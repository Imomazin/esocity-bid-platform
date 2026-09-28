import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BotIcon,
  CoinsIcon,
  CrownIcon,
  GavelIcon,
  HandCoinsIcon,
  ScaleIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StoreIcon,
  TimerIcon,
  TrophyIcon,
  UsersIcon,
  ZapIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { AuctionCard } from '@/components/auction/auction-card'
import {
  AuctionPoller,
  LiveBidders,
  LiveCountdown,
  LiveLeader,
  LivePrice,
  LiveStatus,
} from '@/components/auction/live-bits'
import { CategoryTiles } from '@/components/common/category-tiles'
import { Container, Rail, SectionHeader } from '@/components/common/section'
import { DropCard } from '@/components/commerce/drop-card'
import { EnterDemoButton } from '@/components/layout/enter-demo-button'
import { giftCardLabel, ProductMedia } from '@/components/product/product-art'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { TIER_DEFINITIONS } from '@/domain/rewards'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/utils'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = {
  title: 'Esocity Bid — The Intelligent Live Marketplace',
  alternates: { canonical: '/' },
}

const STEPS = [
  {
    icon: CoinsIcon,
    title: 'Get bid credits',
    body: 'Buy a bid pack or earn promotional credits. Each auction shows exactly what a bid costs before you commit.',
  },
  {
    icon: GavelIcon,
    title: 'Bid in live auctions',
    body: 'Every bid raises the price by a fixed increment and guarantees seconds remain on the clock, so everyone can respond.',
  },
  {
    icon: TimerIcon,
    title: 'Win — or buy it now',
    body: 'When the server’s clock ends, the leader wins and pays the final price. Not your day? Buy Now with bid recovery where offered.',
  },
  {
    icon: TrophyIcon,
    title: 'Earn rewards',
    body: 'Collect Esocity Rewards on purchases and achievements — never on bid spend — and unlock member-only drops.',
  },
]

const DIFFERENTIATORS = [
  {
    icon: GavelIcon,
    title: 'Live auctions',
    body: 'Server-authoritative auctions with transparent rules and visible bid history.',
  },
  {
    icon: StoreIcon,
    title: 'Marketplace',
    body: 'A curated catalogue across 12 categories at fixed prices, delivered fast.',
  },
  {
    icon: ZapIcon,
    title: 'Flash Drops',
    body: 'Limited-stock, fixed-price releases with fair per-member limits.',
  },
  {
    icon: HandCoinsIcon,
    title: 'Buy Now',
    body: 'Skip the auction any time. Bid recovery can return eligible bids.',
  },
  {
    icon: TrophyIcon,
    title: 'Rewards',
    body: 'Tiers, achievements and perks that reward engagement — not spend.',
  },
  {
    icon: SparklesIcon,
    title: 'Personalisation',
    body: 'Recommendations tuned to what you watch, browse and buy.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Responsible use',
    body: 'Daily and weekly bid limits, monthly budgets and cool-off breaks.',
  },
  {
    icon: BotIcon,
    title: 'Fraud intelligence',
    body: 'Risk signals and bot detection keep auctions fair for real members.',
  },
]

const TRUST = [
  {
    icon: ScaleIcon,
    title: 'The server decides',
    body: 'Countdowns and winners are determined by our servers — never by your browser.',
  },
  {
    icon: ScrollTextIcon,
    title: 'Every bid on record',
    body: 'Bids and wallet movements are immutable ledger entries you can review.',
  },
  {
    icon: BadgeCheckIcon,
    title: 'See what winners paid',
    body: 'Completed auctions show the final price and how many bids the winner used.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Your limits, enforced',
    body: 'Limits apply to every bid, including AutoBid. Raising a limit takes 24 hours.',
  },
]

