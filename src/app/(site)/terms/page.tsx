import type { Metadata } from 'next'
import Link from 'next/link'

import { ContentPage, DemoLegalNotice, ProseSection } from '@/components/content/content-page'

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'Terms of use for the Esocity Bid demonstration platform.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Terms of use"
      intro="The terms that apply to using Esocity Bid, buying bid credits, bidding in auctions and shopping in the marketplace."
      updated="1 September 2026"
      toc={[
        { id: 'about', label: 'About these terms' },
        { id: 'accounts', label: 'Accounts' },
        { id: 'credits', label: 'Bid credits' },
        { id: 'auctions', label: 'Auctions' },
        { id: 'purchases', label: 'Purchases' },
        { id: 'rewards', label: 'Rewards' },
        { id: 'conduct', label: 'Acceptable use' },
        { id: 'contact', label: 'Contact' },
      ]}
    >
      <DemoLegalNotice document="terms" />

      <ProseSection id="about" title="About these terms">
        <p>
          Esocity Bid is operated by Esocity. These terms explain how the platform works and what
          you and we can expect from each other. They should be read with the{' '}
          <Link href="/auction-rules">auction rules</Link> and our{' '}
          <Link href="/privacy">privacy notice</Link>.
        </p>
      </ProseSection>

      <ProseSection id="accounts" title="Accounts">
        <ul>
          <li>You must be 18 or over to create an account, and may hold one account.</li>
          <li>
            Keep your sign-in details secure and tell us promptly if you think someone else has
            accessed your account.
          </li>
          <li>
            You can close your account at any time from support. Unused purchased bid credits are
            handled as described in the bid credit section.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="credits" title="Bid credits">
        <ul>
          <li>
            Bid credits are a digital entitlement used to place bids. They are not money, e-money or
            a deposit, and cannot be exchanged for cash.
          </li>
          <li>
            Prices of bid packs are shown before purchase. Bonus and other promotional credits
            expire on the date shown in your Bid Wallet.
          </li>
          <li>
            Bid credits used on accepted bids are not returned, except as set out in the auction
            rules (for example, cancelled auctions and bid credit recovery).
          </li>
          <li>
            Refunds of unused purchased bid packs are handled case by case through support, in line
            with applicable law.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="auctions" title="Auctions">
        <p>
          Auctions are run under the <Link href="/auction-rules">auction rules</Link>, and our
          servers’ records are authoritative for the order and timing of bids. Each auction’s
          specific settings are shown on its page before you bid.
        </p>
      </ProseSection>

      <ProseSection id="purchases" title="Purchases, delivery and returns">
        <ul>
          <li>Prices include VAT where applicable. Delivery charges are shown at checkout.</li>
          <li>
            A contract for an item is formed when we confirm your order after successful payment.
          </li>
          <li>
            Returns and faulty-item claims are handled as described on our{' '}
            <Link href="/trust#returns">trust page</Link>.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="rewards" title="Rewards">
        <ul>
          <li>
            Reward points are earned on eligible purchases and achievements. They have no cash value
            and cannot be transferred.
          </li>
          <li>Tier status is based on qualifying points earned in the previous 12 months.</li>
          <li>
            We may change the rewards programme with reasonable notice; points already earned will
            be honoured for at least 90 days after any change.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="conduct" title="Acceptable use">
        <ul>
          <li>
            Don’t use automated tools, scripts or multiple accounts to bid, or attempt to interfere
            with the platform.
          </li>
          <li>
            We may pause access while we review unusual activity. A person reviews every case, and
            you can always respond before any final decision.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="contact" title="Contact">
        <p>
          Questions about these terms? <Link href="/support">Contact support</Link>.
        </p>
      </ProseSection>
    </ContentPage>
  )
}
