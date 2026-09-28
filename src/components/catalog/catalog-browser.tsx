import { SlidersHorizontalIcon, StoreIcon } from 'lucide-react'
import Link from 'next/link'

import { ChipLink } from '@/components/common/chip-link'
import { UrlSelect } from '@/components/common/url-controls'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/misc'
import { formatMinor } from '@/lib/money'
import type { ProductCard as ProductCardView } from '@/server/views'

export interface CatalogParams {
  q?: string
  category?: string
  subcategory?: string
  brand?: string[]
  min?: number
  max?: number
  availability?: 'all' | 'in-stock' | 'auction'
  sort?: string
  page?: number
}

export function parseCatalogParams(
  params: Record<string, string | string[] | undefined>,
): CatalogParams {
  const one = (key: string) =>
    typeof params[key] === 'string' ? (params[key] as string) : undefined
  const brands =
    params.brand === undefined
      ? undefined
      : Array.isArray(params.brand)
        ? params.brand
        : params.brand.split(',')
  const number = (key: string) => {
    const value = Number(one(key))
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined
  }
  const availability = one('availability')
  return {
    q: one('q')?.slice(0, 80),
    category: one('category'),
    subcategory: one('subcategory'),
    brand: brands?.filter(Boolean).slice(0, 20),
    min: number('min'),
    max: number('max'),
    availability: availability === 'in-stock' || availability === 'auction' ? availability : 'all',
    sort: one('sort'),
    page: number('page') || 1,
  }
}

interface Facets {
  brands: { slug: string; name: string; count: number }[]
  subcategories: { name: string; count: number }[]
  priceRange: { min: number; max: number }
}

