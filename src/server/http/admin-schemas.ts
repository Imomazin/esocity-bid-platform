import { z } from 'zod'

import { AUCTION_STATUSES } from '@/domain/auction/types'
import { auctionRulesPatchSchema } from '@/domain/auction/rules'
import { ORDER_STATUSES } from '@/domain/orders'
import { TICKET_STATUSES } from '@/domain/support'
import { STAFF_ROLES } from '@/server/auth/roles'
import { AUDIT_ENTITY_TYPES, AUDIT_SEVERITIES } from '@/server/infra/audit'

/** Zod schemas for operator (admin) API routes. */

const reason = z.string().trim().min(3, 'Add a short reason').max(300)

export const auctionListQuerySchema = z.object({
  status: z.enum([...AUCTION_STATUSES, 'ALL']).optional(),
  q: z.string().trim().max(100).optional(),
})

export const auctionUpdateSchema = z.object({
  rules: auctionRulesPatchSchema.optional(),
  title: z.string().trim().min(3).max(120).optional(),
  featured: z.boolean().optional(),
  description: z.string().trim().max(500).nullable().optional(),
})

export const auctionTransitionSchema = z.object({
  to: z.enum(AUCTION_STATUSES),
  reason: z.string().trim().max(300).optional(),
})

export const killSwitchSchema = z.object({ active: z.boolean(), reason })

export const inventoryAdjustSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(-10_000).max(10_000),
  reason,
})

export const orderListQuerySchema = z.object({
  status: z.enum([...ORDER_STATUSES, 'ALL']).optional(),
  source: z.string().max(40).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(1_000).optional(),
})

export const orderStatusSchema = z.object({
  to: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(300).nullable().optional(),
})

export const refundSchema = z.object({
  amountMinor: z.number().int().min(1).max(10_000_000).optional(),
  reason,
})

export const promotionStatusSchema = z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']) })

export const ticketUpdateSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    assignee: z.string().trim().max(80).nullable().optional(),
    reply: z.string().trim().max(2_000).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.assignee !== undefined ||
      (value.reply && value.reply.length > 0),
    {
      message: 'Nothing to update',
    },
  )

export const fraudDecisionSchema = z.object({
  action: z.enum(['CLEAR', 'ALLOW', 'REVIEW', 'THROTTLE', 'BLOCK']),
  note: z.string().trim().min(5, 'Add a short note explaining the decision').max(500),
})

export const demoRoleSchema = z.object({ role: z.enum(STAFF_ROLES as [string, ...string[]]) })

export const walletAdjustSchema = z.object({
  userId: z.string().min(1),
  credits: z.number().int().min(1).max(500),
  reason,
})

export const auditQuerySchema = z.object({
  entityType: z.enum(AUDIT_ENTITY_TYPES).optional(),
  severity: z.enum(AUDIT_SEVERITIES).optional(),
  action: z.string().trim().max(80).optional(),
  actor: z.string().trim().max(80).optional(),
  entityId: z.string().trim().max(100).optional(),
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).optional(),
})
