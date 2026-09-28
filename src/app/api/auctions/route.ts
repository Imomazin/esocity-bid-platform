import { z } from 'zod'

import { route } from '@/server/http/api'

const query = z.object({
  status: z.enum(['live', 'scheduled', 'completed', 'all']).optional(),
  category: z.string().max(40).optional(),
  sort: z.enum(['ending', 'newest', 'price', 'popular', 'value']).optional(),
  q: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const GET = route({ query }, async ({ query: q, runtime, viewer }) => ({
  serverTime: Date.now(),
  auctions: runtime.backend.listAuctions(q, viewer?.userId),
}))
