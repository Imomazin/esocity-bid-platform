import type { z } from 'zod'

import { productInputSchema } from '@/server/demo/admin'
import { route } from '@/server/http/api'

export const PATCH = route<{ id: string }, z.infer<typeof productInputSchema>>(
  { auth: 'admin', permission: 'products.manage', body: productInputSchema },
  async ({ params, body, runtime, admin }) => {
    const product = runtime.backend.admin.saveProduct(params.id, body, admin!)
    return { id: product.id, slug: product.slug }
  },
)
