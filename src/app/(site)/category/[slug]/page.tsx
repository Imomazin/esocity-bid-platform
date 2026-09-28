import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AuctionCard } from '@/components/auction/auction-card'
import { AuctionPoller } from '@/components/auction/live-bits'
import { CatalogBrowser, parseCatalogParams } from '@/components/catalog/catalog-browser'
import { CategoryIcon } from '@/components/common/category-icon'
import { Container, Rail } from '@/components/common/section'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export async function generateMetadata({
  params,
}: PageProps<'/category/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const category = getBackend().category(slug)
  if (!category) return { title: 'Category not found' }
  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/category/${slug}` },
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<'/category/[slug]'>) {
  const { slug } = await params
  const backend = getBackend()
  const category = backend.category(slug)
  if (!category) notFound()
  const query = parseCatalogParams(await searchParams)
  const viewer = await getViewer()
  const result = backend.listProducts(
    {
      q: query.q,
      category: slug,
      subcategory: query.subcategory,
      brands: query.brand,
      minPriceMinor: query.min !== undefined ? query.min * 100 : undefined,
      maxPriceMinor: query.max !== undefined ? query.max * 100 : undefined,
      availability: query.availability,
      sort: query.sort as 'recommended',
      page: query.page,
      pageSize: 24,
    },
    viewer?.userId,
  )
  const auctions = backend.listAuctions(
    { status: 'live', category: slug, limit: 8 },
    viewer?.userId,
  )
  return (
    <>
      <section className="border-b">
        <div
          className="art-backdrop"
          style={{ '--art-backdrop': category.tone } as React.CSSProperties}
        >
          <Container className="flex items-center gap-5 py-10 sm:py-12">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-card shadow-card">
              <CategoryIcon name={category.icon} className="size-7" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wider text-brand uppercase">Category</p>
              <h1 className="text-3xl font-semibold tracking-tight">{category.name}</h1>
              <p className="mt-1 text-muted-foreground">{category.description}</p>
            </div>
          </Container>
        </div>
      </section>
      <Container className="py-8 sm:py-10">
        {auctions.length > 0 ? (
          <section className="mb-10" aria-labelledby="category-auctions">
            <AuctionPoller ids={auctions.map((auction) => auction.id)} />
            <h2
              id="category-auctions"
              className="mb-4 flex items-center gap-2 text-lg font-semibold"
            >
              <span className="size-1.5 animate-pulse-dot rounded-full bg-live" aria-hidden /> Live
              in {category.name}
            </h2>
            <Rail>
              {auctions.map((auction) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  serverTime={backend.now()}
                  signedIn={!!viewer}
                  className="w-72 shrink-0 snap-start"
                />
              ))}
            </Rail>
          </section>
        ) : null}
        <CatalogBrowser
          basePath={`/category/${slug}`}
          params={{ ...query, category: slug }}
          items={result.items}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          facets={result.facets}
          categories={backend.categories()}
          signedIn={!!viewer}
          lockCategory={slug}
        />
      </Container>
    </>
  )
}
