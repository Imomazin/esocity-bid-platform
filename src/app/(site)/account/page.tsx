import {
  CoinsIcon,
  CreditCardIcon,
  DownloadIcon,
  GavelIcon,
  KeyRoundIcon,
  PackageIcon,
  ShieldCheckIcon,
  TrophyIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type * as React from 'react'

import { AddressBook } from '@/components/account/address-book'
import { DemoSessionControls } from '@/components/account/demo-session-controls'
import { LimitsForm } from '@/components/account/limits-form'
import { ProfileForm } from '@/components/account/profile-form'
import { AuctionStatusBadge } from '@/components/auction/status-badge'
import { SignInGate } from '@/components/auth/sign-in-gate'
import { OrderStatusBadge } from '@/components/commerce/order-status'
import { Container } from '@/components/common/section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, Notice } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { getTierDefinition } from '@/domain/rewards'
import { formatMinor } from '@/lib/money'
import { formatDate, formatRelative } from '@/lib/time'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'
import type { AccountOverview } from '@/server/views'

export const metadata: Metadata = { title: 'Account', robots: { index: false } }

const SECTIONS = [
  { id: 'bidding', label: 'Bidding activity' },
  { id: 'orders', label: 'Purchases' },
  { id: 'responsible-use', label: 'Responsible use' },
  { id: 'profile', label: 'Profile' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'payments', label: 'Payment methods' },
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy & data' },
] as const

const OUTCOME_BADGES: Record<
  AccountOverview['biddingActivity'][number]['outcome'],
  { label: string; variant: 'success' | 'brand' | 'live' | 'neutral' | 'info' }
> = {
  LEADING: { label: 'Leading', variant: 'success' },
  OUTBID: { label: 'Outbid', variant: 'live' },
  WON: { label: 'Won', variant: 'brand' },
  LOST: { label: 'Not won', variant: 'neutral' },
  REFUNDED: { label: 'Bids refunded', variant: 'info' },
  LIVE: { label: 'Live', variant: 'live' },
}

function SectionCard({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default async function AccountPage() {
  const viewer = await getViewer()
  if (!viewer)
    return (
      <SignInGate
        title="Your account"
        description="Enter the demo to manage your profile, limits, orders and bidding activity."
        redirectTo="/account"
      />
    )
  const backend = getBackend()
  const overview = backend.accountOverview(viewer.userId)
  const now = backend.now()
  const tier = getTierDefinition(overview.rewards.tier)
  const stats = [
    {
      label: 'Bid credits',
      value: overview.wallet.available.toLocaleString('en-GB'),
      href: '/wallet',
      icon: CoinsIcon,
    },
    {
      label: 'Reward points',
      value: overview.rewards.balance.toLocaleString('en-GB'),
      href: '/rewards',
      icon: TrophyIcon,
    },
    {
      label: 'Orders',
      value: overview.stats.orders.toString(),
      href: '/orders',
      icon: PackageIcon,
    },
    {
      label: 'Auction wins',
      value: overview.stats.wins.toString(),
      href: '#bidding',
      icon: GavelIcon,
    },
  ]
  return (
    <Container className="py-8 sm:py-10">
      <div className="flex flex-col gap-5 pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={overview.profile.displayName} className="size-14 text-base" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {overview.profile.displayName}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>@{overview.profile.handle}</span>
              <span aria-hidden>·</span>
              <span>Member since {formatDate(overview.profile.memberSince)}</span>
              <Badge variant="brand">{tier.label}</Badge>
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings">Settings</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-2xl border bg-card p-4 shadow-card transition hover:shadow-raised"
          >
            <stat.icon className="size-4 text-muted-foreground" aria-hidden />
            <p className="tabular mt-3 text-2xl font-semibold tracking-tight">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Account sections" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-lg px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <SectionCard
            id="bidding"
            title="Bidding activity"
            description="Auctions you’ve bid in, with credits used and the outcome."
          >
            {overview.biddingActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You haven’t bid yet.{' '}
                <Link href="/auctions" className="font-medium text-brand underline">
                  Explore live auctions
                </Link>
              </p>
            ) : (
              <div className="-mx-5 sm:-mx-6">
                <Table>
                  <THead>
                    <TR>
                      <TH>Auction</TH>
                      <TH>Status</TH>
                      <TH className="text-right">Bids</TH>
                      <TH className="text-right">Credits used</TH>
                      <TH>Last bid</TH>
                      <TH>Outcome</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {overview.biddingActivity.map((row) => (
                      <TR key={row.auctionId}>
                        <TD className="max-w-[220px]">
                          {row.archived ? (
                            <span className="line-clamp-1 font-medium">{row.title}</span>
                          ) : (
                            <Link
                              href={`/auction/${row.auctionId}`}
                              className="line-clamp-1 font-medium hover:underline"
                            >
                              {row.title}
                            </Link>
                          )}
                        </TD>
                        <TD>
                          <AuctionStatusBadge status={row.status} />
                        </TD>
                        <TD className="tabular text-right">{row.bids}</TD>
                        <TD className="tabular text-right">{row.creditsSpent}</TD>
                        <TD className="whitespace-nowrap text-muted-foreground">
                          {formatRelative(row.lastBidAt, now)}
                        </TD>
                        <TD>
                          <Badge variant={OUTCOME_BADGES[row.outcome].variant}>
                            {OUTCOME_BADGES[row.outcome].label}
                          </Badge>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            id="orders"
            title="Recent purchases"
            description="Your latest orders. See all orders for tracking and receipts."
          >
            {overview.recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {overview.recentOrders.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link href={`/orders/${order.id}`} className="font-medium hover:underline">
                        {order.reference}
                      </Link>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {formatDate(order.createdAt)} ·{' '}
                        {order.lines.map((line) => line.name).join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusBadge status={order.status} />
                      <span className="tabular font-semibold">{formatMinor(order.totalMinor)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/orders">All orders</Link>
            </Button>
          </SectionCard>

          <SectionCard
            id="responsible-use"
            title="Responsible use"
            description="Set limits that our servers enforce on every bid and bid pack purchase — including AutoBid."
          >
            <LimitsForm initial={overview.limits} now={now} />
          </SectionCard>

          <SectionCard id="profile" title="Profile">
            <ProfileForm profile={overview.profile} />
          </SectionCard>

          <SectionCard id="addresses" title="Delivery addresses">
            <AddressBook initial={overview.addresses} />
          </SectionCard>

          <SectionCard id="payments" title="Payment methods">
            <div className="flex items-start gap-3 text-sm">
              <CreditCardIcon
                className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="space-y-1">
                <p>
                  Esocity never stores card numbers. Live payments are handled by a PCI
                  DSS-compliant hosted checkout, which can securely save cards for you.
                </p>
                <p className="text-muted-foreground">
                  In the demo, every payment is simulated at checkout — there is nothing to add
                  here.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="security" title="Security">
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <KeyRoundIcon
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div>
                  <p className="font-medium">Sign-in & two-step verification</p>
                  <p className="text-muted-foreground">
                    Production accounts sign in with a passwordless email link and optional two-step
                    verification. Demo accounts are anonymous, sandboxed sessions.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheckIcon
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div>
                  <p className="font-medium">This session</p>
                  <p className="text-muted-foreground">
                    Demo session · HTTP-only, same-site cookie · expires 30 days after you entered
                    the demo.
                  </p>
                </div>
              </div>
              <DemoSessionControls />
            </div>
          </SectionCard>

          <SectionCard id="privacy" title="Privacy & data">
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                You can request a copy of your data or ask us to delete your account at any time.
                Requests are handled by our support team and confirmed by email.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/support?category=account&subject=Data%20export%20request">
                    <DownloadIcon /> Request my data
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/support?category=account&subject=Account%20deletion%20request">
                    Delete my account
                  </Link>
                </Button>
              </div>
              <Notice tone="neutral">
                See our{' '}
                <Link href="/privacy" className="font-medium underline">
                  privacy notice
                </Link>{' '}
                for how data is used. Marketing is opt-in only.
              </Notice>
            </div>
          </SectionCard>
        </div>
      </div>
    </Container>
  )
}
