import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/config/site'

const PRIVATE_PATHS = [
  '/admin',
  '/api/',
  '/account',
  '/settings',
  '/checkout',
  '/wallet',
  '/orders',
  '/watchlist',
  '/notifications',
  '/buy-bids',
]

export default function robots(): MetadataRoute.Robots {
  // Preview and demo deployments are not indexed unless explicitly enabled.
  const indexable = process.env.ALLOW_INDEXING === 'true'
  return {
    rules: indexable
      ? [{ userAgent: '*', allow: '/', disallow: PRIVATE_PATHS }]
      : [{ userAgent: '*', disallow: '/' }],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
