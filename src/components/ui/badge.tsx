import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/lib/utils'

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        neutral: 'border-transparent bg-muted text-muted-foreground',
        outline: 'border-border bg-transparent text-foreground',
        brand: 'border-transparent bg-brand-soft text-brand-soft-foreground',
        solid: 'border-transparent bg-primary text-primary-foreground',
        live: 'border-transparent bg-live-soft text-live-foreground',
        success: 'border-transparent bg-success-soft text-success-foreground',
        warning: 'border-transparent bg-warning-soft text-warning-foreground',
        danger: 'border-transparent bg-danger-soft text-danger-foreground',
        info: 'border-transparent bg-info-soft text-info',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}
