import { z } from 'zod'

import { TICKET_CATEGORIES } from '@/domain/support'

/** Shared Zod schemas for API input validation. */

export const idParam = z.string().trim().min(1).max(100)

export const paymentMethodSchema = z.enum(['DEMO_CARD', 'DEMO_WALLET', 'DEMO_DECLINE'])

export const checkoutModeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CART') }),
  z.object({ kind: z.literal('ORDER'), orderId: idParam }),
  z.object({ kind: z.literal('AUCTION_BUY_NOW'), auctionId: idParam }),
  z.object({ kind: z.literal('DROP'), dropId: idParam, quantity: z.number().int().min(1).max(10) }),
])

export const checkoutPreviewSchema = z.object({
  mode: checkoutModeSchema,
  promoCode: z.string().trim().max(32).optional().nullable(),
  shippingMethodId: z.enum(['STANDARD', 'EXPRESS', 'NEXT_DAY']).optional(),
})

export const checkoutSchema = checkoutPreviewSchema.extend({
  addressId: idParam.optional().nullable(),
  paymentMethod: paymentMethodSchema,
})

export const cartItemSchema = z.object({
  productId: idParam,
  quantity: z.number().int().min(1).max(10).default(1),
})

export const cartUpdateSchema = z.object({ quantity: z.number().int().min(0).max(10) })

export const bidPackPurchaseSchema = z.object({
  promoCode: z.string().trim().max(32).optional().nullable(),
  paymentMethod: paymentMethodSchema.default('DEMO_CARD'),
})

export const autoBidSchema = z.object({
  auctionId: idParam,
  maxBids: z.number().int().min(1).max(500),
  maxPriceMinor: z.number().int().min(0).max(100_000_000).nullable().default(null),
})

export const watchSchema = z.object({
  type: z.enum(['AUCTION', 'PRODUCT', 'DROP']),
  targetId: idParam,
  watch: z.boolean().optional(),
})

export const supportTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  subject: z.string().trim().min(5, 'Please add a short subject').max(120),
  message: z
    .string()
    .trim()
    .min(20, 'Please describe the issue in at least 20 characters')
    .max(2_000),
  relatedReference: z.string().trim().max(40).optional().nullable(),
})

export const limitsSchema = z.object({
  dailyBidLimit: z.number().int().min(1).max(5_000).nullable().optional(),
  weeklyBidLimit: z.number().int().min(1).max(20_000).nullable().optional(),
  monthlyBidPurchaseBudgetMinor: z.number().int().min(100).max(10_000_000).nullable().optional(),
  coolOffDays: z
    .union([z.literal(1), z.literal(7), z.literal(30)])
    .nullable()
    .optional(),
  spendingNotifications: z.boolean().optional(),
  bidUseNotifications: z.boolean().optional(),
})

export const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s()-]*$/, 'Use digits, spaces and + only'),
  marketingOptIn: z.boolean(),
})

export const preferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).optional(),
  interests: z.array(z.string().max(40)).max(12).optional(),
})

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(30),
  fullName: z.string().trim().min(2).max(80),
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(2).max(60),
  postcode: z
    .string()
    .trim()
    .max(10)
    .regex(/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/, 'Enter a valid UK postcode'),
  phone: z.string().trim().max(30).optional().nullable(),
  makeDefault: z.boolean().optional(),
})

export const notificationPrefsSchema = z.object({
  channels: z.object({
    IN_APP: z.boolean(),
    EMAIL: z.boolean(),
    PUSH: z.boolean(),
    SMS: z.boolean(),
  }),
  types: z.record(z.string(), z.boolean()),
})

export const promoValidateSchema = z.object({
  code: z.string().trim().min(2).max(32),
  context: z.enum(['CHECKOUT', 'BID_PACK']).default('CHECKOUT'),
  packageId: z.string().optional(),
})
