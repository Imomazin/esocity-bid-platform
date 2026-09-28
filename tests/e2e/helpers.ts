import { expect, type APIRequestContext, type Page } from '@playwright/test'

interface Envelope<T> {
  ok: boolean
  data: T
  error?: { code: string; message: string }
}

export async function getData<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(path)
  expect(response.ok(), `GET ${path} → ${response.status()}`).toBeTruthy()
  const body = (await response.json()) as Envelope<T>
  expect(body.ok).toBe(true)
  return body.data
}

/** Starts a sandboxed demo session. The cookie is shared with the page's browser context. */
export async function enterDemo(page: Page): Promise<void> {
  const response = await page.request.post('/api/demo/session', { data: {} })
  expect(response.ok()).toBeTruthy()
}

export async function walletAvailable(page: Page): Promise<number> {
  const data = await getData<{ summary: { available: number } }>(page.request, '/api/wallet')
  return data.summary.available
}

interface AuctionListItem {
  id: string
  status: string
  closeAt: number
  rules: {
    minimumTier: string | null
    maxPreviousWins: number | null
    bidCreditCost: number
    perUserBidLimit: number | null
  }
}

/** A live auction any demo member may bid in, with at least a minute left on the clock. */
export async function findOpenAuction(page: Page): Promise<AuctionListItem> {
  const data = await getData<{ serverTime: number; auctions: AuctionListItem[] }>(
    page.request,
    '/api/auctions?status=live&limit=100',
  )
  const auction = data.auctions.find(
    (item) =>
      item.status === 'LIVE' &&
      item.rules.minimumTier === null &&
      item.rules.maxPreviousWins === null &&
      item.rules.perUserBidLimit === null &&
      item.closeAt - data.serverTime > 60_000,
  )
  expect(auction, 'an open live auction').toBeDefined()
  return auction!
}

/** An in-stock marketplace product that ships physically. */
export async function findInStockProduct(page: Page): Promise<{ slug: string; name: string }> {
  const data = await getData<{
    items: { slug: string; name: string; available: number; shippingClass: string }[]
  }>(
    page.request,
    '/api/products?availability=in-stock&sort=price-asc&pageSize=20&category=kitchen',
  )
  const product = data.items.find((item) => item.available > 2 && item.shippingClass !== 'DIGITAL')
  expect(product, 'an in-stock product').toBeDefined()
  return product!
}
