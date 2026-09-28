import type { MetadataRoute } from 'next'

import { siteConfig } from '@/lib/config/site'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Esocity Bid — The Intelligent Live Marketplace',
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0a0b0f',
    lang: 'en-GB',
    categories: ['shopping', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Live auctions',
        url: '/auctions',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Flash Drops',
        url: '/drops',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Bid Wallet',
        url: '/wallet',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  }
}
