import { describe, expect, it } from 'vitest'

import { DomainError } from '@/domain/errors'
import {
  planRelease,
  planReservation,
  planSale,
  projectInventory,
  stockLevel,
  type InventoryEvent,
} from '@/domain/inventory'
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  canTransitionOrder,
  isOpenOrder,
  lineTotal,
  nextFulfilmentStatus,
  transitionOrder,
  type Order,
} from '@/domain/orders'

import { T0 } from './fixtures'

let sequence = 0
function commit(
  events: InventoryEvent[],
  draft: Omit<InventoryEvent, 'id' | 'at' | 'productId'> | null,
): InventoryEvent[] {
  if (!draft) return events
  sequence += 1
  return [
    ...events,
    {
      ...draft,
      id: `event-${String(sequence).padStart(4, '0')}`,
      at: T0 + sequence,
      productId: 'product-1',
    },
  ]
}

const auctionRef = { type: 'AUCTION' as const, id: 'auction-1' }
const orderRef = { type: 'ORDER' as const, id: 'order-1' }

describe('inventory ledger', () => {
  it('reserves, sells and releases stock as a projection of events', () => {
    let events = commit([], {
      type: 'RECEIVED',
      quantity: 5,
      reference: null,
      note: null,
      actor: 'ops',
    })
    events = commit(events, planReservation(events, 1, auctionRef, 'system'))
    events = commit(events, planReservation(events, 2, orderRef, 'system'))
    expect(projectInventory(events)).toEqual({
      onHand: 5,
      reserved: 3,
      available: 2,
      sold: 0,
      damaged: 0,
      returned: 0,
    })

    events = commit(events, planSale(events, 1, auctionRef, 'system'))
    events = commit(events, planRelease(events, orderRef, 'system', 'Payment window expired'))
    expect(projectInventory(events)).toEqual({
      onHand: 4,
      reserved: 0,
      available: 4,
      sold: 1,
      damaged: 0,
      returned: 0,
    })
  })

  it('never oversells: reservations are limited to available stock', () => {
    let events = commit([], {
      type: 'RECEIVED',
      quantity: 1,
      reference: null,
      note: null,
      actor: 'ops',
    })
    events = commit(events, planReservation(events, 1, auctionRef, 'system'))
    expect(() => planReservation(events, 1, orderRef, 'system')).toThrow(
      expect.objectContaining({ code: 'OUT_OF_STOCK' }),
    )
    expect(() => planSale(events, 2, auctionRef, 'system')).toThrow(
      expect.objectContaining({ code: 'CONFLICT' }),
    )
    expect(() => planReservation(events, 0, orderRef, 'system')).toThrow(DomainError)
  })

  it('makes releases idempotent', () => {
    let events = commit([], {
      type: 'RECEIVED',
      quantity: 2,
      reference: null,
      note: null,
      actor: 'ops',
    })
    events = commit(events, planReservation(events, 1, auctionRef, 'system'))
    events = commit(events, planRelease(events, auctionRef, 'system'))
    expect(planRelease(events, auctionRef, 'system')).toBeNull()
  })

  it('tracks damage, returns and restocks and rejects impossible histories', () => {
    let events = commit([], {
      type: 'RECEIVED',
      quantity: 3,
      reference: null,
      note: null,
      actor: 'ops',
    })
    events = commit(events, {
      type: 'DAMAGED',
      quantity: 1,
      reference: null,
      note: 'Crushed box',
      actor: 'ops',
    })
    events = commit(events, {
      type: 'RETURNED',
      quantity: 1,
      reference: orderRef,
      note: null,
      actor: 'ops',
    })
    events = commit(events, {
      type: 'RESTOCKED',
      quantity: 1,
      reference: orderRef,
      note: null,
      actor: 'ops',
    })
    expect(projectInventory(events)).toMatchObject({
      onHand: 3,
      damaged: 1,
      returned: 0,
      available: 3,
    })
    const impossible = commit(events, {
      type: 'DAMAGED',
      quantity: 10,
      reference: null,
      note: null,
      actor: 'ops',
    })
    expect(() => projectInventory(impossible)).toThrow(
      expect.objectContaining({ code: 'CONFLICT' }),
    )
  })

  it('replays the ledger in append order, not by timestamp or id', () => {
    // Replenishment and the reservation it enabled share a millisecond; the reservation's id sorts first.
    const received: InventoryEvent = {
      id: 'zzzz',
      productId: 'product-1',
      type: 'RECEIVED',
      quantity: 10,
      at: T0,
      reference: null,
      note: null,
      actor: 'ops',
    }
    const reserved: InventoryEvent = {
      id: 'aaaa',
      productId: 'product-1',
      type: 'RESERVED',
      quantity: 1,
      at: T0,
      reference: auctionRef,
      note: null,
      actor: 'system',
    }
    expect(projectInventory([received, reserved])).toMatchObject({
      onHand: 10,
      reserved: 1,
      available: 9,
    })
    // A back-dated event (e.g. a payment window that expired while idle) still replays after the stock it released.
    const released: InventoryEvent = {
      ...reserved,
      id: 'mmmm',
      type: 'RESERVATION_RELEASED',
      at: T0 - 1_000,
    }
    expect(projectInventory([received, reserved, released])).toMatchObject({
      reserved: 0,
      available: 10,
    })
  })

  it('labels stock levels', () => {
    expect(stockLevel(0)).toBe('OUT_OF_STOCK')
    expect(stockLevel(5)).toBe('LOW_STOCK')
    expect(stockLevel(6)).toBe('IN_STOCK')
  })
})

