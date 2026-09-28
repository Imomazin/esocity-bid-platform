import { z } from 'zod'

import { route } from '@/server/http/api'

export const GET = route(
  { query: z.object({ q: z.string().max(80).default('') }) },
  async ({ query, runtime }) => runtime.backend.searchSuggestions(query.q),
)
