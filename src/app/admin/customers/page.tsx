import { SearchIcon } from 'lucide-react'
import type { Metadata } from 'next'

import { AccessDenied, AdminPageHeader } from '@/components/admin/admin-ui'
import { GoodwillCredit } from '@/components/admin/goodwill-credit'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { RISK_CLASS_LABELS } from '@/domain/fraud'
import { formatMinor } from '@/lib/money'
import { formatDate, formatRelative } from '@/lib/time'
import { adminAccess } from '@/server/auth/admin-access'
import { hasPermission } from '@/server/auth/roles'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Customers' }

const STATUS_VARIANTS = {
  ACTIVE: 'success',
  UNDER_REVIEW: 'warning',
  RESTRICTED: 'danger',
} as const
const RISK_VARIANTS = {
  LOW: 'neutral',
  MODERATE: 'warning',
  HIGH: 'danger',
  CRITICAL: 'live',
} as const

export default async function CustomersPage({ searchParams }: PageProps<'/admin/customers'>) {
  const access = await adminAccess('customers.view')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : ''
  const backend = getBackend()
  const customers = backend.admin.customers(q || undefined)
  const now = backend.now()
  const canAdjust = hasPermission(access.actor.roles, 'wallet.adjust')
  return (
    <div>
      <AdminPageHeader
        title="Customers"
        description="Anonymised demo customers plus live demo-session members. Personal data is minimised; risk labels are prompts for review, not conclusions."
        actions={
          <form action="/admin/customers" className="relative w-full sm:w-72">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Name, email or city"
              className="pl-9"
              aria-label="Search customers"
            />
          </form>
        }
      />
      {customers.length === 0 ? (
        <EmptyState title="No customers match" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Customer</TH>
                  <TH>Status</TH>
                  <TH>Tier</TH>
                  <TH className="text-right">Orders</TH>
                  <TH className="text-right">Lifetime spend</TH>
                  <TH className="text-right">Bid packs</TH>
                  <TH className="text-right">Bids used</TH>
                  <TH className="text-right">Wins</TH>
                  <TH>Risk</TH>
                  <TH>Last active</TH>
                  {canAdjust ? (
                    <TH className="text-right">
                      <span className="sr-only">Actions</span>
                    </TH>
                  ) : null}
                </TR>
              </THead>
              <TBody>
                {customers.slice(0, 200).map((customer) => (
                  <TR key={customer.id}>
                    <TD className="max-w-[240px]">
                      <span className="line-clamp-1 font-medium">{customer.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {customer.email} · {customer.city} · joined {formatDate(customer.joinedAt)}
                      </span>
                    </TD>
                    <TD>
                      <Badge variant={STATUS_VARIANTS[customer.status]}>
                        {customer.status.replace('_', ' ').toLowerCase()}
                      </Badge>
                      {!customer.simulated ? (
                        <Badge variant="brand" className="ml-1">
                          session
                        </Badge>
                      ) : null}
                    </TD>
                    <TD className="text-xs">
                      {customer.tier.charAt(0) + customer.tier.slice(1).toLowerCase()}
                    </TD>
                    <TD className="tabular text-right">{customer.orders}</TD>
                    <TD className="tabular text-right">
                      {formatMinor(customer.lifetimeSpendMinor)}
                    </TD>
                    <TD className="tabular text-right">
                      {formatMinor(customer.bidPackSpendMinor)}
                    </TD>
                    <TD className="tabular text-right">
                      {customer.bidsUsed.toLocaleString('en-GB')}
                    </TD>
                    <TD className="tabular text-right">{customer.wins}</TD>
                    <TD>
                      <Badge variant={RISK_VARIANTS[customer.riskClass]}>
                        {RISK_CLASS_LABELS[customer.riskClass]}
                      </Badge>
                    </TD>
                    <TD className="text-xs whitespace-nowrap text-muted-foreground">
                      {formatRelative(customer.lastActiveAt, now)}
                    </TD>
                    {canAdjust ? (
                      <TD className="text-right">
                        {!customer.simulated ? (
                          <GoodwillCredit userId={customer.id} name={customer.name} />
                        ) : null}
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          {customers.length > 200 ? (
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">
              Showing the first 200 of {customers.length}. Refine your search.
            </p>
          ) : null}
        </Card>
      )}
    </div>
  )
}
