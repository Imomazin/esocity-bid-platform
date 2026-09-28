/** Catalogue domain types. */

export type ProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
export type ProductCondition = 'NEW' | 'REFURBISHED' | 'OPEN_BOX'
export type ShippingClass = 'DIGITAL' | 'SMALL' | 'STANDARD' | 'LARGE'

/** Illustration keys for the generated, licence-free product artwork used in demo mode. */
export type ArtKey =
  | 'phone'
  | 'headphones'
  | 'earbuds'
  | 'tv'
  | 'laptop'
  | 'tablet'
  | 'camera'
  | 'console'
  | 'handheld'
  | 'controller'
  | 'vr'
  | 'vacuum'
  | 'robot'
  | 'thermostat'
  | 'lamp'
  | 'coffee'
  | 'kettle'
  | 'airfryer'
  | 'mixer'
  | 'blender'
  | 'fragrance'
  | 'skincare'
  | 'hairdryer'
  | 'sneaker'
  | 'bag'
  | 'jacket'
  | 'sunglasses'
  | 'smartwatch'
  | 'watch'
  | 'tracker'
  | 'bike'
  | 'dumbbell'
  | 'massager'
  | 'luggage'
  | 'powerbank'
  | 'giftcard'
  | 'dashcam'
  | 'evcharger'
  | 'inflator'
  | 'drone'
  | 'scooter'
  | 'candle'
  | 'speaker'

export interface ArtPalette {
  /** Main body colour. */
  body: string
  /** Darker shade used for depth. */
  shade: string
  /** Highlight / trim colour. */
  accent: string
  /** Soft backdrop tint. */
  backdrop: string
}

export interface ProductImage {
  /** Remote/CDN URL when real photography is available (replaceable via STORAGE_PROVIDER). */
  url?: string
  alt: string
  /** Generated artwork fallback. */
  art: ArtKey
  /** Visual variant (0 = hero, 1 = detail, 2 = lifestyle). */
  variant: number
}

export interface Product {
  id: string
  slug: string
  sku: string
  name: string
  brandSlug: string
  brandName: string
  description: string
  highlights: string[]
  categorySlug: string
  subcategory: string
  images: ProductImage[]
  palette: ArtPalette
  colourway: string
  currency: 'GBP'
  referencePriceMinor: number
  buyNowPriceMinor: number
  /** Admin-only. Never sent to customers. */
  costPriceMinor: number
  supplierId: string
  condition: ProductCondition
  shippingClass: ShippingClass
  attributes: Record<string, string>
  status: ProductStatus
  auctionEligible: boolean
  tags: string[]
  popularity: number
  rating: number
  reviewCount: number
  createdAt: number
  updatedAt: number
}

/** Customer-safe projection: strips cost and supplier information. */
export type PublicProduct = Omit<Product, 'costPriceMinor' | 'supplierId'>

export function toPublicProduct(product: Product): PublicProduct {
  const { costPriceMinor: _cost, supplierId: _supplier, ...rest } = product
  return rest
}

export interface Category {
  slug: string
  name: string
  description: string
  subcategories: string[]
  icon: string
  tone: string
}

export interface Brand {
  slug: string
  name: string
  description: string
  origin: string
}

export type SupplierStatus = 'ACTIVE' | 'ONBOARDING' | 'ON_HOLD'

export interface SupplierContact {
  name: string
  role: string
  email: string
  phone: string
}

export interface Supplier {
  id: string
  name: string
  code: string
  status: SupplierStatus
  country: string
  leadTimeDays: number
  categories: string[]
  contacts: SupplierContact[]
  onTimeRateBps: number
  fillRateBps: number
  defectRateBps: number
  paymentTermsDays: number
  notes: string
}

export type PurchaseOrderStatus =
  'DRAFT' | 'SENT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseOrder {
  id: string
  reference: string
  supplierId: string
  status: PurchaseOrderStatus
  lines: { productId: string; quantity: number; unitCostMinor: number }[]
  createdAt: number
  expectedAt: number
  receivedAt: number | null
}
