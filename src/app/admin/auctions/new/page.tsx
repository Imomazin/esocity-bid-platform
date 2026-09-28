import type { Metadata } from 'next'

import { AuctionForm } from '@/components/admin/auction-form'
import { AccessDenied, AdminPageHeader } from '@/components/admin/admin-ui'
import { EmptyState } from '@/components/ui/misc'
import { DEFAULT_AUCTION_RULES } from '@/domain/auction/rules'
import { MINUTE } from '@/lib/time'
import { adminAccess } from '@/server/auth/admin-access'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'New auction' }

export default async function NewAuctionPage({ searchParams }: PageProps<'/admin/auctions/new'>) {
  const access = await adminAccess('auctions.manage')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const backend = getBackend()
  const products = backend.admin.productsForSelect().sort((a, b) => a.name.localeCompare(b.name))
  const params = await searchParams
  const requested = typeof params.product === 'string' ? params.product : undefined
  const first = products.find((product) => product.id === requested) ?? products[0]
  if (!first) {
    return (
      <EmptyState
        title="No auction-eligible products"
        description="Mark an active product as auction-eligible first."
      />
    )
  }
  const startsAt = Math.ceil((backend.now() + 30 * MINUTE) / (5 * MINUTE)) * 5 * MINUTE
  return (
    <div className="max-w-5xl">
      <AdminPageHeader
        eyebrow="Auctions"
        title="New auction"
        description="Auctions start as drafts or are scheduled straight away. Stock is reserved when an auction is scheduled and released if it is unscheduled or cancelled."
      />
      <AuctionForm
        mode="create"
        products={products}
        initialRules={{ ...DEFAULT_AUCTION_RULES, timerSeconds: 30 * 60 }}
        initialMeta={{ productId: first.id, title: '', description: '', featured: false, startsAt }}
      />
    </div>
  )
}
