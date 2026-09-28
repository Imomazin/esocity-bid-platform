import { DomainError } from '@/domain/errors'

export const TICKET_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_CATEGORIES = [
  'auction',
  'payment',
  'wallet',
  'order',
  'delivery',
  'refund',
  'technical',
  'account',
] as const
export type TicketCategory = (typeof TICKET_CATEGORIES)[number]

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export const TICKET_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  OPEN: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_CUSTOMER', 'RESOLVED', 'OPEN'],
  WAITING_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: [],
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_CUSTOMER: 'Waiting on customer',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  auction: 'Auctions & bidding',
  payment: 'Payments',
  wallet: 'Bid Wallet',
  order: 'Orders',
  delivery: 'Delivery',
  refund: 'Refunds & returns',
  technical: 'Technical issue',
  account: 'Account & security',
}

export interface SupportMessage {
  id: string
  author: 'CUSTOMER' | 'AGENT' | 'SYSTEM'
  authorName: string
  body: string
  at: number
}

export interface SupportTicket {
  id: string
  reference: string
  userId: string
  customerName: string
  category: TicketCategory
  subject: string
  status: TicketStatus
  priority: TicketPriority
  assignee: string | null
  relatedReference: string | null
  messages: SupportMessage[]
  createdAt: number
  updatedAt: number
  simulated: boolean
}

export function canTransitionTicket(from: TicketStatus, to: TicketStatus): boolean {
  return TICKET_TRANSITIONS[from].includes(to)
}

export function transitionTicket(
  ticket: SupportTicket,
  to: TicketStatus,
  at: number,
): SupportTicket {
  if (!canTransitionTicket(ticket.status, to)) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `A ticket cannot move from ${TICKET_STATUS_LABELS[ticket.status]} to ${TICKET_STATUS_LABELS[to]}.`,
    )
  }
  return { ...ticket, status: to, updatedAt: at }
}

/** Default priority by category: payment and wallet issues are handled faster. */
export function defaultPriority(category: TicketCategory): TicketPriority {
  if (category === 'payment' || category === 'wallet' || category === 'refund') return 'HIGH'
  if (category === 'technical') return 'NORMAL'
  return 'NORMAL'
}
