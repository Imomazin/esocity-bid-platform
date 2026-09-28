import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import type * as React from 'react'

import { THEME_INIT_SCRIPT } from '@/components/layout/theme-toggle'
import { AppProviders } from '@/components/providers/app-providers'
import { siteConfig } from '@/lib/config/site'

import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: 'Esocity Bid — The Intelligent Live Marketplace',
    template: '%s · Esocity Bid',
  },
  description: siteConfig.description,
  applicationName: 'Esocity Bid',
  keywords: ['live auctions', 'marketplace', 'flash drops', 'buy now', 'rewards', 'Esocity'],
  openGraph: {
    type: 'website',
    siteName: 'Esocity Bid',
    locale: 'en_GB',
    url: '/',
    title: 'Esocity Bid — The Intelligent Live Marketplace',
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Esocity Bid',
    description: siteConfig.description,
  },
  alternates: { canonical: '/' },
  appleWebApp: { capable: true, title: 'Esocity Bid', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0b0f' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading request headers opts every route into dynamic rendering, which the per-request CSP
  // nonce requires.
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <html
      lang="en-GB"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
