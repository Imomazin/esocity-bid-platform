import { fileURLToPath } from 'node:url'

import { count, eq } from 'drizzle-orm'

import * as schema from '@db/schema'
import { DEFAULT_AUCTION_RULES, mergeRules } from '@/domain/auction/rules'
import { BID_PACKAGES, buildPromotions } from '@/server/demo/data/commerce'
import {
  BRANDS,
  buildProducts,
  CATEGORIES,
  initialStock,
  SUPPLIERS,
} from '@/server/demo/data/catalog'
import { DROP_SERIES } from '@/server/demo/data/drops'
import { AUCTION_SERIES, seriesRules } from '@/server/demo/data/series'
import { DEFAULT_FLAGS, FLAG_DESCRIPTIONS, type FeatureFlag } from '@/lib/config/flags'
import { TERMS_VERSION } from '@/lib/config/market'
import { deterministicUuid } from '@/lib/rng'
import { DAY, HOUR, MINUTE } from '@/lib/time'
import { createDatabase, type Database } from '@/server/postgres/client'
import { PostgresAuctionEngine } from '@/server/postgres/auction-engine'

/**
 * Idempotent seed for a PostgreSQL environment (development, staging or a fresh production
 * database before launch). Every row has a deterministic ID and is inserted with
 * ON CONFLICT DO NOTHING, and ledger grants use idempotency keys, so the seed can run repeatedly.
 * It creates fictional brands, products and staff accounts only — no real customer data and no
 * credentials (staff sign in through the configured auth provider).
 */

const id = (...parts: (string | number)[]) => deterministicUuid('seed', ...parts)

const COUNTRY_CODES: Record<string, string> = {
  'United Kingdom': 'GB',
  Ireland: 'IE',
  Germany: 'DE',
  France: 'FR',
  Italy: 'IT',
  Netherlands: 'NL',
  Sweden: 'SE',
  Japan: 'JP',
  'United States': 'US',
}

const STAFF = [
  { key: 'admin', name: 'Platform Admin', email: 'admin@esocity.example', role: 'SUPER_ADMIN' },
  { key: 'ops', name: 'Operations Lead', email: 'operations@esocity.example', role: 'OPERATIONS' },
  {
    key: 'merch',
    name: 'Merchandising Lead',
    email: 'merchandising@esocity.example',
    role: 'MERCHANDISER',
  },
  { key: 'finance', name: 'Finance Lead', email: 'finance@esocity.example', role: 'FINANCE' },
  {
    key: 'support',
    name: 'Support Agent',
    email: 'support@esocity.example',
    role: 'SUPPORT_AGENT',
  },
] as const

export interface SeedSummary {
  categories: number
  products: number
  auctions: number
  drops: number
  promotions: number
}

