import { logger } from '@/server/infra/logger'

/** Email provider abstraction. Demo logs to an in-memory outbox; Resend/SES later. */

export interface EmailMessage {
  to: string
  subject: string
  text: string
  tags?: string[]
}

export interface EmailProvider {
  readonly name: 'demo' | 'resend'
  send(message: EmailMessage): Promise<{ id: string; simulated: boolean }>
}

function maskEmail(address: string): string {
  const [local = '', domain = ''] = address.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

export class DemoEmailProvider implements EmailProvider {
  readonly name = 'demo' as const
  readonly outbox: (EmailMessage & { id: string; at: number })[] = []

  async send(message: EmailMessage) {
    const id = crypto.randomUUID()
    this.outbox.unshift({ ...message, id, at: Date.now() })
    this.outbox.splice(200)
    logger.debug('Demo email queued', { to: maskEmail(message.to), subject: message.subject })
    return { id, simulated: true }
  }
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend' as const

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage) {
    const response = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
    })
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`)
    const body = (await response.json()) as { id?: string }
    return { id: body.id ?? '', simulated: false }
  }
}
