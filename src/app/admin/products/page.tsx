import { GavelIcon, PlusIcon, SearchIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { AccessDenied, AdminPageHeader } from '@/components/admin/admin-ui'
import { ChipLink } from '@/components/common/chip-link'
import { ProductMedia } from '@/components/product/product-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { STOCK_LABELS, stockLevel } from '@/domain/inventory'
import { formatBasisPoints, formatMinor } from '@/lib/money'
import { adminAccess } from '@/server/auth/admin-access'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Products' }

const STATUS_VARIANTS = { ACTIVE: 'success', DRAFT: 'warning', ARCHIVED: 'neutral' } as const

export default async function AdminProductsPage({ searchParams }: PageProps<'/admin/products'>) {
  const access = await adminAccess('products.manage')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : ''
  const category = typeof params.category === 'string' ? params.category : ''
  const backend = getBackend()
  const rows = backend.admin.products(q || undefined, category || undefined)
  const categories = backend.admin.categories()
  return (
    <div>
      <AdminPageHeader
        title="Products"
        description={`${rows.length} products. Cost and margin are internal and never shown to customers.`}
        actions={
          <Button asChild variant="brand">
            <Link href="/admin/products/new">
              <PlusIcon /> New product
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav
          aria-label="Filter by category"
          className="-mx-1 flex scrollbar-none gap-1.5 overflow-x-auto px-1"
        >
          <ChipLink
            href={`/admin/products${q ? `?q=${encodeURIComponent(q)}` : ''}`}
            active={!category}
          >
            All
          </ChipLink>
          {categories.map((item) => (
            <ChipLink
              key={item.slug}
              href={`/admin/products?category=${item.slug}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              active={category === item.slug}
            >
              {item.name}
            </ChipLink>
          ))}
        </nav>
        <form action="/admin/products" className="relative w-full lg:w-72">
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Name, brand or SKU"
            className="pl-9"
            aria-label="Search products"
          />
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No products match" description="Try another search or category." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Reference</TH>
                  <TH className="text-right">Buy Now</TH>
                  <TH className="text-right">Cost</TH>
                  <TH className="text-right">Margin</TH>
                  <TH className="text-right">Available</TH>
                  <TH>Supplier</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map(({ product, position, supplierName, marginBps, liveAuctions }) => {
                  const level =
                    product.shippingClass === 'DIGITAL'
                      ? 'IN_STOCK'
                      : stockLevel(position.available)
                  return (
                    <TR key={product.id}>
                      <TD className="max-w-[340px]">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="flex items-center gap-3"
                        >
                          <span className="w-10 shrink-0 overflow-hidden rounded-lg">
                            <ProductMedia
                              art={product.images[0]?.art ?? 'giftcard'}
                              palette={product.palette}
                              uid={`adm-${product.id}`}
                              alt=""
                            />
                          </span>
                          <span className="min-w-0">
                            <span className="line-clamp-1 font-medium hover:underline">
                              {product.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {product.sku} · {product.brandName}
                            </span>
                          </span>
                        </Link>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={STATUS_VARIANTS[product.status]}>
                            {product.status.toLowerCase()}
                          </Badge>
                          {liveAuctions > 0 ? (
                            <Badge variant="live">
                              <GavelIcon aria-hidden /> {liveAuctions}
                            </Badge>
                          ) : null}
                        </div>
                      </TD>
                      <TD className="tabular text-right">
                        {formatMinor(product.referencePriceMinor)}
                      </TD>
                      <TD className="tabular text-right">
                        {formatMinor(product.buyNowPriceMinor)}
                      </TD>
                      <TD className="tabular text-right text-muted-foreground">
                        {formatMinor(product.costPriceMinor)}
                      </TD>
                      <TD className="tabular text-right">{formatBasisPoints(marginBps)}</TD>
                      <TD className="tabular text-right">
                        {product.shippingClass === 'DIGITAL' ? (
                          <span className="text-muted-foreground">Digital</span>
                        ) : (
                          <span
                            className={
                              level === 'OUT_OF_STOCK'
                                ? 'text-danger-foreground'
                                : level === 'LOW_STOCK'
                                  ? 'text-warning-foreground'
                                  : ''
                            }
                          >
                            {position.available}
                            <span className="sr-only"> ({STOCK_LABELS[level]})</span>
                          </span>
                        )}
                      </TD>
                      <TD className="max-w-[160px] truncate text-muted-foreground">
                        {supplierName}
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}