export function CatalogBrowser({
  basePath,
  params,
  items,
  total,
  page,
  pageSize,
  facets,
  categories,
  signedIn,
  lockCategory,
}: {
  basePath: string
  params: CatalogParams
  items: ProductCardView[]
  total: number
  page: number
  pageSize: number
  facets: Facets
  categories: { slug: string; name: string; productCount: number }[]
  signedIn: boolean
  lockCategory?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const link = (overrides: Partial<Record<string, string | undefined>>) => {
    const search = new URLSearchParams()
    const base: Record<string, string | undefined> = {
      q: params.q,
      category: lockCategory ? undefined : params.category,
      subcategory: params.subcategory,
      brand: params.brand?.join(','),
      min: params.min?.toString(),
      max: params.max?.toString(),
      availability: params.availability === 'all' ? undefined : params.availability,
      sort: params.sort,
    }
    for (const [key, value] of Object.entries({ ...base, ...overrides }))
      if (value) search.set(key, value)
    const query = search.toString()
    return query ? `${basePath}?${query}` : basePath
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
      <aside aria-label="Filters" className="lg:sticky lg:top-24 lg:self-start">
        <details className="group rounded-2xl border bg-card lg:open:bg-card" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold lg:cursor-default">
            <span className="flex items-center gap-2">
              <SlidersHorizontalIcon className="size-4" aria-hidden /> Filters
            </span>
            <span className="text-xs font-normal text-muted-foreground lg:hidden">Show / hide</span>
          </summary>
          <form method="get" action={basePath} className="space-y-6 border-t px-4 py-4">
            {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
            {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
            {!lockCategory ? (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Category
                </legend>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="category"
                    value=""
                    defaultChecked={!params.category}
                    className="accent-[var(--brand)]"
                  />{' '}
                  All
                </label>
                {categories.map((category) => (
                  <label key={category.slug} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="category"
                      value={category.slug}
                      defaultChecked={params.category === category.slug}
                      className="accent-[var(--brand)]"
                    />
                    <span className="flex-1">{category.name}</span>
                    <span className="text-xs text-muted-foreground">{category.productCount}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            {facets.subcategories.length > 1 ? (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Type
                </legend>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="subcategory"
                    value=""
                    defaultChecked={!params.subcategory}
                    className="accent-[var(--brand)]"
                  />{' '}
                  All
                </label>
                {facets.subcategories.map((sub) => (
                  <label key={sub.name} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="subcategory"
                      value={sub.name}
                      defaultChecked={params.subcategory === sub.name}
                      className="accent-[var(--brand)]"
                    />
                    <span className="flex-1">{sub.name}</span>
                    <span className="text-xs text-muted-foreground">{sub.count}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Brand
              </legend>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {facets.brands.map((brand) => (
                  <label key={brand.slug} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="brand"
                      value={brand.slug}
                      defaultChecked={params.brand?.includes(brand.slug)}
                      className="accent-[var(--brand)]"
                    />
                    <span className="flex-1">{brand.name}</span>
                    <span className="text-xs text-muted-foreground">{brand.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Price (£)
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="price-min" className="sr-only">
                    Minimum price
                  </Label>
                  <Input
                    id="price-min"
                    name="min"
                    inputMode="numeric"
                    placeholder={`Min ${Math.floor(facets.priceRange.min / 100)}`}
                    defaultValue={params.min ?? ''}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label htmlFor="price-max" className="sr-only">
                    Maximum price
                  </Label>
                  <Input
                    id="price-max"
                    name="max"
                    inputMode="numeric"
                    placeholder={`Max ${Math.ceil(facets.priceRange.max / 100)}`}
                    defaultValue={params.max ?? ''}
                    className="h-9"
                  />
                </div>
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Availability
              </legend>
              {[
                ['all', 'All products'],
                ['in-stock', 'In stock'],
                ['auction', 'In a live auction'],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="availability"
                    value={value}
                    defaultChecked={(params.availability ?? 'all') === value}
                    className="accent-[var(--brand)]"
                  />{' '}
                  {label}
                </label>
              ))}
            </fieldset>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="flex-1">
                Apply
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={basePath}>Reset</Link>
              </Button>
            </div>
          </form>
        </details>
      </aside>
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="font-semibold text-foreground">{total}</span>{' '}
            {total === 1 ? 'product' : 'products'}
            {params.q ? ` for “${params.q}”` : ''}
            {params.min !== undefined || params.max !== undefined
              ? ` · ${params.min !== undefined ? formatMinor(params.min * 100, 'GBP', { trimZeroMinor: true }) : '£0'}–${params.max !== undefined ? formatMinor(params.max * 100, 'GBP', { trimZeroMinor: true }) : 'any'}`
              : ''}
          </p>
          <UrlSelect
            param="sort"
            label="Sort products"
            value={params.sort ?? ''}
            options={[
              { value: '', label: 'Recommended' },
              { value: 'popular', label: 'Most reviewed' },
              { value: 'rating', label: 'Top rated' },
              { value: 'price-asc', label: 'Price: low to high' },
              { value: 'price-desc', label: 'Price: high to low' },
              { value: 'savings', label: 'Biggest savings' },
              { value: 'newest', label: 'Newest' },
            ]}
          />
        </div>
        {params.brand?.length || params.subcategory ? (
          <div className="mb-5 flex flex-wrap gap-2">
            {params.subcategory ? (
              <ChipLink href={link({ subcategory: undefined })} active>
                {params.subcategory} ✕
              </ChipLink>
            ) : null}
            {params.brand?.map((brand) => (
              <ChipLink
                key={brand}
                href={link({
                  brand: params.brand!.filter((item) => item !== brand).join(',') || undefined,
                })}
                active
              >
                {facets.brands.find((item) => item.slug === brand)?.name ?? brand} ✕
              </ChipLink>
            ))}
          </div>
        ) : null}
        {items.length === 0 ? (
          <EmptyState
            icon={<StoreIcon />}
            title="No products match these filters"
            description="Try removing a filter or widening the price range."
            action={
              <Button asChild variant="outline">
                <Link href={basePath}>Clear filters</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} signedIn={signedIn} />
            ))}
          </div>
        )}
        {pages > 1 ? (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2">
            {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
              <ChipLink
                key={number}
                href={link({ page: number === 1 ? undefined : String(number) })}
                active={number === page}
              >
                {number}
              </ChipLink>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  )
}
