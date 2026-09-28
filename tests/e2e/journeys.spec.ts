import { expect, test } from '@playwright/test'

import { enterDemo, findInStockProduct, findOpenAuction, getData, walletAvailable } from './helpers'

test.describe('visitor', () => {
  test('browses the landing page, live auctions and marketplace without signing in', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ESOCITY')
    await expect(
      page.getByRole('main').getByText('The Intelligent Live Marketplace.'),
    ).toBeVisible()

    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: /auctions/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/auctions/)
    await expect(page.locator('a[href^="/auction/"]').first()).toBeVisible()

    await page.goto('/marketplace')
    await expect(page.locator('a[href^="/product/"]').first()).toBeVisible()
  })

  test('sees the demo prompt instead of a bid button on a live auction', async ({ page }) => {
    const auction = await findOpenAuction(page)
    await page.goto(`/auction/${auction.id}`)
    await expect(page.getByRole('button', { name: 'Enter demo to bid' })).toBeVisible()
    await expect(page.getByText(/simulated/i).first()).toBeVisible()
  })

  test('gets a friendly 404 for unknown pages', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('demo member', () => {
  test('enters the demo and places a server-authoritative bid', async ({ page }) => {
    const auction = await findOpenAuction(page)
    await page.goto(`/auction/${auction.id}`)
    await page.getByRole('button', { name: 'Enter demo to bid' }).click()

    const bidButton = page.getByRole('button', { name: /Place bid|Outbid — bid again/ })
    await expect(bidButton).toBeVisible()
    const before = await walletAvailable(page)
    await bidButton.click()

    // The engine accepted the bid: the wallet ledger was debited exactly once.
    await expect.poll(() => walletAvailable(page)).toBe(before - auction.rules.bidCreditCost)
    await expect(page.getByText('You: 1 bid here')).toBeVisible()
  })

  test('cannot double-spend with a retried bid request (idempotency)', async ({ page }) => {
    await enterDemo(page)
    const auction = await findOpenAuction(page)
    const before = await walletAvailable(page)
    const headers = { 'Idempotency-Key': `e2e-${Date.now()}-retry` }
    const first = await page.request.post(`/api/auctions/${auction.id}/bid`, { headers, data: {} })
    const retry = await page.request.post(`/api/auctions/${auction.id}/bid`, { headers, data: {} })
    expect(first.status()).toBe(200)
    expect(retry.status()).toBe(200)
    expect(retry.headers()['idempotent-replayed']).toBe('true')
    expect((await retry.json()).data.sequence).toBe((await first.json()).data.sequence)
    expect(await walletAvailable(page)).toBe(before - auction.rules.bidCreditCost)
  })

  test('buys a product through the simulated checkout', async ({ page }) => {
    await enterDemo(page)
    const product = await findInStockProduct(page)
    await page.goto('/marketplace?category=kitchen&availability=in-stock&sort=price-asc')
    await page.locator(`a[href="/product/${product.slug}"]`).first().click()
    await expect(page).toHaveURL(new RegExp(`/product/${product.slug}`))
    await page.getByRole('button', { name: 'Add to basket' }).click()
    await expect(page.getByRole('link', { name: /Basket, \d+ items?/ })).toBeVisible()

    await page.goto('/checkout')
    await expect(page.getByRole('group', { name: `Quantity for ${product.name}` })).toBeVisible()
    await expect(page.getByText(/never collects or stores raw card details/)).toBeVisible()
    await page.getByTestId('place-order').click()

    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+\?placed=1/)
    await expect(page.getByText('Thank you — your order is confirmed')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/^ESB-/)
  })

  test('buys a bid pack and sees the credits in the Bid Wallet', async ({ page }) => {
    await enterDemo(page)
    const before = await walletAvailable(page)
    await page.goto('/buy-bids')
    await page.locator('input[name="pack"][value="starter"]').check({ force: true })
    await page.getByRole('button', { name: 'Buy Starter pack' }).click()
    await expect.poll(() => walletAvailable(page)).toBe(before + 50)
    await page.goto('/wallet')
    await expect(page.getByTestId('wallet-available')).toContainText(String(before + 50))
  })

  test('a self-imposed break stops bidding immediately', async ({ page }) => {
    await enterDemo(page)
    const auction = await findOpenAuction(page)
    const update = await page.request.put('/api/account/limits', { data: { coolOffDays: 1 } })
    expect(update.ok()).toBeTruthy()
    const bid = await page.request.post(`/api/auctions/${auction.id}/bid`, {
      headers: { 'Idempotency-Key': `e2e-${Date.now()}-cooloff` },
      data: {},
    })
    expect(bid.status()).toBe(403)
    expect((await bid.json()).error.code).toBe('RESPONSIBLE_USE_LIMIT')

    // A break cannot be shortened by removing it.
    await page.request.put('/api/account/limits', { data: { coolOffDays: null } })
    const limits = await getData<{ limits: { coolOffUntil: number | null } }>(
      page.request,
      '/api/account/limits',
    )
    expect(limits.limits.coolOffUntil).not.toBeNull()
  })
})

test.describe('compliance', () => {
  test('a member sees their acceptance of the current terms', async ({ page }) => {
    await enterDemo(page)
    const status = await getData<{ currentVersion: string; upToDate: boolean }>(
      page.request,
      '/api/account/terms',
    )
    expect(status.upToDate).toBe(true)
    await page.goto('/terms')
    await expect(page.getByText('You have accepted these terms')).toBeVisible()
    await expect(page.getByText(`Version ${status.currentVersion}`)).toBeVisible()
  })
})

test.describe('operations console', () => {
  test('shows the dashboard and enforces role permissions on the server', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const switched = page.waitForResponse(
      (response) => response.url().endsWith('/api/admin/role') && response.ok(),
    )
    await page.getByLabel('Demo operator role').selectOption('SUPPORT_AGENT')
    await switched
    await page.goto('/admin/payments')
    await expect(page.getByText('You don’t have access to this area')).toBeVisible()

    // The API enforces the same permission model: support agents cannot read analytics.
    const dashboard = await page.request.get('/api/admin/dashboard')
    expect(dashboard.status()).toBe(403)
  })
})

test.describe('platform security', () => {
  test('sends security headers and a nonce-based CSP', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response!.headers()
    expect(headers['content-security-policy']).toMatch(/script-src[^;]*'nonce-/)
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  test('rejects cross-site API mutations', async ({ page }) => {
    const response = await page.request.post('/api/demo/session', {
      headers: { Origin: 'https://attacker.example' },
      data: {},
    })
    expect(response.status()).toBe(403)
    expect((await response.json()).error.code).toBe('CSRF_REJECTED')
  })

  test('reports health without exposing configuration secrets', async ({ page }) => {
    const response = await page.request.get('/api/health')
    expect(response.ok()).toBeTruthy()
    const text = await response.text()
    expect(text).not.toMatch(/sk_(live|test)_|postgres(ql)?:\/\/|AUTH_SECRET=/)
  })
})
