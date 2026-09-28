import { GavelIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { AuctionCard } from '@/components/auction/auction-card'
import { AuctionPoller } from '@/components/auction/live-bits'
import { ChipLink } from '@/components/common/chip-link'
import { Container, PageHeader } from '@/components/common/section'
import { UrlSelect } from '@/components/common/url-controls'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = {
  title: 'Live auctions',
  description:
    'Transparent live auctions on electronics, gaming, home, fashion and more. Every bid shows its cost and increment up front.',
  alternates: { canonical: '/auctions' },
}

const STATUS_TABS = [
  { value: 'live', label: 'Live now' },
  { value: 'scheduled', label: 'Starting soon' },
  { value: 'completed', label: 'Results' },
] as const

type Status = (typeof STATUS_TABS)[number]['value']

export default async function AuctionsPage({ searchParams }: PageProps<'/auctions'>) {
  const params = await searchParams
  const status: Status = STATUS_TABS.some((tab) => tab.value === params.status)
    ? (params.status as Status)
    : 'live'
  const category = typeof params.category === 'string' ? params.category : undefined
  const sort = typeof params.sort === 'string' ? params.sort : undefined
  const viewer = await getViewer()
  const backend = getBackend()
  const auctions = backend.listAuctions(
    { status, category, sort: sort as 'ending' | undefined, limit: 60 },
    viewer?.userId,
  )
  const categories = backend.categories()
  const liveCount = backend.liveCount()
  const serverTime = backend.now()
  const href = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams()
    const merged = { status, category, sort, ...next }
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value)
    return `/auctions?${search.toString()}`
  }
  return (
    <Container className="py-8 sm:py-10">
      <AuctionPoller
        ids={auctions
          .filter((auction) => auction.status !== 'COMPLETED')
          .map((auction) => auction.id)}
      />
      <PageHeader
        eyebrow="Live auctions"
        title={
          status === 'completed'
            ? 'Auction results'
            : status === 'scheduled'
              ? 'Starting soon'
              : 'Live auctions'
        }
        description={
          status === 'completed'
            ? 'Every result shows the final price and how many bids the winner used. Demonstration data — bidders are simulated.'
            : `${liveCount} auctions are live right now. Prices and countdowns update from our servers in real time.`
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/how-it-works">
              <GavelIcon /> How bidding works
            </Link>
          </Button>
        }
      />
      <div className="sticky top-16 z-30 -mx-4 mb-6 flex flex-col gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur-lg sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Auction status" className="flex gap-1.5">
            {STATUS_TABS.map((tab) => (
              <ChipLink
                key={tab.value}
                href={href({ status: tab.value, sort: undefined })}
                active={status === tab.value}
              >
                {tab.value === 'live' ? (
                  <span className="size-1.5 animate-pulse-dot rounded-full bg-live" aria-hidden />
                ) : null}
                {tab.label}
              </ChipLink>
            ))}
          </nav>
          <UrlSelect
            param="sort"
            label="Sort auctions"
            value={sort ?? ''}
            options={[
              {
                value: '',
                label:
                  status === 'scheduled'
                    ? 'Starting soonest'
                    : status === 'completed'
                      ? 'Most recent'
                      : 'Ending soonest',
              },
              { value: 'popular', label: 'Most bidders' },
              { value: 'price', label: 'Highest price' },
              { value: 'value', label: 'Highest reference value' },
            ]}
          />
        </div>
        <nav
          aria-label="Categories"
          className="-mx-1 flex scrollbar-none gap-1.5 overflow-x-auto px-1"
        >
          <ChipLink href={href({ category: undefined })} active={!category}>
            All categories
          </ChipLink>
          {categories.map((item) => (
            <ChipLink
              key={item.slug}
              href={href({ category: item.slug })}
              active={category === item.slug}
            >
              {item.name}
              {item.liveAuctions && status === 'live' ? (
                <span className="text-[11px] opacity-70">{item.liveAuctions}</span>
              ) : null}
            </ChipLink>
          ))}
        </nav>
      </div>
      {auctions.length === 0 ? (
        <EmptyState
          icon={<GavelIcon />}
          title="No auctions match right now"
          description="New auctions start every few minutes. Try another category or check auctions starting soon."
          action={
            <Button asChild variant="outline">
              <Link href="/auctions?status=scheduled">See upcoming auctions</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {auctions.map((auction) => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              serverTime={serverTime}
              signedIn={!!viewer}
            />
          ))}
        </div>
      )}
    </Container>
  )
}
