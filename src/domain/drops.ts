import { tierAtLeast, type RewardTier } from '@/domain/rewards'

/**
 * Flash Drops: fixed-price, limited-stock, timed releases. Unlike auctions there is no bidding —
 * members buy at the drop price while stock and time last, subject to a per-member limit.
 */

export type DropStatus = 'UPCOMING' | 'LIVE' | 'SOLD_OUT' | 'ENDED'

export interface DropEligibility {
  minimumTier: RewardTier | null
  membersOnly: boolean
}

export interface FlashDrop {
  id: string
  slug: string
  productId: string
  title: string
  subtitle: string
  dropPriceMinor: number
  referencePriceMinor: number
  stockTotal: number
  perCustomerLimit: number
  startsAt: number
  endsAt: number
  eligibility: DropEligibility
}

export function dropStatus(
  drop: Pick<FlashDrop, 'startsAt' | 'endsAt' | 'stockTotal'>,
  sold: number,
  now: number,
): DropStatus {
  if (now < drop.startsAt) return 'UPCOMING'
  if (now >= drop.endsAt) return 'ENDED'
  if (sold >= drop.stockTotal) return 'SOLD_OUT'
  return 'LIVE'
}

export interface DropPurchaseContext {
  sold: number
  userPurchased: number
  quantity: number
  tier: RewardTier
  isMember: boolean
  now: number
}

export type DropPurchaseCheck =
  | { ok: true }
  | {
      ok: false
      code:
        | 'DROP_NOT_LIVE'
        | 'DROP_SOLD_OUT'
        | 'PURCHASE_LIMIT_REACHED'
        | 'NOT_ELIGIBLE'
        | 'VALIDATION_FAILED'
      message: string
    }

export function checkDropPurchase(drop: FlashDrop, ctx: DropPurchaseContext): DropPurchaseCheck {
  if (!Number.isSafeInteger(ctx.quantity) || ctx.quantity < 1) {
    return { ok: false, code: 'VALIDATION_FAILED', message: 'Choose a valid quantity.' }
  }
  const status = dropStatus(drop, ctx.sold, ctx.now)
  if (status === 'UPCOMING')
    return { ok: false, code: 'DROP_NOT_LIVE', message: 'This drop has not started yet.' }
  if (status === 'ENDED')
    return { ok: false, code: 'DROP_NOT_LIVE', message: 'This drop has ended.' }
  if (status === 'SOLD_OUT')
    return { ok: false, code: 'DROP_SOLD_OUT', message: 'This drop has sold out.' }
  if (drop.eligibility.membersOnly && !ctx.isMember) {
    return { ok: false, code: 'NOT_ELIGIBLE', message: 'This drop is for Esocity members only.' }
  }
  if (!tierAtLeast(ctx.tier, drop.eligibility.minimumTier)) {
    return {
      ok: false,
      code: 'NOT_ELIGIBLE',
      message: `This drop is reserved for ${drop.eligibility.minimumTier?.toLowerCase()} members and above.`,
    }
  }
  if (ctx.userPurchased + ctx.quantity > drop.perCustomerLimit) {
    return {
      ok: false,
      code: 'PURCHASE_LIMIT_REACHED',
      message: `The limit is ${drop.perCustomerLimit} per member for this drop.`,
    }
  }
  if (ctx.sold + ctx.quantity > drop.stockTotal) {
    return {
      ok: false,
      code: 'DROP_SOLD_OUT',
      message: 'Not enough stock remains for that quantity.',
    }
  }
  return { ok: true }
}
