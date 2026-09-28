import type { Metadata } from 'next'
import Link from 'next/link'

import { AccessDenied, AdminPageHeader, SectionTitle, StatTile } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Notice } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { formatMinor } from '@/lib/money'
import { formatDateTime } from '@/lib/time'
import { adminAccess } from '@/server/auth/admin-access'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Payments' }

const STATUS_VARIANTS = {
  PENDING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  PARTIALLY_REFUNDED: 'info',
} as const

export default async function PaymentsPage() {
  const access = await adminAccess('payments.view')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const { payments, refunds, bidPackOrders, totals } = getBackend().admin.payments()
  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Payments"
        description="Captured payments, refunds and bid pack orders. Card data never touches Esocity systems; only provider references are stored."
      />
      <Notice tone="neutral">
        Demo mode uses the simulated payment provider. With Stripe configured, payment state is
        confirmed by signed webhooks — never by the browser.
      </Notice>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile
          label="Captured (30 days)"
          value={formatMinor(totals.capturedMinor)}
          hint={`${totals.count} payments`}
        />
        <StatTile
          label="Of which bid packs"
          value={formatMinor(totals.bidPackMinor)}
          hint="Separate from merchandise"
        />
        <StatTile
          label="Refunded (30 days)"
          value={formatMinor(totals.refundedMinor)}
          hint="Full and partial"
        />
        <StatTile
          label="Failed payments"
          value={totals.failed.toLocaleString('en-GB')}
          hint="Declines & errors"
        />
        <StatTile
          label="Net captured"
          value={formatMinor(totals.capturedMinor - totals.refundedMinor)}
          hint="Captured − refunded"
        />
      </div>

      <section>
        <SectionTitle>Recent payments</SectionTitle>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Customer</TH>
                  <TH>Type</TH>
                  <TH>Status</TH>
                  <TH>Method</TH>
                  <TH className="text-right">Amount</TH>
                  <TH className="text-right">Refunded</TH>
                  <TH>Provider ref.</TH>
                </TR>
              </THead>
              <TBody>
                {payments.map((payment) => (
                  <TR key={payment.id}>
                    <TD className="text-xs whitespace-nowrap text-muted-foreground">
                      {formatDateTime(payment.createdAt)}
                    </TD>
                    <TD className="max-w-[180px] truncate">{payment.customerName}</TD>
                    <TD>
                      {payment.orderId ? (
                        <Link
                          href={`/admin/orders/${payment.orderId}`}
                          className="text-sm hover:underline"
                        >
                          Order
                        </Link>
                      ) : (
                        <span className="text-sm">Bid pack</span>
                      )}
                    </TD>
                    <TD>
                      <Badge variant={STATUS_VARIANTS[payment.status]}>
                        {payment.status.replace('_', ' ').toLowerCase()}
                      </Badge>
                    </TD>
                    <TD className="text-xs text-muted-foreground">{payment.methodLabel}</TD>
                    <TD className="tabular text-right">{formatMinor(payment.amountMinor)}</TD>
                    <TD className="tabular text-right text-muted-foreground">
                      {payment.refundedMinor ? formatMinor(payment.refundedMinor) : '—'}
                    </TD>
                    <TD className="max-w-[160px] truncate font-mono text-[11px] text-muted-foreground">
                      {payment.providerReference}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <SectionTitle>Refunds</SectionTitle>
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Reason</TH>
                  <TH>By</TH>
                  <TH className="text-right">Amount</TH>
                </TR>
              </THead>
              <TBody>
                {refunds.length === 0 ? (
                  <TR>
                    <TD colSpan={4} className="text-muted-foreground">
                      No refunds yet.
                    </TD>
                  </TR>
                ) : (
                  refunds.map((refund) => (
                    <TR key={refund.id}>
                      <TD className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatDateTime(refund.createdAt)}
                      </TD>
                      <TD className="max-w-[220px] truncate">
                        {refund.orderId ? (
                          <Link
                            href={`/admin/orders/${refund.orderId}`}
                            className="hover:underline"
                          >
                            {refund.reason}
                          </Link>
                        ) : (
                          refund.reason
                        )}
                      </TD>
                      <TD className="text-xs text-muted-foreground">{refund.actor}</TD>
                      <TD className="tabular text-right">{formatMinor(refund.amountMinor)}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </Card>
        </section>
        <section>
          <SectionTitle>Bid pack orders</SectionTitle>
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Customer</TH>
                  <TH>Pack</TH>
                  <TH className="text-right">Paid</TH>
                </TR>
              </THead>
              <TBody>
                {bidPackOrders.map((order) => (
                  <TR key={order.id}>
                    <TD className="tabular font-medium">{order.reference}</TD>
                    <TD className="max-w-[160px] truncate">{order.customerName}</TD>
                    <TD className="text-xs text-muted-foreground">
                      {order.packageName} · {order.credits} +{' '}
                      {order.bonusCredits + order.promoBonusCredits} bids
                      {order.status === 'FAILED' ? (
                        <Badge variant="danger" className="ml-1.5">
                          failed
                        </Badge>
                      ) : null}
                    </TD>
                    <TD className="tabular text-right">{formatMinor(order.totalMinor)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </section>
      </div>
    </div>
  )
}
