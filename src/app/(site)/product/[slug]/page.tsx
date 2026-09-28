import {
  ChevronRightIcon,
  GavelIcon,
  PackageCheckIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  StarIcon,
  TruckIcon,
  ZapIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AuctionCard } from '@/components/auction/auction-card'
import { AuctionPoller, LiveCountdown, LivePrice } from '@/components/auction/live-bits'
import { Container, SectionHeader } from '@/components/common/section'
import { PriceStack } from '@/components/commerce/price'
import { AddToCartButton } from '@/components/product/add-to-cart'
import { giftCardLabel } from '@/components/product/product-art'
import { ProductCard } from '@/components/product/product-card'
import { ProductGallery } from '@/components/product/product-gallery'
import { WatchButton } from '@/components/product/watch-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { STOCK_LABELS } from '@/domain/inventory'
import { absoluteUrl } from '@/lib/config/site'
import { formatMinor, toMajorString, money } from '@/lib/money'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export async function generateMetadata({
  params,
}: PageProps<'/product/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const product = getBackend().productDetail(slug)
  if (!product) return { title: 'Product not found', robots: { index: false } }
  return {
    title: product.name,
    description: `${product.brandName} ${product.name} — ${formatMinor(product.buyNowPriceMinor)}. ${product.description.slice(0, 120)}`,
    alternates: { canonical: `/product/${slug}` },
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      type: 'website',
      url: `/product/${slug}`,
    },
  }
}

