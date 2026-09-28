import { DomainError } from '@/domain/errors'
import type { ShippingClass } from '@/domain/catalog'
import type { RecoveryMode } from '@/domain/auction/types'

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export type OrderSource = 'AUCTION_WIN' | 'MARKETPLACE' | 'FLASH_DROP' | 'AUCTION_BUY_NOW'

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'REFUNDED'],
  PROCESSING: ['PACKED', 'REFUNDED'],
  PACKED: ['SHIPPED', 'REFUNDED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
}

/** Statuses that make up the happy-path fulfilment timeline, in order. */
export const FULFILMENT_FLOW: readonly OrderStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Paid',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  AUCTION_WIN: 'Auction win',
  MARKETPLACE: 'Marketplace',
  FLASH_DROP: 'Flash Drop',
  AUCTION_BUY_NOW: 'Buy Now (auction)',
}

export interface OrderLine {
  productId: string
  productSlug: string
  name: string
  brandName: string
  quantity: number
  unitPriceMinor: number
  lineTotalMinor: number
  shippingClass: ShippingClass
}

export interface OrderEvent {
  status: OrderStatus
  at: number
  note: string | null
  actor: string
}

export interface Address {
  id: string
  label: string
  fullName: string
  line1: string
  line2: string | null
  city: string
  postcode: string
  country: string
  phone: string | null
  isDefault: boolean
}

export interface PaymentSummary {
  provider: string
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
  reference: string | null
  methodLabel: string | null
  paidAt: number | null
}

export interface Order {
  id: string
  reference: string
  userId: string
  customerName: string
  source: OrderSource
  status: OrderStatus
  lines: OrderLine[]
  currency: 'GBP'
  subtotalMinor: number
  discountMinor: number
  shippingMinor: number
  /** Tax included in the total (UK VAT) or added on top (tax-exclusive markets). */
  taxMinor: number
  totalMinor: number
  promotionCode: string | null
  recovery: { mode: RecoveryMode; credits: number; valueMinor: number } | null
  shippingAddress: Address | null
  shippingMethod: string
  payment: PaymentSummary
  auctionId: string | null
  dropId: string | null
  events: OrderEvent[]
  trackingNumber: string | null
  carrier: string | null
  paymentDueAt: number | null
  exception: { code: string; message: string } | null
  createdAt: number
  updatedAt: number
  simulated: boolean
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to)
}

export function transitionOrder(
  order: Order,
  to: OrderStatus,
  at: number,
  actor: string,
  note: string | null = null,
): Order {
  if (!canTransitionOrder(order.status, to)) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `An order cannot move from ${ORDER_STATUS_LABELS[order.status]} to ${ORDER_STATUS_LABELS[to]}.`,
      {
        from: order.status,
        to,
      },
    )
  }
  return {
    ...order,
    status: to,
    updatedAt: at,
    events: [...order.events, { status: to, at, note, actor }],
  }
}

export function nextFulfilmentStatus(status: OrderStatus): OrderStatus | null {
  const index = FULFILMENT_FLOW.indexOf(status)
  if (index === -1 || index === FULFILMENT_FLOW.length - 1) return null
  return FULFILMENT_FLOW[index + 1] ?? null
}

export function isOpenOrder(status: OrderStatus): boolean {
  return status !== 'DELIVERED' && status !== 'CANCELLED' && status !== 'REFUNDED'
}

export function lineTotal(unitPriceMinor: number, quantity: number): number {
  if (!Number.isSafeInteger(unitPriceMinor) || !Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid order line')
  }
  return unitPriceMinor * quantity
}
