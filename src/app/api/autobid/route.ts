import { autoBidSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

export const GET = route(
  { auth: 'customer' },
  async ({ runtime, viewer }) => runtime.backend.wallet(viewer!.userId).autobids,
)

/** Configure a server-side AutoBid agent. The browser never places automated bids. */
export const POST = route(
  { auth: 'customer', rateLimit: 'autobid', body: autoBidSchema },
  async ({ body, runtime, viewer }) =>
    runtime.backend.setAutoBid(viewer!.userId, body.auctionId, {
      maxBids: body.maxBids,
      maxPriceMinor: body.maxPriceMinor,
    }),
)
