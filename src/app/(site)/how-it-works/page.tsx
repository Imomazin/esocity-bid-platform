import {
  BotIcon,
  CoinsIcon,
  GavelIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TimerIcon,
  TrophyIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ContentPage, ProseSection } from '@/components/content/content-page'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/misc'
import { formatMinor } from '@/lib/money'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = {
  title: 'How bidding works',
  description:
    'Bid credits, live countdowns, winning, Buy Now and bid credit recovery — explained clearly, with a worked example of what an auction really costs.',
  alternates: { canonical: '/how-it-works' },
}

const STEPS = [
  {
    icon: CoinsIcon,
    title: 'Get bid credits',
    text: 'Bid credits are bought in packs (or received as promotional bonuses). They are not money, and each auction shows exactly what a bid costs.',
  },
  {
    icon: GavelIcon,
    title: 'Place a bid',
    text: 'Each bid uses the auction’s stated number of credits and raises the price by a small fixed increment. You become the leading bidder.',
  },
  {
    icon: TimerIcon,
    title: 'Watch the clock',
    text: 'Every bid guarantees a few seconds remain on the countdown, so others can respond. Some auctions have a hard stop the clock can’t pass.',
  },
  {
    icon: TrophyIcon,
    title: 'Win — or buy it anyway',
    text: 'When the server’s countdown reaches zero, the leading bidder wins and pays the final price. If you don’t win, Buy Now may let you recover your bids.',
  },
]

