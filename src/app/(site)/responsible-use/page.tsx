import {
  AlarmClockIcon,
  BellRingIcon,
  CoffeeIcon,
  GaugeIcon,
  HeartHandshakeIcon,
  WalletIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ContentPage, ProseSection } from '@/components/content/content-page'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Responsible use',
  description:
    'Esocity Bid’s responsible-use tools and commitments: spending and bid limits, alerts, breaks, and where to find support.',
  alternates: { canonical: '/responsible-use' },
}

const TOOLS = [
  {
    icon: GaugeIcon,
    title: 'Daily & weekly bid limits',
    text: 'Cap how many bid credits you can use per day or week.',
  },
  {
    icon: WalletIcon,
    title: 'Monthly bid pack budget',
    text: 'Set the most you’ll spend on bid packs each calendar month.',
  },
  {
    icon: BellRingIcon,
    title: 'Usage alerts',
    text: 'Get notified at 50%, 80% and 100% of your limits.',
  },
  {
    icon: CoffeeIcon,
    title: 'Take a break',
    text: 'Pause bidding and bid pack purchases for 24 hours, 7 days or 30 days.',
  },
  {
    icon: AlarmClockIcon,
    title: '24-hour cooling period',
    text: 'Raising or removing a limit only takes effect after 24 hours.',
  },
  {
    icon: HeartHandshakeIcon,
    title: 'A person to talk to',
    text: 'Our support team can help you set limits or close your account.',
  },
]

export default function ResponsibleUsePage() {
  return (
    <ContentPage
      eyebrow="Responsible use"
      title="Bid for fun, within a budget you choose"
      intro="Live auctions are exciting — and bidding costs money even when you don’t win. These tools and commitments help you stay in control."
      aside={
        <Button asChild variant="brand" size="lg">
          <Link href="/account#responsible-use">Set your limits</Link>
        </Button>
      }
      toc={[
        { id: 'tools', label: 'Your tools' },
        { id: 'tips', label: 'Healthy habits' },
        { id: 'signs', label: 'Warning signs' },
        { id: 'commitments', label: 'Our commitments' },
        { id: 'help', label: 'Getting help' },
      ]}
    >
      <section id="tools" aria-labelledby="tools-heading" className="scroll-mt-24">
        <h2 id="tools-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Your tools
        </h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Every limit is enforced by our servers on every bid and purchase — including bids placed
          by AutoBid.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <div key={tool.title} className="rounded-2xl border bg-card p-5 shadow-card">
              <tool.icon className="size-5 text-brand" aria-hidden />
              <p className="mt-3 font-semibold">{tool.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{tool.text}</p>
            </div>
          ))}
        </div>
      </section>

      <ProseSection id="tips" title="Healthy habits">
        <ul>
          <li>
            Decide on a budget before you start, and only use money you can afford to spend on
            entertainment.
          </li>
          <li>
            Remember that most bids don’t lead to a win — the total cost of an auction includes
            every bid you place.
          </li>
          <li>Set a maximum on AutoBid rather than bidding “just one more time”.</li>
          <li>
            Don’t try to win back bids you’ve already used. Consider Buy Now or the marketplace
            instead.
          </li>
          <li>Take regular breaks, and don’t bid when you’re stressed, tired or upset.</li>
        </ul>
      </ProseSection>

      <ProseSection id="signs" title="Warning signs">
        <p>It may be time to take a break if you:</p>
        <ul>
          <li>spend more than you planned, or more than you can afford;</li>
          <li>feel you need to keep bidding to “get your money’s worth”;</li>
          <li>hide how much you spend from people close to you; or</li>
          <li>feel anxious or irritable when you aren’t bidding.</li>
        </ul>
      </ProseSection>

      <ProseSection id="commitments" title="Our commitments">
        <ul>
          <li>No hidden costs: bid cost, increment and Buy Now price are shown before you bid.</li>
          <li>
            No fake urgency: countdowns, stock levels and bidder counts reflect real server data
            (simulated bidders in the demo are labelled).
          </li>
          <li>No pre-ticked boxes, and marketing is strictly opt-in.</li>
          <li>Rewards are never awarded for the volume of bids you place.</li>
          <li>
            Limits can always be lowered instantly, and there is no way to bypass a limit or shorten
            a break.
          </li>
          <li>Under-18s can’t create accounts or bid.</li>
        </ul>
      </ProseSection>

      <ProseSection id="help" title="Getting help">
        <p>
          If you’re worried about your spending, free and confidential support is available from{' '}
          <a href="https://www.moneyhelper.org.uk/" rel="noopener noreferrer" target="_blank">
            MoneyHelper
          </a>{' '}
          and{' '}
          <a href="https://www.citizensadvice.org.uk/" rel="noopener noreferrer" target="_blank">
            Citizens Advice
          </a>
          . You can also <Link href="/support?category=account">contact our team</Link> to set
          limits, take a longer break or close your account.
        </p>
      </ProseSection>
    </ContentPage>
  )
}
