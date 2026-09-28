import {
  BookOpenIcon,
  ClockIcon,
  LifeBuoyIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Container, PageHeader } from '@/components/common/section'
import { EnterDemoButton } from '@/components/layout/enter-demo-button'
import { FaqSearch } from '@/components/support/faq-search'
import { TicketForm } from '@/components/support/ticket-form'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS, type TicketStatus } from '@/domain/support'
import { formatDateTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = {
  title: 'Help & support',
  description:
    'Answers about bidding, bid credits, orders and delivery — or contact the Esocity Bid support team.',
  alternates: { canonical: '/support' },
}

const STATUS_VARIANTS: Record<TicketStatus, 'warning' | 'info' | 'brand' | 'success' | 'neutral'> =
  {
    OPEN: 'warning',
    IN_PROGRESS: 'info',
    WAITING_CUSTOMER: 'brand',
    RESOLVED: 'success',
    CLOSED: 'neutral',
  }

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function SupportPage({ searchParams }: PageProps<'/support'>) {
  const params = await searchParams
  const viewer = await getViewer()
  const backend = getBackend()
  const faqs = backend.faqs()
  const tickets = viewer ? backend.tickets(viewer.userId) : []
  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        eyebrow="Help centre"
        title="How can we help?"
        description="Search common questions, read the auction rules, or contact our team. We reply to every request within 24 hours."
      />
      <div className="mb-10 grid gap-3 sm:grid-cols-3">
        {[
          {
            href: '/how-it-works',
            icon: BookOpenIcon,
            title: 'How it works',
            text: 'Bids, timers, wins and Buy Now explained.',
          },
          {
            href: '/auction-rules',
            icon: LifeBuoyIcon,
            title: 'Auction rules',
            text: 'The complete, plain-English rulebook.',
          },
          {
            href: '/responsible-use',
            icon: ShieldCheckIcon,
            title: 'Responsible use',
            text: 'Limits, breaks and staying in control.',
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex gap-3 rounded-2xl border bg-card p-4 shadow-card transition hover:shadow-raised"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
              <item.icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-medium">{item.title}</span>
              <span className="text-sm text-muted-foreground">{item.text}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="mb-4 text-xl font-semibold tracking-tight">
            Frequently asked questions
          </h2>
          <FaqSearch faqs={faqs} />
        </section>

        <div className="space-y-6">
          <Card id="contact" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquareIcon className="size-5 text-brand" aria-hidden /> Contact support
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <ClockIcon className="size-3.5" aria-hidden /> Typical reply: within 24 hours ·
                payment and wallet issues are prioritised
              </CardDescription>
            </CardHeader>
            <CardContent>
              {viewer ? (
                <TicketForm
                  defaults={{
                    category: first(params.category),
                    subject: first(params.subject),
                    reference: first(params.ref),
                  }}
                />
              ) : (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Enter the demo to raise a support request and see how the support workflow works
                    end to end.
                  </p>
                  <EnterDemoButton redirectTo="/support#contact">Enter the demo</EnterDemoButton>
                </div>
              )}
            </CardContent>
          </Card>

          {viewer ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your requests</CardTitle>
              </CardHeader>
              <CardContent>
                {tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    You haven’t contacted support yet.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {tickets.map((ticket) => (
                      <li key={ticket.id} className="rounded-xl border">
                        <details className="group px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
                          <summary className="flex cursor-pointer list-none flex-col gap-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="tabular text-xs font-semibold text-muted-foreground">
                                {ticket.reference}
                              </span>
                              <Badge variant={STATUS_VARIANTS[ticket.status]}>
                                {TICKET_STATUS_LABELS[ticket.status]}
                              </Badge>
                              <Badge variant="outline">
                                {TICKET_CATEGORY_LABELS[ticket.category]}
                              </Badge>
                            </span>
                            <span className="text-sm font-medium">{ticket.subject}</span>
                            <span className="text-xs text-muted-foreground">
                              Updated {formatDateTime(ticket.updatedAt)}
                            </span>
                          </summary>
                          <ol className="mt-3 space-y-2 border-t pt-3">
                            {ticket.messages.map((message) => (
                              <li
                                key={message.id}
                                className={cn(
                                  'rounded-lg px-3 py-2 text-sm',
                                  message.author === 'CUSTOMER'
                                    ? 'ml-6 bg-brand-soft/60'
                                    : 'mr-6 bg-muted',
                                )}
                              >
                                <p className="text-xs font-medium text-muted-foreground">
                                  {message.author === 'CUSTOMER' ? 'You' : message.authorName} ·{' '}
                                  {formatDateTime(message.at)}
                                </p>
                                <p className="mt-0.5 whitespace-pre-line">{message.body}</p>
                              </li>
                            ))}
                          </ol>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </Container>
  )
}
