import type { z } from 'zod'

import { refundSchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'

/**
 * Issue a full or partial refund. Idempotent: retrying with the same Idempotency-Key returns the
 * original result instead of refunding twice.
 */
export const POST = route<{ id: string }, z.infer<typeof refundSchema>>(
  {
    auth: 'admin',
    permission: 'refunds.issue',
    body: refundSchema,
    idempotency: { scope: 'admin-refund' },
  },
  async ({ params, body, runtime, admin }) =>
    runtime.backend.admin.refundOrder(params.id, body.amountMinor, body.reason, admin!),
)
