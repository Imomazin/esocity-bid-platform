'use client'

import { MapPinIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { AddressForm } from '@/components/account/address-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Address } from '@/domain/orders'

export function AddressBook({ initial }: { initial: Address[] }) {
  const [addresses, setAddresses] = useState(initial)
  const [adding, setAdding] = useState(false)
  return (
    <div className="space-y-4">
      {addresses.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-xl border p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <MapPinIcon className="size-3.5 text-muted-foreground" aria-hidden />
                {address.label}
                {address.isDefault ? <Badge variant="outline">Default</Badge> : null}
              </p>
              <p className="mt-1 text-muted-foreground">
                {address.fullName}
                <br />
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ''}
                <br />
                {address.city} {address.postcode} · {address.country}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
      )}
      {adding ? (
        <div className="rounded-xl border p-4">
          <AddressForm
            canCancel
            onCancel={() => setAdding(false)}
            onSaved={(saved) => {
              setAddresses(saved)
              setAdding(false)
              toast.success('Address saved')
            }}
          />
        </div>
      ) : addresses.length < 6 ? (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <PlusIcon /> Add address
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">You can save up to six addresses.</p>
      )}
    </div>
  )
}
