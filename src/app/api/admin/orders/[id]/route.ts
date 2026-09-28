import { DomainError } from '@/domain/errors'
import { route } from '@/server/http/api'

export const GET = route<{ id: string }>(
  { auth: 'admin', permission: 'orders.view' },
  async ({ params, runtime }) => {
    const order = runtime.backend.admin.order(params.id)
    if (!order) throw new DomainError('ORDER_NOT_FOUND', 'Order not found.')
    return order
  },
)
