import type { z } from 'zod'

import { promotionStatusSchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'

export const PATCH = route<{ id: string }, z.infer<typeof promotionStatusSchema>>(
  { auth: 'admin', permission: 'promotions.manage', body: promotionStatusSchema },
  async ({ params, body, runtime, admin }) =>
    runtime.backend.admin.setPromotionStatus(params.id, body.status, admin!),
)
