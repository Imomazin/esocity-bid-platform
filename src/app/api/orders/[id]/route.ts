import { DomainError } from '@/domain/errors'
import { route } from '@/server/http/api'

export const GET = route<{ id: string }>(
  { auth: 'customer' },
  async ({ params, runtime, viewer }) => {
    const order = runtime.backend.order(viewer!.userId, params.id)
    if (!order) throw new DomainError('ORDER_NOT_FOUND', 'Order not found.')
    return order
  },
)
