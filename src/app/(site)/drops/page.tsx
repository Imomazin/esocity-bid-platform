import { ZapIcon } from 'lucide-react'
import type { Metadata } from 'next'

import { Container, PageHeader } from '@/components/common/section'
import { DropCard } from '@/components/commerce/drop-card'
import { EmptyState } from '@/components/ui/misc'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = {
  title: 'Flash Drops',
  description:
    'Limited-stock, fixed-price releases for a short time. No bidding — fair per-member limits.',
  alternates: { canonical: '/drops' },
}

export default async function DropsPage() {
  const viewer = await getViewer()
  const backend = getBackend()
  const drops = backend.listDrops(viewer?.userId)
  const serverTime = backend.now()
  const live = drops.filter((drop) => drop.status === 'LIVE')
  const upcoming = drops.filter((drop) => drop.status === 'UPCOMING')
  const done = drops.filter((drop) => drop.status === 'SOLD_OUT' || drop.status === 'ENDED')
  const section = (title: string, items: typeof drops) =>
    items.length ? (
      <section className="mt-10 first:mt-0">
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((drop) => (
            <DropCard key={drop.id} drop={drop} serverTime={serverTime} signedIn={!!viewer} />
          ))}
        </div>
      </section>
    ) : null
  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <ZapIcon className="size-3.5" aria-hidden /> Flash Drops
          </span>
        }
        title="Flash Drops"
        description="Fixed-price, limited-stock releases for a short window. There’s no bidding: buy while stock lasts, up to the per-member limit. Some drops are reserved for higher Rewards tiers."
      />
      {drops.length === 0 ? (
        <EmptyState
          icon={<ZapIcon />}
          title="No drops right now"
          description="New drops are scheduled throughout the day."
        />
      ) : null}
      {section('Live now', live)}
      {section('Coming up', upcoming)}
      {section('Recently sold out', done)}
    </Container>
  )
}
