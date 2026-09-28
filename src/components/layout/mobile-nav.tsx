'use client'

import {
  CompassIcon,
  GavelIcon,
  HomeIcon,
  MenuIcon,
  SparklesIcon,
  StoreIcon,
  UserIcon,
  ZapIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { primaryNav, secondaryNav } from '@/lib/config/site'
import { cn } from '@/lib/utils'

import { HeaderSearch } from './header-search'
import { isActivePath } from './primary-nav'

export function MobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open menu">
          <MenuIcon />
        </Button>
      </DialogTrigger>
      <DialogContent side="right" className="gap-6 p-5">
        <div>
          <DialogTitle>Menu</DialogTitle>
          <DialogDescription className="sr-only">Site navigation</DialogDescription>
        </div>
        <HeaderSearch onNavigate={() => setOpen(false)} />
        <nav aria-label="Mobile primary" className="flex flex-col gap-1">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
              className={cn(
                'rounded-lg px-3 py-2.5 text-[15px] font-medium hover:bg-muted',
                isActivePath(pathname, item.href) && 'bg-muted',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {signedIn ? (
          <nav aria-label="Account" className="flex flex-col gap-1 border-t pt-4">
            {secondaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Operator console
            </Link>
          </nav>
        ) : null}
        <div className="mt-auto border-t pt-4 text-xs text-muted-foreground">
          <Link
            href="/how-it-works"
            className="underline underline-offset-2"
            onClick={() => setOpen(false)}
          >
            How bidding works
          </Link>{' '}
          ·{' '}
          <Link
            href="/responsible-use"
            className="underline underline-offset-2"
            onClick={() => setOpen(false)}
          >
            Responsible use
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const TABS = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/discover', label: 'Discover', icon: CompassIcon },
  { href: '/auctions', label: 'Auctions', icon: GavelIcon },
  { href: '/marketplace', label: 'Shop', icon: StoreIcon },
  { href: '/drops', label: 'Drops', icon: ZapIcon },
]

export function MobileTabBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname()
  const tabs = [
    ...TABS.slice(0, 4),
    signedIn
      ? { href: '/account', label: 'Account', icon: UserIcon }
      : { href: '/demo', label: 'Demo', icon: SparklesIcon },
  ]
  return (
    <nav
      aria-label="Mobile tabs"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 backdrop-blur-lg lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map((tab) => {
          const active = isActivePath(pathname, tab.href)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground',
                  active && 'text-foreground',
                )}
              >
                <tab.icon className={cn('size-5', active && 'text-brand')} aria-hidden />
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
