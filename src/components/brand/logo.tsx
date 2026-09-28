import { useId } from 'react'

import { cn } from '@/lib/utils'

/** Esocity Bid monogram: an "E" built from rising bid increments. */
export function LogoMark({
  className,
  title = 'Esocity Bid',
}: {
  className?: string
  title?: string
}) {
  // One id per instance: `url(#id)` resolves to the first matching element in the document, and a
  // gradient inside a display:none copy (e.g. the desktop logo on mobile) does not paint.
  const gradientId = `esb-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={cn('size-8 shrink-0', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5563fa" />
          <stop offset="1" stopColor="#2830a3" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <rect x="9" y="8" width="3.6" height="16" rx="1.8" fill="#fff" />
      <rect x="9" y="8" width="11" height="3.6" rx="1.8" fill="#fff" />
      <rect x="9" y="14.2" width="8.5" height="3.6" rx="1.8" fill="#fff" opacity="0.85" />
      <rect x="9" y="20.4" width="14" height="3.6" rx="1.8" fill="#fff" />
      <circle cx="24.5" cy="9.8" r="2" fill="#c9d0ff" />
    </svg>
  )
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {compact ? null : (
        <span className="flex items-center gap-1.5 leading-none">
          <span className="text-[15px] font-semibold tracking-[0.14em] text-foreground">
            ESOCITY
          </span>
          <span className="rounded-[5px] bg-foreground px-1.5 py-[3px] text-[10px] font-bold tracking-[0.12em] text-background">
            BID
          </span>
        </span>
      )}
    </span>
  )
}
