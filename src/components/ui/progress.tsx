import type * as React from 'react'

import { cn } from '@/lib/utils'

/** Accessible progress bar (native semantics via role="progressbar"). */
export function Progress({
  value,
  max = 100,
  className,
  indicatorClassName,
  label,
  ...props
}: React.ComponentProps<'div'> & {
  value: number
  max?: number
  indicatorClassName?: string
  label?: string
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-label={label}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <div
        className={cn(
          'h-full rounded-full bg-brand transition-[width] duration-500',
          indicatorClassName,
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
