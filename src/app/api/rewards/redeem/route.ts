import { z } from 'zod'

import { route } from '@/server/http/api'

export const POST = route(
  {
    auth: 'customer',
    body: z.object({ optionId: z.enum(['BIDS_10', 'BIDS_25', 'VOUCHER_5']) }),
    idempotency: { scope: 'reward-redeem' },
  },
  async ({ body, runtime, viewer }) => runtime.backend.redeem(viewer!.userId, body.optionId),
)
