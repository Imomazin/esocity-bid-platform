import { route } from '@/server/http/api'

/**
 * Place a bid. Requires an Idempotency-Key header (one per click intent), is rate limited per
 * member, and is decided entirely by the server-authoritative auction engine.
 */
export const POST = route<{ id: string }>(
  { auth: 'customer', rateLimit: ['bidBurst', 'bidSustained'], idempotency: { scope: 'bid' } },
  async ({ params, runtime, viewer, requestId }) =>
    runtime.backend.placeBid(viewer!.userId, params.id, requestId),
)
