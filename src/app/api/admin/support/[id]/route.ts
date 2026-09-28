import type { z } from 'zod'

import { ticketUpdateSchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'

export const PATCH = route<{ id: string }, z.infer<typeof ticketUpdateSchema>>(
  { auth: 'admin', permission: 'support.manage', body: ticketUpdateSchema },
  async ({ params, body, runtime, admin }) =>
    runtime.backend.admin.updateTicket(params.id, body, admin!),
)
