import { z } from 'zod'

import { route } from '@/server/http/api'

const query = z.object({
  q: z.string().max(80).optional(),
  category: z.string().max(40).optional(),
  subcategory: z.string().max(60).optional(),
  brand: z.string().max(200).optional(),
  min: z.coerce.number().int().min(0).optional(),
  max: z.coerce.number().int().min(0).optional(),
  availability: z.enum(['all', 'in-stock', 'auction']).optional(),
  sort: z
    .enum(['recommended', 'price-asc', 'price-desc', 'newest', 'popular', 'rating', 'savings'])
    .optional(),
  page: z.coerce.number().int().min(1).max(100).optional(),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
})

export const GET = route({ query }, async ({ query: q, runtime, viewer }) =>
  runtime.backend.listProducts(
    {
      q: q.q,
      category: q.category,
      subcategory: q.subcategory,
      brands: q.brand ? q.brand.split(',') : undefined,
      minPriceMinor: q.min,
      maxPriceMinor: q.max,
      availability: q.availability,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    },
    viewer?.userId,
  ),
)
