'use client'

import { CheckIcon, Loader2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type * as React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { FieldError, FieldHint, Input, Label } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { api, ApiError } from '@/lib/client/api'
import type { AccountOverview } from '@/server/views'

export function ProfileForm({ profile }: { profile: AccountOverview['profile'] }) {
  const router = useRouter()
  const [values, setValues] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    marketingOptIn: profile.marketingOptIn,
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty =
    values.firstName !== profile.firstName ||
    values.lastName !== profile.lastName ||
    values.phone !== profile.phone ||
    values.marketingOptIn !== profile.marketingOptIn

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await api('/api/account/profile', { method: 'PATCH', body: values })
      toast.success('Profile updated')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Your profile could not be saved.')
    } finally {
      setPending(false)
    }
  }

  const input = (name: 'firstName' | 'lastName' | 'phone') => ({
    id: `profile-${name}`,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [name]: event.target.value })),
  })

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" aria-label="Profile">
      <div className="space-y-1.5">
        <Label htmlFor="profile-firstName">First name</Label>
        <Input {...input('firstName')} autoComplete="given-name" required maxLength={60} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-lastName">Last name</Label>
        <Input {...input('lastName')} autoComplete="family-name" required maxLength={60} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" value={profile.email} disabled readOnly />
        <FieldHint>Demo email addresses can’t be changed.</FieldHint>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-phone">Phone</Label>
        <Input {...input('phone')} type="tel" autoComplete="tel" maxLength={30} />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-xl border p-3 text-sm sm:col-span-2">
        <span id="profile-marketing">
          Marketing emails
          <span className="block text-xs text-muted-foreground">
            Occasional product news and offers. Off by default; unsubscribe any time.
          </span>
        </span>
        <Switch
          checked={values.marketingOptIn}
          onCheckedChange={(checked) =>
            setValues((current) => ({ ...current, marketingOptIn: checked }))
          }
          aria-labelledby="profile-marketing"
        />
      </div>
      {error ? <FieldError className="sm:col-span-2">{error}</FieldError> : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Save profile
        </Button>
      </div>
    </form>
  )
}
