import { auctionListQuerySchema } from '@/server/http/admin-schemas'
import { route } from '@/server/http/api'
import { createAuctionSchema } from '@/server/demo/admin'

/** List auctions for operators (all statuses). */
export const GET = route(
  { auth: 'admin', permission: 'auctions.view', query: auctionListQuerySchema },
  async ({ query, runtime }) =>
    runtime.backend.admin.auctions({ status: query.status, q: query.q }),
)

/** Create a draft (optionally scheduled) auction. */
export const POST = route(
  { auth: 'admin', permission: 'auctions.manage', body: createAuctionSchema },
  async ({ body, runtime, admin }) => {
    const record = runtime.backend.admin.createAuction(body, admin!)
    return { id: record.state.id, status: record.state.status }
  },
)
