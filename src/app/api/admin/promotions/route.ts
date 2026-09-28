import { promotionInputSchema } from '@/server/demo/admin'
import { route } from '@/server/http/api'

export const GET = route({ auth: 'admin', permission: 'promotions.manage' }, async ({ runtime }) =>
  runtime.backend.admin.promotions(),
)

export const POST = route(
  { auth: 'admin', permission: 'promotions.manage', body: promotionInputSchema },
  async ({ body, runtime, admin }) => runtime.backend.admin.createPromotion(body, admin!),
)
