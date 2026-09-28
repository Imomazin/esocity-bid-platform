import type { Metadata } from 'next'

import { AccessDenied, AdminPageHeader } from '@/components/admin/admin-ui'
import { ProductForm } from '@/components/admin/product-form'
import { adminAccess } from '@/server/auth/admin-access'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'New product' }

export default async function NewProductPage() {
  const access = await adminAccess('products.manage')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const backend = getBackend()
  const brands = backend.admin.brands().map((brand) => ({ slug: brand.slug, name: brand.name }))
  const categories = backend.admin
    .categories()
    .map((category) => ({ slug: category.slug, name: category.name }))
  const suppliers = backend.admin
    .suppliersList()
    .map((supplier) => ({ id: supplier.id, name: supplier.name }))
  return (
    <div className="max-w-4xl">
      <AdminPageHeader
        eyebrow="Products"
        title="New product"
        description="New products use a neutral placeholder illustration until imagery is supplied."
      />
      <ProductForm
        productId={null}
        brands={brands}
        categories={categories}
        suppliers={suppliers}
        initial={{
          name: '',
          brandSlug: brands[0]?.slug ?? '',
          categorySlug: categories[0]?.slug ?? '',
          subcategory: '',
          description: '',
          referencePriceMinor: 0,
          buyNowPriceMinor: 0,
          costPriceMinor: 0,
          supplierId: suppliers[0]?.id ?? '',
          condition: 'NEW',
          shippingClass: 'STANDARD',
          status: 'DRAFT',
          auctionEligible: false,
        }}
      />
    </div>
  )
}
