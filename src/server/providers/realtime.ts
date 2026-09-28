/**
 * Real-time provider abstraction.
 *
 * Server side, the engine publishes authoritative auction updates to channels such as
 * `auction:{id}` and `user:{id}`. In demo mode updates are held in-process and clients poll the
 * snapshot endpoint (no paid WebSocket provider required). With REALTIME_PROVIDER=ably the same
 * events are published through Ably's REST API and clients subscribe with token auth.
 *
 * Clients always treat pushed data as a hint: the server state is authoritative.
 */

export interface RealtimeMessage {
  channel: string
  name: string
  data: unknown
  at: number
}

export interface RealtimePublisher {
  readonly name: 'demo' | 'ably'
  publish(channel: string, name: string, data: unknown): Promise<void>
}

type Listener = (message: RealtimeMessage) => void

export class DemoRealtimePublisher implements RealtimePublisher {
  readonly name = 'demo' as const
  private readonly listeners = new Map<string, Set<Listener>>()

  async publish(channel: string, name: string, data: unknown): Promise<void> {
    const message: RealtimeMessage = { channel, name, data, at: Date.now() }
    for (const listener of this.listeners.get(channel) ?? []) listener(message)
  }

  subscribe(channel: string, listener: Listener): () => void {
    const set = this.listeners.get(channel) ?? new Set<Listener>()
    set.add(listener)
    this.listeners.set(channel, set)
    return () => {
      set.delete(listener)
      if (set.size === 0) this.listeners.delete(channel)
    }
  }
}

export class AblyRealtimePublisher implements RealtimePublisher {
  readonly name = 'ably' as const

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async publish(channel: string, name: string, data: unknown): Promise<void> {
    const response = await this.fetchImpl(
      `https://rest.ably.io/channels/${encodeURIComponent(channel)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, data }),
      },
    )
    if (!response.ok) throw new Error(`Realtime provider returned ${response.status}`)
  }
}

export const channels = {
  auction: (id: string) => `auction:${id}`,
  user: (id: string) => `user:${id}`,
  lobby: 'auctions:lobby',
} as const
