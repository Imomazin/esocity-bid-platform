import { ArrowUpRightIcon, DatabaseIcon, OctagonAlertIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type * as React from 'react'

import {
  AdminMobileNav,
  AdminSidebarNav,
  type AdminNavGroup,
  type AdminNavIcon,
} from '@/components/admin/admin-nav'
import { AccessDenied } from '@/components/admin/admin-ui'
import { RoleSwitcher } from '@/components/admin/role-switcher'
import { Logo, LogoMark } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { isDemoMode } from '@/lib/config/env'
import { hasPermission, ROLE_LABELS, STAFF_ROLES, type Permission } from '@/server/auth/roles'
import { getAdminActor } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = {
  title: { default: 'Operator console', template: '%s · Operator console · Esocity Bid' },
  robots: { index: false, follow: false },
}

const NAV: {
  label: string
  items: { href: string; label: string; icon: AdminNavIcon; permission: Permission }[]
}[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: 'dashboard', permission: 'admin.access' },
      {
        href: '/admin/analytics',
        label: 'Analytics',
        icon: 'analytics',
        permission: 'analytics.view',
      },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { href: '/admin/auctions', label: 'Auctions', icon: 'auctions', permission: 'auctions.view' },
      {
        href: '/admin/products',
        label: 'Products',
        icon: 'products',
        permission: 'products.manage',
      },
      {
        href: '/admin/inventory',
        label: 'Inventory',
        icon: 'inventory',
        permission: 'inventory.manage',
      },
      {
        href: '/admin/suppliers',
        label: 'Suppliers',
        icon: 'suppliers',
        permission: 'suppliers.view',
      },
      {
        href: '/admin/promotions',
        label: 'Promotions',
        icon: 'promotions',
        permission: 'promotions.manage',
      },
    ],
  },
  {
    label: 'Orders & money',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: 'orders', permission: 'orders.view' },
      {
        href: '/admin/fulfilment',
        label: 'Fulfilment',
        icon: 'fulfilment',
        permission: 'orders.manage',
      },
      { href: '/admin/payments', label: 'Payments', icon: 'payments', permission: 'payments.view' },
    ],
  },
  {
    label: 'Customers & risk',
    items: [
      {
        href: '/admin/customers',
        label: 'Customers',
        icon: 'customers',
        permission: 'customers.view',
      },
      { href: '/admin/support', label: 'Support', icon: 'support', permission: 'support.manage' },
      { href: '/admin/fraud', label: 'Fraud & risk', icon: 'fraud', permission: 'fraud.view' },
      { href: '/admin/audit', label: 'Audit log', icon: 'audit', permission: 'audit.view' },
    ],
  },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getAdminActor()
  const demo = isDemoMode()
  if (!actor || !hasPermission(actor.roles, 'admin.access')) {
    return (
      <main id="main" className="min-h-dvh px-4">
        <AccessDenied permission="admin.access" role={actor?.role ?? null} />
      </main>
    )
  }
  const backend = getBackend()
  const openFraud = backend.admin
    .fraudCases()
    .filter((item) => item.status === 'OPEN' || item.status === 'UNDER_REVIEW').length
  const openTickets = backend.admin.tickets('OPEN').length
  const killSwitch = backend.admin.killSwitchActive()
  const badges: Record<string, number> = {
    '/admin/fraud': openFraud,
    '/admin/support': openTickets,
  }
  const groups: AdminNavGroup[] = NAV.map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => hasPermission(actor.roles, item.permission))
      .map((item) => ({
        href: item.href,
        label: item.label,
        icon: item.icon,
        badge: badges[item.href],
      })),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="min-h-dvh bg-surface">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-background lg:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/admin" aria-label="Operator console home">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <AdminSidebarNav groups={groups} />
        </div>
        <div className="border-t p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{actor.name}</p>
          <p>{ROLE_LABELS[actor.role]}</p>
          {demo ? (
            <p className="mt-2 leading-relaxed">
              Demo console: actions change the shared demo world and are written to the audit log.
            </p>
          ) : null}
        </div>
      </aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-lg">
          <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 sm:px-6">
            <Link href="/admin" className="lg:hidden" aria-label="Operator console home">
              <LogoMark className="size-7" />
            </Link>
            <span className="hidden text-sm font-semibold sm:inline lg:hidden">
              Operator console
            </span>
            {demo ? (
              <Badge variant="warning" className="hidden sm:inline-flex">
                <DatabaseIcon aria-hidden /> Demo data
              </Badge>
            ) : null}
            {killSwitch ? (
              <Badge variant="live">
                <OctagonAlertIcon aria-hidden /> AutoBid kill switch on
              </Badge>
            ) : null}
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              {demo ? (
                <RoleSwitcher
                  role={actor.role}
                  roles={STAFF_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
                />
              ) : null}
              <ThemeToggle />
              <Button asChild variant="outline" size="sm">
                <Link href="/">
                  Storefront <ArrowUpRightIcon />
                </Link>
              </Button>
            </div>
          </div>
          <div className="px-4 sm:px-6">
            <AdminMobileNav groups={groups} />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
