import { BellRingIcon, HeartIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { AuctionCard } from '@/components/auction/auction-card'
import { AuctionPoller } from '@/components/auction/live-bits'
import { SignInGate } from '@/components/auth/sign-in-gate'
import { DropCard } from '@/components/commerce/drop-card'
import { Container, PageHeader, SectionHeader } from '@/components/common/section'
import { ProductCard } from '@/components/product/product-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { formatMinor } from '@/lib/money'
import { pluralize } from '@/lib/utils'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Watchlist', robots: { index: false } }

export default async function WatchlistPage() {
  const viewer = await getViewer()
  if (!viewer)
    return (
      <SignInGate
        title="Your watchlist"
        description="Enter the demo to follow auctions, products and Flash Drops."
        redirectTo="/watchlist"
      />
    )
  const backend = getBackend()
  const watchlist = backend.watchlist(viewer.userId)
  const serverTime = backend.now()
  const total = watchlist.auctions.length + watchlist.products.length + watchlist.drops.length
  const openAuctions = watchlist.auctions.filter(
    (auction) => auction.status !== 'COMPLETED' && auction.status !== 'CANCELLED',
  )
  const endedAuctions = watchlist.auctions.filter(
    (auction) => auction.status === 'COMPLETED' || auction.status === 'CANCELLED',
  )
  return (
    <Container className="py-8 sm:py-10">
      <AuctionPoller ids={openAuctions.map((auction) => auction.id)} />
      <PageHeader
        eyebrow="Watchlist"
        title="Watchlist"
        description={`${pluralize(total, 'item')} followed. We’ll notify you when watched auctions are about to start or end and when prices drop.`}
        actions={
          <Button asChild variant="outline">
            <Link href="/settings#notifications">
              <BellRingIcon /> Alert settings
            </Link>
          </Button>
        }
      />
      {total === 0 ? (
        <EmptyState
          icon={<HeartIcon />}
          title="Nothing on your watchlist yet"
          description="Tap the heart on any auction, product or Flash Drop to follow it here."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="brand">
                <Link href="/auctions">Browse live auctions</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/drops">Flash Drops</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-12">
          {watchlist.endingSoon.length > 0 || watchlist.startingSoon.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {watchlist.endingSoon.length > 0 ? (
                <Badge variant="live">
                  {pluralize(watchlist.endingSoon.length, 'watched auction')} ending within 30
                  minutes
                </Badge>
              ) : null}
              {watchlist.startingSoon.length > 0 ? (
                <Badge variant="brand">
                  {pluralize(watchlist.startingSoon.length, 'auction')} starting within 2 hours
                </Badge>
              ) : null}
              {watchlist.priceDrops.length > 0 ? (
                <Badge variant="success">
                  {pluralize(watchlist.priceDrops.length, 'price drop')}
                </Badge>
              ) : null}
            </div>
          ) : null}

          {openAuctions.length > 0 ? (
            <section>
              <SectionHeader
                title="Auctions"
                description="Live and upcoming auctions you follow."
              />
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {openAuctions.map((auction) => (
                  <AuctionCard
                    key={auction.id}
                    auction={auction}
                    serverTime={serverTime}
                    signedIn
                  />
                ))}
              </div>
            </section>
          ) : null}

          {watchlist.products.length > 0 ? (
            <section>
              <SectionHeader
                title="Products"
                description="Price changes are shown since you added each item."
              />
              <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
                {watchlist.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    signedIn
                    reason={
                      product.priceChangeMinor < 0
                        ? `↓ ${formatMinor(-product.priceChangeMinor)} lower since you saved it`
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}

          {watchlist.drops.length > 0 ? (
            <section>
              <SectionHeader
                title="Flash Drops"
                description="Limited-quantity offers you’re following."
              />
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {watchlist.drops.map((drop) => (
                  <DropCard key={drop.id} drop={drop} serverTime={serverTime} signedIn />
                ))}
              </div>
            </section>
          ) : null}

          {endedAuctions.length > 0 ? (
            <section>
              <SectionHeader
                title="Ended auctions"
                description="Results for auctions you followed."
              />
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {endedAuctions.map((auction) => (
                  <AuctionCard
                    key={auction.id}
                    auction={auction}
                    serverTime={serverTime}
                    signedIn
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </Container>
  )
}
