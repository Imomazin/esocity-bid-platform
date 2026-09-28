import { BellRingIcon, CompassIcon, FlameIcon, SparklesIcon, TrendingUpIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { AuctionCard } from '@/components/auction/auction-card'
import { AuctionPoller } from '@/components/auction/live-bits'
import { CategoryTiles } from '@/components/common/category-tiles'
import { Container, Rail, SectionHeader } from '@/components/common/section'
import { DropCard } from '@/components/commerce/drop-card'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = {
  title: 'Discover',
  description:
    'Live auctions ending soon, trending products, Flash Drops and recommendations picked for you.',
  alternates: { canonical: '/discover' },
}

export default async function DiscoverPage() {
  const viewer = await getViewer()
  const data = getBackend().discover(viewer?.userId)
  const signedIn = !!viewer
  const pollIds = [
    ...new Set(
      [
        ...data.liveNow,
        ...data.endingSoon,
        ...data.trending,
        ...data.newAuctions,
        ...data.watchlistReminders,
      ].map((auction) => auction.id),
    ),
  ]
  return (
    <div className="pb-6">
      <AuctionPoller ids={pollIds} />
      <section className="border-b bg-surface">
        <Container className="flex flex-col gap-4 py-8 sm:flex-row sm:items-end sm:justify-between sm:py-10">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-brand uppercase">
              <CompassIcon className="size-4" aria-hidden /> Discover
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {viewer ? `Welcome back, ${viewer.firstName}` : 'Discover what’s live'}
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              {data.liveNow.length} live auctions,{' '}
              {data.drops.filter((drop) => drop.status === 'LIVE').length} Flash Drops live now and
              a marketplace of fixed-price deals.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="brand">
              <Link href="/auctions">Live auctions</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/marketplace">Marketplace</Link>
            </Button>
          </div>
        </Container>
      </section>

      {data.watchlistReminders.length > 0 ? (
        <Container className="pt-10">
          <SectionHeader
            eyebrow={
              <span className="inline-flex items-center gap-1.5">
                <BellRingIcon className="size-3.5" aria-hidden /> Watchlist reminders
              </span>
            }
            title="Auctions you’re watching"
            href="/watchlist"
            linkLabel="Your watchlist"
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.watchlistReminders.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                serverTime={data.serverTime}
                signedIn={signedIn}
              />
            ))}
          </div>
        </Container>
      ) : null}

      <Container className="pt-10">
        <SectionHeader
          eyebrow={
            <span className="inline-flex items-center gap-1.5 text-live">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-live" aria-hidden /> Live
              now
            </span>
          }
          title="Featured live auctions"
          href="/auctions"
        />
        <Rail>
          {data.liveNow.map((auction) => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              serverTime={data.serverTime}
              signedIn={signedIn}
              className="w-72 shrink-0 snap-start sm:w-80"
            />
          ))}
        </Rail>
      </Container>

      <Container className="pt-12">
        <SectionHeader
          eyebrow="Ending soon"
          title="Last chance to bid"
          description="The clock extends with every bid — but not for long."
          href="/auctions"
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {data.endingSoon.slice(0, 4).map((auction) => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              serverTime={data.serverTime}
              signedIn={signedIn}
            />
          ))}
        </div>
      </Container>

      <Container className="pt-12">
        <SectionHeader
          eyebrow={
            <span className="inline-flex items-center gap-1.5">
              <SparklesIcon className="size-3.5" aria-hidden /> Recommended for you
            </span>
          }
          title={signedIn ? 'Picked for you' : 'Popular right now'}
          description="Based on what you browse, watch, bid on and buy."
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
          {data.recommended.slice(0, 8).map(({ product, reason }) => (
            <ProductCard key={product.id} product={product} signedIn={signedIn} reason={reason} />
          ))}
        </div>
      </Container>

      {data.becauseYouWatched ? (
        <Container className="pt-12">
          <SectionHeader eyebrow="Because you watched" title={data.becauseYouWatched.title} />
          <Rail>
            {data.becauseYouWatched.items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                signedIn={signedIn}
                className="w-48 shrink-0 snap-start sm:w-56"
              />
            ))}
          </Rail>
        </Container>
      ) : null}

      <Container className="pt-12">
        <SectionHeader
          eyebrow={
            <span className="inline-flex items-center gap-1.5">
              <TrendingUpIcon className="size-3.5" aria-hidden /> Trending
            </span>
          }
          title="Most active auctions"
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {data.trending.map((auction) => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              serverTime={data.serverTime}
              signedIn={signedIn}
            />
          ))}
        </div>
      </Container>

      {data.newAuctions.length > 0 ? (
        <Container className="pt-12">
          <SectionHeader
            eyebrow="New auctions"
            title="Starting soon"
            description="Add them to your watchlist to be notified when they go live."
            href="/auctions?status=scheduled"
          />
          <Rail>
            {data.newAuctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                serverTime={data.serverTime}
                signedIn={signedIn}
                className="w-72 shrink-0 snap-start sm:w-80"
              />
            ))}
          </Rail>
        </Container>
      ) : null}

      <Container className="pt-12">
        <SectionHeader
          eyebrow={
            <span className="inline-flex items-center gap-1.5">
              <FlameIcon className="size-3.5" aria-hidden /> Flash Drops
            </span>
          }
          title="Limited stock, fixed price"
          href="/drops"
        />
        <div className="grid gap-5 md:grid-cols-3">
          {data.drops.slice(0, 3).map((drop) => (
            <DropCard key={drop.id} drop={drop} serverTime={data.serverTime} signedIn={signedIn} />
          ))}
        </div>
      </Container>

      <Container className="pt-12">
        <SectionHeader
          eyebrow="Buy Now"
          title="In stock, ready to ship"
          href="/marketplace"
          linkLabel="Marketplace"
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
          {data.buyNow.map((product) => (
            <ProductCard key={product.id} product={product} signedIn={signedIn} />
          ))}
        </div>
      </Container>

      <Container className="pt-12">
        <SectionHeader
          eyebrow="Popular in"
          title={data.popularInCategory.category.name}
          href={`/category/${data.popularInCategory.category.slug}`}
        />
        <Rail>
          {data.popularInCategory.items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              signedIn={signedIn}
              className="w-48 shrink-0 snap-start sm:w-56"
            />
          ))}
        </Rail>
      </Container>

      <Container className="pt-12">
        <SectionHeader eyebrow="Categories" title="Popular categories" href="/marketplace" />
        <CategoryTiles categories={data.categories} />
      </Container>

      <Container className="pt-12">
        <SectionHeader
          eyebrow="Recently won"
          title="Latest results"
          description="Final prices and winner bid counts, fully disclosed. Demonstration data."
          href="/auctions?status=completed"
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

      <Container className="pt-12">
        <SectionHeader
          eyebrow="Top savings"
          title="Biggest differences to reference value"
          description="Savings exclude the bid credits winners used — see each result for the full picture."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {data.topSavings.map((auction) => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              serverTime={data.serverTime}
              signedIn={signedIn}
            />
          ))}
        </div>
      </Container>
    </div>
  )
}