export async function seed(db: Database, now = Date.now()): Promise<SeedSummary> {
  const anchorDay = Math.floor(now / DAY) * DAY
  const engine = new PostgresAuctionEngine(db)

  // Catalogue ---------------------------------------------------------------------------------
  await db
    .insert(schema.categories)
    .values(
      CATEGORIES.map((category, index) => ({
        id: id('category', category.slug),
        slug: category.slug,
        name: category.name,
        description: category.description,
        icon: category.icon,
        sortOrder: index,
      })),
    )
    .onConflictDoNothing()
  await db
    .insert(schema.brands)
    .values(
      BRANDS.map((brand) => ({
        id: id('brand', brand.slug),
        slug: brand.slug,
        name: brand.name,
        description: brand.description,
        originCountry: brand.origin,
      })),
    )
    .onConflictDoNothing()
  await db
    .insert(schema.suppliers)
    .values(
      SUPPLIERS.map((supplier) => ({
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        status: supplier.status,
        countryCode: COUNTRY_CODES[supplier.country] ?? 'GB',
        leadTimeDays: supplier.leadTimeDays,
        paymentTermsDays: supplier.paymentTermsDays,
        onTimeRateBps: supplier.onTimeRateBps,
        fillRateBps: supplier.fillRateBps,
        defectRateBps: supplier.defectRateBps,
        notes: supplier.notes,
      })),
    )
    .onConflictDoNothing()
  for (const supplier of SUPPLIERS) {
    await db
      .insert(schema.supplierContacts)
      .values(
        supplier.contacts.map((contact, index) => ({
          id: id('supplier-contact', supplier.code, index),
          supplierId: supplier.id,
          ...contact,
        })),
      )
      .onConflictDoNothing()
  }

  const products = buildProducts(anchorDay)
  await db
    .insert(schema.products)
    .values(
      products.map((product) => ({
        id: product.id,
        sku: product.sku,
        slug: product.slug,
        name: product.name,
        brandId: id('brand', product.brandSlug),
        categoryId: id('category', product.categorySlug),
        subcategory: product.subcategory,
        supplierId: product.supplierId,
        description: product.description,
        highlights: product.highlights,
        attributes: product.attributes,
        referencePriceMinor: product.referencePriceMinor,
        buyNowPriceMinor: product.buyNowPriceMinor,
        costPriceMinor: product.costPriceMinor,
        condition: product.condition,
        shippingClass: product.shippingClass,
        status: product.status,
        auctionEligible: product.auctionEligible,
        tags: product.tags,
        rating: product.rating,
        reviewCount: product.reviewCount,
        popularity: product.popularity,
      })),
    )
    .onConflictDoNothing()
  for (const product of products) {
    await db
      .insert(schema.productImages)
      .values(
        product.images.map((image, index) => ({
          id: id('product-image', product.slug, index),
          productId: product.id,
          artKey: image.art,
          alt: image.alt,
          sortOrder: index,
        })),
      )
      .onConflictDoNothing()
    if (product.shippingClass === 'DIGITAL') continue
    const quantity = initialStock(product.slug)
    // Opening stock is an append-only RECEIVED event plus the matching position row.
    await db
      .insert(schema.inventoryEvents)
      .values({
        id: id('inventory-opening', product.slug),
        productId: product.id,
        type: 'RECEIVED',
        quantity,
        note: 'Opening balance (seed)',
        actor: 'Seed',
        occurredAt: new Date(anchorDay),
      })
      .onConflictDoNothing()
    await db
      .insert(schema.inventoryPositions)
      .values({ productId: product.id, onHand: quantity })
      .onConflictDoNothing()
  }

  // Commerce configuration ---------------------------------------------------------------------
  await db
    .insert(schema.bidPackages)
    .values(
      BID_PACKAGES.map((pack, index) => ({
        id: pack.id,
        name: pack.name,
        credits: pack.credits,
        bonusCredits: pack.bonusCredits,
        priceMinor: pack.priceMinor,
        badge: pack.badge,
        description: pack.description,
        active: pack.active,
        sortOrder: index,
      })),
    )
    .onConflictDoNothing()
  const promotions = buildPromotions(anchorDay)
  await db
    .insert(schema.promotions)
    .values(
      promotions.map((promotion) => ({
        id: promotion.id,
        code: promotion.code,
        name: promotion.name,
        description: promotion.description,
        type: promotion.type,
        value: promotion.value,
        valueKind: promotion.valueKind,
        startsAt: new Date(promotion.startsAt),
        endsAt: new Date(promotion.endsAt),
        usageLimit: promotion.usageLimit,
        perUserLimit: promotion.perUserLimit,
        minimumSpendMinor: promotion.minimumSpendMinor,
        maximumDiscountMinor: promotion.maximumDiscountMinor,
        eligibility: promotion.eligibility,
        status: promotion.status,
      })),
    )
    .onConflictDoNothing()
  await db
    .insert(schema.featureFlags)
    .values(
      (Object.keys(DEFAULT_FLAGS) as FeatureFlag[]).map((key) => ({
        key,
        enabled: DEFAULT_FLAGS[key],
        description: FLAG_DESCRIPTIONS[key],
      })),
    )
    .onConflictDoNothing()

  // People (fictional) -------------------------------------------------------------------------
  for (const staff of STAFF) {
    const userId = id('staff', staff.key)
    await db
      .insert(schema.users)
      .values({
        id: userId,
        email: staff.email,
        displayName: staff.name,
        handle: `staff-${staff.key}`,
        ageVerifiedAt: new Date(anchorDay),
        emailVerifiedAt: new Date(anchorDay),
      })
      .onConflictDoNothing()
    await db.insert(schema.userRoles).values({ userId, role: staff.role }).onConflictDoNothing()
  }
  const memberId = id('member', 'demo')
  await db
    .insert(schema.users)
    .values({
      id: memberId,
      email: 'member@esocity.example',
      displayName: 'Demo Member',
      handle: 'demo-member',
      firstName: 'Demo',
      lastName: 'Member',
      ageVerifiedAt: new Date(anchorDay),
      emailVerifiedAt: new Date(anchorDay),
      termsAcceptedVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(anchorDay),
    })
    .onConflictDoNothing()
  await db
    .insert(schema.userRoles)
    .values({ userId: memberId, role: 'CUSTOMER' })
    .onConflictDoNothing()
  await db.insert(schema.rewardAccounts).values({ userId: memberId }).onConflictDoNothing()
  await db.insert(schema.userPreferences).values({ userId: memberId }).onConflictDoNothing()
  await db.insert(schema.responsibleUseLimits).values({ userId: memberId }).onConflictDoNothing()
  await engine.grantCredits({
    userId: memberId,
    type: 'PROMOTIONAL_CREDIT',
    bucket: 'PROMOTIONAL',
    credits: 100,
    description: 'Welcome bonus (seed)',
    idempotencyKey: 'seed:welcome-bonus',
  })

  // Auctions: the next instance of each series, scheduled on the same wall-clock cadence ---------
  const productsBySlug = new Map(products.map((product) => [product.slug, product]))
  for (const series of AUCTION_SERIES) {
    const product = productsBySlug.get(series.products[0]!)
    if (!product) continue
    const cycleMs = series.cycleMinutes * MINUTE
    const nextCycle =
      Math.ceil((now - series.offsetMinutes * MINUTE) / cycleMs) * cycleMs +
      series.offsetMinutes * MINUTE
    const startsAt = nextCycle + series.leadMinutes * MINUTE
    const rules = mergeRules(
      DEFAULT_AUCTION_RULES,
      seriesRules(series, product.referencePriceMinor),
    )
    await db
      .insert(schema.auctions)
      .values({
        id: id('auction', series.key, nextCycle),
        productId: product.id,
        title: product.name,
        label: series.label ?? null,
        status: 'SCHEDULED',
        featured: series.featured ?? false,
        startingPriceMinor: rules.startingPriceMinor,
        bidIncrementMinor: rules.bidIncrementMinor,
        bidCreditCost: rules.bidCreditCost,
        timerSeconds: rules.timerSeconds,
        timerExtensionSeconds: rules.timerExtensionSeconds,
        hardStopAfterSeconds: rules.hardStopAfterSeconds,
        minimumParticipants: rules.minimumParticipants,
        maximumParticipants: rules.maximumParticipants,
        reservePriceMinor: rules.reservePriceMinor,
        perUserBidLimit: rules.perUserBidLimit,
        preventSelfOutbid: rules.preventSelfOutbid,
        autoBidEnabled: rules.autoBidEnabled,
        buyNowEnabled: rules.buyNowEnabled,
        buyNowPriceMinor: rules.buyNowPriceMinor,
        bidCreditRecoveryEnabled: rules.bidCreditRecoveryEnabled,
        recoveryMode: rules.recoveryMode,
        recoveryWindowHours: rules.recoveryWindowHours,
        recoverPromotionalBids: rules.recoverPromotionalBids,
        winnerPaymentWindowHours: rules.winnerPaymentWindowHours,
        eligibility: rules.eligibility,
        startsAt: new Date(startsAt),
        closeAt: new Date(startsAt + rules.timerSeconds * 1_000),
        hardCloseAt: rules.hardStopAfterSeconds
          ? new Date(startsAt + rules.hardStopAfterSeconds * 1_000)
          : null,
        priceMinor: rules.startingPriceMinor,
        createdBy: id('staff', 'merch'),
      })
      .onConflictDoNothing()
  }

  // Flash Drops: the next window of each drop series ----------------------------------------------
  for (const drop of DROP_SERIES) {
    const product = productsBySlug.get(drop.productSlug)
    if (!product) continue
    const periodMs = drop.periodHours * HOUR
    const startsAt =
      Math.ceil((now - drop.offsetHours * HOUR) / periodMs) * periodMs + drop.offsetHours * HOUR
    await db
      .insert(schema.flashDrops)
      .values({
        id: id('drop', drop.key, startsAt),
        slug: `${drop.key}-${new Date(startsAt).toISOString().slice(0, 13).replace(/[-T:]/g, '')}`,
        productId: product.id,
        title: drop.title,
        subtitle: drop.subtitle,
        dropPriceMinor: drop.dropPriceMinor,
        stockTotal: drop.stock,
        perCustomerLimit: drop.perCustomerLimit,
        minimumTier: drop.minimumTier,
        membersOnly: drop.membersOnly,
        startsAt: new Date(startsAt),
        endsAt: new Date(startsAt + drop.durationHours * HOUR),
        state: 'PUBLISHED',
      })
      .onConflictDoNothing()
  }

  await db
    .insert(schema.auditEvents)
    .values({
      id: id('audit', 'seed', anchorDay),
      actorType: 'SYSTEM',
      actorId: 'seed',
      actorName: 'Seed script',
      action: 'system.seeded',
      entityType: 'SYSTEM',
      entityId: 'seed',
      summary: 'Database seeded with the Esocity Bid catalogue and configuration',
    })
    .onConflictDoNothing()

  const [categoriesCount] = await db.select({ value: count() }).from(schema.categories)
  const [productsCount] = await db.select({ value: count() }).from(schema.products)
  const [auctionsCount] = await db.select({ value: count() }).from(schema.auctions)
  const [dropsCount] = await db.select({ value: count() }).from(schema.flashDrops)
  const [promotionsCount] = await db
    .select({ value: count() })
    .from(schema.promotions)
    .where(eq(schema.promotions.status, 'ACTIVE'))
  return {
    categories: categoriesCount?.value ?? 0,
    products: productsCount?.value ?? 0,
    auctions: auctionsCount?.value ?? 0,
    drops: dropsCount?.value ?? 0,
    promotions: promotionsCount?.value ?? 0,
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set. Run migrations first, then seed (see README).')
    process.exit(1)
  }
  const { db, close } = createDatabase(url, { max: 2 })
  try {
    const summary = await seed(db)
    console.info('Seed complete:', summary)
  } finally {
    await close()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error('Seed failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
