import { route } from '@/server/http/api'

export const GET = route({ auth: 'admin', permission: 'analytics.view' }, async ({ runtime }) =>
  runtime.backend.admin.dashboard(),
)
