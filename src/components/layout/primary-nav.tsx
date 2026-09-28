'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { primaryNav } from '@/lib/config/site'
import { cn } from '@/lib/utils'

export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  if (href === '/auctions') return pathname.startsWith('/auction')
  if (href === '/marketplace')
    return (
      pathname.startsWith('/marketplace') ||
      pathname.startsWith('/category') ||
      pathname.startsWith('/product')
    )
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PrimaryNav({ liveCount }: { liveCount: number }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
      {primaryNav.map((item) => {
        const active = isActivePath(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              active &&
                'text-foreground after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-foreground',
            )}
          >
            {item.label}
            {item.href === '/auctions' && liveCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-live-soft px-1.5 py-0.5 text-[10px] font-semibold text-live-foreground">
                <span className="size-1.5 animate-pulse-dot rounded-full bg-live" aria-hidden />
                {liveCount}
                <span className="sr-only"> live</span>
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
