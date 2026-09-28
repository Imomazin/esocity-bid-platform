import { expect, test, type Page } from '@playwright/test'

import { getData, walletAvailable } from './helpers'

interface AuctionItem {
  id: string
  title: string
  status: string
  startsAt: number
  closeAt: number
  bidCount: number
  result: { finalPriceMinor: number } | null
  rules: {
    minimumTier: string | null
    maxPreviousWins: number | null
    perUserBidLimit: number | null
    bidCreditCost: number
    buyNowEnabled: boolean
  }
}

/**
 * The busiest open auction still in its opening phase. Simulated bidders always follow a bid in
 * the opening phase (the closing phase may end instead), so "get outbid" happens within seconds.
 */
async function busiestOpenAuction(page: Page): Promise<AuctionItem> {
  const data = await getData<{ serverTime: number; auctions: AuctionItem[] }>(
    page.request,
    '/api/auctions?status=live&limit=100',
  )
  const candidates = data.auctions.filter(
    (item) =>
      item.status === 'LIVE' &&
      item.closeAt - data.serverTime > 3 * 60_000 &&
      item.rules.minimumTier === null &&
      item.rules.maxPreviousWins === null &&
      item.rules.perUserBidLimit === null &&
      item.rules.buyNowEnabled,
  )
  const rate = (item: AuctionItem) => item.bidCount / Math.max(1, data.serverTime - item.startsAt)
  const auction = candidates.sort((a, b) => rate(b) - rate(a))[0]
  expect(auction, 'a busy live auction in its opening phase').toBeDefined()
  return auction!
}

async function rewardsBalance(page: Page): Promise<number> {
  return (await getData<{ balance: number }>(page.request, '/api/rewards')).balance
}

test('core journey: explore, bid, get outbid, bid again, watch, see an outcome, Buy Now, order, rewards', async ({
  page,
}) => {
  test.setTimeout(240_000)

  await test.step('visitor lands and explores live auctions', async () => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ESOCITY')
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: /auctions/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/auctions/)
    await expect(page.locator('a[href^="/auction/"]').first()).toBeVisible()
  })

  const auction = await busiestOpenAuction(page)
  const cost = auction.rules.bidCreditCost

  await test.step('opens the auction and enters the demo platform', async () => {
    await page.goto(`/auction/${auction.id}`)
    await page.getByRole('button', { name: 'Enter demo to bid' }).click()
    await expect(page.getByRole('button', { name: /Place bid/ })).toBeVisible()
  })

  const walletStart = await walletAvailable(page)
  expect(walletStart, 'a demo Bid Wallet was issued').toBeGreaterThan(0)

  await test.step('bids', async () => {
    await page.getByRole('button', { name: /Place bid/ }).click()
    await expect.poll(() => walletAvailable(page)).toBe(walletStart - cost)
  })

  await test.step('is outbid by a simulated bidder and bids again', async () => {
    const again = page.getByRole('button', { name: /Outbid — bid again/ })
    await expect(again).toBeVisible({ timeout: 120_000 })
    await again.click()
    await expect.poll(() => walletAvailable(page)).toBe(walletStart - 2 * cost)
    await expect(page.getByText('You: 2 bids here')).toBeVisible()
  })

  await test.step('watches the auction', async () => {
    await page.getByRole('button', { name: 'Add to watchlist' }).first().click()
    await expect(page.getByRole('button', { name: 'Remove from watchlist' }).first()).toBeVisible()
    await page.goto('/watchlist')
    await expect(page.locator(`a[href="/auction/${auction.id}"]`).first()).toBeVisible()
  })

  await test.step('sees how a finished auction resolved', async () => {
    const completed = await getData<{ auctions: AuctionItem[] }>(
      page.request,
      '/api/auctions?status=completed&limit=20',
    )
    const finished = completed.auctions.find((item) => item.result !== null)
    expect(finished, 'a completed auction with a result').toBeDefined()
    await page.goto(`/auction/${finished!.id}`)
    await expect(page.getByText('Final price').first()).toBeVisible()
  })

  const pointsBefore = await rewardsBalance(page)

  await test.step('takes the Buy Now alternative and pays through the simulated checkout', async () => {
    await page.goto(`/auction/${auction.id}`)
    await page.getByRole('link', { name: 'Buy now' }).first().click()
    await expect(page).toHaveURL(new RegExp(`/checkout\\?auction=${auction.id}`))
    await page.getByTestId('place-order').click()
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+\?placed=1/)
    await expect(page.getByText('Thank you — your order is confirmed')).toBeVisible()
  })

  await test.step('earns Esocity Rewards points for the purchase', async () => {
    await expect.poll(() => rewardsBalance(page)).toBeGreaterThan(pointsBefore)
    await page.goto('/rewards')
    await expect(page.getByTestId('rewards-balance')).toBeVisible()
    await expect(page.getByText(/^Order ESB-/).first()).toBeVisible()
  })
})
