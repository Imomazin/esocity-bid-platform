import type { z } from 'zod'

import { auctionTransitionSchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'

/**
 * Move an auction through its state machine (schedule, pause, resume, cancel…). Invalid
 * transitions are rejected by the domain state machine; cancelling refunds member bids.
 */
export const POST = route<{ id: string }, z.infer<typeof auctionTransitionSchema>>(
  { auth: 'admin', permission: 'auctions.manage', body: auctionTransitionSchema },
  async ({ params, body, runtime, admin }) => {
    const record = await runtime.backend.admin.transitionAuction(
      params.id,
      body.to,
      body.reason,
      admin!,
    )
    return { id: record.state.id, status: record.state.status }
  },
)
