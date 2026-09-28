import { route } from '@/server/http/api'

export const DELETE = route<{ id: string }>(
  { auth: 'customer' },
  async ({ params, runtime, viewer }) => runtime.backend.cancelAutoBid(viewer!.userId, params.id),
)
