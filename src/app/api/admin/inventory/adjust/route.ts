import { inventoryAdjustSchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'

/** Manual stock adjustment, recorded as an append-only inventory ledger event. */
export const POST = route(
  { auth: 'admin', permission: 'inventory.manage', body: inventoryAdjustSchema },
  async ({ body, runtime, admin }) => {
    runtime.backend.admin.adjustInventory(body.productId, body.quantity, body.reason, admin!)
    return { adjusted: true }
  },
)
