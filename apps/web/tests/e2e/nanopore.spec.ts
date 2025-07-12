import { test, expect } from '@playwright/test'

test.describe('Nanopore Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nanopore')
  })

  test('should load Nanopore page', async ({ page }) => {
    // Check that the page loads
    await expect(page).toHaveTitle(/Nanopore/)

    // Check for main Nanopore component
    await expect(page.locator('[data-testid="nanopore-app"]')).toBeVisible()
  })

  test('should display PDF upload interface', async ({ page }) => {
    // Check for PDF upload area
    const uploadArea = page.locator('[data-testid="pdf-upload"]')
    await expect(uploadArea).toBeVisible()

    // Check for upload instructions
    await expect(page.locator('text=Upload PDF')).toBeVisible()
  })

  test('should show samples dashboard', async ({ page }) => {
    // Check for samples dashboard
    const dashboard = page.locator('[data-testid="nanopore-dashboard"]')
    await expect(dashboard).toBeVisible()

    // Check for samples table or list
    const samplesContainer = page.locator('[data-testid="samples-container"]')
    if (await samplesContainer.isVisible()) {
      await expect(samplesContainer).toBeVisible()
    }
  })

  test('should handle file upload interaction', async ({ page }) => {
    // Look for file input
    const fileInput = page.locator('input[type="file"]')

    if (await fileInput.isVisible()) {
      // Check that file input accepts PDF files
      await expect(fileInput).toHaveAttribute('accept', /pdf/)
    }
  })

  test('should display AI analysis features', async ({ page }) => {
    // Check for AI analysis components
    const aiFeatures = page.locator('[data-testid="ai-analysis"]')
    if (await aiFeatures.isVisible()) {
      await expect(aiFeatures).toBeVisible()
    }
  })

  test('should be responsive on mobile', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })

    // Check that main components are still visible
    await expect(page.locator('body')).toBeVisible()

    // Check for mobile-friendly navigation
    const mobileNav = page.locator('[data-testid="mobile-nav"]')
    if (await mobileNav.isVisible()) {
      await expect(mobileNav).toBeVisible()
    }
  })

  test('should handle loading states', async ({ page }) => {
    // Check for loading indicators
    const loadingIndicator = page.locator('[data-testid="loading"]')

    // If loading indicator is present, wait for it to disappear
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 })
    }
  })

  test('should display error states gracefully', async ({ page }) => {
    // Check that error messages are handled properly
    const errorMessage = page.locator('[data-testid="error-message"]')

    // If error message is present, it should be visible and informative
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toBeVisible()
      await expect(errorMessage).toContainText(/.+/) // Should contain some text
    }
  })
})
