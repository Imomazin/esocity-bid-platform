import { savingsBasisPoints, money } from '@/lib/money'

/**
 * Transparent auction economics for operators.
 *
 * All figures are ESTIMATES built from the data available to the platform. They deliberately do
 * not claim profit: shipping, payment processing fees, promotional credit cost, returns and
 * overheads are excluded and flagged.
 */

export interface AuctionEconomicsInput {
  referencePriceMinor: number
  finalPriceMinor: number
  winnerPaid: boolean
  bidCount: number
  uniqueBidders: number
  purchasedCreditsUsed: number
  promotionalCreditsUsed: number
  /** Average revenue per purchased bid credit (from bid pack sales), minor units. */
  revenuePerPurchasedCreditMinor: number
  buyNowConversions: number
  buyNowRevenueMinor: number
  /** Value of bid credits returned or credited through recovery. */
  recoveredCreditValueMinor: number
  unitCostMinor: number
  startedAt: number
  closedAt: number
  winnerBidCount: number
  bidCreditCost: number
}

export interface AuctionEconomics {
  bidCreditRevenueEstimateMinor: number
  winnerPaymentMinor: number
  buyNowRevenueMinor: number
  grossRevenueEstimateMinor: number
  productCostMinor: number
  grossContributionEstimateMinor: number
  averageBidsPerBidder: number
  timeToCloseMs: number
  winnerTotalCostMinor: number
  winnerSavingsBps: number
  exclusions: string[]
}

export function computeAuctionEconomics(input: AuctionEconomicsInput): AuctionEconomics {
  const bidCreditRevenueEstimateMinor =
    input.purchasedCreditsUsed * input.revenuePerPurchasedCreditMinor
  const winnerPaymentMinor = input.winnerPaid ? input.finalPriceMinor : 0
  const grossRevenueEstimateMinor =
    bidCreditRevenueEstimateMinor +
    winnerPaymentMinor +
    input.buyNowRevenueMinor -
    input.recoveredCreditValueMinor
  const unitsShipped = (input.winnerPaid ? 1 : 0) + input.buyNowConversions
  const productCostMinor = unitsShipped * input.unitCostMinor
  const winnerTotalCostMinor =
    input.finalPriceMinor +
    input.winnerBidCount * input.bidCreditCost * input.revenuePerPurchasedCreditMinor
  return {
    bidCreditRevenueEstimateMinor,
    winnerPaymentMinor,
    buyNowRevenueMinor: input.buyNowRevenueMinor,
    grossRevenueEstimateMinor,
    productCostMinor,
    grossContributionEstimateMinor: grossRevenueEstimateMinor - productCostMinor,
    averageBidsPerBidder: input.uniqueBidders === 0 ? 0 : input.bidCount / input.uniqueBidders,
    timeToCloseMs: Math.max(0, input.closedAt - input.startedAt),
    winnerTotalCostMinor,
    winnerSavingsBps: savingsBasisPoints(
      money(input.referencePriceMinor),
      money(winnerTotalCostMinor),
    ),
    exclusions: [
      'Shipping and fulfilment costs',
      'Payment processing fees',
      'Cost of promotional (free) bid credits',
      'Returns, chargebacks and overheads',
    ],
  }
}
