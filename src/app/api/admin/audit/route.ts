import { auditQuerySchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'

/** Query the immutable audit log. */
export const GET = route(
  { auth: 'admin', permission: 'audit.view', query: auditQuerySchema },
  async ({ query, runtime }) => runtime.backend.admin.audit(query),
)
