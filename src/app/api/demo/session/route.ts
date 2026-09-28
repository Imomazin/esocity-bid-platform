import { cookies } from 'next/headers'

import { DomainError } from '@/domain/errors'
import { summarizeWallet } from '@/domain/wallet'
import { isDemoMode } from '@/lib/config/env'
import { SESSION_COOKIE, getSessionId, sessionCookieOptions } from '@/server/auth/session'
import { route } from '@/server/http/api'

/** Enter the demo platform: issues a sandboxed demo identity with a demo Bid Wallet. */
export const POST = route({ auth: 'none', rateLimit: 'demoSession' }, async ({ runtime }) => {
  if (!isDemoMode())
    throw new DomainError('FEATURE_DISABLED', 'Demo sessions are only available in demo mode.')
  const jar = await cookies()
  const existing = await getSessionId()
  const sessionId = existing ?? crypto.randomUUID()
  const created = !existing || !runtime.backend.hasSessionAccount(sessionId)
  const account = runtime.backend.ensureSessionAccount(sessionId)
  jar.set(SESSION_COOKIE, sessionId, sessionCookieOptions)
  return {
    created,
    displayName: account.displayName,
    walletAvailable: summarizeWallet(account.ledger, runtime.backend.now()).available,
  }
})

/** Leave the demo. The sandboxed account is discarded. */
export const DELETE = route({ auth: 'none' }, async ({ runtime }) => {
  const jar = await cookies()
  const sessionId = await getSessionId()
  if (sessionId) runtime.backend.resetSessionAccount(sessionId)
  jar.delete(SESSION_COOKIE)
  return { signedOut: true }
})