describe('order lifecycle', () => {
  const order = (status: Order['status']): Order => ({
    id: 'order-1',
    reference: 'ESB-TEST01',
    userId: 'user-1',
    customerName: 'Test Member',
    source: 'MARKETPLACE',
    status,
    lines: [],
    currency: 'GBP',
    subtotalMinor: 1_000,
    discountMinor: 0,
    shippingMinor: 0,
    taxMinor: 167,
    totalMinor: 1_000,
    promotionCode: null,
    recovery: null,
    shippingAddress: null,
    shippingMethod: 'STANDARD',
    payment: {
      provider: 'demo',
      status: 'PENDING',
      reference: null,
      methodLabel: null,
      paidAt: null,
    },
    auctionId: null,
    dropId: null,
    events: [],
    trackingNumber: null,
    carrier: null,
    paymentDueAt: null,
    exception: null,
    createdAt: T0,
    updatedAt: T0,
    simulated: false,
  })

  it('declares transitions for every status', () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort())
  })

  it('walks the fulfilment flow in order and records each event', () => {
    let current = order('PENDING_PAYMENT')
    const path: string[] = [current.status]
    for (
      let next = nextFulfilmentStatus(current.status);
      next;
      next = nextFulfilmentStatus(current.status)
    ) {
      current = transitionOrder(current, next, T0 + path.length, 'ops')
      path.push(current.status)
    }
    expect(path).toEqual([
      'PENDING_PAYMENT',
      'PAID',
      'PROCESSING',
      'PACKED',
      'SHIPPED',
      'DELIVERED',
    ])
    expect(current.events).toHaveLength(5)
    expect(isOpenOrder(current.status)).toBe(false)
  })

  it('rejects invalid order transitions', () => {
    expect(canTransitionOrder('PENDING_PAYMENT', 'SHIPPED')).toBe(false)
    expect(canTransitionOrder('SHIPPED', 'REFUNDED')).toBe(false)
    expect(canTransitionOrder('DELIVERED', 'REFUNDED')).toBe(true)
    expect(() => transitionOrder(order('CANCELLED'), 'PAID', T0, 'ops')).toThrow(
      expect.objectContaining({ code: 'INVALID_TRANSITION' }),
    )
  })

  it('computes line totals in integer minor units', () => {
    expect(lineTotal(1_999, 3)).toBe(5_997)
    expect(() => lineTotal(1_999, 0)).toThrow(DomainError)
    expect(() => lineTotal(19.99, 1)).toThrow(DomainError)
  })
})
