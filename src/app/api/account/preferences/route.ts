import { preferencesSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

export const PATCH = route(
  { auth: 'customer', body: preferencesSchema },
  async ({ body, runtime, viewer }) => runtime.backend.updatePreferences(viewer!.userId, body),
)
