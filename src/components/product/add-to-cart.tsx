'use client'

import { CheckIcon, Loader2Icon, ShoppingBagIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button, type ButtonProps } from '@/components/ui/button'
import { api, ApiError } from '@/lib/client/api'
import { emit } from '@/lib/client/events'

export function AddToCartButton({
  productId,
  signedIn,
  disabled,
  quantity = 1,
  buyNow = false,
  ...props
}: ButtonProps & { productId: string; signedIn: boolean; quantity?: number; buyNow?: boolean }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'pending' | 'added'>('idle')
  return (
    <Button
      {...props}
      disabled={disabled || state === 'pending'}
      onClick={async () => {
        if (!signedIn) {
          toast('Enter the demo to shop', {
            description: 'Checkout uses simulated payments — no real money is taken.',
            action: { label: 'Enter demo', onClick: () => router.push('/demo') },
          })
          return
        }
        setState('pending')
        try {
          const cart = await api<{ itemCount: number }>('/api/cart/items', {
            method: 'POST',
            body: { productId, quantity },
          })
          emit('cart:count', { count: cart.itemCount })
          setState('added')
          if (buyNow) {
            router.push('/checkout')
            return
          }
          toast.success('Added to your basket', {
            action: { label: 'Checkout', onClick: () => router.push('/checkout') },
          })
          setTimeout(() => setState('idle'), 1600)
        } catch (error) {
          setState('idle')
          toast.error(error instanceof ApiError ? error.message : 'Could not add to basket.')
        }
      }}
    >
      {state === 'pending' ? (
        <Loader2Icon className="animate-spin" />
      ) : state === 'added' ? (
        <CheckIcon />
      ) : (
        <ShoppingBagIcon />
      )}
      {props.children ?? (buyNow ? 'Buy now' : state === 'added' ? 'Added' : 'Add to basket')}
    </Button>
  )
}
