import { ArrowLeftIcon, ArrowUpRightIcon, GavelIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AccessDenied, AdminPageHeader } from '@/components/admin/admin-ui'
import { ProductForm } from '@/components/admin/product-form'
import { Button } from '@/components/ui/button'
import { adminAccess } from '@/server/auth/admin-access'
import { hasPermission } from '@/server/auth/roles'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Edit product' }

export default async function EditProductPage({ params }: PageProps<'/admin/products/[id]'>) {
  const access = await adminAccess('products.manage')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const { id } = await params
  const backend = getBackend()
  const product = backend.admin.product(id)
  if (!product) notFound()
  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/products"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Products
      </Link>
      <AdminPageHeader
        title={product.name}
        description={`${product.sku} · Price changes are recorded in the audit log.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/product/${product.slug}`}>
                Storefront <ArrowUpRightIcon />
              </Link>
            </Button>
            {product.auctionEligible &&
            product.status === 'ACTIVE' &&
            hasPermission(access.actor.roles, 'auctions.manage') ? (
              <Button asChild variant="brand">
                <Link href={`/admin/auctions/new?product=${product.id}`}>
                  <GavelIcon /> Create auction
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <ProductForm
        productId={product.id}
        brands={backend.admin.brands().map((brand) => ({ slug: brand.slug, name: brand.name }))}
        categories={backend.admin
          .categories()
          .map((category) => ({ slug: category.slug, name: category.name }))}
        suppliers={backend.admin
          .suppliersList()
          .map((supplier) => ({ id: supplier.id, name: supplier.name }))}
        initial={{
          name: product.name,
          brandSlug: product.brandSlug,
          categorySlug: product.categorySlug,
          subcategory: product.subcategory,
          description: product.description,
          referencePriceMinor: product.referencePriceMinor,
          buyNowPriceMinor: product.buyNowPriceMinor,
          costPriceMinor: product.costPriceMinor,
          supplierId: product.supplierId,
          condition: product.condition,
          shippingClass: product.shippingClass,
          status: product.status,
          auctionEligible: product.auctionEligible,
        }}
      />
    </div>
  )
}
