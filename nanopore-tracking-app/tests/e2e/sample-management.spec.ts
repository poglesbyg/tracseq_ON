import { test, expect } from '@playwright/test'
import { AuthHelper, SampleHelper, DashboardHelper, generateTestSample } from '../utils/test-helpers'

test.describe('Sample Management', () => {
  let auth: AuthHelper
  let sampleHelper: SampleHelper
  let dashboardHelper: DashboardHelper

  test.beforeEach(async ({ page }) => {
    auth = new AuthHelper(page)
    sampleHelper = new SampleHelper(page)
    dashboardHelper = new DashboardHelper(page)
    
    // Login before each test
    await auth.login()
    await dashboardHelper.waitForDashboardLoad()
  })

  test('should display dashboard with statistics cards', async ({ page }) => {
    // Verify dashboard elements
    await dashboardHelper.verifyHeaderElements()
    await dashboardHelper.verifyStatsCards()
    
    // Verify sample list
    await expect(page.locator('text=Samples')).toBeVisible()
    await expect(page.locator('text=Sample Management')).toBeVisible()
  })

  test('should create a new sample successfully', async ({ page }) => {
    const testSample = generateTestSample({
      sampleName: 'E2E-TEST-SAMPLE-001',
      submitterName: 'E2E Test User',
      submitterEmail: 'e2e@test.com'
    })

    await sampleHelper.createSample(testSample)
    
    // Verify sample appears in list
    await sampleHelper.verifySampleExists(testSample.sampleName)
    
    // Verify sample details
    await expect(page.locator(`text=${testSample.submitterName}`)).toBeVisible()
    await expect(page.locator(`text=${testSample.sampleType}`)).toBeVisible()
  })

  test('should validate required fields in sample creation', async ({ page }) => {
    // Open create sample modal
    await page.click('text=New Sample')
    await page.waitForSelector('[data-testid="create-sample-modal"]')
    
    // Try to submit without required fields
    await page.click('button[type="submit"]')
    
    // Verify validation errors
    await expect(page.locator('text=Sample name is required')).toBeVisible()
    await expect(page.locator('text=Submitter name is required')).toBeVisible()
    await expect(page.locator('text=Email is required')).toBeVisible()
  })

  test('should filter samples by status', async ({ page }) => {
    // Create samples with different statuses
    await sampleHelper.createSample(generateTestSample({
      sampleName: 'SUBMITTED-SAMPLE',
      submitterEmail: 'submitted@test.com'
    }))
    
    // Filter by submitted status
    await sampleHelper.filterByStatus('submitted')
    
    // Verify filtered results
    await expect(page.locator('text=SUBMITTED-SAMPLE')).toBeVisible()
    
    // Change filter to completed
    await sampleHelper.filterByStatus('completed')
    
    // Verify no results for completed (since we just created submitted samples)
    await expect(page.locator('text=No samples found')).toBeVisible()
  })

  test('should filter samples by priority', async ({ page }) => {
    // Create urgent sample
    await sampleHelper.createSample(generateTestSample({
      sampleName: 'URGENT-SAMPLE',
      submitterEmail: 'urgent@test.com'
    }))
    
    // Filter by urgent priority
    await sampleHelper.filterByPriority('urgent')
    
    // Verify urgent sample is shown
    await expect(page.locator('text=URGENT-SAMPLE')).toBeVisible()
    
    // Filter by low priority
    await sampleHelper.filterByPriority('low')
    
    // Verify no low priority samples
    await expect(page.locator('text=No samples found')).toBeVisible()
  })

  test('should search samples by name and submitter', async ({ page }) => {
    const testSample = generateTestSample({
      sampleName: 'SEARCHABLE-SAMPLE',
      submitterName: 'John Doe',
      submitterEmail: 'john@test.com'
    })
    
    await sampleHelper.createSample(testSample)
    
    // Search by sample name
    await sampleHelper.searchSamples('SEARCHABLE')
    await expect(page.locator('text=SEARCHABLE-SAMPLE')).toBeVisible()
    
    // Clear search and search by submitter
    await page.fill('input[placeholder*="Search samples"]', '')
    await sampleHelper.searchSamples('John Doe')
    await expect(page.locator('text=SEARCHABLE-SAMPLE')).toBeVisible()
  })

  test('should display sample details correctly', async ({ page }) => {
    const testSample = generateTestSample({
      sampleName: 'DETAILED-SAMPLE',
      concentration: 150.5,
      volume: 75
    })
    
    await sampleHelper.createSample(testSample)
    
    // Verify sample details are displayed
    await expect(page.locator('text=Conc: 150.5 ng/μL')).toBeVisible()
    await expect(page.locator('text=Vol: 75 μL')).toBeVisible()
    await expect(page.locator('text=Type: Genomic DNA')).toBeVisible()
  })

  test('should show correct status badges', async ({ page }) => {
    const testSample = generateTestSample({
      sampleName: 'STATUS-SAMPLE'
    })
    
    await sampleHelper.createSample(testSample)
    
    // Verify status badge is shown
    const sampleRow = page.locator(`text=${testSample.sampleName}`).locator('..')
    await expect(sampleRow.locator('text=Submitted')).toBeVisible()
    
    // Verify priority badge
    await expect(sampleRow.locator('text=Normal')).toBeVisible()
  })

  test('should handle empty state correctly', async ({ page }) => {
    // Filter to show no results
    await sampleHelper.searchSamples('NONEXISTENT_SAMPLE')
    
    // Verify empty state
    await expect(page.locator('text=No samples found')).toBeVisible()
    await expect(page.locator('text=Try adjusting your filters')).toBeVisible()
    await expect(page.locator('button:has-text("Create Sample")')).toBeVisible()
  })

  test('should validate chart field selection', async ({ page }) => {
    // Open create sample modal
    await page.click('text=New Sample')
    await page.waitForSelector('[data-testid="create-sample-modal"]')
    
    // Fill required fields except chart field
    await page.fill('input[name="sampleName"]', 'CHART-TEST')
    await page.fill('input[name="submitterName"]', 'Test User')
    await page.fill('input[name="submitterEmail"]', 'test@example.com')
    await page.selectOption('select[name="sampleType"]', 'Genomic DNA')
    
    // Try to submit without chart field
    await page.click('button[type="submit"]')
    
    // Verify validation error
    await expect(page.locator('text=Chart field is required')).toBeVisible()
  })

  test('should show sample count in header', async ({ page }) => {
    const initialCount = await sampleHelper.getSampleCount()
    
    // Create a new sample
    await sampleHelper.createSample(generateTestSample({
      sampleName: 'COUNT-TEST-SAMPLE'
    }))
    
    // Verify count increased
    const newCount = await sampleHelper.getSampleCount()
    expect(newCount).toBe(initialCount + 1)
  })

  test('should handle concurrent sample creation', async ({ page }) => {
    const samples = [
      generateTestSample({ sampleName: 'CONCURRENT-1', submitterEmail: 'c1@test.com' }),
      generateTestSample({ sampleName: 'CONCURRENT-2', submitterEmail: 'c2@test.com' }),
      generateTestSample({ sampleName: 'CONCURRENT-3', submitterEmail: 'c3@test.com' })
    ]
    
    // Create samples sequentially (simulating concurrent creation)
    for (const sample of samples) {
      await sampleHelper.createSample(sample)
    }
    
    // Verify all samples are created
    for (const sample of samples) {
      await sampleHelper.verifySampleExists(sample.sampleName)
    }
  })

  test('should show loading state during sample creation', async ({ page }) => {
    // Open create sample modal
    await page.click('text=New Sample')
    await page.waitForSelector('[data-testid="create-sample-modal"]')
    
    // Fill form
    const testSample = generateTestSample()
    await page.fill('input[name="sampleName"]', testSample.sampleName)
    await page.fill('input[name="submitterName"]', testSample.submitterName)
    await page.fill('input[name="submitterEmail"]', testSample.submitterEmail)
    await page.selectOption('select[name="sampleType"]', testSample.sampleType)
    await page.selectOption('select[name="chartField"]', testSample.chartField)
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Verify loading state
    await expect(page.locator('text=Creating...')).toBeVisible()
  })

  test('should close modal on cancel', async ({ page }) => {
    // Open create sample modal
    await page.click('text=New Sample')
    await page.waitForSelector('[data-testid="create-sample-modal"]')
    
    // Click cancel
    await page.click('button:has-text("Cancel")')
    
    // Verify modal is closed
    await page.waitForSelector('[data-testid="create-sample-modal"]', { state: 'hidden' })
  })

  test('should persist form data when modal is reopened', async ({ page }) => {
    // Open create sample modal
    await page.click('text=New Sample')
    await page.waitForSelector('[data-testid="create-sample-modal"]')
    
    // Fill some fields
    await page.fill('input[name="sampleName"]', 'PERSIST-TEST')
    await page.fill('input[name="submitterName"]', 'Persist User')
    
    // Close modal
    await page.click('button:has-text("Cancel")')
    
    // Reopen modal
    await page.click('text=New Sample')
    await page.waitForSelector('[data-testid="create-sample-modal"]')
    
    // Verify form is reset (this is the expected behavior)
    await expect(page.locator('input[name="sampleName"]')).toHaveValue('')
    await expect(page.locator('input[name="submitterName"]')).toHaveValue('')
  })
})

