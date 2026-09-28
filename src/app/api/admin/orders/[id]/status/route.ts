import type { z } from 'zod'

import { orderStatusSchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'

/** Advance an order through fulfilment (or cancel an unpaid order). Refunds use the refund route. */
export const POST = route<{ id: string }, z.infer<typeof orderStatusSchema>>(
  { auth: 'admin', permission: 'orders.manage', body: orderStatusSchema },
  async ({ params, body, runtime, admin }) =>
    runtime.backend.admin.updateOrderStatus(params.id, body.to, body.note ?? null, admin!),
)
