import { z } from 'zod'

import { productInputSchema } from '@/server/demo/admin'
import { route } from '@/server/http/api'

export const GET = route(
  {
    auth: 'admin',
    permission: 'products.manage',
    query: z.object({ q: z.string().max(100).optional(), category: z.string().max(60).optional() }),
  },
  async ({ query, runtime }) =>
    runtime.backend.admin.products(query.q, query.category).map((row) => ({
      id: row.product.id,
      name: row.product.name,
      sku: row.product.sku,
      status: row.product.status,
      categorySlug: row.product.categorySlug,
      buyNowPriceMinor: row.product.buyNowPriceMinor,
      available: row.position.available,
      supplierName: row.supplierName,
      marginBps: row.marginBps,
    })),
)

export const POST = route(
  { auth: 'admin', permission: 'products.manage', body: productInputSchema },
  async ({ body, runtime, admin }) => {
    const product = runtime.backend.admin.saveProduct(null, body, admin!)
    return { id: product.id, slug: product.slug }
  },
)
