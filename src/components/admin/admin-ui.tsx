import { ArrowDownRightIcon, ArrowUpRightIcon, LockKeyholeIcon, MinusIcon } from 'lucide-react'
import Link from 'next/link'
import type * as React from 'react'

import { Card } from '@/components/ui/card'
import { ROLE_LABELS, type Permission, type Role } from '@/server/auth/roles'
import { cn } from '@/lib/utils'

export function AdminPageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  eyebrow?: string
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold tracking-wider text-brand uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <div className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function AccessDenied({ permission, role }: { permission: Permission; role: Role | null }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <LockKeyholeIcon className="size-6" aria-hidden />
      </span>
      <h1 className="mt-5 text-xl font-semibold">You don’t have access to this area</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {role ? `The ${ROLE_LABELS[role]} role` : 'Your account'} doesn’t include the{' '}
        <code className="font-mono text-xs">{permission}</code> permission. Access is enforced on
        the server for every page and action.
      </p>
      <Link href="/admin" className="mt-5 inline-block text-sm font-medium text-brand underline">
        Back to dashboard
      </Link>
    </div>
  )
}

/**
 * Stat tile: label · value · delta vs a named period. The delta carries an arrow and sign, so
 * direction never relies on colour; colour reflects whether the change is good.
 */
export function StatTile({
  label,
  value,
  change,
  goodWhenUp = true,
  period = 'vs previous 30 days',
  hint,
  className,
}: {
  label: string
  value: string
  change?: number | null
  goodWhenUp?: boolean
  period?: string
  hint?: string
  className?: string
}) {
  const direction =
    change === undefined || change === null || Math.abs(change) < 0.0005
      ? 'flat'
      : change > 0
        ? 'up'
        : 'down'
  const good = direction === 'flat' ? null : (direction === 'up') === goodWhenUp
  const Icon =
    direction === 'up' ? ArrowUpRightIcon : direction === 'down' ? ArrowDownRightIcon : MinusIcon
  return (
    <Card className={cn('p-4 sm:p-5', className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {change !== undefined ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs">
          {change === null ? (
            <span className="text-muted-foreground">No prior period</span>
          ) : (
            <>
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-medium',
                  good === null
                    ? 'text-muted-foreground'
                    : good
                      ? 'text-success-foreground'
                      : 'text-danger-foreground',
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {change > 0 ? '+' : ''}
                {(change * 100).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">{period}</span>
            </>
          )}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </Card>
  )
}

/** Small operational counter used in dense "at a glance" rows. */
export function OpsCounter({
  label,
  value,
  href,
  tone = 'neutral',
  icon,
}: {
  label: string
  value: React.ReactNode
  href?: string
  tone?: 'neutral' | 'warning' | 'danger' | 'live'
  icon?: React.ReactNode
}) {
  const tones = {
    neutral: 'text-muted-foreground',
    warning: 'text-warning-foreground',
    danger: 'text-danger-foreground',
    live: 'text-live-foreground',
  }
  const body = (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition hover:shadow-card">
      {icon ? <span className={cn('[&_svg]:size-4', tones[tone])}>{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tracking-tight">{value}</p>
      </div>
    </div>
  )
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  )
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}
