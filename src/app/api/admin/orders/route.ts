import { orderListQuerySchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'

export const GET = route(
  { auth: 'admin', permission: 'orders.view', query: orderListQuerySchema },
  async ({ query, runtime }) =>
    runtime.backend.admin.orders({
      status: query.status,
      source: query.source,
      q: query.q,
      page: query.page,
    }),
)
