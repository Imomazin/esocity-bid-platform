import { MINUTE, SECOND } from '@/lib/time'

/**
 * Fraud and bot intelligence.
 *
 * The platform computes RISK INDICATORS, not accusations. A FraudRiskAssessment combines weighted
 * signals into a 0–100 score, a risk class and a *recommended* action. Automated enforcement is
 * limited to throttling; blocking an account always requires a human decision that is recorded
 * in the audit log. Customer-facing messages never state or imply wrongdoing.
 */

export const FRAUD_SIGNAL_CODES = [
  'BID_VELOCITY',
  'IMPOSSIBLE_FREQUENCY',
  'AUTOMATION_PATTERN',
  'SHARED_DEVICE',
  'ACCOUNT_ANOMALY',
  'PAYMENT_RISK',
  'PROMO_ABUSE',
  'REFUND_ABUSE',
] as const

export type FraudSignalCode = (typeof FRAUD_SIGNAL_CODES)[number]
export type RiskClass = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
export type RiskAction = 'ALLOW' | 'REVIEW' | 'THROTTLE' | 'BLOCK'

export const SIGNAL_LABELS: Record<FraudSignalCode, string> = {
  BID_VELOCITY: 'Elevated bid velocity',
  IMPOSSIBLE_FREQUENCY: 'Bid timing faster than human interaction',
  AUTOMATION_PATTERN: 'Highly regular bid intervals (possible automation)',
  SHARED_DEVICE: 'Device shared with other accounts (placeholder signal)',
  ACCOUNT_ANOMALY: 'Unusual account activity',
  PAYMENT_RISK: 'Payment risk indicator (placeholder signal)',
  PROMO_ABUSE: 'Repeated promotion use across related accounts',
  REFUND_ABUSE: 'Refund rate above normal range',
}

export interface FraudSignal {
  code: FraudSignalCode
  /** Contribution weight 0–100. */
  weight: number
  detail: string
  observedAt: number
}

export interface FraudRiskAssessment {
  score: number
  riskClass: RiskClass
  recommendedAction: RiskAction
  /** What the system applies automatically (never BLOCK). */
  automatedAction: Exclude<RiskAction, 'BLOCK'>
  signals: FraudSignal[]
  assessedAt: number
}

/**
 * Combines weights as independent probabilities: score = 100 × (1 − Π(1 − wᵢ/100)).
 * Bounded to 0–100 and monotonic in every signal.
 */
export function scoreSignals(signals: readonly FraudSignal[]): number {
  const remaining = signals.reduce((product, signal) => {
    const weight = Math.min(Math.max(signal.weight, 0), 100) / 100
    return product * (1 - weight)
  }, 1)
  return Math.round((1 - remaining) * 100)
}

export function classifyScore(score: number): RiskClass {
  if (score >= 75) return 'CRITICAL'
  if (score >= 50) return 'HIGH'
  if (score >= 25) return 'MODERATE'
  return 'LOW'
}

export const RECOMMENDED_ACTION: Record<RiskClass, RiskAction> = {
  LOW: 'ALLOW',
  MODERATE: 'REVIEW',
  HIGH: 'THROTTLE',
  CRITICAL: 'BLOCK',
}

export function assessRisk(signals: readonly FraudSignal[], now: number): FraudRiskAssessment {
  const score = scoreSignals(signals)
  const riskClass = classifyScore(score)
  const recommendedAction = RECOMMENDED_ACTION[riskClass]
  return {
    score,
    riskClass,
    recommendedAction,
    automatedAction: recommendedAction === 'BLOCK' ? 'THROTTLE' : recommendedAction,
    signals: [...signals],
    assessedAt: now,
  }
}

/** Derives bid-behaviour signals from a member's recent bid timestamps (ms, any order). */
export function detectBidSignals(timestamps: readonly number[], now: number): FraudSignal[] {
  const sorted = [...timestamps].sort((a, b) => a - b)
  const signals: FraudSignal[] = []
  const lastMinute = sorted.filter((at) => at > now - MINUTE).length
  if (lastMinute > 30) {
    signals.push({
      code: 'BID_VELOCITY',
      weight: Math.min(60, 20 + (lastMinute - 30) * 2),
      detail: `${lastMinute} bids in the last 60 seconds`,
      observedAt: now,
    })
  }
  const intervals = sorted.slice(1).map((at, index) => at - (sorted[index] ?? at))
  const recent = intervals.slice(-20)
  const impossible = recent.filter((interval) => interval < 150).length
  if (impossible >= 3) {
    signals.push({
      code: 'IMPOSSIBLE_FREQUENCY',
      weight: Math.min(70, 35 + impossible * 5),
      detail: `${impossible} bids placed less than 150ms apart`,
      observedAt: now,
    })
  }
  if (recent.length >= 12) {
    const mean = recent.reduce((acc, value) => acc + value, 0) / recent.length
    const variance = recent.reduce((acc, value) => acc + (value - mean) ** 2, 0) / recent.length
    const coefficient = mean === 0 ? 0 : Math.sqrt(variance) / mean
    if (coefficient < 0.08 && mean < 30 * SECOND) {
      signals.push({
        code: 'AUTOMATION_PATTERN',
        weight: 45,
        detail: `Interval variation ${(coefficient * 100).toFixed(1)}% across ${recent.length} bids`,
        observedAt: now,
      })
    }
  }
  return signals
}

export const RISK_CLASS_LABELS: Record<RiskClass, string> = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export const RISK_ACTION_LABELS: Record<RiskAction, string> = {
  ALLOW: 'Allow',
  REVIEW: 'Review',
  THROTTLE: 'Throttle',
  BLOCK: 'Block (requires analyst)',
}

export type FraudCaseStatus = 'OPEN' | 'UNDER_REVIEW' | 'CLEARED' | 'THROTTLED' | 'BLOCKED'

export interface FraudCase {
  id: string
  userId: string
  customerName: string
  assessment: FraudRiskAssessment
  status: FraudCaseStatus
  decision: { action: RiskAction | 'CLEAR'; by: string; at: number; note: string } | null
  createdAt: number
  simulated: boolean
}
