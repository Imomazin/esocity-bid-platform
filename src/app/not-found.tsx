import type { Metadata } from 'next'
import Link from 'next/link'

import { Logo } from '@/components/brand/logo'
import { NotFoundContent } from '@/components/common/not-found-content'

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } }

/** Fallback for URLs that match no route (rendered inside the root layout only). */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
          <Link href="/" aria-label="Esocity Bid home">
            <Logo />
          </Link>
        </div>
      </header>
      <main id="main" className="flex flex-1 items-center justify-center">
        <NotFoundContent />
      </main>
    </div>
  )
}
