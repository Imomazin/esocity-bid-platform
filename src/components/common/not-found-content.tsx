import { CompassIcon } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export function NotFoundContent() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-soft-foreground">
        <CompassIcon className="size-7" aria-hidden />
      </span>
      <p className="tabular mt-6 text-sm font-semibold text-brand">404</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">We couldn’t find that page</h1>
      <p className="mt-3 text-muted-foreground">
        The page may have moved, or the auction or order may no longer be available. Try one of
        these instead.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="brand">
          <Link href="/auctions">Explore Auctions</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/marketplace">Enter Marketplace</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/support">Help centre</Link>
        </Button>
      </div>
    </div>
  )
}
