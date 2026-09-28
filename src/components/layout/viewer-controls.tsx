'use client'

import {
  BellIcon,
  CoinsIcon,
  GavelIcon,
  HeartIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PackageIcon,
  RotateCcwIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  TrophyIcon,
  UserIcon,
  WalletIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar } from '@/components/ui/misc'
import { api } from '@/lib/client/api'
import { on, useEventValue } from '@/lib/client/events'
import { cn } from '@/lib/utils'
import type { ViewerSummary } from '@/server/views'

export function WalletChip({ initial, className }: { initial: number; className?: string }) {
  const available = useEventValue(initial, 'wallet:balance')
  const [flash, setFlash] = useState(false)
  useEffect(
    () =>
      on('wallet:balance', () => {
        setFlash(true)
        setTimeout(() => setFlash(false), 900)
      }),
    [],
  )
  return (
    <Link
      href="/wallet"
      className={cn(
        'tabular inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm font-semibold shadow-xs transition hover:bg-muted',
        flash && 'animate-flash',
        className,
      )}
      aria-label={`Bid Wallet: ${available} bid credits`}
    >
      <CoinsIcon className="size-4 text-brand" aria-hidden />
      {available.toLocaleString('en-GB')}
      <span className="hidden text-xs font-normal text-muted-foreground xl:inline">bids</span>
    </Link>
  )
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="tabular absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-live px-1 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function ViewerControls({ summary }: { summary: ViewerSummary }) {
  const router = useRouter()
  const unread = useEventValue(summary.unreadNotifications, 'notifications:unread')
  const cart = useEventValue(summary.cartCount, 'cart:count')

  const signOut = async (reset: boolean) => {
    try {
      await api(reset ? '/api/demo/reset' : '/api/demo/session', {
        method: reset ? 'POST' : 'DELETE',
        body: reset ? {} : undefined,
      })
      toast.success(
        reset ? 'Demo reset — fresh wallet and history loaded.' : 'You have left the demo.',
      )
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="flex items-center gap-1">
      <WalletChip initial={summary.walletAvailable} className="hidden sm:inline-flex" />
      <Button asChild variant="ghost" size="icon-sm" className="relative hidden sm:inline-flex">
        <Link href="/watchlist" aria-label="Watchlist">
          <HeartIcon />
        </Link>
      </Button>
      <Button asChild variant="ghost" size="icon-sm" className="relative">
        <Link
          href="/notifications"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        >
          <BellIcon />
          <CountBadge count={unread} />
        </Link>
      </Button>
      <Button asChild variant="ghost" size="icon-sm" className="relative">
        <Link href="/checkout" aria-label={`Basket${cart ? `, ${cart} items` : ''}`}>
          <ShoppingBagIcon />
          <CountBadge count={cart} />
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Account menu"
          >
            <Avatar name={summary.displayName} className="size-8" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
            <span className="text-sm font-semibold text-foreground">{summary.displayName}</span>
            <span>
              {summary.handle} · {summary.tier.charAt(0) + summary.tier.slice(1).toLowerCase()}{' '}
              member
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { href: '/account', label: 'Account', icon: UserIcon },
            { href: '/wallet', label: 'Bid Wallet', icon: WalletIcon },
            { href: '/orders', label: 'Orders', icon: PackageIcon },
            { href: '/watchlist', label: 'Watchlist', icon: HeartIcon },
            { href: '/rewards', label: 'Rewards', icon: TrophyIcon },
            { href: '/account#bidding', label: 'Bidding activity', icon: GavelIcon },
            { href: '/settings', label: 'Settings', icon: SettingsIcon },
            { href: '/responsible-use', label: 'Responsible use', icon: ShieldCheckIcon },
          ].map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href}>
                <item.icon />
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboardIcon />
              Operator console
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void signOut(true)}>
            <RotateCcwIcon />
            Reset demo data
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void signOut(false)}>
            <LogOutIcon />
            Exit demo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
