import { route } from '@/server/http/api'

export const GET = route({}, async ({ runtime, viewer }) => ({
  serverTime: Date.now(),
  drops: runtime.backend.listDrops(viewer?.userId),
}))
