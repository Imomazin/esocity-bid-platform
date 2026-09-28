import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ClockIcon,
  GiftIcon,
  HandCoinsIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { LedgerEntryType } from '@/domain/wallet'
import { LEDGER_TYPE_LABELS } from '@/domain/wallet'

const VARIANTS: Record<
  LedgerEntryType,
  'success' | 'brand' | 'neutral' | 'warning' | 'info' | 'outline'
> = {
  BID_PACK_PURCHASE: 'success',
  PROMOTIONAL_CREDIT: 'brand',
  AUCTION_BID: 'neutral',
  BID_REFUND: 'info',
  BUY_NOW_RECOVERY: 'info',
  ADMIN_ADJUSTMENT: 'outline',
  EXPIRY: 'warning',
}

const ICONS = {
  BID_PACK_PURCHASE: ArrowDownLeftIcon,
  PROMOTIONAL_CREDIT: GiftIcon,
  AUCTION_BID: ArrowUpRightIcon,
  BID_REFUND: RotateCcwIcon,
  BUY_NOW_RECOVERY: HandCoinsIcon,
  ADMIN_ADJUSTMENT: SlidersHorizontalIcon,
  EXPIRY: ClockIcon,
}

export function LedgerTypeBadge({ type }: { type: LedgerEntryType }) {
  const Icon = ICONS[type]
  return (
    <Badge variant={VARIANTS[type]}>
      <Icon aria-hidden />
      {LEDGER_TYPE_LABELS[type]}
    </Badge>
  )
}
