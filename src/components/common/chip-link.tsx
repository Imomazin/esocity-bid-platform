import Link from 'next/link'
import type * as React from 'react'

import { cn } from '@/lib/utils'

export function ChipLink({
  href,
  active,
  children,
  className,
}: {
  href: string
  active?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground',
        className,
      )}
    >
      {children}
    </Link>
  )
}
