import {
  BotIcon,
  CreditCardIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  MailIcon,
  RotateCcwIcon,
  ServerIcon,
  TruckIcon,
  UsersIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ContentPage, ProseSection } from '@/components/content/content-page'
import { EnterDemoButton } from '@/components/layout/enter-demo-button'
import { Button } from '@/components/ui/button'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = {
  title: 'About this demo',
  description:
    'What’s real and what’s simulated on the Esocity Bid demonstration platform, and how to explore it.',
  alternates: { canonical: '/demo' },
}

const SIMULATED = [
  {
    icon: UsersIcon,
    title: 'Other bidders',
    text: 'Anonymised, simulated members bid in every auction and are labelled “simulated”.',
  },
  {
    icon: CreditCardIcon,
    title: 'Payments',
    text: 'A demo payment provider approves (or, if you choose, declines) payments. No money moves.',
  },
  {
    icon: TruckIcon,
    title: 'Fulfilment',
    text: 'Orders advance from paid to delivered over a few minutes, with demo tracking numbers.',
  },
  {
    icon: MailIcon,
    title: 'Email & SMS',
    text: 'Messages are logged instead of sent. Your in-app notifications are real.',
  },
]

const REAL = [
  {
    icon: ServerIcon,
    title: 'Auction engine',
    text: 'Server-authoritative bidding, timers, extensions, finalisation and refunds.',
  },
  {
    icon: DatabaseIcon,
    title: 'Ledgers',
    text: 'Bid Wallet, rewards and inventory are append-only ledgers with idempotent writes.',
  },
  {
    icon: BotIcon,
    title: 'AutoBid & limits',
    text: 'AutoBid and responsible-use limits are enforced on the server for every bid.',
  },
  {
    icon: LayoutDashboardIcon,
    title: 'Operator console',
    text: 'Admin tools for auctions, inventory, orders, fraud review and the audit log.',
  },
]

export default async function DemoPage() {
  const viewer = await getViewer()
  const health = getBackend().health()
  const live = health.auctions.LIVE ?? 0
  return (
    <ContentPage
      eyebrow="Demonstration platform"
      title="About this demo"
      intro={
        <>
          Esocity Bid is running in <strong className="text-foreground">demo mode</strong>: a
          complete, working platform with simulated money, bidders and deliveries. Explore it end to
          end — nothing you do here costs anything.
        </>
      }
      aside={
        <div className="flex flex-wrap gap-3">
          {viewer ? (
            <Button asChild variant="brand" size="lg">
              <Link href="/auctions">Go to live auctions</Link>
            </Button>
          ) : (
            <EnterDemoButton size="lg" redirectTo="/auctions">
              Enter the demo
            </EnterDemoButton>
          )}
          <Button asChild variant="outline" size="lg">
            <Link href="/admin">Open operator console</Link>
          </Button>
        </div>
      }
    >
      <ProseSection id="start" title="How to explore">
        <ol>
          <li>
            <strong>Enter the demo.</strong> You get a sandboxed Demo Member account with a demo Bid
            Wallet, order history and rewards progress. It’s private to your browser session.
          </li>
          <li>
            <strong>Bid in a live auction.</strong> {live} auctions are live right now. Try manual
            bids and AutoBid, and watch simulated bidders respond.
          </li>
          <li>
            <strong>Shop and check out.</strong> Add marketplace items to your basket, try a
            promotion code such as <code className="font-mono">SAVE5</code>, and pay with the demo
            card — or choose “Simulate decline” to see failure handling.
          </li>
          <li>
            <strong>Set limits.</strong> Lower a limit (instant) and raise one (scheduled for 24
            hours later), or start a break.
          </li>
          <li>
            <strong>Switch to the operator console.</strong> Create and schedule auctions, pause a
            live auction, review fraud signals and browse the audit log.
          </li>
        </ol>
      </ProseSection>

      <section aria-labelledby="simulated-heading">
        <h2 id="simulated-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          What’s simulated
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {SIMULATED.map((item) => (
            <div key={item.title} className="rounded-2xl border bg-card p-5 shadow-card">
              <item.icon className="size-5 text-warning" aria-hidden />
              <p className="mt-3 font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="real-heading">
        <h2 id="real-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          What’s real
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {REAL.map((item) => (
            <div key={item.title} className="rounded-2xl border bg-card p-5 shadow-card">
              <item.icon className="size-5 text-success" aria-hidden />
              <p className="mt-3 font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <ProseSection id="data" title="Demo data">
        <p>
          The shared demo world — products, auctions, drops and simulated bidders — is generated
          deterministically from the clock, so every visitor sees the same live auctions. Your own
          account, bids and orders are sandboxed to your session. Use{' '}
          <strong>Reset demo data</strong> in your account menu to start again at any time.
        </p>
        <p className="flex items-center gap-2">
          <RotateCcwIcon className="size-4 text-muted-foreground" aria-hidden /> Product imagery is
          original illustration; brands and products are fictional.
        </p>
      </ProseSection>
    </ContentPage>
  )
}
