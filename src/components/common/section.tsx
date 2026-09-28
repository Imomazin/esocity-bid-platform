import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'
import type * as React from 'react'

import { cn } from '@/lib/utils'

export function SectionHeader({
  title,
  description,
  href,
  linkLabel = 'View all',
  eyebrow,
  className,
  action,
}: {
  title: string
  description?: string
  href?: string
  linkLabel?: string
  eyebrow?: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <div className={cn('mb-5 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1.5 text-xs font-semibold tracking-wider text-brand uppercase">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ??
        (href ? (
          <Link
            href={href}
            className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground hover:text-brand"
          >
            {linkLabel}
            <ArrowRightIcon className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ) : null)}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  children,
}: {
  title: string
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 text-xs font-semibold tracking-wider text-brand uppercase">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <div className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-[15px]">
            {description}
          </div>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function Container({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6', className)} {...props} />
}

export function Rail({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        '-mx-4 flex snap-x snap-mandatory scrollbar-none gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
