import { count, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import * as schema from '@db/schema'
import { seed } from '@db/seed'
import { createDatabase, type DatabaseHandle } from '@/server/postgres/client'
import { PostgresAuctionEngine } from '@/server/postgres/auction-engine'

import { DATABASE_URL, resetDatabase } from './helpers'

let handle: DatabaseHandle

beforeAll(async () => {
  await resetDatabase()
  handle = createDatabase(DATABASE_URL, { max: 4 })
})

afterAll(async () => {
  await handle?.close()
})

async function tableCounts() {
  const tables = [
    schema.products,
    schema.inventoryEvents,
    schema.bidLedgerEntries,
    schema.auctions,
    schema.flashDrops,
    schema.users,
    schema.promotions,
  ] as const
  return Promise.all(
    tables.map(async (table) => (await handle.db.select({ value: count() }).from(table))[0]!.value),
  )
}

describe('database seed', () => {
  it('is idempotent: running it twice creates no duplicates', async () => {
    const now = Date.now()
    const first = await seed(handle.db, now)
    const countsAfterFirst = await tableCounts()
    const second = await seed(handle.db, now)
    expect(second).toEqual(first)
    expect(await tableCounts()).toEqual(countsAfterFirst)
    expect(first.products).toBeGreaterThanOrEqual(40)
    expect(first.auctions).toBeGreaterThanOrEqual(12)
  })

  it('seeds scheduled auctions that the engine starts when their time arrives', async () => {
    const [auction] = await handle.db.select().from(schema.auctions).limit(1)
    // Pull the start time into the past to simulate the schedule being reached.
    await handle.db
      .update(schema.auctions)
      .set({
        startsAt: new Date(Date.now() - 1_000),
        closeAt: new Date(Date.now() + auction!.timerSeconds * 1_000),
        hardCloseAt: null,
      })
      .where(eq(schema.auctions.id, auction!.id))
    const engine = new PostgresAuctionEngine(handle.db)
    const started = await engine.startDueAuctions()
    expect(started).toContain(auction!.id)
    const [row] = await handle.db
      .select()
      .from(schema.auctions)
      .where(eq(schema.auctions.id, auction!.id))
    expect(row!.status).toBe('LIVE')
    expect(await engine.startDueAuctions()).not.toContain(auction!.id)
  })
})
