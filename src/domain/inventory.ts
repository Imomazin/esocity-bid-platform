import { DomainError } from '@/domain/errors'

/**
 * Inventory ledger.
 *
 * Stock positions are projections of an append-only event log. Auctions and checkouts reserve
 * stock; a win or a paid order converts the reservation into a sale; cancellations release it.
 *
 *   ON_HAND   physical units held (not yet sold)
 *   RESERVED  units allocated to live auctions, drops or unpaid orders
 *   AVAILABLE ON_HAND − RESERVED (what can still be promised)
 *   SOLD      units sold (left stock)
 *   DAMAGED   units written off as damaged
 *   RETURNED  units returned by customers awaiting inspection/restock
 */

export const INVENTORY_EVENT_TYPES = [
  'RECEIVED',
  'RESERVED',
  'RESERVATION_RELEASED',
  'SOLD',
  'DAMAGED',
  'RETURNED',
  'RESTOCKED',
  'ADJUSTED',
] as const

export type InventoryEventType = (typeof INVENTORY_EVENT_TYPES)[number]

export type InventoryReferenceType = 'AUCTION' | 'ORDER' | 'DROP' | 'PURCHASE_ORDER' | 'MANUAL'

export interface InventoryEvent {
  id: string
  productId: string
  type: InventoryEventType
  /** Positive quantity; ADJUSTED may be negative. */
  quantity: number
  at: number
  reference: { type: InventoryReferenceType; id: string } | null
  note: string | null
  actor: string
}

export interface InventoryPosition {
  onHand: number
  reserved: number
  available: number
  sold: number
  damaged: number
  returned: number
}

export const EMPTY_POSITION: InventoryPosition = {
  onHand: 0,
  reserved: 0,
  available: 0,
  sold: 0,
  damaged: 0,
  returned: 0,
}

function applyEvent(position: InventoryPosition, event: InventoryEvent): InventoryPosition {
  const next = { ...position }
  switch (event.type) {
    case 'RECEIVED':
      next.onHand += event.quantity
      break
    case 'RESERVED':
      next.reserved += event.quantity
      break
    case 'RESERVATION_RELEASED':
      next.reserved -= event.quantity
      break
    case 'SOLD':
      next.reserved -= event.quantity
      next.onHand -= event.quantity
      next.sold += event.quantity
      break
    case 'DAMAGED':
      next.onHand -= event.quantity
      next.damaged += event.quantity
      break
    case 'RETURNED':
      next.returned += event.quantity
      break
    case 'RESTOCKED':
      next.returned -= event.quantity
      next.onHand += event.quantity
      break
    case 'ADJUSTED':
      next.onHand += event.quantity
      break
  }
  next.available = next.onHand - next.reserved
  return next
}

/**
 * Replays events into a position, verifying invariants after every event.
 *
 * Events must be passed in ledger (append) order: that is the order in which each event was
 * validated against the stock available at the time. Timestamps are not a safe replay order —
 * two events can share a millisecond, and back-dated events (e.g. a payment window that expired
 * while the server was idle) would be replayed ahead of stock they depended on.
 */
export function projectInventory(events: readonly InventoryEvent[]): InventoryPosition {
  let position = { ...EMPTY_POSITION }
  for (const event of events) {
    position = applyEvent(position, event)
    if (
      position.reserved < 0 ||
      position.onHand < 0 ||
      position.available < 0 ||
      position.returned < 0
    ) {
      throw new DomainError(
        'CONFLICT',
        `Inventory invariant violated by event ${event.id} (${event.type})`,
      )
    }
  }
  return position
}

/** Quantity currently reserved against a given reference (auction, order or drop). */
export function reservedFor(events: readonly InventoryEvent[], referenceId: string): number {
  return events
    .filter((event) => event.reference?.id === referenceId)
    .reduce((total, event) => {
      if (event.type === 'RESERVED') return total + event.quantity
      if (event.type === 'RESERVATION_RELEASED' || event.type === 'SOLD')
        return total - event.quantity
      return total
    }, 0)
}

type EventDraft = Omit<InventoryEvent, 'id' | 'at' | 'productId'>

function validateQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new DomainError('VALIDATION_FAILED', 'Quantity must be a positive integer')
  }
}

export function planReservation(
  events: readonly InventoryEvent[],
  quantity: number,
  reference: NonNullable<InventoryEvent['reference']>,
  actor: string,
): EventDraft {
  validateQuantity(quantity)
  const position = projectInventory(events)
  if (position.available < quantity) {
    throw new DomainError('OUT_OF_STOCK', 'This item is currently unavailable.', {
      available: position.available,
      requested: quantity,
    })
  }
  return { type: 'RESERVED', quantity, reference, note: null, actor }
}

/** Releases whatever is still reserved for the reference (idempotent: returns null if nothing to release). */
export function planRelease(
  events: readonly InventoryEvent[],
  reference: NonNullable<InventoryEvent['reference']>,
  actor: string,
  note: string | null = null,
): EventDraft | null {
  const reserved = reservedFor(events, reference.id)
  if (reserved <= 0) return null
  return { type: 'RESERVATION_RELEASED', quantity: reserved, reference, note, actor }
}

/** Converts the reservation for the reference into a sale. */
export function planSale(
  events: readonly InventoryEvent[],
  quantity: number,
  reference: NonNullable<InventoryEvent['reference']>,
  actor: string,
): EventDraft {
  validateQuantity(quantity)
  const reserved = reservedFor(events, reference.id)
  if (reserved < quantity) {
    throw new DomainError(
      'CONFLICT',
      'Cannot sell more units than are reserved for this reference',
      {
        reserved,
        quantity,
      },
    )
  }
  return { type: 'SOLD', quantity, reference, note: null, actor }
}

export type StockLevel = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export function stockLevel(available: number, lowThreshold = 5): StockLevel {
  if (available <= 0) return 'OUT_OF_STOCK'
  if (available <= lowThreshold) return 'LOW_STOCK'
  return 'IN_STOCK'
}

export const STOCK_LABELS: Record<StockLevel, string> = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
}
