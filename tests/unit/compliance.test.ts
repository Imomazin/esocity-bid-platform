import { describe, expect, it } from 'vitest'

import {
  COMPLIANCE_MESSAGES,
  checkCompliance,
  withCompliance,
  type CompliancePolicy,
  type ComplianceProfile,
} from '@/domain/compliance'
import { MARKETS, TERMS_VERSION } from '@/lib/config/market'

const policy: CompliancePolicy = {
  termsVersion: '2026-09-01',
  termsRequiredFor: ['PLACE_BID', 'BUY_BID_PACK', 'CHECKOUT'],
  ageVerificationRequiredFor: ['PLACE_BID', 'BUY_BID_PACK'],
  kycRequiredFor: [],
}
const profile = (overrides: Partial<ComplianceProfile> = {}): ComplianceProfile => ({
  termsAcceptedVersion: '2026-09-01',
  ageVerified: true,
  kycStatus: 'NOT_STARTED',
  ...overrides,
})

describe('compliance gates', () => {
  it('allows a member who has accepted the current terms and confirmed their age', () => {
    expect(checkCompliance('PLACE_BID', profile(), policy)).toEqual({ allowed: true })
  })

  it('requires the current terms version, not an older one', () => {
    expect(
      checkCompliance('CHECKOUT', profile({ termsAcceptedVersion: '2025-01-01' }), policy),
    ).toMatchObject({ allowed: false, requirement: 'TERMS' })
    expect(
      checkCompliance('PLACE_BID', profile({ termsAcceptedVersion: null }), policy),
    ).toMatchObject({ allowed: false, requirement: 'TERMS' })
  })

  it('applies age checks only to the actions the market lists', () => {
    const unverified = profile({ ageVerified: false })
    expect(checkCompliance('BUY_BID_PACK', unverified, policy)).toMatchObject({
      requirement: 'AGE_VERIFICATION',
    })
    expect(checkCompliance('CHECKOUT', unverified, policy)).toEqual({ allowed: true })
  })

  it('keeps KYC as a placeholder that a market can switch on by configuration', () => {
    expect(checkCompliance('BUY_BID_PACK', profile(), policy)).toEqual({ allowed: true })
    const kycPolicy = { ...policy, kycRequiredFor: ['BUY_BID_PACK'] as const }
    expect(checkCompliance('BUY_BID_PACK', profile(), kycPolicy)).toMatchObject({
      requirement: 'IDENTITY_VERIFICATION',
    })
    expect(checkCompliance('BUY_BID_PACK', profile({ kycStatus: 'VERIFIED' }), kycPolicy)).toEqual({
      allowed: true,
    })
  })

  it('reports compliance first when folded into auction eligibility', () => {
    const blocked = checkCompliance('PLACE_BID', profile({ termsAcceptedVersion: null }), policy)
    expect(withCompliance({ eligible: true }, blocked)).toEqual({
      eligible: false,
      reasons: [COMPLIANCE_MESSAGES.TERMS],
    })
    expect(withCompliance({ eligible: false, reasons: ['Region'] }, blocked)).toEqual({
      eligible: false,
      reasons: [COMPLIANCE_MESSAGES.TERMS, 'Region'],
    })
    expect(withCompliance({ eligible: true }, { allowed: true })).toEqual({ eligible: true })
  })

  it('configures every market with the current terms and no KYC requirement yet', () => {
    for (const market of Object.values(MARKETS)) {
      expect(market.compliance.termsVersion).toBe(TERMS_VERSION)
      expect(market.compliance.kycRequiredFor).toEqual([])
    }
  })
})
