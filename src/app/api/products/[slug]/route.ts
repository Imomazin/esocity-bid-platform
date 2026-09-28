import { DomainError } from '@/domain/errors'
import { route } from '@/server/http/api'

export const GET = route<{ slug: string }>({}, async ({ params, runtime, viewer }) => {
  const product = runtime.backend.productDetail(params.slug, viewer?.userId)
  if (!product) throw new DomainError('NOT_FOUND', 'Product not found.')
  return product
})
