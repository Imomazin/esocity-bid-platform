import { DomainError } from '@/domain/errors'
import { promoValidateSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

/** Validate a promotion code against the member's basket (checkout) or a bid pack. */
export const POST = route(
  { auth: 'customer', rateLimit: 'promoValidation', body: promoValidateSchema },
  async ({ body, runtime, viewer }) => {
    if (body.context === 'BID_PACK') {
      if (!body.packageId) throw new DomainError('VALIDATION_FAILED', 'Choose a bid pack first.')
      return runtime.backend.validateBidPackCode(viewer!.userId, body.code, body.packageId)
    }
    const preview = runtime.backend.previewCheckout(
      viewer!.userId,
      { kind: 'CART' },
      { promoCode: body.code },
    )
    return preview.promotion
  },
)
