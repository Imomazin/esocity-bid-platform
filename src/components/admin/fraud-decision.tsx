'use client'

import { Loader2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type * as React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { FieldError, FieldHint, Label, NativeSelect, Textarea } from '@/components/ui/input'
import { api, ApiError } from '@/lib/client/api'

const ACTIONS = [
  { value: 'CLEAR', label: 'Clear — no issue found' },
  { value: 'REVIEW', label: 'Keep under review' },
  { value: 'THROTTLE', label: 'Throttle bidding speed' },
  { value: 'BLOCK', label: 'Restrict account (requires block permission)' },
] as const

/**
 * Analyst decision on a risk case. Automated scoring only ever recommends; a person decides,
 * writes down why, and the decision is audited.
 */
export function FraudDecision({
  caseId,
  recommended,
  canBlock,
}: {
  caseId: string
  recommended: string
  canBlock: boolean
}) {
  const router = useRouter()
  const [action, setAction] = useState<string>(
    recommended === 'BLOCK' && !canBlock
      ? 'REVIEW'
      : recommended === 'ALLOW'
        ? 'CLEAR'
        : recommended,
  )
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (note.trim().length < 5)
      return setError('Explain the decision in a sentence — it is shown in the audit log.')
    setPending(true)
    setError(null)
    try {
      await api(`/api/admin/fraud/${caseId}/decision`, { body: { action, note: note.trim() } })
      toast.success('Decision recorded')
      setNote('')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The decision could not be recorded.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border bg-muted/30 p-3"
      aria-label="Record decision"
    >
      <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label htmlFor={`fraud-action-${caseId}`}>Decision</Label>
          <NativeSelect
            id={`fraud-action-${caseId}`}
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            {ACTIONS.filter((item) => item.value !== 'BLOCK' || canBlock).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`fraud-note-${caseId}`}>Analyst note</Label>
          <Textarea
            id={`fraud-note-${caseId}`}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What did you check and why this decision?"
          />
        </div>
      </div>
      <FieldHint>
        Customers are never told they are suspected of fraud; restricted members are asked to
        contact support, and every decision can be appealed.
      </FieldHint>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button
        type="submit"
        size="sm"
        variant={action === 'BLOCK' ? 'danger' : 'primary'}
        disabled={pending}
      >
        {pending ? <Loader2Icon className="animate-spin" /> : null} Record decision
      </Button>
    </form>
  )
}
