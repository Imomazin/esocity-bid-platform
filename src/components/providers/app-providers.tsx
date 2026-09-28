'use client'

import { Toaster } from 'sonner'
import type * as React from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      {children}
      <Toaster
        position="bottom-right"
        closeButton
        toastOptions={{
          classNames: {
            toast: 'rounded-xl border border-border bg-popover text-foreground shadow-raised',
            description: 'text-muted-foreground',
          },
        }}
      />
    </TooltipProvider>
  )
}
