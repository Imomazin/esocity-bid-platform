import type { Metadata } from 'next'
import Link from 'next/link'

import { AccessDenied, AdminPageHeader } from '@/components/admin/admin-ui'
import { TicketActions } from '@/components/admin/ticket-actions'
import { ChipLink } from '@/components/common/chip-link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/misc'
import {
  TICKET_CATEGORY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  type TicketStatus,
} from '@/domain/support'
import { formatDateTime, formatRelative } from '@/lib/time'
import { cn } from '@/lib/utils'
import { adminAccess } from '@/server/auth/admin-access'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Support' }

const PRIORITY_VARIANTS = {
  LOW: 'neutral',
  NORMAL: 'outline',
  HIGH: 'warning',
  URGENT: 'live',
} as const
const STATUS_VARIANTS = {
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  WAITING_CUSTOMER: 'brand',
  RESOLVED: 'success',
  CLOSED: 'neutral',
} as const

export default async function SupportAdminPage({ searchParams }: PageProps<'/admin/support'>) {
  const access = await adminAccess('support.manage')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const params = await searchParams
  const statusParam = typeof params.status === 'string' ? params.status : 'ACTIVE'
  const selectedId = typeof params.ticket === 'string' ? params.ticket : null
  const backend = getBackend()
  const all = backend.admin.tickets('ALL')
  const now = backend.now()
  const tickets =
    statusParam === 'ACTIVE'
      ? all.filter((ticket) => ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED')
      : (TICKET_STATUSES as readonly string[]).includes(statusParam)
        ? all.filter((ticket) => ticket.status === (statusParam as TicketStatus))
        : all
  const selected = all.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null
  const link = (next: { status?: string; ticket?: string }) => {
    const search = new URLSearchParams()
    search.set('status', next.status ?? statusParam)
    if (next.ticket) search.set('ticket', next.ticket)
    return `/admin/support?${search.toString()}`
  }
  return (
    <div>
      <AdminPageHeader
        title="Support"
        description="Customer requests with priorities by category. Payment, wallet and refund requests are prioritised automatically."
      />
      <nav
        aria-label="Filter tickets"
        className="-mx-1 mb-4 flex scrollbar-none gap-1.5 overflow-x-auto px-1"
      >
        <ChipLink href={link({ status: 'ACTIVE' })} active={statusParam === 'ACTIVE'}>
          Needs attention
        </ChipLink>
        {TICKET_STATUSES.map((status) => (
          <ChipLink key={status} href={link({ status })} active={statusParam === status}>
            {TICKET_STATUS_LABELS[status]}{' '}
            <span className="text-[11px] opacity-70">
              {all.filter((ticket) => ticket.status === status).length}
            </span>
          </ChipLink>
        ))}
        <ChipLink href={link({ status: 'ALL' })} active={statusParam === 'ALL'}>
          All
        </ChipLink>
      </nav>
      {tickets.length === 0 && !selected ? (
        <EmptyState
          title="No tickets here"
          description="Nice work — nothing needs attention in this view."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <ul className="space-y-2">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={link({ ticket: ticket.id })}
                  className={cn(
                    'block rounded-xl border bg-card p-3 transition hover:shadow-card',
                    selected?.id === ticket.id && 'border-foreground',
                  )}
                  aria-current={selected?.id === ticket.id ? 'true' : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular text-xs font-semibold text-muted-foreground">
                      {ticket.reference}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(ticket.updatedAt, now)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm font-medium">{ticket.subject}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant={STATUS_VARIANTS[ticket.status]}>
                      {TICKET_STATUS_LABELS[ticket.status]}
                    </Badge>
                    <Badge variant={PRIORITY_VARIANTS[ticket.priority]}>
                      {ticket.priority.toLowerCase()}
                    </Badge>
                    <Badge variant="outline">{TICKET_CATEGORY_LABELS[ticket.category]}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {selected ? (
            <Card className="self-start">
              <CardHeader>
                <p className="tabular text-xs font-semibold text-muted-foreground">
                  {selected.reference} · {selected.customerName}
                  {selected.relatedReference ? ` · re ${selected.relatedReference}` : ''}
                </p>
                <CardTitle className="text-lg">{selected.subject}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Opened {formatDateTime(selected.createdAt)} · assigned to{' '}
                  {selected.assignee ?? 'nobody'}
                  {selected.simulated ? ' · simulated ticket' : ''}
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <ol className="space-y-2">
                  {selected.messages.map((message) => (
                    <li
                      key={message.id}
                      className={cn(
                        'rounded-xl px-3 py-2 text-sm',
                        message.author === 'CUSTOMER' ? 'mr-8 bg-muted' : 'ml-8 bg-brand-soft/60',
                      )}
                    >
                      <p className="text-xs font-medium text-muted-foreground">
                        {message.authorName} · {formatDateTime(message.at)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-line">{message.body}</p>
                    </li>
                  ))}
                </ol>
                {selected.status !== 'CLOSED' ? (
                  <TicketActions
                    key={selected.id}
                    ticketId={selected.id}
                    status={selected.status}
                    assignee={selected.assignee}
                    operatorName={access.actor.name}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">This ticket is closed.</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  )
}
