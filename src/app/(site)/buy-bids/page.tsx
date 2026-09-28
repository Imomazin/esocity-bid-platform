import { ShieldCheckIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'

import { Container, PageHeader } from '@/components/common/section'
import { BidPackPurchase } from '@/components/wallet/bid-pack-purchase'
import { Notice } from '@/components/ui/misc'
import { formatMinor } from '@/lib/money'
import { getViewer } from '@/server/auth/session'
import { getBackend, getRuntime } from '@/server/runtime'

export const metadata: Metadata = { title: 'Buy bid packs', robots: { index: false, follow: true } }

export default async function BuyBidsPage() {
  const viewer = await getViewer()
  const backend = getBackend()
  const wallet = viewer ? backend.wallet(viewer.userId) : null
  const budget = wallet?.limits.monthlyBidPurchaseBudgetMinor ?? null
  const remaining =
    budget !== null && wallet ? Math.max(0, budget - wallet.usage.bidPackSpendThisMonthMinor) : null
  after(() => getRuntime().analytics.track('BID_PACK_VIEW', {}, viewer?.userId ?? null))
  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        eyebrow="Bid packs"
        title="Buy bid credits"
        description="Bid credits let you place bids in live auctions. They are not money, cannot be withdrawn, and each auction shows exactly how many credits a bid costs."
      />
      <Notice
        tone="brand"
        icon={<ShieldCheckIcon />}
        title="Bid within your budget"
        className="mb-8"
      >
        Only spend what you can afford to lose — most auctions are not won.{' '}
        {remaining !== null
          ? `You have ${formatMinor(remaining)} left in your monthly bid budget.`
          : 'Set a monthly budget to stay in control.'}{' '}
        <Link href="/account#responsible-use" className="font-medium underline">
          Manage limits
        </Link>
      </Notice>
      <BidPackPurchase
        packages={backend.bidPackages()}
        signedIn={!!viewer}
        budgetRemainingMinor={remaining}
      />
    </Container>
  )
}
