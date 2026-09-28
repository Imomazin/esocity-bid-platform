import type { z } from 'zod'

import { DomainError } from '@/domain/errors'
import { auctionUpdateSchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'

export const GET = route<{ id: string }>(
  { auth: 'admin', permission: 'auctions.view' },
  async ({ params, runtime }) => {
    const detail = await runtime.backend.admin.auctionDetail(params.id)
    if (!detail) throw new DomainError('AUCTION_NOT_FOUND', 'Auction not found.')
    return detail
  },
)

/** Update rules and presentation. Economics-sensitive fields are locked once an auction is live. */
export const PATCH = route<{ id: string }, z.infer<typeof auctionUpdateSchema>>(
  { auth: 'admin', permission: 'auctions.manage', body: auctionUpdateSchema },
  async ({ params, body, runtime, admin }) => {
    const record = await runtime.backend.admin.updateAuction(
      params.id,
      body.rules ?? {},
      { title: body.title, featured: body.featured, description: body.description },
      admin!,
    )
    return { id: record.state.id, status: record.state.status, version: record.state.version }
  },
)
