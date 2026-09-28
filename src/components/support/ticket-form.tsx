'use client'

import { Loader2Icon, SendIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type * as React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from '@/components/ui/input'
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, type TicketCategory } from '@/domain/support'
import { api, ApiError } from '@/lib/client/api'

export function TicketForm({
  defaults,
}: {
  defaults: { category?: string; subject?: string; reference?: string }
}) {
  const router = useRouter()
  const initialCategory = TICKET_CATEGORIES.includes(defaults.category as TicketCategory)
    ? (defaults.category as TicketCategory)
    : 'auction'
  const [values, setValues] = useState({
    category: initialCategory,
    subject: defaults.subject ?? '',
    message: '',
    relatedReference: defaults.reference ?? '',
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const ticket = await api<{ reference: string }>('/api/support/tickets', {
        body: { ...values, relatedReference: values.relatedReference.trim() || null },
      })
      toast.success(`Request ${ticket.reference} received`, {
        description: 'We’ll reply within 24 hours. (Demo replies are simulated.)',
      })
      setValues({ category: values.category, subject: '', message: '', relatedReference: '' })
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Your request could not be sent. Please try again.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Contact support">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ticket-category">Topic</Label>
          <NativeSelect
            id="ticket-category"
            value={values.category}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                category: event.target.value as TicketCategory,
              }))
            }
          >
            {TICKET_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {TICKET_CATEGORY_LABELS[category]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ticket-reference">Order or auction reference (optional)</Label>
          <Input
            id="ticket-reference"
            value={values.relatedReference}
            maxLength={40}
            onChange={(event) =>
              setValues((current) => ({ ...current, relatedReference: event.target.value }))
            }
            placeholder="e.g. ESB-7F3K2Q"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ticket-subject">Subject</Label>
        <Input
          id="ticket-subject"
          value={values.subject}
          required
          minLength={5}
          maxLength={120}
          onChange={(event) =>
            setValues((current) => ({ ...current, subject: event.target.value }))
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ticket-message">How can we help?</Label>
        <Textarea
          id="ticket-message"
          value={values.message}
          required
          minLength={20}
          maxLength={2000}
          rows={5}
          onChange={(event) =>
            setValues((current) => ({ ...current, message: event.target.value }))
          }
        />
        <FieldHint>
          Please don’t include card numbers or passwords — we’ll never ask for them.
        </FieldHint>
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Send request
      </Button>
    </form>
  )
}
