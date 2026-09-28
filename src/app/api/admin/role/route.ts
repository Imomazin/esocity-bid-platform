import { cookies } from 'next/headers'

import { DomainError } from '@/domain/errors'
import { isDemoMode } from '@/lib/config/env'
import { DEMO_ROLE_COOKIE } from '@/server/auth/session'
import { demoRoleSchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'

/**
 * Demo only: switch the simulated operator's role to explore the permission model. In
 * production, roles come from the authentication provider and cannot be self-assigned.
 */
export const POST = route(
  { auth: 'none', rateLimit: 'mutation', body: demoRoleSchema },
  async ({ body }) => {
    if (!isDemoMode())
      throw new DomainError('FEATURE_DISABLED', 'Role switching is only available in demo mode.')
    ;(await cookies()).set(DEMO_ROLE_COOKIE, body.role, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return { role: body.role }
  },
)
