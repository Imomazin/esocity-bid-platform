import { walletAdjustSchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'

/** Goodwill credit: adds promotional bid credits as a new ledger entry (never edits history). */
export const POST = route(
  {
    auth: 'admin',
    permission: 'wallet.adjust',
    body: walletAdjustSchema,
    idempotency: { scope: 'wallet-adjust' },
  },
  async ({ body, runtime, admin }) => {
    runtime.backend.admin.adjustWallet(body.userId, body.credits, body.reason, admin!)
    return { adjusted: true }
  },
)
