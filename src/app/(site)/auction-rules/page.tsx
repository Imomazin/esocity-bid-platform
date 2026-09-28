import type { Metadata } from 'next'
import Link from 'next/link'

import { ContentPage, ProseSection } from '@/components/content/content-page'
import { DEFAULT_AUCTION_RULES } from '@/domain/auction/rules'
import { formatMinor } from '@/lib/money'

export const metadata: Metadata = {
  title: 'Auction rules',
  description:
    'The complete Esocity Bid auction rules: bid credits, increments, timers, winning, payment, refunds, Buy Now recovery and AutoBid.',
  alternates: { canonical: '/auction-rules' },
}

const TOC = [
  { id: 'eligibility', label: '1. Who can bid' },
  { id: 'credits', label: '2. Bid credits' },
  { id: 'bidding', label: '3. Placing bids' },
  { id: 'timer', label: '4. The countdown' },
  { id: 'winning', label: '5. Winning & payment' },
  { id: 'refunds', label: '6. When bids are refunded' },
  { id: 'recovery', label: '7. Buy Now & recovery' },
  { id: 'autobid', label: '8. AutoBid' },
  { id: 'integrity', label: '9. Fair play' },
  { id: 'changes', label: '10. Rule changes' },
]

export default function AuctionRulesPage() {
  const defaults = DEFAULT_AUCTION_RULES
  return (
    <ContentPage
      eyebrow="Rulebook"
      title="Auction rules"
      intro="These rules apply to every Esocity Bid auction. Each auction page also shows its specific settings — bid cost, increment, timer and any eligibility rules — before you bid."
      toc={TOC}
      updated="1 September 2026"
    >
      <ProseSection id="eligibility" title="1. Who can bid">
        <ul>
          <li>
            You must be 18 or over, hold a verified Esocity account and be located in a market where
            the auction is offered (currently the United Kingdom).
          </li>
          <li>
            Some auctions have extra eligibility rules, shown on the auction page — for example,{' '}
            <strong>Beginner</strong> auctions for members who haven’t won yet, or auctions reserved
            for a rewards tier.
          </li>
          <li>
            Accounts that are taking a break, or that are temporarily restricted while an issue is
            reviewed by our team, can’t bid until the break or review ends.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="credits" title="2. Bid credits">
        <ul>
          <li>
            Placing a bid uses bid credits. The number of credits per bid is shown on each auction
            (usually {defaults.bidCreditCost}).
          </li>
          <li>
            Bid credits are not money, have no cash value and cannot be withdrawn or transferred.
          </li>
          <li>
            Promotional credits (bonuses, rewards, goodwill) are used before purchased credits and
            may expire; the expiry date is shown in your <Link href="/wallet">Bid Wallet</Link>.
            Purchased credits don’t expire.
          </li>
          <li>
            Your balance is always the sum of an immutable ledger of credits and debits, which you
            can review at any time.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="bidding" title="3. Placing bids">
        <ul>
          <li>
            Each accepted bid raises the auction price by the auction’s fixed increment (usually{' '}
            {formatMinor(defaults.bidIncrementMinor)}) and makes you the leading bidder.
          </li>
          <li>
            Bids are processed by our servers strictly in the order they arrive. A bid that arrives
            after the countdown reaches zero is rejected and no credits are used.
          </li>
          <li>You cannot bid while you are the leading bidder.</li>
          <li>
            An auction may limit the number of bids per member or the number of bidders; these
            limits are shown on the auction page.
          </li>
          <li>
            A bid is only final once our servers confirm it. If a bid is rejected, no credits are
            taken.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="timer" title="4. The countdown">
        <ul>
          <li>
            Each accepted bid guarantees at least the auction’s extension time remains (usually{' '}
            {defaults.timerExtensionSeconds} seconds). If more time than that already remains, the
            countdown is not changed.
          </li>
          <li>
            Auctions with a <strong>hard stop</strong> end at their scheduled time regardless of
            bidding.
          </li>
          <li>
            The countdown in your browser is a display synchronised to our server clock. Only the
            server clock decides when an auction ends. If an auction is paused for operational
            reasons, the remaining time is frozen and restored when it resumes.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="winning" title="5. Winning and payment">
        <ul>
          <li>
            When the server countdown reaches zero, the leading bidder at that moment wins, subject
            to any reserve and minimum-participant rules.
          </li>
          <li>
            The winner pays the final auction price plus delivery, within the payment window shown
            (usually {defaults.winnerPaymentWindowHours} hours). Bid credits used are not part of
            the price.
          </li>
          <li>
            If payment isn’t completed in time, the order is cancelled and the item is released. Bid
            credits used in the auction are not returned.
          </li>
          <li>
            Results show the final price, the number of bids and the number of bids the winner used.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="refunds" title="6. When bids are refunded">
        <p>All bid credits used in an auction are returned to bidders’ wallets if:</p>
        <ul>
          <li>fewer than the auction’s minimum number of different bidders took part;</li>
          <li>the auction has a reserve price that wasn’t reached; or</li>
          <li>we cancel the auction (for example, if the item becomes unavailable).</li>
        </ul>
        <p>Refunds are made automatically and appear in your Bid Wallet ledger.</p>
      </ProseSection>

      <ProseSection id="recovery" title="7. Buy Now and bid credit recovery">
        <ul>
          <li>Where Buy Now is offered, anyone can buy the item at its Buy Now price.</li>
          <li>
            If the auction offers bid credit recovery and you bid but didn’t win, buying the item at
            its Buy Now price within the recovery window (usually {defaults.recoveryWindowHours}{' '}
            hours after the auction ends) returns your eligible bids to your wallet — or, on
            price-credit auctions, deducts their value from the price. Only purchased bids ever
            count towards a price credit.
          </li>
          <li>
            Recovery can be used once per auction. The auction page and checkout show exactly what
            you’ll recover before you pay.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="autobid" title="8. AutoBid">
        <ul>
          <li>
            AutoBid places bids on our servers on your behalf, following exactly the same rules as
            manual bids.
          </li>
          <li>
            It never exceeds the maximum bids or price you set, your responsible-use limits, or your
            available credits, and you can cancel it at any time.
          </li>
          <li>
            We may temporarily switch AutoBid off platform-wide or for an auction to protect
            fairness; any active AutoBid then stops placing bids.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="integrity" title="9. Fair play">
        <ul>
          <li>Esocity staff and suppliers cannot bid. We don’t place bids to raise prices.</li>
          <li>
            Each member may hold one account. We monitor for patterns such as shared devices or
            automated bidding tools. Unusual activity is reviewed by a person before any action is
            taken, and you’ll always be told what happened and how to respond.
          </li>
          <li>
            On the demonstration platform, other bidders are <strong>simulated</strong> and clearly
            labelled — see <Link href="/demo">About this demo</Link>.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="changes" title="10. Rule changes">
        <p>
          An auction’s rules can’t be changed once it is live in any way that affects its economics
          or fairness. We may pause or cancel an auction for operational or integrity reasons;
          cancelled auctions are refunded in full. Changes to these general rules are published here
          with the date they take effect.
        </p>
      </ProseSection>
    </ContentPage>
  )
}
