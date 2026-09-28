'use client'

import { Loader2Icon, SaveIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type * as React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldHint, Input, Label, NativeSelect, Textarea } from '@/components/ui/input'
import { Notice } from '@/components/ui/misc'
import { Switch } from '@/components/ui/switch'
import { api, ApiError } from '@/lib/client/api'
import { minorToInput, parsePoundsInput, parseWholeInput } from '@/lib/client/money-input'
import { formatBasisPoints } from '@/lib/money'

export interface ProductFormValues {
  name: string
  brandSlug: string
  categorySlug: string
  subcategory: string
  description: string
  referencePriceMinor: number
  buyNowPriceMinor: number
  costPriceMinor: number
  supplierId: string
  condition: 'NEW' | 'REFURBISHED' | 'OPEN_BOX'
  shippingClass: 'DIGITAL' | 'SMALL' | 'STANDARD' | 'LARGE'
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  auctionEligible: boolean
}

export function ProductForm({
  productId,
  initial,
  brands,
  categories,
  suppliers,
}: {
  productId: string | null
  initial: ProductFormValues
  brands: { slug: string; name: string }[]
  categories: { slug: string; name: string }[]
  suppliers: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [values, setValues] = useState({
    ...initial,
    reference: minorToInput(initial.referencePriceMinor),
    buyNow: minorToInput(initial.buyNowPriceMinor),
    cost: minorToInput(initial.costPriceMinor),
    initialStock: '',
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((current) => ({ ...current, [key]: value }))
  const text = (
    key: 'name' | 'subcategory' | 'description' | 'reference' | 'buyNow' | 'cost' | 'initialStock',
  ) => ({
    id: `product-${key}`,
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, event.target.value),
  })

  const buyNow = parsePoundsInput(values.buyNow)
  const cost = parsePoundsInput(values.cost)
  const margin =
    typeof buyNow === 'number' && typeof cost === 'number' && buyNow > 0
      ? Math.round(((buyNow - cost) * 10_000) / buyNow)
      : null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const reference = parsePoundsInput(values.reference)
    const stock = parseWholeInput(values.initialStock)
    if (typeof reference !== 'number' || typeof buyNow !== 'number' || typeof cost !== 'number') {
      setError('Enter reference, Buy Now and cost prices as amounts, e.g. 129.99.')
      return
    }
    if (stock === 'invalid') {
      setError('Initial stock must be a whole number.')
      return
    }
    setPending(true)
    try {
      const body = {
        name: values.name,
        brandSlug: values.brandSlug,
        categorySlug: values.categorySlug,
        subcategory: values.subcategory,
        description: values.description,
        referencePriceMinor: reference,
        buyNowPriceMinor: buyNow,
        costPriceMinor: cost,
        supplierId: values.supplierId,
        condition: values.condition,
        shippingClass: values.shippingClass,
        status: values.status,
        auctionEligible: values.auctionEligible,
        ...(productId === null && stock ? { initialStock: stock } : {}),
      }
      const result = productId
        ? await api<{ id: string }>(`/api/admin/products/${productId}`, { method: 'PATCH', body })
        : await api<{ id: string }>('/api/admin/products', { body })
      toast.success(productId ? 'Product updated' : 'Product created')
      if (productId) router.refresh()
      else router.push(`/admin/products/${result.id}`)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The product could not be saved.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5"
      aria-label={productId ? 'Edit product' : 'New product'}
    >
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="product-name">Name</Label>
            <Input {...text('name')} required minLength={3} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-brand">Brand</Label>
            <NativeSelect
              id="product-brand"
              value={values.brandSlug}
              onChange={(event) => set('brandSlug', event.target.value)}
            >
              {brands.map((brand) => (
                <option key={brand.slug} value={brand.slug}>
                  {brand.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-supplier">Supplier</Label>
            <NativeSelect
              id="product-supplier"
              value={values.supplierId}
              onChange={(event) => set('supplierId', event.target.value)}
            >
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-category">Category</Label>
            <NativeSelect
              id="product-category"
              value={values.categorySlug}
              onChange={(event) => set('categorySlug', event.target.value)}
            >
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-subcategory">Subcategory</Label>
            <Input {...text('subcategory')} required minLength={2} maxLength={60} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="product-description">Description</Label>
            <Textarea {...text('description')} rows={4} required minLength={20} maxLength={2000} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing & fulfilment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="product-reference">Reference price (£)</Label>
            <Input {...text('reference')} inputMode="decimal" required />
            <FieldHint>Genuine comparison price shown to customers.</FieldHint>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-buyNow">Buy Now price (£)</Label>
            <Input {...text('buyNow')} inputMode="decimal" required />
            <FieldHint>Cannot exceed the reference price.</FieldHint>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-cost">Unit cost (£)</Label>
            <Input {...text('cost')} inputMode="decimal" required />
            <FieldHint>
              Internal only. Margin: {margin === null ? '—' : formatBasisPoints(margin)}
            </FieldHint>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-condition">Condition</Label>
            <NativeSelect
              id="product-condition"
              value={values.condition}
              onChange={(event) =>
                set('condition', event.target.value as ProductFormValues['condition'])
              }
            >
              <option value="NEW">New</option>
              <option value="REFURBISHED">Refurbished</option>
              <option value="OPEN_BOX">Open box</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-shipping">Shipping class</Label>
            <NativeSelect
              id="product-shipping"
              value={values.shippingClass}
              onChange={(event) =>
                set('shippingClass', event.target.value as ProductFormValues['shippingClass'])
              }
            >
              <option value="DIGITAL">Digital</option>
              <option value="SMALL">Small parcel</option>
              <option value="STANDARD">Standard parcel</option>
              <option value="LARGE">Large item</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-status">Status</Label>
            <NativeSelect
              id="product-status"
              value={values.status}
              onChange={(event) => set('status', event.target.value as ProductFormValues['status'])}
            >
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </NativeSelect>
          </div>
          {productId === null ? (
            <div className="space-y-1.5">
              <Label htmlFor="product-initialStock">Initial stock (units)</Label>
              <Input {...text('initialStock')} inputMode="numeric" placeholder="0" />
              <FieldHint>Recorded as a RECEIVED inventory ledger event.</FieldHint>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3 sm:col-span-2">
            <span id="product-auction-label" className="text-sm">
              <span className="font-medium">Auction eligible</span>
              <span className="block text-xs text-muted-foreground">
                Allow merchandisers to run auctions for this product.
              </span>
            </span>
            <Switch
              checked={values.auctionEligible}
              onCheckedChange={(checked) => set('auctionEligible', checked)}
              aria-labelledby="product-auction-label"
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Notice tone="danger" title="Not saved">
          {error}
        </Notice>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          {productId ? 'Save product' : 'Create product'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
