import type { Metadata } from 'next'
import Link from 'next/link'

import { ContentPage, DemoLegalNotice, ProseSection } from '@/components/content/content-page'

export const metadata: Metadata = {
  title: 'Privacy notice',
  description: 'How the Esocity Bid demonstration platform uses data, cookies and storage.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Privacy notice"
      intro="What data Esocity Bid uses, why, how long we keep it, and the choices you have."
      updated="1 September 2026"
      toc={[
        { id: 'demo', label: 'In demo mode' },
        { id: 'collect', label: 'What we collect' },
        { id: 'use', label: 'How we use it' },
        { id: 'cookies', label: 'Cookies & storage' },
        { id: 'retention', label: 'Retention' },
        { id: 'rights', label: 'Your choices' },
      ]}
    >
      <DemoLegalNotice document="privacy notice" />

      <ProseSection id="demo" title="In demo mode">
        <p>
          The demonstration platform does not ask for your name, email or payment details. Entering
          the demo creates an anonymous, sandboxed account linked to a session cookie. Demo data is
          held in memory and discarded when you exit the demo or the demo environment restarts.
        </p>
      </ProseSection>

      <ProseSection id="collect" title="What we collect (production)">
        <ul>
          <li>
            Account details: name, email, phone (optional), delivery addresses and date-of-birth
            confirmation.
          </li>
          <li>
            Transactions: bid pack purchases, bids, orders, refunds and rewards — kept as ledgers
            for accuracy and audit.
          </li>
          <li>
            Payment references from our payment provider. We never receive or store full card
            numbers.
          </li>
          <li>
            Security signals such as IP address and device information, used to protect accounts and
            keep auctions fair.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="use" title="How we use it">
        <ul>
          <li>To run your account, process bids and orders, deliver items and provide support.</li>
          <li>To enforce the responsible-use limits you set and send the alerts you choose.</li>
          <li>
            To detect and investigate fraud or misuse. Automated signals are always reviewed by a
            person before action is taken.
          </li>
          <li>
            To personalise recommendations using your interests and activity on Esocity Bid — never
            sensitive data.
          </li>
          <li>To send marketing only if you opt in.</li>
        </ul>
      </ProseSection>

      <ProseSection id="cookies" title="Cookies and storage">
        <ul>
          <li>
            <strong>esb_session</strong> — an essential, HTTP-only cookie that keeps you signed in
            to the demo.
          </li>
          <li>
            <strong>esb_demo_role</strong> — an essential cookie used only in the operator console
            to select a demo staff role.
          </li>
          <li>
            <strong>esb-theme</strong> — stored in your browser to remember light or dark mode.
          </li>
          <li>
            Analytics are disabled in demo mode. In production, non-essential analytics run only
            with your consent.
          </li>
        </ul>
      </ProseSection>

      <ProseSection id="retention" title="Retention">
        <p>
          Financial and audit records are retained for the period required for accounting and
          regulatory purposes. Other data is deleted or anonymised when no longer needed, or when
          you close your account unless we must keep it.
        </p>
      </ProseSection>

      <ProseSection id="rights" title="Your choices">
        <p>
          You can access, correct, export or delete your data, object to certain processing and
          withdraw consent at any time. Use <Link href="/account#privacy">Privacy &amp; data</Link>{' '}
          in your account or <Link href="/support">contact support</Link>.
        </p>
      </ProseSection>
    </ContentPage>
  )
}
