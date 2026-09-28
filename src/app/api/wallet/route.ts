import { route } from '@/server/http/api'

export const GET = route({ auth: 'customer' }, async ({ runtime, viewer }) => {
  const wallet = runtime.backend.wallet(viewer!.userId)
  return {
    summary: wallet.summary,
    usage: wallet.usage,
    limits: wallet.limits,
    packages: wallet.packages,
    autobids: wallet.autobids,
  }
})
