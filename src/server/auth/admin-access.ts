import 'server-only'

import { hasPermission, type Permission } from './roles'
import { getAdminActor, type AdminActor } from './session'

export type AdminAccess =
  | { allowed: true; actor: AdminActor }
  | { allowed: false; actor: AdminActor | null; permission: Permission }

/**
 * Server-side permission check for operator pages. Every admin page calls this before reading
 * data, so hiding a navigation item is never the only protection.
 */
export async function adminAccess(permission: Permission): Promise<AdminAccess> {
  const actor = await getAdminActor()
  if (actor && hasPermission(actor.roles, permission)) return { allowed: true, actor }
  return { allowed: false, actor, permission }
}
