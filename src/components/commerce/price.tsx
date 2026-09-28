import { formatBasisPoints, formatMinor, money, savingsBasisPoints } from '@/lib/money'
import { cn } from '@/lib/utils'

export function Money({
  minor,
  className,
  trim = false,
}: {
  minor: number
  className?: string
  trim?: boolean
}) {
  return (
    <span className={cn('tabular', className)}>
      {formatMinor(minor, 'GBP', { trimZeroMinor: trim })}
    </span>
  )
}

export function PriceStack({
  priceMinor,
  referenceMinor,
  label,
  className,
  size = 'md',
}: {
  priceMinor: number
  referenceMinor?: number
  label?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const savings = referenceMinor ? savingsBasisPoints(money(referenceMinor), money(priceMinor)) : 0
  const sizes = { sm: 'text-base', md: 'text-lg', lg: 'text-3xl' }
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      {label ? <span className="w-full text-xs text-muted-foreground">{label}</span> : null}
      <span className={cn('tabular font-semibold tracking-tight', sizes[size])}>
        {formatMinor(priceMinor)}
      </span>
      {referenceMinor && referenceMinor > priceMinor ? (
        <>
          <span
            className="tabular text-sm text-muted-foreground line-through"
            aria-label={`Reference price ${formatMinor(referenceMinor)}`}
          >
            {formatMinor(referenceMinor, 'GBP', { trimZeroMinor: true })}
          </span>
          {savings >= 100 ? (
            <span className="text-xs font-semibold text-success">
              Save {formatBasisPoints(savings)}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
