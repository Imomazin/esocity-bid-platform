import { DomainError } from '@/domain/errors'
import { route } from '@/server/http/api'

export const GET = route<{ id: string }>({}, async ({ params, runtime, viewer }) => {
  const auction = runtime.backend.auctionDetail(params.id, viewer?.userId)
  if (!auction) throw new DomainError('AUCTION_NOT_FOUND', 'Auction not found.')
  return auction
})
