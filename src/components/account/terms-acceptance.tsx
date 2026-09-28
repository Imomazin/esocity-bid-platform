'use client'

import { CheckIcon, FileTextIcon, Loader2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/misc'
import { api, ApiError } from '@/lib/client/api'
import { formatDate } from '@/lib/time'

export interface TermsStatus {
  currentVersion: string
  acceptedVersion: string | null
  acceptedAt: number | null
  upToDate: boolean
}

/** Shows a signed-in member whether they have accepted the current terms, and lets them accept. */
export function TermsAcceptance({ status }: { status: TermsStatus }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  if (status.upToDate) {
    return (
      <Notice
        tone="success"
        icon={<CheckIcon />}
        title="You have accepted these terms"
        className="mb-8"
      >
        Version {status.currentVersion}
        {status.acceptedAt ? `, accepted on ${formatDate(status.acceptedAt)}` : ''}.
      </Notice>
    )
  }

  const accept = async () => {
    setPending(true)
    try {
      await api('/api/account/terms', { method: 'POST', body: { version: status.currentVersion } })
      toast.success('Thank you — terms accepted')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not record your acceptance.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Notice
      tone="brand"
      icon={<FileTextIcon />}
      title="Please review and accept the updated terms"
      className="mb-8"
    >
      <p>
        Bidding, bid pack purchases and checkout need the current terms (version{' '}
        {status.currentVersion}).
        {status.acceptedVersion ? ` You last accepted version ${status.acceptedVersion}.` : ''}
      </p>
      <Button className="mt-3" size="sm" onClick={accept} disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
        Accept the terms
      </Button>
    </Notice>
  )
}
