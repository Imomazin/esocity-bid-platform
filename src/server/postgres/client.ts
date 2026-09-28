import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '@db/schema'

export type Database = PostgresJsDatabase<typeof schema>
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export interface DatabaseHandle {
  db: Database
  close: () => Promise<void>
}

/**
 * Creates a Drizzle client over postgres.js.
 *
 * Serverless-friendly defaults: a small pool, short idle timeout and `prepare: false`, which keeps
 * the client compatible with transaction-mode poolers (Neon, Supabase, PgBouncer).
 */
export function createDatabase(url: string, options: { max?: number } = {}): DatabaseHandle {
  const client = postgres(url, {
    max: options.max ?? 5,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => undefined,
  })
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) }
}
