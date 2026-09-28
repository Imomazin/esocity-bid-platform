import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle Kit configuration.
 * `pnpm db:generate` needs no database connection; `pnpm db:studio` reads DATABASE_URL.
 */
export default defineConfig({
  schema: './db/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  strict: true,
  verbose: true,
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
