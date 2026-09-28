import { supportTicketSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

export const GET = route({ auth: 'customer' }, async ({ runtime, viewer }) =>
  runtime.backend.tickets(viewer!.userId),
)

export const POST = route(
  { auth: 'customer', rateLimit: 'supportTicket', body: supportTicketSchema },
  async ({ body, runtime, viewer, requestId }) =>
    runtime.backend.createTicket(
      viewer!.userId,
      {
        category: body.category,
        subject: body.subject,
        message: body.message,
        relatedReference: body.relatedReference,
      },
      requestId,
    ),
)
