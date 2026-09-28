'use client'

import { Loader2Icon, SparklesIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button, type ButtonProps } from '@/components/ui/button'
import { api, ApiError } from '@/lib/client/api'

export function EnterDemoButton({
  children,
  redirectTo,
  ...props
}: ButtonProps & { redirectTo?: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant="brand"
      {...props}
      disabled={pending || props.disabled}
      onClick={async () => {
        setPending(true)
        try {
          const result = await api<{ walletAvailable: number; created: boolean }>(
            '/api/demo/session',
            { method: 'POST', body: {} },
          )
          toast.success('Welcome to Esocity Bid', {
            description: `You’re signed in as Demo Member with ${result.walletAvailable} demo bid credits. Everything here is simulated.`,
          })
          if (redirectTo) router.push(redirectTo)
          router.refresh()
        } catch (error) {
          toast.error(
            error instanceof ApiError
              ? error.message
              : 'Could not start the demo. Please try again.',
          )
        } finally {
          setPending(false)
        }
      }}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
      {children ?? 'Enter demo'}
    </Button>
  )
}
