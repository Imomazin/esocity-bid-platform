'use client'

import { HeartIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { api, ApiError } from '@/lib/client/api'
import { cn } from '@/lib/utils'

export function WatchButton({
  type,
  targetId,
  initialWatched,
  signedIn,
  className,
  label,
}: {
  type: 'AUCTION' | 'PRODUCT' | 'DROP'
  targetId: string
  initialWatched: boolean
  signedIn: boolean
  className?: string
  label?: string
}) {
  const router = useRouter()
  const [watched, setWatched] = useState(initialWatched)
  const [pending, setPending] = useState(false)
  const toggle = async () => {
    if (!signedIn) {
      toast('Enter the demo to use your watchlist', {
        description: 'Watch auctions, products and drops and get notified when they start or end.',
        action: { label: 'Enter demo', onClick: () => router.push('/demo') },
      })
      return
    }
    const next = !watched
    setWatched(next)
    setPending(true)
    try {
      const url = type === 'AUCTION' ? `/api/auctions/${targetId}/watch` : '/api/watchlist'
      await api(url, {
        method: 'POST',
        body: type === 'AUCTION' ? { watch: next } : { type, targetId, watch: next },
      })
      toast.success(next ? 'Added to your watchlist' : 'Removed from your watchlist')
    } catch (error) {
      setWatched(!next)
      toast.error(error instanceof ApiError ? error.message : 'Could not update your watchlist.')
    } finally {
      setPending(false)
    }
  }
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void toggle()
      }}
      disabled={pending}
      aria-pressed={watched}
      aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-full bg-card/90 text-sm font-medium shadow-card backdrop-blur transition hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        label ? 'h-9 px-3' : 'size-9',
        className,
      )}
    >
      <HeartIcon
        className={cn('size-4 transition', watched ? 'fill-live text-live' : 'text-foreground')}
        aria-hidden
      />
      {label ? <span>{watched ? 'Watching' : label}</span> : null}
    </button>
  )
}
