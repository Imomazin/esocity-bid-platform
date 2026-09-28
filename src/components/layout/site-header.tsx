import { GavelIcon } from 'lucide-react'
import Link from 'next/link'

import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

import { EnterDemoButton } from './enter-demo-button'
import { HeaderSearch } from './header-search'
import { MobileMenu } from './mobile-nav'
import { PrimaryNav } from './primary-nav'
import { ThemeToggle } from './theme-toggle'
import { ViewerControls } from './viewer-controls'

export async function SiteHeader() {
  const viewer = await getViewer()
  const backend = getBackend()
  const summary = viewer ? backend.viewerSummary(viewer.userId) : null
  const liveCount = backend.liveCount()
  return (
    <header className="sticky top-0 z-40 border-b bg-background/88 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Esocity Bid home"
        >
          <Logo className="hidden sm:inline-flex" />
          <Logo compact className="sm:hidden" />
        </Link>
        <PrimaryNav liveCount={liveCount} />
        <div className="ml-auto hidden max-w-sm flex-1 md:block">
          <HeaderSearch />
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          <ThemeToggle />
          {summary ? (
            <ViewerControls summary={summary} />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/how-it-works">
                  <GavelIcon />
                  How it works
                </Link>
              </Button>
              <EnterDemoButton size="sm" />
            </>
          )}
          <MobileMenu signedIn={!!summary} />
        </div>
      </div>
    </header>
  )
}
