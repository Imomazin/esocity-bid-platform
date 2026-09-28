import { killSwitchSchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'

/** Platform-wide AutoBid kill switch. Activating it stops every active AutoBid agent. */
export const POST = route(
  { auth: 'admin', permission: 'autobid.killswitch', body: killSwitchSchema },
  async ({ body, runtime, admin }) =>
    runtime.backend.admin.setKillSwitch(body.active, body.reason, admin!),
)
