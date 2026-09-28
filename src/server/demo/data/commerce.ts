import type { Promotion } from '@/domain/promotions'
import type { BidPackage } from '@/domain/wallet'
import { deterministicUuid } from '@/lib/rng'
import { DAY } from '@/lib/time'

/** Demo bid packs. Payment is simulated via DemoPaymentProvider. */
export const BID_PACKAGES: BidPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 50,
    bonusCredits: 0,
    priceMinor: 1_250,
    currency: 'GBP',
    badge: null,
    description: 'Try a few auctions and get a feel for live bidding.',
    active: true,
  },
  {
    id: 'popular',
    name: 'Popular',
    credits: 150,
    bonusCredits: 10,
    priceMinor: 3_300,
    currency: 'GBP',
    badge: 'Most popular',
    description: 'Enough for several auctions, with 10 bonus bids.',
    active: true,
  },
  {
    id: 'power',
    name: 'Power',
    credits: 400,
    bonusCredits: 50,
    priceMinor: 8_000,
    currency: 'GBP',
    badge: null,
    description: 'For regular bidders who follow multiple auctions.',
    active: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 1_000,
    bonusCredits: 150,
    priceMinor: 18_000,
    currency: 'GBP',
    badge: null,
    description: 'Lowest price per bid. Consider your budget and limits first.',
    active: true,
  },
]

/**
 * Value attributed to one purchased bid credit for recovery price credits and economics
 * estimates (approximately the blended pack price per credit).
 */
export const CREDIT_VALUE_MINOR = 20

export const BONUS_CREDIT_VALIDITY_DAYS = 90

export function buildPromotions(anchorDay: number): Promotion[] {
  const base = {
    usageCount: 0,
    perUserLimit: null,
    minimumSpendMinor: null,
    maximumDiscountMinor: null,
    status: 'ACTIVE' as const,
    createdAt: anchorDay - 40 * DAY,
    eligibility: { newCustomersOnly: false, minimumTier: null, categories: null, bidPackIds: null },
  }
  const promo = (
    code: string,
    rest: Partial<Promotion> &
      Pick<Promotion, 'name' | 'description' | 'type' | 'value' | 'valueKind'>,
  ): Promotion => ({
    ...base,
    id: deterministicUuid('promotion', code),
    code,
    startsAt: anchorDay - 30 * DAY,
    endsAt: anchorDay + 60 * DAY,
    usageLimit: null,
    ...rest,
    eligibility: { ...base.eligibility, ...(rest.eligibility ?? {}) },
  })
  return [
    promo('WELCOME10', {
      name: 'Welcome 10%',
      description: '10% off your first marketplace order (max £30).',
      type: 'NEW_CUSTOMER',
      value: 1_000,
      valueKind: 'PERCENT',
      minimumSpendMinor: 2_000,
      maximumDiscountMinor: 3_000,
      perUserLimit: 1,
      usageLimit: 10_000,
      usageCount: 4_128,
      eligibility: {
        newCustomersOnly: true,
        minimumTier: null,
        categories: null,
        bidPackIds: null,
      },
    }),
    promo('FREESHIP', {
      name: 'Free delivery',
      description: 'Free standard delivery on orders over £30.',
      type: 'FREE_SHIPPING',
      value: 0,
      valueKind: 'NONE',
      minimumSpendMinor: 3_000,
      usageCount: 1_904,
    }),
    promo('SAVE5', {
      name: '£5 off £40',
      description: '£5 off marketplace orders of £40 or more.',
      type: 'FIXED_DISCOUNT',
      value: 500,
      valueKind: 'FIXED',
      minimumSpendMinor: 4_000,
      perUserLimit: 2,
      usageLimit: 5_000,
      usageCount: 2_311,
    }),
    promo('KITCHEN15', {
      name: 'Kitchen 15%',
      description: '15% off kitchen appliances (max £60).',
      type: 'CATEGORY_OFFER',
      value: 1_500,
      valueKind: 'PERCENT',
      maximumDiscountMinor: 6_000,
      usageCount: 612,
      eligibility: {
        newCustomersOnly: false,
        minimumTier: null,
        categories: ['kitchen'],
        bidPackIds: null,
      },
    }),
    promo('BIDS20', {
      name: '+20 bonus bids',
      description: '20 bonus bids with the Power or Pro pack (once per member).',
      type: 'BONUS_BID_CREDITS',
      value: 20,
      valueKind: 'CREDITS',
      perUserLimit: 1,
      usageCount: 845,
      eligibility: {
        newCustomersOnly: false,
        minimumTier: null,
        categories: null,
        bidPackIds: ['power', 'pro'],
      },
    }),
    promo('PACK10', {
      name: 'Silver pack saver',
      description: '10% off bid packs for Silver members and above.',
      type: 'BID_PACK_DISCOUNT',
      value: 1_000,
      valueKind: 'PERCENT',
      perUserLimit: 3,
      usageCount: 377,
      eligibility: {
        newCustomersOnly: false,
        minimumTier: 'SILVER',
        categories: null,
        bidPackIds: null,
      },
    }),
    promo('GOLDONLY', {
      name: 'Gold members 12%',
      description: '12% off marketplace orders for Gold members.',
      type: 'PERCENT_DISCOUNT',
      value: 1_200,
      valueKind: 'PERCENT',
      usageCount: 129,
      eligibility: {
        newCustomersOnly: false,
        minimumTier: 'GOLD',
        categories: null,
        bidPackIds: null,
      },
    }),
    promo('SUMMER20', {
      name: 'Summer 20%',
      description: 'Seasonal campaign (ended).',
      type: 'PERCENT_DISCOUNT',
      value: 2_000,
      valueKind: 'PERCENT',
      startsAt: anchorDay - 120 * DAY,
      endsAt: anchorDay - 25 * DAY,
      usageCount: 6_540,
    }),
  ]
}

