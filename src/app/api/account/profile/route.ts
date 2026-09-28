import { profileSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

export const PATCH = route(
  { auth: 'customer', body: profileSchema },
  async ({ body, runtime, viewer }) => runtime.backend.updateProfile(viewer!.userId, body),
)
