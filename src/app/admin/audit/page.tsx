import { FilterIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { AccessDenied, AdminPageHeader } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, NativeSelect } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { DAY } from '@/lib/time'
import { formatDateTime } from '@/lib/time'
import { adminAccess } from '@/server/auth/admin-access'
import {
  AUDIT_ENTITY_TYPES,
  AUDIT_SEVERITIES,
  type AuditEntityType,
  type AuditSeverity,
} from '@/server/infra/audit'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Audit log' }

const PAGE_SIZE = 50
const SEVERITY_VARIANTS = {
  INFO: 'neutral',
  NOTICE: 'info',
  WARNING: 'warning',
  CRITICAL: 'live',
} as const
const RANGES = [
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
] as const

function param(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

export default async function AuditPage({ searchParams }: PageProps<'/admin/audit'>) {
  const access = await adminAccess('audit.view')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const params = await searchParams
  const entityType = (AUDIT_ENTITY_TYPES as readonly string[]).includes(param(params.entity))
    ? (param(params.entity) as AuditEntityType)
    : undefined
  const severity = (AUDIT_SEVERITIES as readonly string[]).includes(param(params.severity))
    ? (param(params.severity) as AuditSeverity)
    : undefined
  const action = param(params.action).trim() || undefined
  const actor = param(params.actor).trim() || undefined
  const range = RANGES.some((item) => item.value === param(params.range))
    ? param(params.range)
    : '7'
  const page = Math.max(1, Number.parseInt(param(params.page) || '1', 10) || 1)
  const backend = getBackend()
  const now = backend.now()
  const { items, total } = await backend.admin.audit({
    entityType,
    severity,
    action,
    actor,
    from: range === 'all' ? undefined : now - Number(range) * DAY,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageHref = (target: number) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries({
      entity: entityType,
      severity,
      action,
      actor,
      range,
    }))
      if (value) search.set(key, value)
    if (target > 1) search.set('page', String(target))
    return `/admin/audit?${search.toString()}`
  }
  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Audit log"
        description="An append-only record of admin actions, auction transitions, refunds, wallet adjustments, limit changes and risk decisions. Entries can’t be edited or deleted."
      />
      <form
        action="/admin/audit"
        className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6"
        aria-label="Filter audit events"
      >
        <div className="space-y-1.5">
          <Label htmlFor="audit-range">Time range</Label>
          <NativeSelect id="audit-range" name="range" defaultValue={range}>
            {RANGES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-entity">Entity</Label>
          <NativeSelect id="audit-entity" name="entity" defaultValue={entityType ?? ''}>
            <option value="">All entities</option>
            {AUDIT_ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace('_', ' ').toLowerCase()}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-severity">Severity</Label>
          <NativeSelect id="audit-severity" name="severity" defaultValue={severity ?? ''}>
            <option value="">Any severity</option>
            {AUDIT_SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-action">Action contains</Label>
          <Input id="audit-action" name="action" defaultValue={action} placeholder="e.g. refund" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-actor">Actor</Label>
          <Input id="audit-actor" name="actor" defaultValue={actor} placeholder="Name or ID" />
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" className="flex-1">
            <FilterIcon /> Apply
          </Button>
          <Button asChild variant="ghost">
            <Link href="/admin/audit">Reset</Link>
          </Button>
        </div>
      </form>
      <p className="text-sm text-muted-foreground">
        {total.toLocaleString('en-GB')} matching events · page {page} of {pages}
      </p>
      {items.length === 0 ? (
        <EmptyState title="No events match these filters" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Severity</TH>
                  <TH>Actor</TH>
                  <TH>Action</TH>
                  <TH>Summary</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((event) => (
                  <TR key={event.id} className="align-top">
                    <TD className="text-xs whitespace-nowrap text-muted-foreground">
                      {formatDateTime(event.occurredAt)}
                    </TD>
                    <TD>
                      <Badge variant={SEVERITY_VARIANTS[event.severity]}>
                        {event.severity.toLowerCase()}
                      </Badge>
                    </TD>
                    <TD className="text-xs">
                      <span className="font-medium">{event.actor.name}</span>
                      <span className="block text-muted-foreground">
                        {event.actor.type.toLowerCase()}
                        {event.actor.role ? ` · ${event.actor.role}` : ''}
                      </span>
                    </TD>
                    <TD className="font-mono text-xs">
                      {event.action}
                      <span className="block font-sans text-muted-foreground">
                        {event.entityType.toLowerCase()} {event.entityId.slice(0, 8)}
                      </span>
                    </TD>
                    <TD className="max-w-[520px] text-sm">
                      {event.summary}
                      {Object.keys(event.metadata).length > 0 || event.requestId ? (
                        <details className="mt-1 text-xs">
                          <summary className="cursor-pointer text-muted-foreground select-none">
                            Details
                          </summary>
                          <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap">
                            {JSON.stringify(
                              {
                                ...event.metadata,
                                requestId: event.requestId ?? undefined,
                                entityId: event.entityId,
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          {pages > 1 ? (
            <div className="flex items-center justify-end gap-4 border-t px-4 py-3 text-sm">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="font-medium text-brand">
                  Newer
                </Link>
              ) : null}
              {page < pages ? (
                <Link href={pageHref(page + 1)} className="font-medium text-brand">
                  Older
                </Link>
              ) : null}
            </div>
          ) : null}
        </Card>
      )}
    </div>
  )
}
