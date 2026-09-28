import { CheckIcon, CircleDashedIcon, XIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  FULFILMENT_FLOW,
  ORDER_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  type Order,
  type OrderSource,
  type OrderStatus,
} from '@/domain/orders'
import { formatDateTime } from '@/lib/time'
import { cn } from '@/lib/utils'

const STATUS_VARIANTS: Record<
  OrderStatus,
  'warning' | 'brand' | 'info' | 'neutral' | 'success' | 'danger' | 'outline'
> = {
  PENDING_PAYMENT: 'warning',
  PAID: 'brand',
  PROCESSING: 'info',
  PACKED: 'info',
  SHIPPED: 'brand',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
  REFUNDED: 'danger',
}

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus
  className?: string
}) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className={className}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  )
}

export function OrderSourceBadge({ source }: { source: OrderSource }) {
  return <Badge variant="outline">{ORDER_SOURCE_LABELS[source]}</Badge>
}

/** Visual timeline of the fulfilment flow, with timestamps from the order's event log. */
export function OrderTimeline({ order }: { order: Pick<Order, 'status' | 'events'> }) {
  const reachedAt = new Map<OrderStatus, number>()
  for (const event of order.events)
    if (!reachedAt.has(event.status)) reachedAt.set(event.status, event.at)
  const terminal = order.status === 'CANCELLED' || order.status === 'REFUNDED' ? order.status : null
  const currentIndex = FULFILMENT_FLOW.indexOf(order.status)
  const steps = terminal
    ? [...FULFILMENT_FLOW.filter((status) => reachedAt.has(status)), terminal]
    : FULFILMENT_FLOW
  return (
    <ol className="relative space-y-0" aria-label="Order progress">
      {steps.map((status, index) => {
        const at = reachedAt.get(status)
        const done = at !== undefined
        const isTerminal = status === terminal
        const isCurrent = status === order.status
        const upcoming =
          !done &&
          !isTerminal &&
          (currentIndex === -1 || FULFILMENT_FLOW.indexOf(status) > currentIndex)
        const note = order.events.find((event) => event.status === status)?.note
        return (
          <li key={status} className="relative flex gap-3 pb-5 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  'absolute top-6 left-[11px] h-[calc(100%-1.25rem)] w-px',
                  done ? 'bg-foreground/25' : 'bg-border',
                )}
              />
            ) : null}
            <span
              className={cn(
                'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px]',
                isTerminal
                  ? 'border-danger bg-danger-soft text-danger'
                  : done
                    ? isCurrent
                      ? 'border-brand bg-brand text-white'
                      : 'border-foreground bg-foreground text-background'
                    : 'border-dashed bg-card text-subtle-foreground',
              )}
            >
              {isTerminal ? (
                <XIcon className="size-3.5" />
              ) : done ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <CircleDashedIcon className="size-3.5" />
              )}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn('text-sm font-medium', upcoming && 'text-muted-foreground')}>
                {ORDER_STATUS_LABELS[status]}
                {isCurrent && !isTerminal && status !== 'DELIVERED' ? (
                  <span className="ml-2 text-xs font-normal text-brand">Current</span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {at ? formatDateTime(at) : upcoming ? 'Pending' : ''}
              </p>
              {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
