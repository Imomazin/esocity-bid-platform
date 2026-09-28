'use client'

import { CheckIcon, Loader2Icon } from 'lucide-react'
import type * as React from 'react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'
import type { Address } from '@/domain/orders'
import { api, ApiError } from '@/lib/client/api'

const EMPTY_ADDRESS = {
  label: 'Home',
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  postcode: '',
  phone: '',
  makeDefault: true,
}

/** Adds a UK delivery address to the member's address book (validated server-side). */
export function AddressForm({
  onSaved,
  onCancel,
  canCancel,
}: {
  onSaved: (addresses: Address[]) => void
  onCancel: () => void
  canCancel: boolean
}) {
  const [values, setValues] = useState(EMPTY_ADDRESS)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const field = (name: keyof typeof EMPTY_ADDRESS) => ({
    id: `address-${name}`,
    name,
    value: String(values[name]),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [name]: event.target.value })),
  })
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const addresses = await api<Address[]>('/api/account/addresses', {
        body: { ...values, line2: values.line2 || null, phone: values.phone || null },
      })
      onSaved(addresses)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The address could not be saved.')
    } finally {
      setPending(false)
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" aria-label="New delivery address">
      <div className="space-y-1.5">
        <Label htmlFor="address-fullName">Full name</Label>
        <Input {...field('fullName')} autoComplete="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address-label">Label</Label>
        <Input {...field('label')} placeholder="Home, Work…" required />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="address-line1">Address line 1</Label>
        <Input {...field('line1')} autoComplete="address-line1" required />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="address-line2">Address line 2 (optional)</Label>
        <Input {...field('line2')} autoComplete="address-line2" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address-city">Town or city</Label>
        <Input {...field('city')} autoComplete="address-level2" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address-postcode">Postcode</Label>
        <Input
          {...field('postcode')}
          autoComplete="postal-code"
          placeholder="e.g. SW1A 1AA"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address-phone">Phone (optional)</Label>
        <Input {...field('phone')} type="tel" autoComplete="tel" />
      </div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input
          type="checkbox"
          checked={values.makeDefault}
          onChange={(event) =>
            setValues((current) => ({ ...current, makeDefault: event.target.checked }))
          }
          className="size-4 accent-[var(--brand)]"
        />
        Make this my default address
      </label>
      {error ? <FieldError className="sm:col-span-2">{error}</FieldError> : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Save address
        </Button>
        {canCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground sm:col-span-2">
        Demo addresses stay inside your sandboxed demo session.
      </p>
    </form>
  )
}
