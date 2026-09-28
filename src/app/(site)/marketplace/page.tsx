import type { Metadata } from 'next'

import { CatalogBrowser, parseCatalogParams } from '@/components/catalog/catalog-browser'
import { Container, PageHeader } from '@/components/common/section'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = {
  title: 'Marketplace',
  description:
    'Shop electronics, gaming, home, kitchen, beauty, fashion, watches and more at fixed prices with fast delivery.',
  alternates: { canonical: '/marketplace' },
}

export default async function MarketplacePage({ searchParams }: PageProps<'/marketplace'>) {
  const params = parseCatalogParams(await searchParams)
  const viewer = await getViewer()
  const backend = getBackend()
  const result = backend.listProducts(
    {
      q: params.q,
      category: params.category,
      subcategory: params.subcategory,
      brands: params.brand,
      minPriceMinor: params.min !== undefined ? params.min * 100 : undefined,
      maxPriceMinor: params.max !== undefined ? params.max * 100 : undefined,
      availability: params.availability,
      sort: params.sort as 'recommended',
      page: params.page,
      pageSize: 24,
    },
    viewer?.userId,
  )
  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        eyebrow="Marketplace"
        title="Shop the marketplace"
        description="Fixed prices, free standard delivery over £50, and 30-day returns. Some items are also in live auctions right now."
      />
      <CatalogBrowser
        basePath="/marketplace"
        params={params}
        items={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        facets={result.facets}
        categories={backend.categories()}
        signedIn={!!viewer}
      />
    </Container>
  )
}
