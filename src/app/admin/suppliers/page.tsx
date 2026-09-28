import { ClockIcon, MailIcon, PackageCheckIcon } from 'lucide-react'
import type { Metadata } from 'next'

import { AccessDenied, AdminPageHeader } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBasisPoints, formatMinor } from '@/lib/money'
import { formatDate } from '@/lib/time'
import { adminAccess } from '@/server/auth/admin-access'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Suppliers' }

const STATUS_VARIANTS = { ACTIVE: 'success', ONBOARDING: 'brand', ON_HOLD: 'warning' } as const
const PO_VARIANTS = {
  DRAFT: 'neutral',
  SENT: 'brand',
  CONFIRMED: 'info',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'neutral',
} as const

export default async function SuppliersPage() {
  const access = await adminAccess('suppliers.view')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const suppliers = getBackend().admin.suppliers()
  return (
    <div>
      <AdminPageHeader
        title="Suppliers"
        description="Vetted suppliers, their service levels and open purchase orders. Supplier self-service (feeds, inventory sync, settlements) is on the roadmap."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {suppliers.map(({ supplier, productCount, available, onOrder, purchaseOrders }) => (
          <Card key={supplier.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">{supplier.name}</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {supplier.code} · {supplier.country} · {supplier.categories.join(', ')}
                </p>
              </div>
              <Badge variant={STATUS_VARIANTS[supplier.status]}>
                {supplier.status.replace('_', ' ').toLowerCase()}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Products</dt>
                  <dd className="font-semibold">{productCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Units available</dt>
                  <dd className="font-semibold">{available.toLocaleString('en-GB')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">On order</dt>
                  <dd className="font-semibold">{onOrder.toLocaleString('en-GB')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">On-time delivery</dt>
                  <dd className="font-semibold">{formatBasisPoints(supplier.onTimeRateBps, 1)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Fill rate</dt>
                  <dd className="font-semibold">{formatBasisPoints(supplier.fillRateBps, 1)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Defect rate</dt>
                  <dd className="font-semibold">{formatBasisPoints(supplier.defectRateBps, 1)}</dd>
                </div>
              </dl>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="size-3.5" aria-hidden /> {supplier.leadTimeDays}-day lead
                  time
                </span>
                <span className="inline-flex items-center gap-1">
                  <PackageCheckIcon className="size-3.5" aria-hidden /> {supplier.paymentTermsDays}
                  -day payment terms
                </span>
                {supplier.contacts[0] ? (
                  <span className="inline-flex items-center gap-1">
                    <MailIcon className="size-3.5" aria-hidden /> {supplier.contacts[0].name} (
                    {supplier.contacts[0].role})
                  </span>
                ) : null}
              </p>
              {purchaseOrders.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Recent purchase orders
                  </p>
                  <ul className="divide-y rounded-lg border text-sm">
                    {purchaseOrders.map((po) => (
                      <li key={po.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="tabular font-medium">{po.reference}</span>
                        <span className="text-xs text-muted-foreground">
                          {po.lines.reduce((total, line) => total + line.quantity, 0)} units ·{' '}
                          {formatMinor(
                            po.lines.reduce(
                              (total, line) => total + line.quantity * line.unitCostMinor,
                              0,
                            ),
                          )}{' '}
                          · due {formatDate(po.expectedAt)}
                        </span>
                        <Badge variant={PO_VARIANTS[po.status]}>
                          {po.status.replace('_', ' ').toLowerCase()}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {supplier.notes ? (
                <p className="text-xs text-muted-foreground">{supplier.notes}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
