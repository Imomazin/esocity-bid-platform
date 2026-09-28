import { SettingsIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { SignInGate } from '@/components/auth/sign-in-gate'
import { Container, PageHeader } from '@/components/common/section'
import { NotificationList } from '@/components/notifications/notification-list'
import { Button } from '@/components/ui/button'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } }

export default async function NotificationsPage() {
  const viewer = await getViewer()
  if (!viewer)
    return (
      <SignInGate
        title="Notifications"
        description="Enter the demo to receive auction, order and account updates."
        redirectTo="/notifications"
      />
    )
  const backend = getBackend()
  const notifications = backend.notifications(viewer.userId)
  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Outbid alerts, wins, order updates and account messages. Responsible-use alerts are always delivered."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/settings#notifications">
              <SettingsIcon /> Preferences
            </Link>
          </Button>
        }
      />
      <NotificationList initial={notifications} now={backend.now()} />
    </Container>
  )
}
