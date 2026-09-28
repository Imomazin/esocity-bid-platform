import { DomainError } from '@/domain/errors'
import { route } from '@/server/http/api'

/** Live payload for the auction detail page: snapshot, recent bids and the viewer's state. */
export const GET = route<{ id: string }>({}, async ({ params, runtime, viewer }) => {
  const payload = runtime.backend.liveAuction(params.id, viewer?.userId)
  if (!payload) throw new DomainError('AUCTION_NOT_FOUND', 'Auction not found.')
  return payload
})