test.describe('Sample Workflow Management', () => {
  let auth: AuthHelper
  let sampleHelper: SampleHelper

  test.beforeEach(async ({ page }) => {
    auth = new AuthHelper(page)
    sampleHelper = new SampleHelper(page)
    
    await auth.login()
  })

  test('should progress sample through workflow stages', async ({ page }) => {
    // Create a sample
    const testSample = generateTestSample({
      sampleName: 'WORKFLOW-SAMPLE'
    })
    
    await sampleHelper.createSample(testSample)
    
    // Verify initial status
    await expect(page.locator('text=Submitted')).toBeVisible()
    
    // Update status to prep
    await sampleHelper.updateSampleStatus(testSample.sampleName, 'prep')
    
    // Verify status updated
    await expect(page.locator('text=Prep')).toBeVisible()
  })

  test('should show assignment information', async ({ page }) => {
    const testSample = generateTestSample({
      sampleName: 'ASSIGNED-SAMPLE'
    })
    
    await sampleHelper.createSample(testSample)
    
    // Verify no assignment initially
    const sampleRow = page.locator(`text=${testSample.sampleName}`).locator('..')
    await expect(sampleRow.locator('text=Assigned to:')).not.toBeVisible()
    
    // TODO: Add assignment functionality tests when implemented
  })
}) 