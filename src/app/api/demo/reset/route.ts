import { cookies } from 'next/headers'

import { DomainError } from '@/domain/errors'
import { summarizeWallet } from '@/domain/wallet'
import { SESSION_COOKIE, getSessionId, sessionCookieOptions } from '@/server/auth/session'
import { route } from '@/server/http/api'

/** Reset the demo: discards the sandboxed account and issues a fresh one with seeded history. */
export const POST = route({ auth: 'none', rateLimit: 'demoSession' }, async ({ runtime }) => {
  const current = await getSessionId()
  if (!current) throw new DomainError('UNAUTHENTICATED', 'Enter the demo first.')
  runtime.backend.resetSessionAccount(current)
  const next = crypto.randomUUID()
  const account = runtime.backend.ensureSessionAccount(next)
  ;(await cookies()).set(SESSION_COOKIE, next, sessionCookieOptions)
  return { walletAvailable: summarizeWallet(account.ledger, runtime.backend.now()).available }
})