export interface Faq {
  id: string
  category: 'bidding' | 'wallet' | 'orders' | 'account' | 'drops' | 'rewards'
  question: string
  answer: string
}

export const FAQS: Faq[] = [
  {
    id: 'what-is-a-bid-credit',
    category: 'bidding',
    question: 'What is a bid credit?',
    answer:
      'A bid credit is what you spend to place one bid in a live auction. Credits are bought in bid packs or received as promotional credits. They are not money, cannot be withdrawn, and each auction shows exactly how many credits a bid costs.',
  },
  {
    id: 'how-price-moves',
    category: 'bidding',
    question: 'How does bidding change the auction price?',
    answer:
      'Every accepted bid raises the auction price by the auction’s fixed increment (for example £0.05) and makes you the leading bidder. The increment and bid cost are shown on every auction before you bid.',
  },
  {
    id: 'timer-extension',
    category: 'bidding',
    question: 'Why does the countdown go back up?',
    answer:
      'Each bid guarantees a minimum amount of time remains (for example 15 seconds), so everyone has a fair chance to respond. Some auctions also have a hard stop that the clock can never pass.',
  },
  {
    id: 'who-wins',
    category: 'bidding',
    question: 'How is the winner decided?',
    answer:
      'Our servers decide. When the authoritative countdown reaches zero, the leading bidder at that moment wins. Your browser only displays the countdown; it never decides the result.',
  },
  {
    id: 'what-winner-pays',
    category: 'bidding',
    question: 'What does the winner pay?',
    answer:
      'The winner pays the final auction price plus delivery, within the payment window shown on the auction. The bid credits they used are not refunded. Every completed auction shows the winner’s bids used, so the total cost is transparent.',
  },
  {
    id: 'buy-now-recovery',
    category: 'bidding',
    question: 'What happens to my bids if I don’t win?',
    answer:
      'Bids used in an auction you do not win are spent. Where an auction offers Bid Credit Recovery, you can buy the item at its Buy Now price within the recovery window and eligible bids are returned or credited against the price, as shown on the auction.',
  },
  {
    id: 'cancelled-auction',
    category: 'bidding',
    question: 'What if an auction is cancelled?',
    answer:
      'If we cancel an auction, or it closes without meeting its minimum bidders or reserve, every bid credit used in it is refunded to the original bidders automatically.',
  },
  {
    id: 'autobid',
    category: 'bidding',
    question: 'How does AutoBid work?',
    answer:
      'AutoBid places bids for you on our servers in the final seconds whenever you are not leading, up to the maximum bids (and optional maximum price) you set. You can cancel it at any time and it respects your responsible-use limits.',
  },
  {
    id: 'credits-expire',
    category: 'wallet',
    question: 'Do bid credits expire?',
    answer:
      'Purchased bid credits do not expire. Promotional and bonus credits expire on the date shown in your Bid Wallet, and they are always used before purchased credits.',
  },
  {
    id: 'limits',
    category: 'account',
    question: 'How do I set a spending or bidding limit?',
    answer:
      'Go to Account → Responsible use. Lowering a limit or starting a break takes effect immediately. Raising or removing a limit takes effect after 24 hours.',
  },
  {
    id: 'delivery-times',
    category: 'orders',
    question: 'How long does delivery take?',
    answer:
      'Standard delivery takes 3–5 working days (free over £50), Express 1–2 working days and Next-day is available for orders placed by 8pm. Large items may carry a two-person delivery surcharge.',
  },
  {
    id: 'returns',
    category: 'orders',
    question: 'Can I return an item?',
    answer:
      'Marketplace and Flash Drop purchases can be returned within 30 days in original condition. Your statutory rights are not affected. Auction wins are covered by the manufacturer warranty.',
  },
  {
    id: 'flash-drops',
    category: 'drops',
    question: 'What is a Flash Drop?',
    answer:
      'Flash Drops are limited-stock releases at a fixed price for a short time. There is no bidding: buy while stock lasts, subject to a per-member limit.',
  },
  {
    id: 'rewards-earning',
    category: 'rewards',
    question: 'How do I earn Esocity Rewards points?',
    answer:
      'You earn points on product purchases (1 point per £1, boosted by your tier) and by unlocking achievements. Buying bid packs does not earn points.',
  },
  {
    id: 'demo-mode',
    category: 'account',
    question: 'Is this demo real?',
    answer:
      'No money changes hands in this demonstration. Products, brands, bidders, payments and deliveries are simulated so you can explore how Esocity Bid works.',
  },
]
