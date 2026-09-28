import { InfoIcon } from 'lucide-react'
import type { Metadata } from 'next'

import { AccessDenied, AdminPageHeader } from '@/components/admin/admin-ui'
import { FraudDecision } from '@/components/admin/fraud-decision'
import { ChipLink } from '@/components/common/chip-link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, Notice } from '@/components/ui/misc'
import { Progress } from '@/components/ui/progress'
import { RISK_ACTION_LABELS, RISK_CLASS_LABELS, SIGNAL_LABELS } from '@/domain/fraud'
import { formatDateTime, formatRelative } from '@/lib/time'
import { adminAccess } from '@/server/auth/admin-access'
import { hasPermission } from '@/server/auth/roles'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Fraud & risk' }

const RISK_VARIANTS = {
  LOW: 'neutral',
  MODERATE: 'warning',
  HIGH: 'danger',
  CRITICAL: 'live',
} as const
const STATUS_VARIANTS = {
  OPEN: 'warning',
  UNDER_REVIEW: 'info',
  CLEARED: 'success',
  THROTTLED: 'brand',
  BLOCKED: 'danger',
} as const

export default async function FraudPage({ searchParams }: PageProps<'/admin/fraud'>) {
  const access = await adminAccess('fraud.view')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const params = await searchParams
  const view = params.view === 'closed' ? 'closed' : 'open'
  const backend = getBackend()
  const cases = backend.admin.fraudCases()
  const now = backend.now()
  const open = cases.filter((item) => item.status === 'OPEN' || item.status === 'UNDER_REVIEW')
  const closed = cases.filter((item) => item.status !== 'OPEN' && item.status !== 'UNDER_REVIEW')
  const visible = view === 'open' ? open : closed
  const canDecide = hasPermission(access.actor.roles, 'fraud.decide')
  const canBlock = hasPermission(access.actor.roles, 'fraud.block')
  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Fraud & risk"
        description="Risk scores (0–100) combine behavioural signals such as bid velocity, sub-human timing and regular intervals. Scores recommend an action; people decide."
      />
      <Notice tone="brand" icon={<InfoIcon />} title="Automated actions are limited by design">
        The system may apply a temporary throttle for high scores, but it never blocks an account on
        its own and never labels a customer as fraudulent. Device and payment signals are
        placeholders until those providers are connected.
      </Notice>
      <nav aria-label="Case status" className="flex gap-1.5">
        <ChipLink href="/admin/fraud" active={view === 'open'}>
          To review <span className="text-[11px] opacity-70">{open.length}</span>
        </ChipLink>
        <ChipLink href="/admin/fraud?view=closed" active={view === 'closed'}>
          Decided <span className="text-[11px] opacity-70">{closed.length}</span>
        </ChipLink>
      </nav>
      {visible.length === 0 ? (
        <EmptyState title={view === 'open' ? 'No cases to review' : 'No decided cases yet'} />
      ) : (
        <div className="space-y-4">
          {visible.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-4 pt-5 sm:pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{item.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      Flagged {formatRelative(item.createdAt, now)} · assessed{' '}
                      {formatDateTime(item.assessment.assessedAt)}
                      {item.simulated ? ' · simulated case' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={STATUS_VARIANTS[item.status]}>
                      {item.status.replace('_', ' ').toLowerCase()}
                    </Badge>
                    <Badge variant={RISK_VARIANTS[item.assessment.riskClass]}>
                      {RISK_CLASS_LABELS[item.assessment.riskClass]} risk
                    </Badge>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="viz-root">
                    <p className="text-xs text-muted-foreground">Risk score</p>
                    <p className="text-3xl font-semibold tracking-tight">{item.assessment.score}</p>
                    <Progress
                      value={item.assessment.score}
                      max={100}
                      label="Risk score"
                      className="mt-2 bg-[var(--viz-track)]"
                      indicatorClassName={
                        item.assessment.score >= 75
                          ? 'bg-danger'
                          : item.assessment.score >= 50
                            ? 'bg-warning'
                            : 'bg-[var(--viz-1)]'
                      }
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Recommended:{' '}
                      <span className="font-medium text-foreground">
                        {RISK_ACTION_LABELS[item.assessment.recommendedAction]}
                      </span>
                      <br />
                      Automated:{' '}
                      <span className="font-medium text-foreground">
                        {RISK_ACTION_LABELS[item.assessment.automatedAction]}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Signals</p>
                    <ul className="space-y-2 text-sm">
                      {item.assessment.signals.map((signal) => (
                        <li
                          key={signal.code}
                          className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
                        >
                          <span>
                            <span className="font-medium">{SIGNAL_LABELS[signal.code]}</span>
                            <span className="block text-xs text-muted-foreground">
                              {signal.detail}
                            </span>
                          </span>
                          <span className="tabular shrink-0 text-xs text-muted-foreground">
                            weight {signal.weight}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {item.decision ? (
                  <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <span className="font-medium">{item.decision.action}</span> by{' '}
                    {item.decision.by} · {formatDateTime(item.decision.at)} — {item.decision.note}
                  </p>
                ) : null}
                {canDecide && view === 'open' ? (
                  <FraudDecision
                    caseId={item.id}
                    recommended={item.assessment.recommendedAction}
                    canBlock={canBlock}
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
