import { z } from 'zod'

import { route } from '@/server/http/api'

export const GET = route(
  {
    auth: 'customer',
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    }),
  },
  async ({ runtime, viewer, query }) => {
    const entries = runtime.backend.wallet(viewer!.userId).entries
    return {
      entries: entries.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
      total: entries.length,
      page: query.page,
      pageSize: query.pageSize,
    }
  },
)
