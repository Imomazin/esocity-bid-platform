import { GlobeIcon, ShieldCheckIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type * as React from 'react'

import { DemoSessionControls } from '@/components/account/demo-session-controls'
import { SignInGate } from '@/components/auth/sign-in-gate'
import { Container, PageHeader } from '@/components/common/section'
import { NotificationPreferencesForm } from '@/components/settings/notification-preferences-form'
import { AppearanceForm, InterestsForm } from '@/components/settings/preferences-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/input'
import { formatMinor } from '@/lib/money'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Settings', robots: { index: false } }

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default async function SettingsPage() {
  const viewer = await getViewer()
  if (!viewer)
    return (
      <SignInGate
        title="Settings"
        description="Enter the demo to personalise notifications, appearance and limits."
        redirectTo="/settings"
      />
    )
  const backend = getBackend()
  const overview = backend.accountOverview(viewer.userId)
  const categories = backend
    .categories()
    .map((category) => ({ slug: category.slug, name: category.name }))
  const { limits } = overview.limits
  const limitSummary = [
    limits.dailyBidLimit !== null ? `${limits.dailyBidLimit} bids/day` : null,
    limits.weeklyBidLimit !== null ? `${limits.weeklyBidLimit} bids/week` : null,
    limits.monthlyBidPurchaseBudgetMinor !== null
      ? `${formatMinor(limits.monthlyBidPurchaseBudgetMinor, 'GBP', { trimZeroMinor: true })}/month on bid packs`
      : null,
  ].filter(Boolean)
  return (
    <Container className="max-w-4xl py-8 sm:py-10">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Personalise Esocity Bid. Profile, addresses and data requests live in your account."
      />
      <div className="space-y-6">
        <Section
          id="appearance"
          title="Appearance"
          description="Choose a theme, or follow your device setting."
        >
          <AppearanceForm />
        </Section>

        <Section
          id="interests"
          title="Interests"
          description="Tell us what you like and we’ll tailor recommendations. We never use sensitive data for personalisation."
        >
          <InterestsForm categories={categories} initial={overview.preferences.interests} />
        </Section>

        <Section
          id="notifications"
          title="Notifications"
          description="Choose how and when we contact you."
        >
          <NotificationPreferencesForm initial={overview.notificationPreferences} />
        </Section>

        <Section id="responsible-use" title="Responsible use">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-3 text-sm">
              <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
              <span>
                {limitSummary.length > 0 ? (
                  <>Your limits: {limitSummary.join(' · ')}.</>
                ) : (
                  'You haven’t set any limits yet.'
                )}{' '}
                <span className="text-muted-foreground">
                  Limits, alerts and breaks are enforced by our servers on every bid.
                </span>
              </span>
            </p>
            <Button asChild variant="outline" className="shrink-0">
              <Link href="/account#responsible-use">Manage limits</Link>
            </Button>
          </div>
        </Section>

        <Section
          id="region"
          title="Region & currency"
          description="Esocity Bid currently operates in the United Kingdom."
        >
          <div className="grid max-w-md gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="region" className="text-sm font-medium">
                Region
              </label>
              <NativeSelect id="region" defaultValue={overview.preferences.region} disabled>
                <option value="UK">United Kingdom</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="currency" className="text-sm font-medium">
                Currency
              </label>
              <NativeSelect id="currency" defaultValue={overview.preferences.currency} disabled>
                <option value="GBP">Pound sterling (£)</option>
              </NativeSelect>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <GlobeIcon className="size-3.5" aria-hidden /> Additional markets (e.g. Ireland) are
            planned and will be enabled per market after compliance review.
          </p>
        </Section>

        <Section id="privacy" title="Privacy">
          <p className="text-sm text-muted-foreground">
            Marketing emails are opt-in and managed in your{' '}
            <Link href="/account#profile" className="font-medium text-foreground underline">
              profile
            </Link>
            . Data export and deletion requests are available from{' '}
            <Link href="/account#privacy" className="font-medium text-foreground underline">
              Privacy &amp; data
            </Link>
            .
          </p>
        </Section>

        <Section id="security" title="Security & session">
          <p className="mb-4 text-sm text-muted-foreground">
            You’re using a sandboxed demo account. Resetting restores fresh demo data; exiting
            discards this account.
          </p>
          <DemoSessionControls />
        </Section>
      </div>
    </Container>
  )
}
