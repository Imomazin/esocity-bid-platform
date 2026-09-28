import type { Metadata } from 'next'

import { AdminAction } from '@/components/admin/admin-action'
import { AccessDenied, AdminPageHeader } from '@/components/admin/admin-ui'
import { PromotionForm } from '@/components/admin/promotion-form'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { PROMOTION_TYPE_LABELS, type Promotion } from '@/domain/promotions'
import { formatBasisPoints, formatMinor } from '@/lib/money'
import { formatDate } from '@/lib/time'
import { adminAccess } from '@/server/auth/admin-access'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Promotions' }

const STATE_VARIANTS = {
  LIVE: 'success',
  SCHEDULED: 'brand',
  PAUSED: 'warning',
  EXPIRED: 'neutral',
  EXHAUSTED: 'neutral',
  ARCHIVED: 'outline',
} as const

function describeValue(promotion: Promotion): string {
  switch (promotion.valueKind) {
    case 'PERCENT':
      return `${formatBasisPoints(promotion.value, promotion.value % 100 === 0 ? 0 : 1)} off`
    case 'FIXED':
      return `${formatMinor(promotion.value)} off`
    case 'CREDITS':
      return `+${promotion.value} bids`
    default:
      return 'Free delivery'
  }
}

export default async function PromotionsPage() {
  const access = await adminAccess('promotions.manage')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const backend = getBackend()
  const promotions = backend.admin.promotions()
  const categories = backend.admin
    .categories()
    .map((category) => ({ slug: category.slug, name: category.name }))
  return (
    <div>
      <AdminPageHeader
        title="Promotions"
        description="Coupons, bid pack offers and bonus credits. Limits, dates and eligibility are enforced server-side, including per-member use counts."
        actions={<PromotionForm categories={categories} now={backend.now()} />}
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Code</TH>
                <TH>Type</TH>
                <TH>Offer</TH>
                <TH>State</TH>
                <TH className="text-right">Used</TH>
                <TH>Window</TH>
                <TH>Eligibility</TH>
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {promotions.map(({ promotion, state }) => (
                <TR key={promotion.id}>
                  <TD>
                    <span className="font-mono font-semibold">{promotion.code}</span>
                    <span className="block max-w-[200px] truncate text-xs text-muted-foreground">
                      {promotion.name}
                    </span>
                  </TD>
                  <TD className="text-xs">{PROMOTION_TYPE_LABELS[promotion.type]}</TD>
                  <TD className="text-sm">
                    {describeValue(promotion)}
                    {promotion.minimumSpendMinor ? (
                      <span className="block text-xs text-muted-foreground">
                        min. {formatMinor(promotion.minimumSpendMinor)}
                      </span>
                    ) : null}
                  </TD>
                  <TD>
                    <Badge variant={STATE_VARIANTS[state]}>{state.toLowerCase()}</Badge>
                  </TD>
                  <TD className="tabular text-right">
                    {promotion.usageCount}
                    {promotion.usageLimit !== null ? (
                      <span className="text-muted-foreground"> / {promotion.usageLimit}</span>
                    ) : null}
                  </TD>
                  <TD className="text-xs whitespace-nowrap text-muted-foreground">
                    {formatDate(promotion.startsAt)} – {formatDate(promotion.endsAt)}
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {[
                      promotion.eligibility.newCustomersOnly ? 'New customers' : null,
                      promotion.eligibility.minimumTier
                        ? `${promotion.eligibility.minimumTier.toLowerCase()}+`
                        : null,
                      promotion.eligibility.categories?.length
                        ? promotion.eligibility.categories.join(', ')
                        : null,
                      promotion.perUserLimit ? `${promotion.perUserLimit}/member` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Everyone'}
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      {promotion.status === 'ACTIVE' ? (
                        <AdminAction
                          size="xs"
                          variant="outline"
                          method="PATCH"
                          endpoint={`/api/admin/promotions/${promotion.id}`}
                          body={{ status: 'PAUSED' }}
                          successMessage={`${promotion.code} paused`}
                        >
                          Pause
                        </AdminAction>
                      ) : null}
                      {promotion.status === 'PAUSED' ? (
                        <AdminAction
                          size="xs"
                          variant="outline"
                          method="PATCH"
                          endpoint={`/api/admin/promotions/${promotion.id}`}
                          body={{ status: 'ACTIVE' }}
                          successMessage={`${promotion.code} resumed`}
                        >
                          Resume
                        </AdminAction>
                      ) : null}
                      {promotion.status !== 'ARCHIVED' ? (
                        <AdminAction
                          size="xs"
                          variant="ghost"
                          method="PATCH"
                          endpoint={`/api/admin/promotions/${promotion.id}`}
                          body={{ status: 'ARCHIVED' }}
                          successMessage={`${promotion.code} archived`}
                          confirm={{
                            title: `Archive ${promotion.code}?`,
                            description:
                              'The code stops working immediately. Past orders are unaffected.',
                            confirmLabel: 'Archive',
                          }}
                        >
                          Archive
                        </AdminAction>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
