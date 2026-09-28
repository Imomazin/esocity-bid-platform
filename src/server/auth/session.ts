import 'server-only'

import { cookies } from 'next/headers'

import { isDemoMode } from '@/lib/config/env'
import { isUuid } from '@/lib/ids'
import { getRuntime } from '@/server/runtime'

import { isRole, type Role } from './roles'

/**
 * Identity.
 *
 * DEMO MODE: visitors browse anonymously. "Enter the demo platform" issues a random session id
 * (httpOnly cookie) that maps to a sandboxed demo account ("Demo Member") with a demo Bid Wallet.
 * The admin console is open to demo visitors under a simulated operator identity whose role can
 * be switched to explore the permission model.
 *
 * PRODUCTION: `getProductionViewer` / `getProductionAdmin` are the attach points for an
 * authentication provider (Auth.js or Clerk). See docs/SECURITY.md → "Authentication".
 */

export const SESSION_COOKIE = 'esb_session'
export const DEMO_ROLE_COOKIE = 'esb_demo_role'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export interface Viewer {
  userId: string
  displayName: string
  firstName: string
  email: string
  handle: string
  roles: Role[]
  isDemo: boolean
}

export interface AdminActor {
  id: string
  name: string
  role: Role
  roles: Role[]
  isDemo: boolean
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
}

/** Attach point: resolve the signed-in customer from the auth provider session. */
async function getProductionViewer(): Promise<Viewer | null> {
  return null
}

/** Attach point: resolve a staff member and their roles from the auth provider session. */
async function getProductionAdmin(): Promise<AdminActor | null> {
  return null
}

export async function getSessionId(): Promise<string | null> {
  const jar = await cookies()
  const value = jar.get(SESSION_COOKIE)?.value
  return value && isUuid(value) ? value : null
}

export async function getViewer(): Promise<Viewer | null> {
  if (!isDemoMode()) return getProductionViewer()
  const sessionId = await getSessionId()
  if (!sessionId) return null
  const account = getRuntime().backend.ensureSessionAccount(sessionId)
  return {
    userId: account.id,
    displayName: account.displayName,
    firstName: account.profile.firstName,
    email: account.profile.email,
    handle: account.handle,
    roles: ['CUSTOMER'],
    isDemo: true,
  }
}

export async function getAdminActor(): Promise<AdminActor | null> {
  if (!isDemoMode()) return getProductionAdmin()
  const jar = await cookies()
  const requested = jar.get(DEMO_ROLE_COOKIE)?.value
  const role: Role = isRole(requested) && requested !== 'CUSTOMER' ? requested : 'ADMIN'
  return { id: 'demo-operator', name: 'Demo Operator', role, roles: [role], isDemo: true }
}
