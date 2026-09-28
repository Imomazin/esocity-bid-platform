import { expect, test, type Page } from '@playwright/test'

import { enterDemo, findOpenAuction } from './helpers'

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

test.describe('mobile', () => {
  test('landing page fits the screen and the menu opens', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoHorizontalScroll(page)

    await expect(page.getByRole('navigation', { name: 'Mobile tabs' })).toBeVisible()
    await page.getByRole('button', { name: 'Open menu' }).click()
    const menu = page.getByRole('navigation', { name: 'Mobile primary' })
    await expect(menu).toBeVisible()
    await menu
      .getByRole('link', { name: /auctions/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/auctions/)
    await expectNoHorizontalScroll(page)
  })

  test('a member can bid from a phone without scrolling', async ({ page }) => {
    await enterDemo(page)
    const auction = await findOpenAuction(page)
    await page.goto(`/auction/${auction.id}`)
    // The main bid control starts below the gallery, so the sticky bid bar offers the action.
    const bar = page.getByTestId('mobile-bid-bar')
    const bid = bar.getByRole('button', { name: /Bid now/ })
    await expect(bid).toBeInViewport()
    await expectNoHorizontalScroll(page)
    await bid.click()
    await expect(page.getByText('You: 1 bid here')).toBeAttached()

    // Once the main control is scrolled into view, the bar steps aside.
    await page
      .getByRole('button', { name: /highest bidder|Place bid|Outbid — bid again/ })
      .scrollIntoViewIfNeeded()
    await expect(bar).toHaveAttribute('aria-hidden', 'true')
  })

  test('checkout and wallet pages fit the screen', async ({ page }) => {
    await enterDemo(page)
    for (const path of ['/wallet', '/buy-bids', '/account', '/drops', '/marketplace']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
  })
})
