import type { EligibilityDecision } from '@/domain/auction/rules'

/**
 * Compliance gates.
 *
 * These are configuration HOOKS, not legal conclusions. Whether a market requires acceptance of
 * the current terms, age verification or identity verification (KYC) before an action is decided
 * by legal review and recorded in that market's compliance policy (src/lib/config/market.ts).
 * See docs/COMPLIANCE.md for the open questions.
 */

export const COMPLIANCE_ACTIONS = ['PLACE_BID', 'BUY_BID_PACK', 'CHECKOUT'] as const
export type ComplianceAction = (typeof COMPLIANCE_ACTIONS)[number]

/** Identity verification status. A placeholder until a market's policy requires KYC. */
export const KYC_STATUSES = ['NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED'] as const
export type KycStatus = (typeof KYC_STATUSES)[number]

export interface CompliancePolicy {
  /** Current version of the member terms. */
  termsVersion: string
  /** Actions that need the current terms version to have been accepted. */
  termsRequiredFor: readonly ComplianceAction[]
  /** Actions that need confirmed age (the market's minimum age). */
  ageVerificationRequiredFor: readonly ComplianceAction[]
  /** Actions that need verified identity. Empty unless legal review requires it. */
  kycRequiredFor: readonly ComplianceAction[]
}

export interface ComplianceProfile {
  termsAcceptedVersion: string | null
  ageVerified: boolean
  kycStatus: KycStatus
}

export type ComplianceRequirement = 'TERMS' | 'AGE_VERIFICATION' | 'IDENTITY_VERIFICATION'

export type ComplianceDecision =
  { allowed: true } | { allowed: false; requirement: ComplianceRequirement; message: string }

export const COMPLIANCE_MESSAGES: Record<ComplianceRequirement, string> = {
  TERMS: 'Please review and accept the latest Esocity Bid terms to continue.',
  AGE_VERIFICATION: 'Please confirm your age to continue.',
  IDENTITY_VERIFICATION: 'Please verify your identity to continue.',
}

export function checkCompliance(
  action: ComplianceAction,
  profile: ComplianceProfile,
  policy: CompliancePolicy,
): ComplianceDecision {
  const fail = (requirement: ComplianceRequirement): ComplianceDecision => ({
    allowed: false,
    requirement,
    message: COMPLIANCE_MESSAGES[requirement],
  })
  if (
    policy.termsRequiredFor.includes(action) &&
    profile.termsAcceptedVersion !== policy.termsVersion
  ) {
    return fail('TERMS')
  }
  if (policy.ageVerificationRequiredFor.includes(action) && !profile.ageVerified) {
    return fail('AGE_VERIFICATION')
  }
  if (policy.kycRequiredFor.includes(action) && profile.kycStatus !== 'VERIFIED') {
    return fail('IDENTITY_VERIFICATION')
  }
  return { allowed: true }
}

/** Folds a compliance decision into auction eligibility, so the bid path reports it first. */
export function withCompliance(
  eligibility: EligibilityDecision,
  compliance: ComplianceDecision,
): EligibilityDecision {
  if (compliance.allowed) return eligibility
  const others = eligibility.eligible ? [] : eligibility.reasons
  return { eligible: false, reasons: [compliance.message, ...others] }
}
