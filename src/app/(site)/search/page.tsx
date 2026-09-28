import { SearchIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { AuctionCard } from '@/components/auction/auction-card'
import { AuctionPoller } from '@/components/auction/live-bits'
import { ChipLink } from '@/components/common/chip-link'
import { Container, PageHeader } from '@/components/common/section'
import { HeaderSearch } from '@/components/layout/header-search'
import { ProductCard } from '@/components/product/product-card'
import { EmptyState } from '@/components/ui/misc'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Search', robots: { index: false, follow: true } }

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q.slice(0, 80) : ''
  const viewer = await getViewer()
  const backend = getBackend()
  const results = q ? backend.searchAll(q, viewer?.userId) : null
  const serverTime = backend.now()
  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        eyebrow="Search"
        title={q ? `Results for “${q}”` : 'Search Esocity Bid'}
        description={
          results
            ? `${results.total} products and ${results.auctions.length} live or upcoming auctions`
            : 'Search products, brands, categories and auctions.'
        }
      />
      <div className="mb-8 max-w-xl md:hidden">
        <HeaderSearch />
      </div>
      {results && (results.brands.length > 0 || results.categories.length > 0) ? (
        <div className="mb-8 flex flex-wrap gap-2">
          {results.categories.map((category) => (
            <ChipLink key={category.slug} href={`/category/${category.slug}`}>
              Category: {category.name}
            </ChipLink>
          ))}
          {results.brands.map((brand) => (
            <ChipLink key={brand.slug} href={`/marketplace?brand=${brand.slug}`}>
              Brand: {brand.name}
            </ChipLink>
          ))}
        </div>
      ) : null}
      {results && results.auctions.length > 0 ? (
        <section className="mb-12">
          <AuctionPoller ids={results.auctions.map((auction) => auction.id)} />
          <h2 className="mb-4 text-lg font-semibold">Auctions</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {results.auctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                serverTime={serverTime}
                signedIn={!!viewer}
              />
            ))}
          </div>
        </section>
      ) : null}
      {results && results.products.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Products</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {results.products.map((product) => (
              <ProductCard key={product.id} product={product} signedIn={!!viewer} />
            ))}
          </div>
        </section>
      ) : null}
      {results && results.products.length === 0 && results.auctions.length === 0 ? (
        <EmptyState
          icon={<SearchIcon />}
          title="No results"
          description="Try a brand (e.g. Aurion), a product type (e.g. espresso) or a category (e.g. watches)."
          action={
            <Link href="/marketplace" className="text-sm font-medium text-brand hover:underline">
              Browse the marketplace
            </Link>
          }
        />
      ) : null}
    </Container>
  )
}
