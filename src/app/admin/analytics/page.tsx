import type { Metadata } from 'next'
import Link from 'next/link'

import { AccessDenied, AdminPageHeader, StatTile } from '@/components/admin/admin-ui'
import { MultiLineChart, TrendAreaChart } from '@/components/admin/charts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { OUTCOME_LABELS } from '@/domain/auction/bidding'
import { formatBasisPoints, formatMinor } from '@/lib/money'
import { describeDuration, formatDateTime } from '@/lib/time'
import { formatCompact, formatPercent } from '@/lib/utils'
import { adminAccess } from '@/server/auth/admin-access'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Analytics' }

/** Sequential blue ramp steps for the retention heatmap, light to dark. */
const RETENTION_STEPS = [
  'var(--viz-seq-1)',
  'var(--viz-seq-2)',
  'var(--viz-seq-3)',
  'var(--viz-seq-4)',
  'var(--viz-seq-5)',
  'var(--viz-seq-6)',
]

function retentionCell(value: number) {
  const index = Math.min(RETENTION_STEPS.length - 1, Math.floor(value * RETENTION_STEPS.length))
  // Ink on the light steps, white on the dark ones, so the value always clears contrast.
  return { background: RETENTION_STEPS[index], color: index >= 3 ? '#ffffff' : '#0b0b0b' }
}

export default async function AnalyticsPage() {
  const access = await adminAccess('analytics.view')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const backend = getBackend()
  const analytics = backend.admin.customerAnalytics()
  const economics = backend.admin.economics()
  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Analytics"
        description="Customer behaviour and auction economics over the last 30 days. Demo figures are simulated; economics are estimates, not profit."
      />

      <section
        aria-label="Customer metrics"
        className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6"
      >
        <StatTile label="New users" value={formatCompact(analytics.newUsers)} hint="Last 30 days" />
        <StatTile
          label="Returning users (daily avg)"
          value={formatCompact(analytics.returningUsers)}
          hint="Last 30 days"
        />
        <StatTile
          label="Session conversion"
          value={formatPercent(analytics.conversion, 2)}
          hint="Orders ÷ sessions"
        />
        <StatTile
          label="Auction participation"
          value={formatPercent(analytics.auctionParticipation)}
          hint="Bidders ÷ active users"
        />
        <StatTile
          label="Bid pack conversion"
          value={formatPercent(analytics.bidPackConversion)}
          hint="Purchases ÷ pack page views"
        />
        <StatTile
          label="Buy Now conversion"
          value={formatPercent(analytics.buyNowConversion)}
          hint="From auction pages"
        />
        <StatTile
          label="Repeat purchase rate"
          value={formatPercent(analytics.repeatPurchaseRate)}
          hint="Customers with 2+ orders"
        />
        <StatTile
          label="Average order value"
          value={formatMinor(analytics.averageOrderValue)}
          hint="Merchandise orders"
        />
        <StatTile
          label="Watchlist → bid"
          value={formatPercent(analytics.watchlistToParticipation)}
          hint="Watchers who went on to bid"
        />
        <StatTile
          label="Flash Drop conversion"
          value={formatPercent(analytics.dropConversion)}
          hint="Purchases ÷ drop views"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New and returning users</CardTitle>
            <CardDescription>Daily, last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <MultiLineChart
              data={analytics.series}
              series={[
                { key: 'returningUsers', label: 'Returning users', color: 'var(--viz-1)' },
                { key: 'newUsers', label: 'New users', color: 'var(--viz-2)' },
              ]}
              label="Daily new and returning users, last 30 days"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Session conversion</CardTitle>
            <CardDescription>Completed orders per session, daily.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendAreaChart
              data={analytics.series}
              dataKey="conversion"
              name="Conversion"
              axisFormat="percent1"
              valueFormat="percent2"
              label="Daily session conversion, last 30 days"
              height={244}
            />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Retention by monthly cohort</CardTitle>
          <CardDescription>
            Share of each sign-up cohort active in later months. Darker is higher.
          </CardDescription>
        </CardHeader>
        <CardContent className="viz-root overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-[2px] text-sm">
            <caption className="sr-only">Monthly cohort retention</caption>
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="px-2 py-1.5 text-left font-medium">
                  Cohort
                </th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">
                  Members
                </th>
                {['Month 0', 'Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5'].map((month) => (
                  <th key={month} scope="col" className="px-2 py-1.5 text-center font-medium">
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analytics.cohorts.map((cohort) => (
                <tr key={cohort.cohort}>
                  <th scope="row" className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                    {cohort.cohort}
                  </th>
                  <td className="tabular px-2 py-1.5 text-right text-muted-foreground">
                    {cohort.size.toLocaleString('en-GB')}
                  </td>
                  {Array.from({ length: 6 }, (_, index) => {
                    const value = cohort.retention[index]
                    return value === undefined ? (
                      <td
                        key={index}
                        className="rounded-md bg-muted/40"
                        aria-label="Not yet available"
                      />
                    ) : (
                      <td
                        key={index}
                        className="tabular rounded-md px-2 py-1.5 text-center text-xs font-medium"
                        style={retentionCell(value)}
                      >
                        {formatPercent(value, 0)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auction economics · recently completed</CardTitle>
          <CardDescription>
            Estimates from purchased bid credits used, winner payments and Buy Now sales, minus
            product cost. Shipping, payment fees, promotional credit cost and overheads are
            excluded.
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Auction</TH>
                <TH>Outcome</TH>
                <TH className="text-right">Reference</TH>
                <TH className="text-right">Final price</TH>
                <TH className="text-right">Bids</TH>
                <TH className="text-right">Bidders</TH>
                <TH className="text-right">Gross revenue (est.)</TH>
                <TH className="text-right">Contribution (est.)</TH>
                <TH className="text-right">Winner saving</TH>
                <TH className="text-right">Duration</TH>
              </TR>
            </THead>
            <TBody>
              {economics.map((row) => (
                <TR key={row.id}>
                  <TD className="max-w-[240px]">
                    <Link
                      href={`/admin/auctions/${row.id}`}
                      className="line-clamp-1 font-medium hover:underline"
                    >
                      {row.title}
                    </Link>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(row.closedAt)}
                    </span>
                  </TD>
                  <TD>
                    <Badge variant={row.outcome === 'WON' ? 'success' : 'neutral'}>
                      {OUTCOME_LABELS[row.outcome]}
                    </Badge>
                  </TD>
                  <TD className="tabular text-right">{formatMinor(row.referencePriceMinor)}</TD>
                  <TD className="tabular text-right">{formatMinor(row.finalPriceMinor)}</TD>
                  <TD className="tabular text-right">{row.bidCount.toLocaleString('en-GB')}</TD>
                  <TD className="tabular text-right">{row.uniqueBidders}</TD>
                  <TD className="tabular text-right">
                    {formatMinor(row.economics.grossRevenueEstimateMinor)}
                  </TD>
                  <TD
                    className={`tabular text-right ${row.economics.grossContributionEstimateMinor < 0 ? 'text-danger-foreground' : ''}`}
                  >
                    {formatMinor(row.economics.grossContributionEstimateMinor)}
                  </TD>
                  <TD className="tabular text-right">
                    {row.outcome === 'WON'
                      ? formatBasisPoints(row.economics.winnerSavingsBps)
                      : '—'}
                  </TD>
                  <TD className="text-right whitespace-nowrap text-muted-foreground">
                    {describeDuration(row.economics.timeToCloseMs)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
