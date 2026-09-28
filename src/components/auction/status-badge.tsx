import {
  CalendarClockIcon,
  CheckCircle2Icon,
  CircleSlashIcon,
  PauseCircleIcon,
  TimerIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { AuctionStatus } from '@/domain/auction/types'
import { cn } from '@/lib/utils'

/** Status is conveyed with text and icon, never colour alone. */
export function AuctionStatusBadge({
  status,
  className,
}: {
  status: AuctionStatus
  className?: string
}) {
  switch (status) {
    case 'LIVE':
      return (
        <Badge variant="live" className={cn('font-semibold tracking-wide uppercase', className)}>
          <span className="size-1.5 animate-pulse-dot rounded-full bg-live" aria-hidden />
          Live
        </Badge>
      )
    case 'SCHEDULED':
      return (
        <Badge variant="brand" className={className}>
          <CalendarClockIcon aria-hidden />
          Starting soon
        </Badge>
      )
    case 'PAUSED':
      return (
        <Badge variant="warning" className={className}>
          <PauseCircleIcon aria-hidden />
          Paused
        </Badge>
      )
    case 'FINALIZING':
      return (
        <Badge variant="neutral" className={className}>
          <TimerIcon aria-hidden />
          Finalising
        </Badge>
      )
    case 'COMPLETED':
      return (
        <Badge variant="neutral" className={className}>
          <CheckCircle2Icon aria-hidden />
          Ended
        </Badge>
      )
    case 'CANCELLED':
      return (
        <Badge variant="danger" className={className}>
          <CircleSlashIcon aria-hidden />
          Cancelled
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className={className}>
          Draft
        </Badge>
      )
  }
}
