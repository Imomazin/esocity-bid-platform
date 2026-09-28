/** Public (client-safe) site configuration. Only NEXT_PUBLIC_* values may be read here. */

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'Esocity Bid',
  shortName: 'Esocity Bid',
  tagline: 'The Intelligent Live Marketplace',
  supportingLine: 'Live Commerce. Smarter Bidding.',
  description:
    'Esocity Bid is the intelligent live marketplace: discover products, join transparent live auctions, buy instantly, catch Flash Drops and earn rewards.',
  url: (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  engineeringPartner: 'AX',
  supportEmail: 'support@esocity.example',
  locale: 'en-GB',
} as const

export const primaryNav = [
  { href: '/', label: 'Home' },
  { href: '/discover', label: 'Discover' },
  { href: '/auctions', label: 'Live Auctions' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/drops', label: 'Drops' },
  { href: '/rewards', label: 'Rewards' },
] as const

export const secondaryNav = [
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/wallet', label: 'Bid Wallet' },
  { href: '/orders', label: 'Orders' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/account', label: 'Account' },
] as const

export function absoluteUrl(path = '/'): string {
  return `${siteConfig.url}${path.startsWith('/') ? path : `/${path}`}`
}
