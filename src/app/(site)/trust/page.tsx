import {
  BadgeCheckIcon,
  EyeIcon,
  FileLockIcon,
  LockIcon,
  PackageCheckIcon,
  ScaleIcon,
  ServerIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ContentPage, ProseSection } from '@/components/content/content-page'
import { getMarket } from '@/lib/config/market'

export const metadata: Metadata = {
  title: 'Trust & transparency',
  description:
    'How Esocity Bid keeps auctions fair, payments secure and pricing transparent — and how we handle returns, fraud prevention and your data.',
  alternates: { canonical: '/trust' },
}

const PILLARS = [
  {
    icon: ServerIcon,
    title: 'Server-authoritative auctions',
    text: 'Bids, timers and winners are decided by our servers — never your browser.',
  },
  {
    icon: EyeIcon,
    title: 'Transparent pricing',
    text: 'Bid cost, increment, Buy Now price and recovery terms are shown before you bid.',
  },
  {
    icon: FileLockIcon,
    title: 'Immutable records',
    text: 'Bids, wallet movements and admin actions are recorded in append-only ledgers and audit logs.',
  },
  {
    icon: LockIcon,
    title: 'Secure payments',
    text: 'Card details are handled by a PCI-compliant payment provider. We never see or store them.',
  },
  {
    icon: PackageCheckIcon,
    title: 'Genuine products',
    text: 'Items come from vetted suppliers with tracked inventory and delivery.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'You stay in control',
    text: 'Limits, alerts and breaks are enforced on every bid, including AutoBid.',
  },
]

export default function TrustPage() {
  const market = getMarket('UK')
  return (
    <ContentPage
      eyebrow="Trust & transparency"
      title="Built to be fair, clear and secure"
      intro="Live auctions only work when you can trust them. These are the commitments behind every auction, order and payment on Esocity Bid."
      toc={[
        { id: 'pillars', label: 'Our commitments' },
        { id: 'fairness', label: 'Fair auctions' },
        { id: 'pricing', label: 'Pricing' },
        { id: 'payments', label: 'Payments' },
        { id: 'returns', label: 'Delivery & returns' },
        { id: 'fraud', label: 'Fraud prevention' },
        { id: 'data', label: 'Your data' },
      ]}
    >
      <section id="pillars" aria-label="Our commitments" className="scroll-mt-24">
        <div className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-2xl border bg-card p-5 shadow-card">
              <pillar.icon className="size-5 text-brand" aria-hidden />
              <p className="mt-3 font-semibold">{pillar.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{pillar.text}</p>
            </div>
          ))}
        </div>
      </section>

      <ProseSection id="fairness" title="Fair auctions">
        <p>
          Every bid is processed on our servers in order of arrival, inside a database transaction
          that locks the auction, so results are consistent even when many people bid in the same
          second. The browser countdown is only a synchronised display.
        </p>
        <ul>
          <li>Staff and suppliers can’t bid, and we never bid to push prices up.</li>
          <li>Auction settings are locked once an auction is live.</li>
          <li>
            Every result shows the final price, total bids and the number of bids the winner used.
          </li>
          <li>
            Our demonstration platform uses simulated bidders, which are always labelled as
            simulated.
          </li>
        </ul>
        <p>
          The full <Link href="/auction-rules">auction rules</Link> explain every rule in plain
          English.
        </p>
      </ProseSection>

      <ProseSection id="pricing" title="Pricing you can check">
        <p>
          We show a reference price for each product so you can compare. Savings shown for auctions
          reflect the final price only — your total cost also includes the bid credits you used,
          which we show alongside every win. See the worked example in{' '}
          <Link href="/how-it-works#costs">how bidding works</Link>.
        </p>
      </ProseSection>

      <ProseSection id="payments" title="Payments">
        <p>
          Payments are processed by a PCI DSS-compliant provider using a hosted checkout. Esocity
          never receives or stores your full card number. Every charge and refund is matched to an
          order and recorded, and payment confirmations are verified server-to-server — not by your
          browser.
        </p>
      </ProseSection>

      <ProseSection id="returns" title="Delivery and returns">
        <ul>
          <li>
            Delivery options and costs are shown at checkout before you pay; tracking is added to
            your order as soon as it ships.
          </li>
          <li>
            Most items can be returned within {market.returnsWindowDays} days of delivery (45 days
            for Gold members and above). Start a return from your order page.
          </li>
          <li>
            Faulty or not-as-described items are always covered — contact support and we’ll put it
            right.
          </li>
          <li>Your statutory rights as a consumer are not affected.</li>
        </ul>
      </ProseSection>

      <ProseSection id="fraud" title="Fraud prevention">
        <p>
          We use risk signals (for example, unusual bidding speed or several accounts on one device)
          to protect honest bidders. Signals only ever flag activity for review: a trained person
          makes any decision, we never accuse anyone automatically, and you can always contact us to
          explain or appeal.
        </p>
      </ProseSection>

      <ProseSection id="data" title="Your data">
        <p>
          We collect only what we need to run your account, process orders and keep the platform
          safe. Marketing is opt-in. You can request a copy of your data or deletion of your account
          at any time — see our <Link href="/privacy">privacy notice</Link>.
        </p>
        <p className="flex items-center gap-2">
          <BadgeCheckIcon className="size-4 text-success" aria-hidden /> Questions?{' '}
          <Link href="/support">Contact our support team</Link>.
        </p>
        <p className="flex items-center gap-2">
          <ScaleIcon className="size-4 text-muted-foreground" aria-hidden /> Legal and regulatory
          review of these commitments is completed per market before launch.
        </p>
      </ProseSection>
    </ContentPage>
  )
}
