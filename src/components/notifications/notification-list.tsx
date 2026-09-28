'use client'

import {
  AwardIcon,
  BellOffIcon,
  CheckCheckIcon,
  CoinsIcon,
  CreditCardIcon,
  GavelIcon,
  HourglassIcon,
  InfoIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TimerIcon,
  TrophyIcon,
  TruckIcon,
  ZapIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import type { Notification, NotificationType } from '@/domain/notifications'
import { api, ApiError } from '@/lib/client/api'
import { emit } from '@/lib/client/events'
import { formatRelative } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { NotificationsView } from '@/server/views'

const ICONS: Record<NotificationType, typeof InfoIcon> = {
  AUCTION_STARTING: TimerIcon,
  OUTBID: ZapIcon,
  AUCTION_WON: TrophyIcon,
  AUCTION_LOST: GavelIcon,
  AUCTION_ENDING: HourglassIcon,
  DROP_STARTING: SparklesIcon,
  ORDER_PAID: CreditCardIcon,
  ORDER_SHIPPED: TruckIcon,
  REWARD_EARNED: AwardIcon,
  BID_BALANCE_LOW: CoinsIcon,
  LIMIT_THRESHOLD: ShieldCheckIcon,
  SYSTEM: InfoIcon,
}

const TONES: Partial<Record<NotificationType, string>> = {
  OUTBID: 'bg-live-soft text-live-foreground',
  AUCTION_WON: 'bg-success-soft text-success-foreground',
  LIMIT_THRESHOLD: 'bg-warning-soft text-warning-foreground',
  ORDER_SHIPPED: 'bg-info-soft text-info',
  REWARD_EARNED: 'bg-brand-soft text-brand-soft-foreground',
}

export function NotificationList({ initial, now }: { initial: NotificationsView; now: number }) {
  const router = useRouter()
  const [items, setItems] = useState<Notification[]>(initial.items)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [pending, setPending] = useState(false)
  const unread = items.filter((item) => item.readAt === null).length
  const visible = filter === 'unread' ? items.filter((item) => item.readAt === null) : items

  const markRead = async (ids: string[] | 'all') => {
    const next = await api<NotificationsView>('/api/notifications/read', { body: { ids } })
    setItems(next.items)
    emit('notifications:unread', { unread: next.unread })
    return next
  }

  const markAll = async () => {
    setPending(true)
    try {
      await markRead('all')
      toast.success('All caught up')
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not update notifications.')
    } finally {
      setPending(false)
    }
  }

  const open = async (item: Notification) => {
    if (item.readAt === null) {
      try {
        await markRead([item.id])
      } catch {
        // Marking as read is best-effort; navigation still proceeds.
      }
    }
    if (item.href) router.push(item.href)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5" role="tablist" aria-label="Filter notifications">
          {(['all', 'unread'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition',
                filter === value
                  ? 'border-foreground bg-foreground text-background'
                  : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'all' ? 'All' : 'Unread'}
              {value === 'unread' && unread > 0 ? (
                <span className="tabular rounded-full bg-live px-1.5 text-[10px] leading-4 text-white">
                  {unread}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={markAll} disabled={pending || unread === 0}>
          <CheckCheckIcon /> Mark all as read
        </Button>
      </div>
      {visible.length === 0 ? (
        <EmptyState
          icon={<BellOffIcon />}
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description="Auction, order and account updates will appear here."
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
          {visible.map((item) => {
            const Icon = ICONS[item.type]
            const isUnread = item.readAt === null
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => open(item)}
                  className={cn(
                    'flex w-full gap-3 px-4 py-4 text-left transition hover:bg-muted/50 sm:px-5',
                    isUnread && 'bg-brand-soft/30',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground',
                      TONES[item.type],
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className={cn('text-sm', isUnread ? 'font-semibold' : 'font-medium')}>
                        {item.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelative(item.createdAt, now)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{item.body}</span>
                  </span>
                  {isUnread ? (
                    <span
                      className="mt-2 size-2 shrink-0 rounded-full bg-brand"
                      aria-label="Unread"
                    />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
