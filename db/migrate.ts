import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Applies pending migrations (generated schema + custom SQL guards) to DATABASE_URL.
 * Usage: DATABASE_URL=… pnpm db:migrate. The connection string is never printed.
 */
export async function runMigrations(url: string): Promise<void> {
  const client = postgres(url, { max: 1, onnotice: () => undefined })
  try {
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)),
    })
  } finally {
    await client.end()
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(
      'DATABASE_URL is not set. Point it at a PostgreSQL 15+ database (see .env.example).',
    )
    process.exit(1)
  }
  await runMigrations(url)
  console.info('Migrations applied.')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error('Migration failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
