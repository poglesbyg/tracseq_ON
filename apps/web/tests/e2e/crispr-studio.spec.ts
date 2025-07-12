import { test, expect } from '@playwright/test'

test.describe('CRISPR Studio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/crispr')
  })

  test('should load CRISPR Studio page', async ({ page }) => {
    // Check that the page loads
    await expect(page).toHaveTitle(/CRISPR Studio/)

    // Check for main CRISPR Studio component
    await expect(page.locator('[data-testid="crispr-studio"]')).toBeVisible()
  })

  test('should have navigation tabs', async ({ page }) => {
    // Check for tab navigation
    const tabs = page.locator('[role="tablist"]')
    await expect(tabs).toBeVisible()

    // Check for specific tabs
    await expect(page.locator('button[role="tab"]')).toHaveCount(5) // Design, Analysis, Batch, AI Tools, Results
  })

  test('should allow sequence input', async ({ page }) => {
    // Look for sequence input field
    const sequenceInput = page.locator(
      'textarea[placeholder*="sequence" i], input[placeholder*="sequence" i]',
    )

    if (await sequenceInput.isVisible()) {
      await sequenceInput.fill('ATCGATCGATCGATCG')
      await expect(sequenceInput).toHaveValue('ATCGATCGATCGATCG')
    }
  })

  test('should handle tab switching', async ({ page }) => {
    // Click on different tabs and verify they switch
    const designTab = page.locator('button[role="tab"]:has-text("Design")')
    const analysisTab = page.locator('button[role="tab"]:has-text("Analysis")')

    if (await designTab.isVisible()) {
      await designTab.click()
      await expect(designTab).toHaveAttribute('aria-selected', 'true')
    }

    if (await analysisTab.isVisible()) {
      await analysisTab.click()
      await expect(analysisTab).toHaveAttribute('aria-selected', 'true')
    }
  })

  test('should display 3D molecular viewer', async ({ page }) => {
    // Switch to Analysis tab if available
    const analysisTab = page.locator('button[role="tab"]:has-text("Analysis")')
    if (await analysisTab.isVisible()) {
      await analysisTab.click()

      // Check for 3D viewer canvas
      const canvas = page.locator('canvas')
      await expect(canvas).toBeVisible()
    }
  })

  test('should handle AI tools interaction', async ({ page }) => {
    // Switch to AI Tools tab if available
    const aiToolsTab = page.locator('button[role="tab"]:has-text("AI")')
    if (await aiToolsTab.isVisible()) {
      await aiToolsTab.click()

      // Check for AI tools interface
      await expect(page.locator('[data-testid="ai-tools"]')).toBeVisible()
    }
  })

  test('should be accessible', async ({ page }) => {
    // Check for proper ARIA labels and roles
    await expect(page.locator('[role="tablist"]')).toBeVisible()
    await expect(page.locator('[role="tab"]')).toHaveCount(5)

    // Check for proper heading structure
    const headings = page.locator('h1, h2, h3')
    await expect(headings.first()).toBeVisible()
  })
})
