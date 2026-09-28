import type { NotificationPreferences } from '@/domain/notifications'
import { notificationPrefsSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

export const PUT = route(
  { auth: 'customer', body: notificationPrefsSchema },
  async ({ body, runtime, viewer }) =>
    runtime.backend.updateNotificationPreferences(viewer!.userId, body as NotificationPreferences),
)
