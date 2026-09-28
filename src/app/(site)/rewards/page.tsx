import {
  AwardIcon,
  CheckIcon,
  CrownIcon,
  FlameIcon,
  InfoIcon,
  LockIcon,
  Share2Icon,
  SparklesIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { SignInGate } from '@/components/auth/sign-in-gate'
import { Container, PageHeader } from '@/components/common/section'
import { RedeemOptions } from '@/components/rewards/redeem-options'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/misc'
import { Progress } from '@/components/ui/progress'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { getTierDefinition } from '@/domain/rewards'
import { formatDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = {
  title: 'Rewards',
  description:
    'Esocity Rewards: earn points on purchases, unlock member tiers and redeem for bids or vouchers.',
}

const TIER_STYLES = {
  MEMBER: 'from-zinc-700 to-zinc-900',
  SILVER: 'from-slate-400 to-slate-600',
  GOLD: 'from-amber-500 to-amber-700',
  PLATINUM: 'from-indigo-500 to-violet-700',
} as const

export default async function RewardsPage() {
  const viewer = await getViewer()
  if (!viewer) {
    return (
      <SignInGate
        title="Esocity Rewards"
        description="Enter the demo to see your points, tier progress and achievements."
        redirectTo="/rewards"
      />
    )
  }
  const rewards = getBackend().rewards(viewer.userId)
  const { progress } = rewards
  const current = getTierDefinition(progress.tier)
  const next = progress.nextTier ? getTierDefinition(progress.nextTier) : null
  const unlocked = rewards.achievements.filter((achievement) => achievement.unlocked).length
  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        eyebrow="Esocity Rewards"
        title="Rewards"
        description="Earn points when you shop — on marketplace orders, auction wins and Buy Now — plus a few one-off achievements. Points are never awarded for how many bids you place."
      />
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <div
            className={cn('bg-gradient-to-br p-6 text-white sm:p-8', TIER_STYLES[progress.tier])}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm text-white/75">
                  <CrownIcon className="size-4" aria-hidden /> Your tier
                </p>
                <p className="mt-1 text-4xl font-semibold tracking-tight">{current.label}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/75">Points balance</p>
                <p
                  className="tabular mt-1 text-3xl font-semibold tracking-tight"
                  data-testid="rewards-balance"
                >
                  {rewards.balance.toLocaleString('en-GB')}
                </p>
              </div>
            </div>
            <div className="mt-8">
              <div className="mb-2 flex justify-between text-sm text-white/80">
                <span className="tabular">
                  {progress.qualifyingPoints.toLocaleString('en-GB')} qualifying points (12 months)
                </span>
                {next ? <span>{next.label}</span> : <span>Top tier</span>}
              </div>
              <Progress
                value={progress.progress * 100}
                className="bg-white/20"
                indicatorClassName="bg-white"
                label="Progress to next tier"
              />
              <p className="mt-2 text-sm text-white/80">
                {next
                  ? `${progress.pointsToNext.toLocaleString('en-GB')} points to ${next.label}`
                  : 'You’ve reached our highest tier. Thank you for being here.'}
              </p>
            </div>
          </div>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium">Your {current.label} benefits</p>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {current.perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
                <FlameIcon className="size-5 text-warning" aria-hidden />
                <div>
                  <p className="text-sm font-medium">{rewards.weeklyStreak}-week visit streak</p>
                  <p className="text-xs text-muted-foreground">
                    Just visiting counts — no purchase or bid needed.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
                <Share2Icon className="size-5 text-brand" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Referral code{' '}
                    <span className="font-mono tracking-wide">{rewards.referral.code}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rewards.referral.enabled
                      ? 'Share with friends — you both earn points on their first order.'
                      : 'Referrals launch soon (feature flag off).'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Redeem points</CardTitle>
            <CardDescription>
              Redemptions are credited instantly. Promotional bids expire after 30 days; they’re
              always used before purchased bids.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RedeemOptions options={rewards.redemptions} balance={rewards.balance} />
          </CardContent>
        </Card>
      </div>

      <section className="mt-10" aria-labelledby="tiers-heading">
        <h2 id="tiers-heading" className="text-xl font-semibold tracking-tight">
          Membership tiers
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tiers are based on points earned from purchases in the last 12 months.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rewards.tiers.map((tier) => {
            const active = tier.tier === progress.tier
            return (
              <div
                key={tier.tier}
                className={cn(
                  'rounded-2xl border bg-card p-5 shadow-card',
                  active && 'ring-2 ring-brand',
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{tier.label}</p>
                  {active ? <Badge variant="brand">Your tier</Badge> : null}
                </div>
                <p className="tabular mt-1 text-xs text-muted-foreground">
                  {tier.threshold === 0
                    ? 'On joining'
                    : `${tier.threshold.toLocaleString('en-GB')}+ points`}{' '}
                  ·{' '}
                  {(tier.multiplierBps / 10_000).toFixed(tier.multiplierBps % 1_000 === 0 ? 1 : 2)}×
                  earn rate
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex gap-2">
                      <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="achievements-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="achievements-heading" className="text-xl font-semibold tracking-tight">
              Achievements
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {unlocked} of {rewards.achievements.length} unlocked. Achievements celebrate exploring
              and staying in control — never spending more.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rewards.achievements.map((achievement) => (
            <div
              key={achievement.id}
              className={cn(
                'rounded-2xl border p-4',
                achievement.unlocked ? 'bg-card shadow-card' : 'bg-muted/30',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-xl',
                    achievement.unlocked
                      ? 'bg-success-soft text-success-foreground'
                      : 'bg-muted text-subtle-foreground',
                  )}
                >
                  {achievement.unlocked ? (
                    <AwardIcon className="size-4" aria-hidden />
                  ) : (
                    <LockIcon className="size-4" aria-hidden />
                  )}
                </span>
                <span className="tabular text-xs font-medium text-muted-foreground">
                  +{achievement.points} pts
                </span>
              </div>
              <p className="mt-3 font-medium">{achievement.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{achievement.description}</p>
              <Progress
                value={achievement.current}
                max={achievement.target}
                className="mt-3 h-1.5"
                indicatorClassName={achievement.unlocked ? 'bg-success' : undefined}
                label={`${achievement.title} progress`}
              />
              <p className="tabular mt-1.5 text-[11px] text-muted-foreground">
                {achievement.current} / {achievement.target}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-xl font-semibold tracking-tight">
          Points history
        </h2>
        <Card className="mt-4 overflow-hidden">
          {rewards.entries.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No points activity yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Activity</TH>
                  <TH className="text-right">Points</TH>
                </TR>
              </THead>
              <TBody>
                {rewards.entries.slice(0, 30).map((entry) => (
                  <TR key={entry.id}>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {formatDate(entry.at)}
                    </TD>
                    <TD>{entry.description}</TD>
                    <TD
                      className={cn(
                        'tabular text-right font-medium',
                        entry.points > 0 ? 'text-success' : 'text-muted-foreground',
                      )}
                    >
                      {entry.points > 0 ? '+' : ''}
                      {entry.points.toLocaleString('en-GB')}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </section>

      <Notice tone="neutral" icon={<InfoIcon />} className="mt-8">
        Points have no cash value and cannot be exchanged for money. Rewards terms may change with
        notice; any change is shown here first.{' '}
        <Link href="/terms#rewards" className="font-medium underline">
          Rewards terms
        </Link>
      </Notice>
    </Container>
  )
}