export default async function LandingPage() {
  const viewer = await getViewer()
  const backend = getBackend()
  const data = backend.landing()
  const featured = data.liveNow[0]
  const signedIn = !!viewer
  const pollIds = [...data.liveNow.map((auction) => auction.id)]
  return (
    <>
      <AuctionPoller ids={pollIds} intervalMs={2_000} />
      {/* 1 · Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: 'var(--hero-glow)' }}
          aria-hidden
        />
        <Container className="relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-card backdrop-blur">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-live" aria-hidden />
              {data.liveCount} auctions live now · {data.productCount} products
            </p>
            <h1 className="mt-6 text-5xl font-semibold tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              ESOCITY <span className="text-brand">BID</span>
            </h1>
            <p className="mt-3 text-xl font-medium tracking-tight text-foreground sm:text-2xl">
              The Intelligent Live Marketplace.
            </p>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Discover products. Join live auctions. Win through transparent bidding. Buy instantly.
              Earn rewards — all in one place, with the rules in plain sight.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="primary" size="xl">
                <Link href="/auctions">
                  <GavelIcon />
                  Explore Auctions
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <Link href="/marketplace">
                  <StoreIcon />
                  Enter Marketplace
                </Link>
              </Button>
            </div>
            <Link
              href="/how-it-works"
              className="group mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              How bidding works — costs, timers and winners explained
              <ArrowRightIcon
                className="size-4 transition group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>
          {featured ? (
            <div className="relative animate-rise [animation-delay:120ms]">
              <div
                className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-brand/15 via-transparent to-live/10 blur-2xl"
                aria-hidden
              />
              <Link
                href={`/auction/${featured.id}`}
                className="relative block overflow-hidden rounded-3xl border bg-card shadow-float transition hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="relative">
                  <ProductMedia
                    art={featured.product.art}
                    palette={featured.product.palette}
                    uid={`hero-${featured.product.slug}`}
                    label={giftCardLabel(featured.product.name)}
                    alt={featured.title}
                    className="aspect-[5/4]"
                  />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <LiveStatus initial={featured} />
                    <span className="rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-medium shadow-card backdrop-blur">
                      Featured
                    </span>
                  </div>
                </div>
                <div className="space-y-4 p-5 sm:p-6">
                  <div>
                    <p className="text-xs text-muted-foreground">{featured.product.brandName}</p>
                    <p className="text-lg font-semibold tracking-tight">{featured.title}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        Current price
                      </p>
                      <p className="text-3xl font-semibold tracking-tight">
                        <LivePrice initial={featured} />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Reference{' '}
                        {formatMinor(featured.product.referencePriceMinor, 'GBP', {
                          trimZeroMinor: true,
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        Time left
                      </p>
                      <LiveCountdown initial={featured} serverTime={data.serverTime} size="lg" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CrownIcon className="size-4 text-warning" aria-hidden />
                      <LiveLeader initial={featured} />
                    </span>
                    <span className="flex items-center gap-1.5">
                      <UsersIcon className="size-4" aria-hidden />
                      <LiveBidders initial={featured} /> bidders
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          ) : null}
        </Container>
      </section>

      {/* 2 · Live now */}
      <section className="py-14 sm:py-16">
        <Container>
          <SectionHeader
            eyebrow={
              <span className="inline-flex items-center gap-1.5 text-live">
                <span className="size-1.5 animate-pulse-dot rounded-full bg-live" aria-hidden />{' '}
                Live now
              </span>
            }
            title="Auctions ending soon"
            description="Prices and countdowns update live from our servers. Every bid shows its cost up front."
            href="/auctions"
            linkLabel="All live auctions"
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.liveNow.slice(0, 6).map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                serverTime={data.serverTime}
                signedIn={signedIn}
              />
            ))}
          </div>
        </Container>
      </section>

      {/* 3 · How it works */}
      <section className="border-y bg-surface py-14 sm:py-16">
        <Container>
          <SectionHeader
            eyebrow="How Esocity Bid works"
            title="Transparent by design"
            description="No hidden mechanics. Here is exactly how bidding, winning and buying work."
            href="/how-it-works"
            linkLabel="Read the full guide"
          />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative rounded-2xl border bg-card p-5 shadow-card">
                <span className="absolute top-5 right-5 font-mono text-xs text-subtle-foreground">
                  0{index + 1}
                </span>
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
                  <step.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* 4 · Marketplace */}
      <section className="py-14 sm:py-16">
        <Container>
          <SectionHeader
            eyebrow="Marketplace"
            title="Buy it now, delivered fast"
            description="Fixed prices, free standard delivery over £50 and 30-day returns."
            href="/marketplace"
            linkLabel="Enter Marketplace"
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {data.marketplace.map((product) => (
              <ProductCard key={product.id} product={product} signedIn={signedIn} />
            ))}
          </div>
        </Container>
      </section>

      {/* 5 · Flash Drops */}
      <section className="border-y bg-surface py-14 sm:py-16">
        <Container>
          <SectionHeader
            eyebrow={
              <span className="inline-flex items-center gap-1.5">
                <ZapIcon className="size-3.5" aria-hidden /> Flash Drops
              </span>
            }
            title="Limited stock. Fixed price. Short windows."
            description="No bidding — just fair, first-come releases with per-member limits."
            href="/drops"
            linkLabel="All drops"
          />
          <div className="grid gap-5 md:grid-cols-3">
            {data.drops.map((drop) => (
              <DropCard
                key={drop.id}
                drop={drop}
                serverTime={data.serverTime}
                signedIn={signedIn}
              />
            ))}
          </div>
        </Container>
      </section>

      {/* 6 · Rewards */}
      <section className="py-14 sm:py-16">
        <Container className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold tracking-wider text-brand uppercase">
              Esocity Rewards
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Rewards that respect your wallet
            </h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Earn points on product purchases and achievements — including one for setting your own
              spending limits. Points never accrue on bid pack purchases.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/rewards">
                Explore Rewards <ArrowRightIcon />
              </Link>
            </Button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {TIER_DEFINITIONS.map((tier, index) => (
              <li
                key={tier.tier}
                className={cn(
                  'rounded-2xl border p-5',
                  index === 3 ? 'bg-primary text-primary-foreground' : 'bg-card',
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{tier.label}</p>
                  <p
                    className={cn(
                      'text-xs',
                      index === 3 ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}
                  >
                    {tier.threshold.toLocaleString('en-GB')}+ pts
                  </p>
                </div>
                <ul
                  className={cn(
                    'mt-3 space-y-1.5 text-sm',
                    index === 3 ? 'text-primary-foreground/80' : 'text-muted-foreground',
                  )}
                >
                  {tier.perks.slice(0, 3).map((perk) => (
                    <li key={perk}>• {perk}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 7 · Why Esocity Bid */}
      <section className="border-y bg-surface py-14 sm:py-16">
        <Container>
          <SectionHeader
            eyebrow="Why Esocity Bid"
            title="More than an auction site"
            description="Live auctions are one part of a complete, intelligent commerce platform."
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DIFFERENTIATORS.map((item) => (
              <li key={item.title} className="rounded-2xl border bg-card p-5">
                <item.icon className="size-5 text-brand" aria-hidden />
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 8 · Trust */}
      <section className="py-14 sm:py-16">
        <Container>
          <div className="overflow-hidden rounded-3xl bg-primary text-primary-foreground">
            <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="text-xs font-semibold tracking-wider text-primary-foreground/60 uppercase">
                  Trust & transparency
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Fair play is engineered in
                </h2>
                <p className="mt-3 text-primary-foreground/70">
                  Our auction engine is server-authoritative, every bid is recorded in an immutable
                  ledger, and the mechanics are published in full.
                </p>
                <Button asChild variant="secondary" className="mt-6">
                  <Link href="/trust">How we keep auctions fair</Link>
                </Button>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {TRUST.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-2xl bg-primary-foreground/[0.06] p-5 ring-1 ring-primary-foreground/10"
                  >
                    <item.icon className="size-5" aria-hidden />
                    <h3 className="mt-3 font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-primary-foreground/70">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* 9 · Categories */}
      <section className="pb-14 sm:pb-16">
        <Container>
          <SectionHeader
            eyebrow="Shop by category"
            title="Twelve categories, one marketplace"
            href="/marketplace"
            linkLabel="Browse all"
          />
          <CategoryTiles categories={data.categories} />
        </Container>
      </section>

      {/* 10 · Recently won */}
      <section className="border-y bg-surface py-14 sm:py-16">
        <Container>
          <SectionHeader
            eyebrow="Recently won"
            title="Real outcomes, fully disclosed"
            description="Final prices alongside the number of bids each winner used. Demonstration data — bidders are simulated."
            href="/auctions?status=completed"
            linkLabel="All results"
          />
          <Rail>
            {data.recentlyWon.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                serverTime={data.serverTime}
                signedIn={signedIn}
                className="w-72 shrink-0 snap-start"
              />
            ))}
          </Rail>
        </Container>
      </section>

      {/* 11 · CTA */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="relative overflow-hidden rounded-3xl border bg-card p-8 text-center shadow-card sm:p-14">
            <div
              className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-64 w-[640px] rounded-full blur-3xl"
              style={{ background: 'var(--hero-glow)' }}
              aria-hidden
            />
            <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">
              Experience the platform
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-muted-foreground">
              {signedIn
                ? 'You’re in the demo. Your wallet is loaded — find an auction or browse the marketplace.'
                : 'Enter the demo to receive a simulated Bid Wallet, place bids against simulated bidders, try AutoBid and complete a demo checkout.'}
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              {signedIn ? (
                <Button asChild variant="brand" size="xl">
                  <Link href="/discover">Go to Discover</Link>
                </Button>
              ) : (
                <EnterDemoButton size="xl" redirectTo="/discover">
                  Enter the demo platform
                </EnterDemoButton>
              )}
              <Button asChild variant="outline" size="xl">
                <Link href="/how-it-works">How bidding works</Link>
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}
