import postgres from 'postgres'

import * as schema from '@db/schema'
import { runMigrations } from '@db/migrate'
import { DEFAULT_ELIGIBILITY } from '@/domain/auction/rules'
import { createDatabase, type DatabaseHandle } from '@/server/postgres/client'
import { PostgresAuctionEngine } from '@/server/postgres/auction-engine'

export const DATABASE_URL = process.env.DATABASE_URL ?? ''

/**
 * Resets the test database schema and applies all migrations. For safety this refuses to run
 * against any database whose name does not end in "_test".
 */
export async function resetDatabase(): Promise<void> {
  if (!DATABASE_URL) throw new Error('DATABASE_URL must be set for database tests')
  const name = new URL(DATABASE_URL).pathname.replace(/^\//, '')
  if (!name.endsWith('_test'))
    throw new Error(`Refusing to reset database "${name}": test database names must end in _test`)
  const client = postgres(DATABASE_URL, { max: 1, onnotice: () => undefined })
  try {
    await client.unsafe(
      'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;',
    )
  } finally {
    await client.end()
  }
  await runMigrations(DATABASE_URL)
}

export interface TestContext {
  handle: DatabaseHandle
  engine: PostgresAuctionEngine
  productId: string
}

let counter = 0

export async function setupContext(): Promise<TestContext> {
  const handle = createDatabase(DATABASE_URL, { max: 16 })
  const { db } = handle
  const [category] = await db
    .insert(schema.categories)
    .values({ slug: 'electronics', name: 'Electronics' })
    .returning()
  const [brand] = await db
    .insert(schema.brands)
    .values({ slug: 'aurion', name: 'Aurion' })
    .returning()
  const [supplier] = await db
    .insert(schema.suppliers)
    .values({
      code: 'SUP-1',
      name: 'Test Supplier',
      countryCode: 'GB',
      leadTimeDays: 5,
      status: 'ACTIVE',
    })
    .returning()
  const [product] = await db
    .insert(schema.products)
    .values({
      sku: 'TEST-001',
      slug: 'test-phone',
      name: 'Test Phone',
      brandId: brand!.id,
      categoryId: category!.id,
      subcategory: 'Phones',
      supplierId: supplier!.id,
      description: 'A test product used by the database integration tests.',
      referencePriceMinor: 99_900,
      buyNowPriceMinor: 94_900,
      costPriceMinor: 70_000,
      status: 'ACTIVE',
      auctionEligible: true,
      shippingClass: 'SMALL',
    })
    .returning()
  return { handle, engine: new PostgresAuctionEngine(db), productId: product!.id }
}

/** Creates an adult, age-verified member with `credits` purchased bid credits. */
export async function createMember(
  ctx: TestContext,
  credits: number,
  options: { role?: (typeof schema.roleEnum.enumValues)[number] } = {},
) {
  counter += 1
  const [user] = await ctx.handle.db
    .insert(schema.users)
    .values({
      email: `member${counter}@example.test`,
      displayName: `Member ${counter}`,
      handle: `member${counter}`,
      ageVerifiedAt: new Date(),
      createdAt: new Date(Date.now() - 400 * 24 * 3_600_000),
    })
    .returning()
  if (options.role)
    await ctx.handle.db.insert(schema.userRoles).values({ userId: user!.id, role: options.role })
  if (credits > 0) {
    await ctx.engine.grantCredits({
      userId: user!.id,
      type: 'BID_PACK_PURCHASE',
      bucket: 'PURCHASED',
      credits,
      description: 'Test bid pack',
      idempotencyKey: `test-pack-${user!.id}`,
    })
  }
  return user!
}

export async function createLiveAuction(
  ctx: TestContext,
  overrides: Partial<typeof schema.auctions.$inferInsert> = {},
) {
  const now = Date.now()
  const [auction] = await ctx.handle.db
    .insert(schema.auctions)
    .values({
      productId: ctx.productId,
      title: 'Test Phone auction',
      status: 'LIVE',
      timerSeconds: 600,
      timerExtensionSeconds: 15,
      bidIncrementMinor: 1,
      bidCreditCost: 1,
      minimumParticipants: 2,
      eligibility: DEFAULT_ELIGIBILITY,
      startsAt: new Date(now - 60_000),
      closeAt: new Date(now + 600_000),
      ...overrides,
    })
    .returning()
  return auction!
}
