'use client'

import { Loader2Icon, LogOutIcon, RotateCcwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/client/api'
import { emit } from '@/lib/client/events'

/** Reset or leave the sandboxed demo account. */
export function DemoSessionControls() {
  const router = useRouter()
  const [pending, setPending] = useState<'reset' | 'exit' | null>(null)
  const run = async (kind: 'reset' | 'exit') => {
    setPending(kind)
    try {
      if (kind === 'reset') {
        const result = await api<{ walletAvailable: number }>('/api/demo/reset', { body: {} })
        emit('wallet:balance', { available: result.walletAvailable })
        toast.success('Demo reset', {
          description: 'A fresh demo wallet and history have been loaded.',
        })
        router.refresh()
      } else {
        await api('/api/demo/session', { method: 'DELETE' })
        toast.success('You have left the demo.')
        router.push('/')
        router.refresh()
      }
    } catch (caught) {
      toast.error(
        caught instanceof ApiError ? caught.message : 'Something went wrong. Please try again.',
      )
    } finally {
      setPending(null)
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => run('reset')} disabled={pending !== null}>
        {pending === 'reset' ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />} Reset
        demo data
      </Button>
      <Button variant="ghost" onClick={() => run('exit')} disabled={pending !== null}>
        {pending === 'exit' ? <Loader2Icon className="animate-spin" /> : <LogOutIcon />} Exit demo
      </Button>
    </div>
  )
}
