import {
  BoxesIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  GavelIcon,
  LifeBuoyIcon,
  OctagonAlertIcon,
  PackageIcon,
  ShieldAlertIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { AdminAction } from '@/components/admin/admin-action'
import {
  AccessDenied,
  AdminPageHeader,
  OpsCounter,
  SectionTitle,
  StatTile,
} from '@/components/admin/admin-ui'
import { HorizontalBarChart, StackedColumnChart, TrendAreaChart } from '@/components/admin/charts'
import { OrderStatusBadge } from '@/components/commerce/order-status'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { RISK_CLASS_LABELS } from '@/domain/fraud'
import { compactMoney } from '@/lib/format'
import { formatMinor } from '@/lib/money'
import { formatDateTime, formatRelative } from '@/lib/time'
import { formatCompact, formatPercent } from '@/lib/utils'
import { adminAccess } from '@/server/auth/admin-access'
import { hasPermission } from '@/server/auth/roles'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Dashboard' }

const REVENUE_SERIES = [
  { key: 'auctions', label: 'Auction wins', color: 'var(--viz-1)' },
  { key: 'buyNow', label: 'Buy Now', color: 'var(--viz-2)' },
  { key: 'marketplace', label: 'Marketplace', color: 'var(--viz-3)' },
  { key: 'drops', label: 'Flash Drops', color: 'var(--viz-4)' },
  { key: 'bidPacks', label: 'Bid packs', color: 'var(--viz-5)' },
]

const RISK_VARIANTS = {
  LOW: 'neutral',
  MODERATE: 'warning',
  HIGH: 'danger',
  CRITICAL: 'live',
} as const

export default async function AdminDashboardPage() {
  const access = await adminAccess('admin.access')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const { actor } = access
  const backend = getBackend()
  const data = backend.admin.dashboard()
  const now = backend.now()
  const can = (permission: Parameters<typeof hasPermission>[1]) =>
    hasPermission(actor.roles, permission)
  const { kpis, operations } = data
  const funnelTop = data.funnel[0]?.value ?? 0

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Dashboard"
        description="Last 30 days compared with the previous 30 days. All figures in demo mode are simulated."
        actions={
          can('auctions.manage') ? (
            <Link
              href="/admin/auctions/new"
              className="inline-flex h-9 items-center rounded-lg bg-brand px-3.5 text-sm font-medium text-brand-foreground hover:bg-brand-strong"
            >
              New auction
            </Link>
          ) : null
        }
      />

      {can('analytics.view') ? (
        <section
          aria-label="Key metrics"
          className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]"
        >
          <Card className="flex flex-col justify-between p-5 sm:p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Gross merchandise value · 30 days
              </p>
              <p className="mt-2 text-5xl font-semibold tracking-tight">
                {compactMoney(kpis.gmv.value)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatMinor(kpis.gmv.value)} across auction wins, Buy Now, marketplace and Flash
                Drops
              </p>
            </div>
            <div className="mt-5">
              <TrendAreaChart
                data={data.series.map((row) => ({
                  day: row.day,
                  gmv: row.auctions + row.buyNow + row.marketplace + row.drops,
                }))}
                dataKey="gmv"
                name="GMV"
                axisFormat="compactMoney"
                valueFormat="money"
                label="Daily gross merchandise value, last 30 days"
                height={120}
              />
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatTile
              label="Gross revenue (incl. bid packs)"
              value={compactMoney(kpis.grossRevenue.value)}
              change={kpis.grossRevenue.change}
            />
            <StatTile
              label="Auction revenue"
              value={compactMoney(kpis.auctionRevenue.value)}
              change={kpis.auctionRevenue.change}
            />
            <StatTile
              label="Buy Now revenue"
              value={compactMoney(kpis.buyNowRevenue.value)}
              change={kpis.buyNowRevenue.change}
            />
            <StatTile
              label="Bid pack revenue"
              value={compactMoney(kpis.bidPackRevenue.value)}
              change={kpis.bidPackRevenue.change}
            />
            <StatTile
              label="Marketplace & drops"
              value={compactMoney(kpis.marketplaceRevenue.value)}
              change={kpis.marketplaceRevenue.change}
            />
            <StatTile
              label="Active users (daily avg)"
              value={formatCompact(kpis.activeUsers.value)}
              change={kpis.activeUsers.change}
            />
            <StatTile
              label="Session conversion"
              value={formatPercent(kpis.conversion.value, 2)}
              change={kpis.conversion.change}
            />
            <StatTile
              label="Refunds"
              value={compactMoney(kpis.refunds.value)}
              change={kpis.refunds.change}
              goodWhenUp={false}
            />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="ops-heading">
        <SectionTitle>
          <span id="ops-heading">Operations right now</span>
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <OpsCounter
            label="Live auctions"
            value={operations.activeAuctions}
            href="/admin/auctions?status=LIVE"
            tone="live"
            icon={<GavelIcon />}
          />
          <OpsCounter
            label="Scheduled auctions"
            value={operations.scheduledAuctions}
            href="/admin/auctions?status=SCHEDULED"
            icon={<CalendarClockIcon />}
          />
          <OpsCounter
            label="Completed (24h)"
            value={operations.completedAuctions24h}
            href="/admin/auctions?status=COMPLETED"
            icon={<CheckCircle2Icon />}
          />
          <OpsCounter
            label={`Units available · ${operations.lowStock} low`}
            value={formatCompact(operations.inventoryUnits)}
            href={can('inventory.manage') ? '/admin/inventory' : undefined}
            tone={operations.lowStock > 0 ? 'warning' : 'neutral'}
            icon={<BoxesIcon />}
          />
          <OpsCounter
            label={`Awaiting fulfilment · ${operations.fulfilmentExceptions} exceptions`}
            value={operations.awaitingFulfilment}
            href={can('orders.manage') ? '/admin/fulfilment' : undefined}
            tone={operations.fulfilmentExceptions > 0 ? 'warning' : 'neutral'}
            icon={<PackageIcon />}
          />
          <OpsCounter
            label={`Fraud alerts · ${operations.criticalFraud} critical`}
            value={operations.fraudAlerts}
            href={can('fraud.view') ? '/admin/fraud' : undefined}
            tone={operations.criticalFraud > 0 ? 'danger' : 'neutral'}
            icon={<ShieldAlertIcon />}
          />
          <OpsCounter
            label={`Open support · ${operations.supportUrgent} high priority`}
            value={operations.supportOpen}
            href={can('support.manage') ? '/admin/support' : undefined}
            tone={operations.supportUrgent > 0 ? 'warning' : 'neutral'}
            icon={<LifeBuoyIcon />}
          />
          <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">AutoBid (platform)</p>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                {operations.autobidKillSwitch ? (
                  <>
                    <OctagonAlertIcon className="size-4 text-live" aria-hidden /> Kill switch on
                  </>
                ) : (
                  <>
                    <CheckCircle2Icon className="size-4 text-success" aria-hidden /> Running
                  </>
                )}
              </p>
            </div>
            {can('autobid.killswitch') ? (
              <AdminAction
                size="xs"
                variant={operations.autobidKillSwitch ? 'outline' : 'danger'}
                endpoint="/api/admin/autobid/kill-switch"
                body={{ active: !operations.autobidKillSwitch }}
                successMessage={
                  operations.autobidKillSwitch
                    ? 'AutoBid re-enabled'
                    : 'AutoBid kill switch activated'
                }
                confirm={{
                  title: operations.autobidKillSwitch
                    ? 'Re-enable AutoBid?'
                    : 'Stop all AutoBid agents?',
                  description: operations.autobidKillSwitch
                    ? 'Members will be able to start AutoBid again. Stopped agents stay stopped.'
                    : 'Every active AutoBid agent stops immediately and members are notified. Manual bidding continues.',
                  confirmLabel: operations.autobidKillSwitch ? 'Re-enable' : 'Activate kill switch',
                  danger: !operations.autobidKillSwitch,
                  reasonField: 'reason',
                }}
              >
                {operations.autobidKillSwitch ? 'Release' : 'Kill switch'}
              </AdminAction>
            ) : null}
          </div>
        </div>
      </section>

      {can('analytics.view') ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by stream</CardTitle>
              <CardDescription>
                Daily, last 30 days. Bid pack revenue is shown separately from merchandise.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StackedColumnChart
                data={data.series}
                series={REVENUE_SERIES}
                label="Daily revenue by stream, last 30 days"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Category mix</CardTitle>
              <CardDescription>Merchandise sales by category, last 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <HorizontalBarChart
                data={data.categoryMix
                  .slice(0, 8)
                  .map((row) => ({ name: row.name, value: row.value }))}
                label="Sales by category, last 30 days"
                valueLabel="Sales"
              />
            </CardContent>
          </Card>
        </section>
      ) : null}

      {can('analytics.view') ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Active users</CardTitle>
              <CardDescription>Daily active users, last 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendAreaChart
                data={data.series.map((row) => ({ day: row.day, activeUsers: row.activeUsers }))}
                dataKey="activeUsers"
                name="Active users"
                label="Daily active users, last 30 days"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Checkout funnel</CardTitle>
              <CardDescription>Sessions to completed orders, last 30 days.</CardDescription>
            </CardHeader>
            <CardContent className="viz-root space-y-5">
              {data.funnel.map((stage, index) => {
                const previous = index > 0 ? (data.funnel[index - 1]?.value ?? 0) : null
                return (
                  <div key={stage.stage}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{stage.stage}</span>
                      <span className="tabular">
                        {stage.value.toLocaleString('en-GB')}
                        {previous ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {formatPercent(previous ? stage.value / previous : 0)} of previous step
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <Progress
                      value={stage.value}
                      max={Math.max(1, funnelTop)}
                      label={stage.stage}
                      className="h-2.5 bg-[var(--viz-track)]"
                      indicatorClassName="bg-[var(--viz-1)]"
                    />
                  </div>
                )
              })}
              <p className="text-xs text-muted-foreground">
                Overall session-to-order conversion: {formatPercent(kpis.conversion.value, 2)}.
              </p>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Busiest live auctions</CardTitle>
            <Link href="/admin/auctions?status=LIVE" className="text-sm font-medium text-brand">
              All auctions
            </Link>
          </CardHeader>
          <Table>
            <THead>
              <TR>
                <TH>Auction</TH>
                <TH className="text-right">Price</TH>
                <TH className="text-right">Bids</TH>
                <TH className="text-right">Bidders</TH>
                <TH className="text-right">Closes</TH>
              </TR>
            </THead>
            <TBody>
              {data.liveAuctions.map((auction) => (
                <TR key={auction.id}>
                  <TD className="max-w-[260px]">
                    <Link
                      href={`/admin/auctions/${auction.id}`}
                      className="line-clamp-1 font-medium hover:underline"
                    >
                      {auction.title}
                    </Link>
                  </TD>
                  <TD className="tabular text-right">{formatMinor(auction.priceMinor)}</TD>
                  <TD className="tabular text-right">{auction.bids.toLocaleString('en-GB')}</TD>
                  <TD className="tabular text-right">{auction.bidders}</TD>
                  <TD className="text-right whitespace-nowrap text-muted-foreground">
                    {formatRelative(auction.closeAt, now)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
        {can('fraud.view') ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle>Risk cases to review</CardTitle>
              <Link href="/admin/fraud" className="text-sm font-medium text-brand">
                Review
              </Link>
            </CardHeader>
            <CardContent>
              {data.openFraud.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>
              ) : (
                <ul className="space-y-3">
                  {data.openFraud.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.customerName}</span>
                        <span className="text-xs text-muted-foreground">
                          Score {item.assessment.score} · {item.assessment.signals.length} signals
                        </span>
                      </span>
                      <Badge variant={RISK_VARIANTS[item.assessment.riskClass]}>
                        {RISK_CLASS_LABELS[item.assessment.riskClass]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Signals prompt review only — no customer is blocked without an analyst decision.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {can('orders.view') ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Latest orders</CardTitle>
            <Link href="/admin/orders" className="text-sm font-medium text-brand">
              All orders
            </Link>
          </CardHeader>
          <Table>
            <THead>
              <TR>
                <TH>Order</TH>
                <TH>Customer</TH>
                <TH>Status</TH>
                <TH className="text-right">Total</TH>
                <TH className="text-right">Placed</TH>
              </TR>
            </THead>
            <TBody>
              {data.recentOrders.map((order) => (
                <TR key={order.id}>
                  <TD>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="tabular font-medium hover:underline"
                    >
                      {order.reference}
                    </Link>
                  </TD>
                  <TD className="max-w-[200px] truncate">{order.customerName}</TD>
                  <TD>
                    <OrderStatusBadge status={order.status} />
                  </TD>
                  <TD className="tabular text-right">{formatMinor(order.totalMinor)}</TD>
                  <TD className="text-right whitespace-nowrap text-muted-foreground">
                    {formatDateTime(order.createdAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : null}
    </div>
  )
}
