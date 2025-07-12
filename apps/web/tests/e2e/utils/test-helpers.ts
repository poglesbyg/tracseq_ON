import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Wait for the page to be fully loaded with all network requests completed
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle')
}

/**
 * Check if an element exists without throwing an error
 */
export async function elementExists(
  page: Page,
  selector: string,
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 1000 })
    return true
  } catch {
    return false
  }
}

/**
 * Wait for and click an element if it exists
 */
export async function clickIfExists(
  page: Page,
  selector: string,
): Promise<boolean> {
  if (await elementExists(page, selector)) {
    await page.click(selector)
    return true
  }
  return false
}

/**
 * Fill input field if it exists
 */
export async function fillIfExists(
  page: Page,
  selector: string,
  value: string,
): Promise<boolean> {
  if (await elementExists(page, selector)) {
    await page.fill(selector, value)
    return true
  }
  return false
}

/**
 * Wait for API requests to complete
 */
export async function waitForApiRequests(page: Page) {
  await page.waitForLoadState('networkidle')
  // Wait a bit more for any async operations
  await page.waitForTimeout(500)
}

/**
 * Check if the page contains any error messages
 */
export async function hasErrorMessages(page: Page): Promise<boolean> {
  const errorSelectors = [
    '[data-testid="error-message"]',
    '.error',
    '[role="alert"]',
    '.alert-error',
    '.text-red-500',
    '.text-destructive',
  ]

  for (const selector of errorSelectors) {
    if (await elementExists(page, selector)) {
      return true
    }
  }
  return false
}

/**
 * Wait for loading indicators to disappear
 */
export async function waitForLoadingToComplete(page: Page) {
  const loadingSelectors = [
    '[data-testid="loading"]',
    '.loading',
    '.spinner',
    '[aria-label="Loading"]',
  ]

  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { state: 'hidden', timeout: 10000 })
    } catch {
      // Continue if selector doesn't exist
    }
  }
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/${name}-${Date.now()}.png` })
}

/**
 * Check for accessibility violations (basic checks)
 */
export async function checkBasicAccessibility(page: Page) {
  // Check for proper heading structure
  const headings = page.locator('h1, h2, h3, h4, h5, h6')
  if ((await headings.count()) > 0) {
    await expect(headings.first()).toBeVisible()
  }

  // Check for alt text on images
  const images = page.locator('img')
  const imageCount = await images.count()

  for (let i = 0; i < imageCount; i++) {
    const img = images.nth(i)
    if (await img.isVisible()) {
      await expect(img).toHaveAttribute('alt')
    }
  }

  // Check for proper form labels
  const inputs = page.locator(
    'input[type="text"], input[type="email"], input[type="password"], textarea',
  )
  const inputCount = await inputs.count()

  for (let i = 0; i < inputCount; i++) {
    const input = inputs.nth(i)
    if (await input.isVisible()) {
      // Should have either a label, aria-label, or aria-labelledby
      const hasLabel = await input.evaluate((el) => {
        const id = el.getAttribute('id')
        const hasAriaLabel = el.getAttribute('aria-label')
        const hasAriaLabelledBy = el.getAttribute('aria-labelledby')
        const hasAssociatedLabel = id
          ? document.querySelector(`label[for="${id}"]`)
          : null

        return hasAriaLabel || hasAriaLabelledBy || hasAssociatedLabel
      })

      expect(hasLabel).toBeTruthy()
    }
  }
}

/**
 * Mock API responses for testing
 */
export async function mockApiResponse(page: Page, url: string, response: any) {
  await page.route(url, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
}

/**
 * Test responsive design at different breakpoints
 */
export async function testResponsiveDesign(page: Page) {
  const viewports = [
    { width: 375, height: 667, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1280, height: 720, name: 'desktop' },
    { width: 1920, height: 1080, name: 'large-desktop' },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    })
    await waitForPageLoad(page)

    // Check that the page is still functional
    await expect(page.locator('body')).toBeVisible()

    // Take screenshot for visual comparison
    void takeScreenshot(page, `responsive-${viewport.name}`)
  }
}
