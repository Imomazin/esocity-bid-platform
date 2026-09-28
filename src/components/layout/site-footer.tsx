import Link from 'next/link'

import { Logo } from '@/components/brand/logo'

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      { href: '/discover', label: 'Discover' },
      { href: '/auctions', label: 'Live auctions' },
      { href: '/marketplace', label: 'Marketplace' },
      { href: '/drops', label: 'Flash Drops' },
      { href: '/buy-bids', label: 'Buy bid packs' },
    ],
  },
  {
    title: 'Your account',
    links: [
      { href: '/wallet', label: 'Bid Wallet' },
      { href: '/orders', label: 'Orders' },
      { href: '/watchlist', label: 'Watchlist' },
      { href: '/rewards', label: 'Esocity Rewards' },
      { href: '/settings', label: 'Settings' },
    ],
  },
  {
    title: 'Trust & help',
    links: [
      { href: '/how-it-works', label: 'How bidding works' },
      { href: '/auction-rules', label: 'Auction rules' },
      { href: '/trust', label: 'Trust & transparency' },
      { href: '/responsible-use', label: 'Responsible use' },
      { href: '/support', label: 'Help centre' },
    ],
  },
  {
    title: 'Esocity',
    links: [
      { href: '/demo', label: 'About this demo' },
      { href: '/supplier', label: 'Supplier portal' },
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/admin', label: 'Operator console' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t bg-surface pb-20 lg:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            The Intelligent Live Marketplace. Discover products, join transparent live auctions, buy
            instantly and earn rewards.
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-subtle-foreground">
            Demonstration build: brands, products, bidders, payments and deliveries are fictional or
            simulated. Pay-to-bid mechanics are subject to jurisdictional review before launch.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-xs font-semibold tracking-wider text-foreground uppercase">
              {column.title}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <p>
            <span className="font-medium text-foreground">Esocity Bid</span> · ©{' '}
            {new Date().getFullYear()} Esocity. All prices include VAT where applicable.
          </p>
          <p className="text-subtle-foreground">Engineered by AX</p>
        </div>
      </div>
    </footer>
  )
}
