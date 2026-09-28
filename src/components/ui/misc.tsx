import type * as React from 'react'

import { cn, initials } from '@/lib/utils'

export function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<'div'> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  )
}

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div aria-hidden className={cn('skeleton rounded-lg', className)} {...props} />
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-soft-foreground',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

export function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function Notice({
  tone = 'neutral',
  icon,
  title,
  children,
  className,
}: {
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'live'
  icon?: React.ReactNode
  title?: string
  children?: React.ReactNode
  className?: string
}) {
  const tones = {
    neutral: 'bg-muted text-foreground',
    brand: 'bg-brand-soft text-brand-soft-foreground',
    success: 'bg-success-soft text-success-foreground',
    warning: 'bg-warning-soft text-warning-foreground',
    danger: 'bg-danger-soft text-danger-foreground',
    live: 'bg-live-soft text-live-foreground',
  }
  return (
    <div
      role="note"
      className={cn('flex gap-3 rounded-xl px-4 py-3 text-sm', tones[tone], className)}
    >
      {icon ? <div className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</div> : null}
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed opacity-90">{children}</div> : null}
      </div>
    </div>
  )
}
