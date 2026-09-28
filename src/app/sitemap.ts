import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/config/site'
import { getBackend } from '@/server/runtime'

const STATIC_ROUTES: {
  path: string
  priority: number
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
}[] = [
  { path: '/', priority: 1, changeFrequency: 'hourly' },
  { path: '/auctions', priority: 0.9, changeFrequency: 'always' },
  { path: '/marketplace', priority: 0.9, changeFrequency: 'daily' },
  { path: '/discover', priority: 0.8, changeFrequency: 'hourly' },
  { path: '/drops', priority: 0.8, changeFrequency: 'hourly' },
  { path: '/rewards', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/how-it-works', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/auction-rules', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/trust', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/responsible-use', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/support', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/demo', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/supplier', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const backend = getBackend()
  const now = new Date(backend.now())
  const categories = backend.categories().map((category) => ({
    url: absoluteUrl(`/category/${category.slug}`),
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))
  const products = backend.listProducts({ pageSize: 500 }).items.map((product) => ({
    url: absoluteUrl(`/product/${product.slug}`),
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }))
  const auctions = backend
    .listAuctions({ status: 'live', limit: 100 })
    .concat(backend.listAuctions({ status: 'scheduled', limit: 100 }))
    .map((auction) => ({
      url: absoluteUrl(`/auction/${auction.id}`),
      lastModified: now,
      changeFrequency: 'always' as const,
      priority: 0.5,
    }))
  return [
    ...STATIC_ROUTES.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...categories,
    ...products,
    ...auctions,
  ]
}
