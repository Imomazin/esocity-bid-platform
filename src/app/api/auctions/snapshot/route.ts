import { z } from 'zod'

import { route } from '@/server/http/api'

/** Batch snapshot endpoint used by the demo realtime transport (polling). */
export const GET = route(
  {
    query: z.object({
      ids: z
        .string()
        .max(2_000)
        .transform((value) => value.split(',').filter(Boolean).slice(0, 60)),
    }),
  },
  async ({ query, runtime, viewer }) => runtime.backend.snapshots(query.ids, viewer?.userId),
)
