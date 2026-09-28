import { checkoutPreviewSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

export const POST = route(
  { auth: 'customer', rateLimit: 'promoValidation', body: checkoutPreviewSchema },
  async ({ body, runtime, viewer }) =>
    runtime.backend.previewCheckout(viewer!.userId, body.mode, {
      promoCode: body.promoCode,
      shippingMethodId: body.shippingMethodId,
    }),
)