export default function HowItWorksPage() {
  const packages = getBackend().bidPackages()
  const starter = packages.find((pack) => pack.id === 'starter') ?? packages[0]
  const perBid = starter ? Math.round(starter.priceMinor / starter.credits) : 25
  const bidsUsed = 30
  const finalPrice = 847
  const bidsCost = bidsUsed * perBid
  return (
    <ContentPage
      eyebrow="How it works"
      title="How bidding works on Esocity Bid"
      intro="Esocity Bid combines a marketplace, live auctions and Flash Drops. Here’s exactly how live auctions work, what they cost, and how you stay in control."
      toc={[
        { id: 'steps', label: 'Four steps' },
        { id: 'costs', label: 'What an auction costs' },
        { id: 'fairness', label: 'Who decides the winner' },
        { id: 'buy-now', label: 'Buy Now & recovery' },
        { id: 'autobid', label: 'AutoBid' },
        { id: 'more', label: 'Marketplace & Drops' },
        { id: 'control', label: 'Staying in control' },
      ]}
      aside={
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="brand" size="lg">
            <Link href="/auctions">Explore Auctions</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/marketplace">Enter Marketplace</Link>
          </Button>
        </div>
      }
    >
      <section id="steps" aria-labelledby="steps-heading" className="scroll-mt-24">
        <h2 id="steps-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Four steps
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
                  <step.icon className="size-5" aria-hidden />
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <ProseSection id="costs" title="What an auction really costs">
        <p>
          Your cost for an auction is <strong>the bid credits you use</strong> plus, if you win,{' '}
          <strong>the final auction price</strong> and delivery. Bids used are not returned when you
          don’t win (except where an auction is cancelled, doesn’t meet its minimum participants or
          reserve, or you use Buy Now recovery).
        </p>
        <div className="not-prose overflow-hidden rounded-2xl border bg-card text-sm text-foreground shadow-card">
          <p className="border-b bg-muted/50 px-5 py-3 font-medium">Worked example</p>
          <dl className="divide-y">
            <div className="flex justify-between gap-4 px-5 py-3">
              <dt className="text-muted-foreground">
                {starter?.name ?? 'Starter'} pack: {starter?.credits ?? 50} bids for{' '}
                {formatMinor(starter?.priceMinor ?? 1_250)}
              </dt>
              <dd className="tabular">{formatMinor(perBid)} per bid</dd>
            </div>
            <div className="flex justify-between gap-4 px-5 py-3">
              <dt className="text-muted-foreground">You place {bidsUsed} bids</dt>
              <dd className="tabular">{formatMinor(bidsCost)}</dd>
            </div>
            <div className="flex justify-between gap-4 px-5 py-3">
              <dt className="text-muted-foreground">
                If you win at a final price of {formatMinor(finalPrice)}
              </dt>
              <dd className="tabular">
                {formatMinor(bidsCost)} + {formatMinor(finalPrice)} ={' '}
                <strong>{formatMinor(bidsCost + finalPrice)}</strong> + delivery
              </dd>
            </div>
            <div className="flex justify-between gap-4 px-5 py-3">
              <dt className="text-muted-foreground">If you don’t win</dt>
              <dd className="tabular">{formatMinor(bidsCost)} of bids used</dd>
            </div>
          </dl>
        </div>
        <p>
          Many bidders take part in each auction and only one can win, so most bids do not lead to a
          win. Please treat bidding as entertainment with a budget you set in advance.
        </p>
      </ProseSection>

      <ProseSection id="fairness" title="Who decides the winner">
        <p>
          Our servers do. Every bid is timestamped and processed in order of arrival on the server,
          inside a locked transaction, so two bids can never both “win” the same moment. Your
          browser only displays the countdown and sends your intent to bid — it never decides the
          result.
        </p>
        <ul>
          <li>
            You can’t bid while you’re already the leading bidder, so you never outbid yourself.
          </li>
          <li>Every accepted bid and every auction result is written to an immutable audit log.</li>
          <li>
            Auction rules (bid cost, increment, timer) are shown before you bid and are locked once
            an auction goes live.
          </li>
        </ul>
        <p>
          Read the full <Link href="/auction-rules">auction rules</Link> and our{' '}
          <Link href="/trust">trust &amp; transparency</Link> commitments.
        </p>
      </ProseSection>

      <ProseSection id="buy-now" title="Buy Now and bid credit recovery">
        <p>
          Most auctions show a Buy Now price. If you bid but don’t win, and the auction offers bid
          credit recovery, you can buy the item at its Buy Now price within the stated window and{' '}
          <strong>eligible bids are returned to your Bid Wallet</strong> (or, on some auctions,
          their value is credited against the price).
        </p>
        <Notice tone="brand" icon={<RotateCcwIcon />}>
          Recovery terms are shown on each auction page and at checkout, including which bids are
          eligible and how long the offer lasts.
        </Notice>
      </ProseSection>

      <ProseSection id="autobid" title="AutoBid">
        <p>
          AutoBid places bids for you on our servers, within limits you set: a maximum number of
          bids and, optionally, a maximum price. It never exceeds your limits, your responsible-use
          limits or your wallet balance, and you can stop it at any time.
        </p>
        <p className="flex items-center gap-2">
          <BotIcon className="size-4 text-brand" aria-hidden /> AutoBid follows exactly the same
          rules as manual bids.
        </p>
      </ProseSection>

      <ProseSection id="more" title="Marketplace and Flash Drops">
        <div className="not-prose grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5 text-sm shadow-card">
            <ShoppingBagIcon className="size-5 text-brand" aria-hidden />
            <p className="mt-3 font-semibold text-foreground">Marketplace</p>
            <p className="mt-1 text-muted-foreground">
              Buy instantly at fixed prices — no bid credits needed.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-5 text-sm shadow-card">
            <SparklesIcon className="size-5 text-brand" aria-hidden />
            <p className="mt-3 font-semibold text-foreground">Flash Drops</p>
            <p className="mt-1 text-muted-foreground">
              Limited-quantity offers at a set price for a short time, with a per-customer limit.
            </p>
          </div>
        </div>
      </ProseSection>

      <ProseSection id="control" title="Staying in control">
        <p>
          Set daily and weekly bid limits, a monthly bid pack budget, and alerts — or take a break.
          Limits are enforced on our servers for every bid, including AutoBid. Raising a limit only
          takes effect after 24 hours.
        </p>
        <p className="flex items-center gap-2">
          <ShieldCheckIcon className="size-4 text-success" aria-hidden />
          <Link href="/responsible-use">Read our responsible use guide</Link>
        </p>
      </ProseSection>
    </ContentPage>
  )
}
