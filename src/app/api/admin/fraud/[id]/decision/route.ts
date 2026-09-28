import type { z } from 'zod'

import { fraudDecisionSchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'

/**
 * Record an analyst's decision on a risk case. Automated signals never block an account on
 * their own; blocking requires the `fraud.block` permission and a written note.
 */
export const POST = route<{ id: string }, z.infer<typeof fraudDecisionSchema>>(
  { auth: 'admin', permission: 'fraud.decide', body: fraudDecisionSchema },
  async ({ params, body, runtime, admin }) =>
    runtime.backend.admin.decideFraud(params.id, body.action, body.note, admin!),
)
