import {
  ChevronRightIcon,
  PackageIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  TruckIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AuctionCard } from '@/components/auction/auction-card'
import { AuctionPoller } from '@/components/auction/live-bits'
import { LiveAuctionPanel } from '@/components/auction/live-auction-panel'
import { Container } from '@/components/common/section'
import { giftCardLabel } from '@/components/product/product-art'
import { ProductGallery } from '@/components/product/product-gallery'
import { WatchButton } from '@/components/product/watch-button'
import { Badge } from '@/components/ui/badge'
import { formatMinor } from '@/lib/money'
import { formatDateTime } from '@/lib/time'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export async function generateMetadata({ params }: PageProps<'/auction/[id]'>): Promise<Metadata> {
  const { id } = await params
  const auction = getBackend().auctionDetail(id)
  if (!auction) return { title: 'Auction not found', robots: { index: false } }
  return {
    title: `${auction.title} — live auction`,
    description: `Bid on ${auction.title}. Reference value ${formatMinor(auction.product.referencePriceMinor)}. Transparent rules: every bid adds ${formatMinor(auction.rules.bidIncrementMinor)}.`,
    // Auction pages are ephemeral: keep them out of the index but let crawlers follow to the product.
    robots: { index: false, follow: true },
    alternates: { canonical: `/product/${auction.product.slug}` },
  }
}

export default async function AuctionPage({ params }: PageProps<'/auction/[id]'>) {
  const { id } = await params
  const viewer = await getViewer()
  const auction = getBackend().auctionDetail(id, viewer?.userId)
  if (!auction) notFound()
  const signedIn = !!viewer
  const rules = auction.fullRules
  return (
    <Container className="py-6 sm:py-8">
      <AuctionPoller ids={auction.similar.map((item) => item.id)} intervalMs={3_000} />
      <nav
        aria-label="Breadcrumb"
        className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link href="/auctions" className="hover:text-foreground">
          Auctions
        </Link>
        <ChevronRightIcon className="size-3.5" aria-hidden />
        <Link href={`/category/${auction.product.categorySlug}`} className="hover:text-foreground">
          {auction.product.categoryName}
        </Link>
        <ChevronRightIcon className="size-3.5" aria-hidden />
        <span className="truncate text-foreground" aria-current="page">
          {auction.title}
        </span>
      </nav>
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-x-10">
        <div className="space-y-8 lg:col-start-1">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {auction.label ? <Badge variant="outline">{auction.label}</Badge> : null}
              {auction.rules.hardStop ? <Badge variant="warning">Hard stop</Badge> : null}
              {auction.rules.reserve ? (
                <Badge variant="neutral">Reserve price applies</Badge>
              ) : null}
              {auction.rules.minimumParticipants > 2 ? (
                <Badge variant="neutral">Min. {auction.rules.minimumParticipants} bidders</Badge>
              ) : null}
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{auction.product.brandName}</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {auction.title}
                </h1>
              </div>
              <WatchButton
                type="AUCTION"
                targetId={auction.id}
                initialWatched={auction.watched}
                signedIn={signedIn}
                label="Watch"
                className="shrink-0 border"
              />
            </div>
          </div>
          <ProductGallery
            images={
              auction.product
                ? [0, 1, 2].map((variant) => ({
                    alt: `${auction.title} image ${variant + 1}`,
                    art: auction.product.art,
                    variant,
                  }))
                : []
            }
            palette={auction.product.palette}
            uid={auction.product.slug}
            label={giftCardLabel(auction.product.name)}
            name={auction.title}
          />
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="lg:sticky lg:top-24">
            <LiveAuctionPanel initial={auction} signedIn={signedIn} />
          </div>
        </div>
        <div className="space-y-8 lg:col-start-1">
          <section aria-labelledby="about-heading" className="space-y-4">
            <h2 id="about-heading" className="text-lg font-semibold">
              About this item
            </h2>
            <p className="leading-relaxed text-muted-foreground">{auction.description}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {auction.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-2 text-sm">
                  <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {highlight}
                </li>
              ))}
            </ul>
            <Link
              href={`/product/${auction.product.slug}`}
              className="inline-block text-sm font-medium text-brand hover:underline"
            >
              Full product details and specifications →
            </Link>
          </section>
          <section
            aria-labelledby="rules-heading"
            className="rounded-2xl border bg-surface p-5 sm:p-6"
          >
            <h2 id="rules-heading" className="text-lg font-semibold">
              Auction rules
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {auction.rulesText.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {[
                ['Bid cost', `${rules.bidCreditCost} credit${rules.bidCreditCost > 1 ? 's' : ''}`],
                ['Price increment', formatMinor(rules.bidIncrementMinor)],
                ['Timer extension', `${rules.timerExtensionSeconds}s`],
                ['Starts', formatDateTime(auction.startsAt)],
                ['Winner payment window', `${rules.winnerPaymentWindowHours} hours`],
                [
                  'Buy Now',
                  auction.rules.buyNowEnabled
                    ? formatMinor(auction.rules.buyNowPriceMinor)
                    : 'Not available',
                ],
                [
                  'Bid recovery',
                  auction.rules.recoveryEnabled
                    ? rules.recoveryMode === 'RETURN_BIDS'
                      ? `Bids returned (${rules.recoveryWindowHours}h)`
                      : `Price credit (${rules.recoveryWindowHours}h)`
                    : 'Not offered',
                ],
                [
                  'Eligibility',
                  rules.eligibility.minimumTier
                    ? `${rules.eligibility.minimumTier.toLowerCase()} members+`
                    : rules.eligibility.maxPreviousWins !== null
                      ? `≤ ${rules.eligibility.maxPreviousWins} previous wins`
                      : 'All members 18+',
                ],
                ['AutoBid', auction.rules.autoBidEnabled ? 'Available' : 'Not available'],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt className="text-xs text-muted-foreground">{term}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <Link
              href="/auction-rules"
              className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
            >
              Read the full auction rules
            </Link>
          </section>
          <section aria-labelledby="shipping-heading" className="grid gap-4 sm:grid-cols-3">
            <h2 id="shipping-heading" className="sr-only">
              Delivery and returns
            </h2>
            {[
              {
                icon: TruckIcon,
                title: 'Delivery',
                body: 'Winners choose delivery at payment. Standard is free over £50; express and next-day available.',
              },
              {
                icon: PackageIcon,
                title: 'Genuine & new',
                body: 'Supplied by vetted partners with full manufacturer warranty.',
              },
              {
                icon: RotateCcwIcon,
                title: 'Returns',
                body: 'Buy Now purchases have 30-day returns. Auction wins are covered by warranty.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border p-4">
                <item.icon className="size-5 text-brand" aria-hidden />
                <p className="mt-2 text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </section>
        </div>
      </div>
      {auction.similar.length > 0 ? (
        <section className="mt-14" aria-labelledby="similar-heading">
          <h2 id="similar-heading" className="mb-5 text-xl font-semibold tracking-tight">
            Similar auctions
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {auction.similar.map((item) => (
              <AuctionCard
                key={item.id}
                auction={item}
                serverTime={auction.serverTime}
                signedIn={signedIn}
              />
            ))}
          </div>
        </section>
      ) : null}
      {/* Room for the sticky mobile bid bar, so it never covers the end of the page. */}
      <div className="h-16 lg:hidden" aria-hidden />
    </Container>
  )
}
