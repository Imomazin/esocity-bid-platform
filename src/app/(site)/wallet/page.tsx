import { BotIcon, CoinsIcon, InfoIcon, PlusIcon, ShieldCheckIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { SignInGate } from '@/components/auth/sign-in-gate'
import { Container, PageHeader } from '@/components/common/section'
import { LedgerTypeBadge } from '@/components/wallet/ledger-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/misc'
import { Progress } from '@/components/ui/progress'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { AUTOBID_STATUS_LABELS } from '@/domain/auction/autobid'
import { formatMinor } from '@/lib/money'
import { formatDate, formatDateTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Bid Wallet', robots: { index: false } }

export default async function WalletPage() {
  const viewer = await getViewer()
  if (!viewer)
    return (
      <SignInGate
        title="Your Bid Wallet"
        description="Enter the demo to receive a demo Bid Wallet with a full ledger history."
        redirectTo="/wallet"
      />
    )
  const wallet = getBackend().wallet(viewer.userId)
  const { summary, usage, limits } = wallet
  const stats = [
    { label: 'Purchased (lifetime)', value: summary.purchased, hint: 'From bid packs' },
    {
      label: 'Promotional (lifetime)',
      value: summary.promotional,
      hint: 'Bonus, rewards & goodwill',
    },
    { label: 'Used on bids', value: summary.used, hint: 'Spent in auctions' },
    { label: 'Refunded', value: summary.refunded, hint: 'Cancelled / no-sale auctions' },
    { label: 'Recovered', value: summary.recovered, hint: 'Via Buy Now recovery' },
    { label: 'Expired', value: summary.expired, hint: 'Promotional credits only' },
  ]
  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        eyebrow="Bid Wallet"
        title="Bid Wallet"
        description="Bid credits are separate from money. Every movement is an immutable ledger entry, and your balance is always the sum of the ledger."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/account#responsible-use">
                <ShieldCheckIcon /> Limits
              </Link>
            </Button>
            <Button asChild variant="brand">
              <Link href="/buy-bids">
                <PlusIcon /> Buy bids
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <div className="bg-primary p-6 text-primary-foreground sm:p-8">
            <p className="flex items-center gap-2 text-sm text-primary-foreground/70">
              <CoinsIcon className="size-4" aria-hidden /> Available bid credits
            </p>
            <p
              className="tabular mt-2 text-5xl font-semibold tracking-tight"
              data-testid="wallet-available"
            >
              {summary.available.toLocaleString('en-GB')}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-primary-foreground/60">Purchased</p>
                <p className="tabular text-lg font-semibold">
                  {summary.availablePurchased.toLocaleString('en-GB')}
                </p>
              </div>
              <div>
                <p className="text-primary-foreground/60">Promotional</p>
                <p className="tabular text-lg font-semibold">
                  {summary.availablePromotional.toLocaleString('en-GB')}
                </p>
              </div>
            </div>
          </div>
          <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="tabular text-xl font-semibold">
                  {stat.value.toLocaleString('en-GB')}
                </p>
                <p className="text-[11px] text-subtle-foreground">{stat.hint}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-5">
          {summary.expiringSoon ? (
            <Notice
              tone="warning"
              icon={<InfoIcon />}
              title={`${summary.expiringSoon.credits} promotional bids expire soon`}
            >
              They expire on {formatDateTime(summary.expiringSoon.expiresAt)}. Promotional bids are
              always used before purchased bids.
            </Notice>
          ) : null}
          {summary.lowBalance ? (
            <Notice tone="brand" title="Low balance">
              You have fewer than 20 bids. Top up only if it fits your budget.
            </Notice>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Usage & limits</CardTitle>
              <CardDescription>
                Your responsible-use limits are enforced on every bid, including AutoBid.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  label: 'Bids today',
                  used: usage.bidCreditsToday,
                  limit: limits.dailyBidLimit,
                  format: (n: number) => n.toLocaleString('en-GB'),
                },
                {
                  label: 'Bids this week',
                  used: usage.bidCreditsThisWeek,
                  limit: limits.weeklyBidLimit,
                  format: (n: number) => n.toLocaleString('en-GB'),
                },
                {
                  label: 'Bid pack spend this month',
                  used: usage.bidPackSpendThisMonthMinor,
                  limit: limits.monthlyBidPurchaseBudgetMinor,
                  format: (n: number) => formatMinor(n),
                },
              ].map((row) => (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{row.label}</span>
                    <span className="tabular text-muted-foreground">
                      {row.format(row.used)}{' '}
                      {row.limit !== null ? `of ${row.format(row.limit)}` : '· no limit set'}
                    </span>
                  </div>
                  {row.limit !== null ? (
                    <Progress
                      value={row.used}
                      max={row.limit}
                      label={row.label}
                      indicatorClassName={row.used / row.limit > 0.8 ? 'bg-warning' : 'bg-brand'}
                    />
                  ) : null}
                </div>
              ))}
              <Button asChild variant="link" size="sm">
                <Link href="/account#responsible-use">Manage limits and breaks</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {wallet.autobids.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BotIcon className="size-4" aria-hidden /> AutoBid agents
            </CardTitle>
            <CardDescription>
              Server-side agents bid for you in the final seconds, within your limits.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {wallet.autobids.map((rule) => (
                <li
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <Link href={`/auction/${rule.auctionId}`} className="font-medium hover:underline">
                    {rule.auctionTitle}
                  </Link>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span className="tabular">
                      {rule.bidsPlaced}/{rule.maxBids} bids
                    </span>
                    <Badge variant={rule.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {AUTOBID_STATUS_LABELS[rule.status]}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
          <CardDescription>
            Consecutive bids in the same auction are grouped. Each group is made of individual
            ledger entries.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-0">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="pl-5 sm:pl-6">Date</TH>
                <TH>Type</TH>
                <TH>Description</TH>
                <TH className="text-right">Credits</TH>
                <TH className="pr-5 text-right sm:pr-6">Balance</TH>
              </TR>
            </THead>
            <TBody>
              {wallet.entries.map((entry) => (
                <TR key={entry.id}>
                  <TD className="pl-5 whitespace-nowrap text-muted-foreground sm:pl-6">
                    {formatDate(entry.createdAt)}
                  </TD>
                  <TD>
                    <LedgerTypeBadge type={entry.type} />
                  </TD>
                  <TD className="min-w-56">
                    <span>{entry.description}</span>
                    {entry.count > 1 ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({entry.count} bids)
                      </span>
                    ) : null}
                    <span className="block text-[11px] text-subtle-foreground">
                      {entry.bucket === 'PURCHASED' ? 'Purchased credits' : 'Promotional credits'}
                      {entry.expiresAt && entry.credits > 0
                        ? ` · expires ${formatDate(entry.expiresAt)}`
                        : ''}
                    </span>
                  </TD>
                  <TD
                    className={cn(
                      'tabular text-right font-semibold',
                      entry.credits > 0 ? 'text-success' : 'text-foreground',
                    )}
                  >
                    {entry.credits > 0 ? '+' : '−'}
                    {Math.abs(entry.credits).toLocaleString('en-GB')}
                  </TD>
                  <TD className="tabular pr-5 text-right text-muted-foreground sm:pr-6">
                    {entry.balanceAfter.toLocaleString('en-GB')}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </Container>
  )
}
