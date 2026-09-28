'use client'

import { Loader2Icon, SendIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type * as React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, NativeSelect, Textarea } from '@/components/ui/input'
import { TICKET_STATUS_LABELS, TICKET_TRANSITIONS, type TicketStatus } from '@/domain/support'
import { api, ApiError } from '@/lib/client/api'

/** Reply to a ticket and/or change its status and assignee. */
export function TicketActions({
  ticketId,
  status,
  assignee,
  operatorName,
}: {
  ticketId: string
  status: TicketStatus
  assignee: string | null
  operatorName: string
}) {
  const router = useRouter()
  const [reply, setReply] = useState('')
  const [nextStatus, setNextStatus] = useState<TicketStatus>(status)
  const [owner, setOwner] = useState(assignee ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const options = [status, ...TICKET_TRANSITIONS[status]]

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const body: Record<string, unknown> = {}
    if (reply.trim()) body.reply = reply.trim()
    if (nextStatus !== status) body.status = nextStatus
    if ((owner.trim() || null) !== assignee) body.assignee = owner.trim() || null
    if (Object.keys(body).length === 0)
      return setError('Write a reply or change the status or assignee.')
    setPending(true)
    setError(null)
    try {
      await api(`/api/admin/support/${ticketId}`, { method: 'PATCH', body })
      toast.success(body.reply ? 'Reply sent' : 'Ticket updated')
      setReply('')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The ticket could not be updated.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Update ticket">
      <div className="space-y-1.5">
        <Label htmlFor="ticket-reply">Reply to customer</Label>
        <Textarea
          id="ticket-reply"
          rows={4}
          maxLength={2000}
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder="Write a clear, friendly reply…"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ticket-status">Status</Label>
          <NativeSelect
            id="ticket-status"
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value as TicketStatus)}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {TICKET_STATUS_LABELS[option]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ticket-assignee">Assignee</Label>
          <div className="flex gap-2">
            <Input
              id="ticket-assignee"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              placeholder="Unassigned"
              maxLength={80}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => setOwner(operatorName)}
            >
              Me
            </Button>
          </div>
        </div>
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Update ticket
      </Button>
    </form>
  )
}
