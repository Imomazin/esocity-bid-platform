import { GavelIcon, StarIcon } from 'lucide-react'
import Link from 'next/link'

import { PriceStack } from '@/components/commerce/price'
import { Badge } from '@/components/ui/badge'
import { STOCK_LABELS } from '@/domain/inventory'
import { cn } from '@/lib/utils'
import type { ProductCard as ProductCardView } from '@/server/views'

import { giftCardLabel, ProductMedia } from './product-art'
import { WatchButton } from './watch-button'

export function ProductCard({
  product,
  signedIn,
  className,
  reason,
}: {
  product: ProductCardView
  signedIn: boolean
  className?: string
  reason?: string
}) {
  return (
    <article className={cn('group relative flex flex-col', className)}>
      <Link
        href={`/product/${product.slug}`}
        className="block overflow-hidden rounded-2xl border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ProductMedia
          art={product.art}
          palette={product.palette}
          uid={product.slug}
          label={giftCardLabel(product.name)}
          alt={product.name}
          className="transition duration-500 group-hover:scale-[1.03]"
        />
      </Link>
      <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5">
        {product.liveAuction?.status === 'LIVE' ? (
          <Badge variant="live" className="shadow-card">
            <GavelIcon aria-hidden />
            In live auction
          </Badge>
        ) : null}
        {product.stockLevel !== 'IN_STOCK' ? (
          <Badge
            variant={product.stockLevel === 'OUT_OF_STOCK' ? 'danger' : 'warning'}
            className="shadow-card"
          >
            {STOCK_LABELS[product.stockLevel]}
          </Badge>
        ) : null}
      </div>
      <WatchButton
        type="PRODUCT"
        targetId={product.id}
        initialWatched={product.watched}
        signedIn={signedIn}
        className="absolute top-3 right-3"
      />
      <div className="mt-3 flex flex-1 flex-col gap-1">
        <p className="text-xs text-muted-foreground">{product.brandName}</p>
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">
          <Link href={`/product/${product.slug}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <PriceStack
          priceMinor={product.buyNowPriceMinor}
          referenceMinor={product.referencePriceMinor}
          size="sm"
        />
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <StarIcon className="size-3.5 fill-warning text-warning" aria-hidden />
          <span className="font-medium text-foreground">{product.rating.toFixed(1)}</span>
          <span>({product.reviewCount.toLocaleString('en-GB')})</span>
        </div>
        {reason ? <p className="text-[11px] text-brand">{reason}</p> : null}
      </div>
    </article>
  )
}
