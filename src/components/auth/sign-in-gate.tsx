import { LockKeyholeIcon } from 'lucide-react'
import Link from 'next/link'

import { Container } from '@/components/common/section'
import { EnterDemoButton } from '@/components/layout/enter-demo-button'
import { Button } from '@/components/ui/button'

export function SignInGate({
  title,
  description,
  redirectTo,
}: {
  title: string
  description: string
  redirectTo?: string
}) {
  return (
    <Container className="py-20">
      <div className="mx-auto max-w-lg rounded-3xl border bg-card p-10 text-center shadow-card">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-soft-foreground">
          <LockKeyholeIcon className="size-6" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <EnterDemoButton size="lg" redirectTo={redirectTo}>
            Enter the demo platform
          </EnterDemoButton>
          <Button asChild variant="outline" size="lg">
            <Link href="/how-it-works">How it works</Link>
          </Button>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          You’ll get a sandboxed Demo Member account with demo bid credits. No real money or
          personal data.
        </p>
      </div>
    </Container>
  )
}
