import { ShoppingBagIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { SignInGate } from '@/components/auth/sign-in-gate'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { Container, PageHeader } from '@/components/common/section'
import { Button } from '@/components/ui/button'
import { EmptyState, Notice } from '@/components/ui/misc'
import { DomainError } from '@/domain/errors'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'
import type { CheckoutMode } from '@/server/views'

export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } }

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function resolveMode(params: Record<string, string | string[] | undefined>): CheckoutMode {
  const order = first(params.order)
  if (order) return { kind: 'ORDER', orderId: order }
  const auction = first(params.auction)
  if (auction) return { kind: 'AUCTION_BUY_NOW', auctionId: auction }
  const drop = first(params.drop)
  if (drop) {
    const quantity = Number.parseInt(first(params.qty) ?? '1', 10)
    return {
      kind: 'DROP',
      dropId: drop,
      quantity: Number.isFinite(quantity) ? Math.min(10, Math.max(1, quantity)) : 1,
    }
  }
  return { kind: 'CART' }
}

export default async function CheckoutPage({ searchParams }: PageProps<'/checkout'>) {
  const viewer = await getViewer()
  if (!viewer) {
    return (
      <SignInGate
        title="Checkout"
        description="Enter the demo to check out with simulated payments. No card details are ever collected."
        redirectTo="/checkout"
      />
    )
  }
  const mode = resolveMode(await searchParams)
  const backend = getBackend()
  let preview
  try {
    preview = backend.previewCheckout(viewer.userId, mode, {})
  } catch (error) {
    if (!(error instanceof DomainError)) throw error
    return (
      <Container className="py-10">
        <PageHeader
          eyebrow="Checkout"
          title={error.code === 'CART_EMPTY' ? 'Your basket is empty' : 'Checkout unavailable'}
        />
        {error.code === 'CART_EMPTY' ? (
          <EmptyState
            icon={<ShoppingBagIcon />}
            title="Nothing to check out yet"
            description="Browse the marketplace for fixed-price items, or join a live auction."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="brand">
                  <Link href="/marketplace">Shop the marketplace</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/auctions">Live auctions</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <Notice tone="warning" title="We couldn’t start this checkout">
            {error.message}{' '}
            <Link href="/orders" className="font-medium underline">
              View your orders
            </Link>
          </Notice>
        )}
      </Container>
    )
  }
  const cart = mode.kind === 'CART' ? backend.cart(viewer.userId) : null
  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        eyebrow="Secure checkout · simulated payments"
        title={mode.kind === 'CART' ? 'Checkout' : preview.title}
        description="Prices include VAT. Stock is reserved when you place the order and released automatically if payment does not complete."
      />
      <CheckoutForm initial={preview} initialCart={cart} />
    </Container>
  )
}
