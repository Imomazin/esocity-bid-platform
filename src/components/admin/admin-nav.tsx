'use client'

import {
  BarChart3Icon,
  BoxesIcon,
  CreditCardIcon,
  FactoryIcon,
  GavelIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  PackageIcon,
  ScrollTextIcon,
  ShieldAlertIcon,
  ShoppingBagIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const ICONS = {
  dashboard: LayoutDashboardIcon,
  analytics: BarChart3Icon,
  auctions: GavelIcon,
  products: ShoppingBagIcon,
  inventory: BoxesIcon,
  suppliers: FactoryIcon,
  orders: PackageIcon,
  fulfilment: TruckIcon,
  payments: CreditCardIcon,
  promotions: TagIcon,
  customers: UsersIcon,
  support: LifeBuoyIcon,
  fraud: ShieldAlertIcon,
  audit: ScrollTextIcon,
} as const

export type AdminNavIcon = keyof typeof ICONS

export interface AdminNavGroup {
  label: string
  items: { href: string; label: string; icon: AdminNavIcon; badge?: number }[]
}

function isActive(pathname: string, href: string): boolean {
  return href === '/admin'
    ? pathname === '/admin'
    : pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminSidebarNav({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Operator console" className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-subtle-foreground uppercase">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon]
              const active = isActive(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
                      active
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span
                        className={cn(
                          'tabular rounded-full px-1.5 text-[10px] leading-4 font-semibold',
                          active ? 'bg-background/20' : 'bg-live-soft text-live-foreground',
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Compact horizontal navigation for small screens. */
export function AdminMobileNav({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname()
  const items = groups.flatMap((group) => group.items)
  return (
    <nav
      aria-label="Operator console"
      className="-mx-4 flex scrollbar-none gap-1.5 overflow-x-auto px-4 pb-3 lg:hidden"
    >
      {items.map((item) => {
        const Icon = ICONS[item.icon]
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap',
              active
                ? 'border-foreground bg-foreground text-background'
                : 'bg-card text-muted-foreground',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
