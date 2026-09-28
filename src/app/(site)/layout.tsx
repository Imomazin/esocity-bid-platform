import type * as React from 'react'

import { DemoBanner } from '@/components/layout/demo-banner'
import { MobileTabBar } from '@/components/layout/mobile-nav'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { isDemoMode } from '@/lib/config/env'
import { getViewer } from '@/server/auth/session'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer()
  return (
    <div className="flex min-h-dvh flex-col">
      {isDemoMode() ? <DemoBanner /> : null}
      <SiteHeader />
      <main id="main" className="flex-1 pb-16 lg:pb-0">
        {children}
      </main>
      <SiteFooter />
      <MobileTabBar signedIn={!!viewer} />
    </div>
  )
}
