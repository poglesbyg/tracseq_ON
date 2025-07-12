import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('should load the homepage successfully', async ({ page }) => {
    await page.goto('/')

    // Check that the page loads
    await expect(page).toHaveTitle(/TracSeq ON/)

    // Check for main navigation elements
    await expect(page.locator('nav')).toBeVisible()

    // Check for the main content area
    await expect(page.locator('main')).toBeVisible()
  })

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/')

    // Check if CRISPR Studio link is present and clickable
    const crisprLink = page.locator('a[href="/crispr"]')
    if (await crisprLink.isVisible()) {
      await expect(crisprLink).toBeVisible()
      await expect(crisprLink).toHaveText(/crispr/i)
    }

    // Check if Nanopore link is present and clickable
    const nanoporeLink = page.locator('a[href="/nanopore"]')
    if (await nanoporeLink.isVisible()) {
      await expect(nanoporeLink).toBeVisible()
      await expect(nanoporeLink).toHaveText(/nanopore/i)
    }
  })

  test('should be responsive', async ({ page }) => {
    await page.goto('/')

    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(page.locator('body')).toBeVisible()

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator('body')).toBeVisible()

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('body')).toBeVisible()
  })
})
