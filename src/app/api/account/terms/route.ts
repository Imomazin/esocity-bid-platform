import { z } from 'zod'

import { route } from '@/server/http/api'

const acceptTermsSchema = z.object({ version: z.string().trim().min(1).max(40) })

/** The member's terms status for their market. */
export const GET = route({ auth: 'customer' }, async ({ runtime, viewer }) =>
  runtime.backend.termsStatus(viewer!.userId),
)

/** Accept the current terms version (only the version currently in force can be accepted). */
export const POST = route(
  { auth: 'customer', body: acceptTermsSchema },
  async ({ body, runtime, viewer, requestId }) =>
    runtime.backend.acceptTerms(viewer!.userId, body.version, requestId),
)
