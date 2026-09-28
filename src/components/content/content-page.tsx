import type * as React from 'react'

import { Container } from '@/components/common/section'
import { cn } from '@/lib/utils'

/** Layout for editorial/policy pages: header, optional table of contents and readable prose. */
export function ContentPage({
  eyebrow,
  title,
  intro,
  toc,
  updated,
  children,
  aside,
}: {
  eyebrow: string
  title: string
  intro: React.ReactNode
  toc?: { id: string; label: string }[]
  updated?: string
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <div>
      <div className="border-b bg-surface">
        <Container className="py-10 sm:py-14">
          <p className="text-xs font-semibold tracking-wider text-brand uppercase">{eyebrow}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <div className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">{intro}</div>
          {updated ? (
            <p className="mt-4 text-xs text-muted-foreground">Last updated {updated}</p>
          ) : null}
          {aside ? <div className="mt-6">{aside}</div> : null}
        </Container>
      </div>
      <Container
        className={cn('py-10 sm:py-12', toc && 'grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]')}
      >
        {toc ? (
          <nav aria-label="On this page" className="hidden lg:block">
            <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              On this page
            </p>
            <ul className="sticky top-24 space-y-1 text-sm">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block rounded-md px-2 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div className="max-w-3xl min-w-0 space-y-12">{children}</div>
      </Container>
    </div>
  )
}

export function ProseSection({
  id,
  title,
  children,
  className,
}: {
  id: string
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn('scroll-mt-24', className)}>
      <h2 id={`${id}-heading`} className="text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h2>
      <div className="prose-esb mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}

export function DemoLegalNotice({ document }: { document: string }) {
  return (
    <div
      role="note"
      className="rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning-foreground"
    >
      <strong>Demonstration {document}.</strong> This text describes how the Esocity Bid demo
      platform works. It is not legal advice and must be replaced with counsel-approved {document}{' '}
      before any public launch.
    </div>
  )
}
