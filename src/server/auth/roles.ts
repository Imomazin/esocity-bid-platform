import { DomainError } from '@/domain/errors'

/**
 * Role-based access control. Demo mode may bypass external authentication, but permissions are
 * still modelled and enforced on every admin page and API route.
 */

export const ROLES = [
  'CUSTOMER',
  'SUPPORT_AGENT',
  'OPERATIONS',
  'MERCHANDISER',
  'FINANCE',
  'ADMIN',
  'SUPER_ADMIN',
] as const
export type Role = (typeof ROLES)[number]

export const STAFF_ROLES = ROLES.filter((role) => role !== 'CUSTOMER') as Exclude<
  Role,
  'CUSTOMER'
>[]

export const PERMISSIONS = [
  'admin.access',
  'analytics.view',
  'auctions.view',
  'auctions.manage',
  'auctions.cancel',
  'autobid.killswitch',
  'products.manage',
  'inventory.manage',
  'suppliers.view',
  'orders.view',
  'orders.manage',
  'payments.view',
  'refunds.issue',
  'promotions.manage',
  'support.manage',
  'fraud.view',
  'fraud.decide',
  'fraud.block',
  'audit.view',
  'customers.view',
  'wallet.adjust',
] as const
export type Permission = (typeof PERMISSIONS)[number]

const ALL = [...PERMISSIONS] as Permission[]

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  CUSTOMER: [],
  SUPPORT_AGENT: [
    'admin.access',
    'auctions.view',
    'orders.view',
    'support.manage',
    'customers.view',
    'fraud.view',
  ],
  OPERATIONS: [
    'admin.access',
    'analytics.view',
    'auctions.view',
    'auctions.manage',
    'autobid.killswitch',
    'inventory.manage',
    'suppliers.view',
    'orders.view',
    'orders.manage',
    'support.manage',
    'fraud.view',
    'fraud.decide',
    'customers.view',
  ],
  MERCHANDISER: [
    'admin.access',
    'analytics.view',
    'auctions.view',
    'auctions.manage',
    'products.manage',
    'inventory.manage',
    'suppliers.view',
    'promotions.manage',
  ],
  FINANCE: [
    'admin.access',
    'analytics.view',
    'auctions.view',
    'orders.view',
    'payments.view',
    'refunds.issue',
    'audit.view',
    'customers.view',
  ],
  ADMIN: ALL.filter((permission) => permission !== 'wallet.adjust' && permission !== 'fraud.block'),
  SUPER_ADMIN: ALL,
}

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Customer',
  SUPPORT_AGENT: 'Support agent',
  OPERATIONS: 'Operations',
  MERCHANDISER: 'Merchandiser',
  FINANCE: 'Finance',
  ADMIN: 'Administrator',
  SUPER_ADMIN: 'Super administrator',
}

export function isRole(value: string | undefined | null): value is Role {
  return !!value && (ROLES as readonly string[]).includes(value)
}

export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission))
}

export function assertPermission(roles: readonly Role[], permission: Permission): void {
  if (!hasPermission(roles, permission)) {
    throw new DomainError('FORBIDDEN', 'Your role does not allow this action.', { permission })
  }
}