export default async function ProductPage({ params }: PageProps<'/product/[slug]'>) {
  const { slug } = await params
  const viewer = await getViewer()
  const backend = getBackend()
  const product = backend.productDetail(slug, viewer?.userId)
  if (!product) notFound()
  const signedIn = !!viewer
  const serverTime = backend.now()
  const outOfStock = product.stockLevel === 'OUT_OF_STOCK'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    brand: { '@type': 'Brand', name: product.brandName },
    description: product.description,
    category: product.categoryName,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    },
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/product/${product.slug}`),
      priceCurrency: 'GBP',
      price: toMajorString(money(product.buyNowPriceMinor)),
      availability: outOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  }
  const pollIds = [
    ...(product.activeAuction ? [product.activeAuction.id] : []),
    ...product.relatedAuctions.map((auction) => auction.id),
  ]
  return (
    <Container className="py-6 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <AuctionPoller ids={pollIds} />
      <nav
        aria-label="Breadcrumb"
        className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link href="/marketplace" className="hover:text-foreground">
          Marketplace
        </Link>
        <ChevronRightIcon className="size-3.5" aria-hidden />
        <Link href={`/category/${product.categorySlug}`} className="hover:text-foreground">
          {product.categoryName}
        </Link>
        <ChevronRightIcon className="size-3.5" aria-hidden />
        <span className="truncate text-foreground" aria-current="page">
          {product.name}
        </span>
      </nav>
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <ProductGallery
          images={product.images}
          palette={product.palette}
          uid={product.slug}
          label={giftCardLabel(product.name)}
          name={product.name}
        />
        <div className="space-y-6">
          <div>
            <Link
              href={`/marketplace?brand=${product.brandSlug}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {product.brandName}
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {product.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1">
                <StarIcon className="size-4 fill-warning text-warning" aria-hidden />
                <span className="font-medium">{product.rating.toFixed(1)}</span>
                <span className="text-muted-foreground">
                  ({product.reviewCount.toLocaleString('en-GB')} reviews)
                </span>
              </span>
              <span className="text-muted-foreground">SKU {product.sku}</span>
              <span className="text-muted-foreground">Colour: {product.colourway}</span>
            </div>
          </div>
          <div className="space-y-4 rounded-3xl border bg-card p-5 shadow-card sm:p-6">
            <PriceStack
              priceMinor={product.buyNowPriceMinor}
              referenceMinor={product.referencePriceMinor}
              label="Buy Now price (inc. VAT)"
              size="lg"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  product.stockLevel === 'IN_STOCK'
                    ? 'success'
                    : product.stockLevel === 'LOW_STOCK'
                      ? 'warning'
                      : 'danger'
                }
              >
                <PackageCheckIcon aria-hidden />
                {STOCK_LABELS[product.stockLevel]}
                {product.stockLevel === 'LOW_STOCK' ? ` — ${product.available} left` : ''}
              </Badge>
              <Badge variant="outline">
                {product.condition === 'NEW'
                  ? 'New'
                  : product.condition === 'REFURBISHED'
                    ? 'Refurbished'
                    : 'Open box'}
              </Badge>
              {product.shippingClass === 'LARGE' ? (
                <Badge variant="outline">Two-person delivery</Badge>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <AddToCartButton
                productId={product.id}
                signedIn={signedIn}
                size="lg"
                variant="primary"
                className="flex-1"
                disabled={outOfStock}
                buyNow
              >
                Buy now
              </AddToCartButton>
              <AddToCartButton
                productId={product.id}
                signedIn={signedIn}
                size="lg"
                variant="outline"
                className="flex-1"
                disabled={outOfStock}
              />
              <WatchButton
                type="PRODUCT"
                targetId={product.id}
                initialWatched={product.watched}
                signedIn={signedIn}
                label="Watch"
                className="h-11 border px-4"
              />
            </div>
            <ul className="grid gap-2 border-t pt-4 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <TruckIcon className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />{' '}
                {product.deliveryNote}
              </li>
              <li className="flex gap-2">
                <RotateCcwIcon className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />{' '}
                {product.returnsWindowDays}-day returns on marketplace purchases. Your statutory
                rights are not affected.
              </li>
              <li className="flex gap-2">
                <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />{' '}
                Genuine product from a vetted supplier, with manufacturer warranty.
              </li>
            </ul>
          </div>
          {product.activeAuction ? (
            <Link
              href={`/auction/${product.activeAuction.id}`}
              className="group block rounded-3xl border-2 border-live/30 bg-live-soft/40 p-5 transition hover:border-live/60"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <GavelIcon className="size-4 text-live" aria-hidden />
                  {product.activeAuction.status === 'LIVE'
                    ? 'This item is in a live auction'
                    : 'An auction for this item starts soon'}
                </p>
                <span className="text-sm font-medium text-live-foreground group-hover:underline">
                  View auction →
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {product.activeAuction.status === 'LIVE' ? 'Current price' : 'Opening price'}
                  </p>
                  <p className="text-2xl font-semibold tracking-tight">
                    <LivePrice initial={product.activeAuction} />
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {product.activeAuction.status === 'LIVE' ? 'Time left' : 'Starts in'}
                  </p>
                  <LiveCountdown
                    initial={product.activeAuction}
                    serverTime={serverTime}
                    size="lg"
                  />
                </div>
              </div>
            </Link>
          ) : null}
          {product.drop &&
          (product.drop.status === 'LIVE' || product.drop.status === 'UPCOMING') ? (
            <Link
              href="/drops"
              className="flex items-center justify-between gap-3 rounded-2xl border bg-brand-soft/60 p-4 text-sm"
            >
              <span className="flex items-center gap-2 font-medium">
                <ZapIcon className="size-4 text-brand" aria-hidden />
                Flash Drop {product.drop.status === 'LIVE' ? 'live now' : 'coming up'}:{' '}
                {formatMinor(product.drop.dropPriceMinor)}
              </span>
              <span className="text-brand">View drop →</span>
            </Link>
          ) : null}
        </div>
      </div>
      <div className="mt-12 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <section aria-labelledby="description-heading">
          <h2 id="description-heading" className="text-lg font-semibold">
            Description
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">{product.description}</p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {product.highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2 text-sm">
                <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {highlight}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="specs-heading">
          <h2 id="specs-heading" className="text-lg font-semibold">
            Specifications
          </h2>
          <dl className="mt-3 divide-y rounded-2xl border">
            {Object.entries(product.attributes).map(([key, value]) => (
              <div key={key} className="grid grid-cols-[140px_1fr] gap-4 px-4 py-3 text-sm">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      {product.relatedAuctions.length > 0 ? (
        <section className="mt-14">
          <SectionHeader
            title="Related live auctions"
            href={`/auctions?category=${product.categorySlug}`}
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {product.relatedAuctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                serverTime={serverTime}
                signedIn={signedIn}
              />
            ))}
          </div>
        </section>
      ) : null}
      <section className="mt-14">
        <SectionHeader
          title="You may also like"
          href={`/category/${product.categorySlug}`}
          linkLabel={`More in ${product.categoryName}`}
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {product.related.map((item) => (
            <ProductCard key={item.id} product={item} signedIn={signedIn} />
          ))}
        </div>
      </section>
      <div className="mt-10 text-center">
        <Button asChild variant="link">
          <Link href="/marketplace">Back to marketplace</Link>
        </Button>
      </div>
    </Container>
  )
}
