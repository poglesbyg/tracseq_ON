import { test, expect } from '@playwright/test'
import { AuthHelper, SampleHelper, DashboardHelper, generateTestSample } from '../utils/test-helpers'

test.describe('Production Workflows E2E', () => {
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

  test('should handle complete sample lifecycle from creation to completion', async ({ page }) => {
    const testSample = generateTestSample({
      sampleName: 'LIFECYCLE-TEST-001',
      submitterName: 'Lifecycle Test User',
      submitterEmail: 'lifecycle@test.com',
      sampleType: 'DNA',
      concentration: 75.5,
      volume: 25.0,
      chartField: 'LIFECYCLE-CHART'
    })

    // Step 1: Create sample
    await sampleHelper.createSample(testSample)
    await sampleHelper.verifySampleExists(testSample.sampleName)

    // Step 2: Assign sample to staff member
    await page.click(`[data-testid="sample-row-${testSample.sampleName}"] button:has-text("Assign")`)
    await page.selectOption('[data-testid="assign-to-select"]', 'Grey')
    await page.selectOption('[data-testid="library-prep-select"]', 'Stephanie')
    await page.click('button:has-text("Assign Sample")')
    await expect(page.locator('text=Sample assigned successfully')).toBeVisible()

    // Step 3: Progress through workflow stages
    const workflowStages = ['prep', 'sequencing', 'analysis', 'completed']
    
    for (const stage of workflowStages) {
      await page.click(`[data-testid="sample-row-${testSample.sampleName}"] button:has-text("Edit")`)
      await page.selectOption('[data-testid="status-select"]', stage)
      await page.click('button:has-text("Save Changes")')
      await expect(page.locator('text=Sample updated successfully')).toBeVisible()
      
      // Verify status change
      await expect(page.locator(`[data-testid="sample-row-${testSample.sampleName}"] [data-testid="status-badge"]`))
        .toHaveText(stage)
    }

    // Step 4: Verify completion
    await expect(page.locator(`[data-testid="sample-row-${testSample.sampleName}"] [data-testid="status-badge"]`))
      .toHaveText('completed')
  })

  test('should handle PDF upload and AI processing workflow', async ({ page }) => {
    // Create a test PDF file content (mock)
    const pdfContent = Buffer.from('Mock PDF content for testing')
    
    // Navigate to PDF upload section
    await page.click('button:has-text("Upload PDF")')
    await expect(page.locator('[data-testid="pdf-upload-modal"]')).toBeVisible()

    // Upload PDF file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test-sample-form.pdf',
      mimeType: 'application/pdf',
      buffer: pdfContent
    })

    // Wait for upload to complete
    await expect(page.locator('text=Upload complete')).toBeVisible({ timeout: 10000 })

    // Verify AI processing starts
    await expect(page.locator('text=Processing with AI')).toBeVisible()
    await expect(page.locator('[data-testid="ai-progress-bar"]')).toBeVisible()

    // Wait for AI processing to complete
    await expect(page.locator('text=AI processing complete')).toBeVisible({ timeout: 30000 })

    // Verify extracted data preview
    await expect(page.locator('[data-testid="extracted-data-preview"]')).toBeVisible()
    await expect(page.locator('[data-testid="confidence-score"]')).toBeVisible()

    // Accept extracted data
    await page.click('button:has-text("Accept Extracted Data")')
    await expect(page.locator('text=Sample created from PDF')).toBeVisible()
  })

  test('should handle error scenarios gracefully', async ({ page }) => {
    // Test invalid sample creation
    await page.click('text=New Sample')
    await page.waitForSelector('[data-testid="create-sample-modal"]')
    
    // Submit empty form
    await page.click('button:has-text("Create Sample")')
    await expect(page.locator('text=Please fill in all required fields')).toBeVisible()

    // Test invalid email format
    await page.fill('[data-testid="sample-name-input"]', 'ERROR-TEST-001')
    await page.fill('[data-testid="submitter-name-input"]', 'Error Test User')
    await page.fill('[data-testid="submitter-email-input"]', 'invalid-email')
    await page.click('button:has-text("Create Sample")')
    await expect(page.locator('text=Please enter a valid email address')).toBeVisible()

    // Test invalid sample name
    await page.fill('[data-testid="submitter-email-input"]', 'error@test.com')
    await page.fill('[data-testid="sample-name-input"]', 'invalid sample name!')
    await page.click('button:has-text("Create Sample")')
    await expect(page.locator('text=Sample name can only contain letters, numbers, dashes, and underscores')).toBeVisible()

    // Close modal
    await page.click('button:has-text("Cancel")')
    await expect(page.locator('[data-testid="create-sample-modal"]')).not.toBeVisible()
  })

  test('should handle concurrent operations without conflicts', async ({ page }) => {
    // Create multiple samples simultaneously
    const samplePromises: Promise<void>[] = []
    for (let i = 0; i < 3; i++) {
      samplePromises.push(
        sampleHelper.createSample(generateTestSample({
          sampleName: `CONCURRENT-${i}-${Date.now()}`,
          submitterName: `Concurrent User ${i}`,
          submitterEmail: `concurrent${i}@test.com`
        }))
      )
    }

    // Wait for all samples to be created
    await Promise.all(samplePromises)

    // Verify all samples appear in the list
    for (let i = 0; i < 3; i++) {
      await expect(page.locator(`text=CONCURRENT-${i}-`)).toBeVisible()
    }

    // Test concurrent status updates
    const statusButtons = await page.locator('button:has-text("Edit")').all()
    expect(statusButtons.length).toBeGreaterThanOrEqual(3)
  })

  test('should handle memory optimization during active use', async ({ page }) => {
    // Generate some load by creating samples
    for (let i = 0; i < 5; i++) {
      await sampleHelper.createSample(generateTestSample({
        sampleName: `MEMORY-TEST-${i}-${Date.now()}`,
        submitterName: 'Memory Test User',
        submitterEmail: 'memory@test.com'
      }))
    }

    // Open memory optimization panel
    await page.click('button:has-text("Memory")')
    await expect(page.locator('[data-testid="memory-optimization-panel"]')).toBeVisible()

    // Check memory statistics
    await expect(page.locator('[data-testid="memory-usage-bar"]')).toBeVisible()
    await expect(page.locator('[data-testid="memory-percentage"]')).toBeVisible()

    // Perform memory optimization
    await page.click('button:has-text("Full Optimization")')
    await expect(page.locator('text=Memory optimization completed')).toBeVisible({ timeout: 15000 })

    // Verify system remains responsive
    await page.click('text=Dashboard')
    await dashboardHelper.verifyStatsCards()
  })

  test('should handle export functionality under various conditions', async ({ page }) => {
    // Create test samples with different statuses
    const testSamples = [
      { name: 'EXPORT-SUBMITTED', status: 'submitted' },
      { name: 'EXPORT-PREP', status: 'prep' },
      { name: 'EXPORT-COMPLETED', status: 'completed' }
    ]

    for (const sample of testSamples) {
      await sampleHelper.createSample(generateTestSample({
        sampleName: sample.name,
        submitterName: 'Export Test User',
        submitterEmail: 'export@test.com'
      }))
    }

    // Test export functionality
    await page.click('button:has-text("Export")')
    await expect(page.locator('[data-testid="export-modal"]')).toBeVisible()

    // Select export format
    await page.selectOption('[data-testid="export-format-select"]', 'csv')
    
    // Apply status filter
    await page.selectOption('[data-testid="status-filter-select"]', 'all')
    
    // Start export
    await page.click('button:has-text("Export Data")')
    await expect(page.locator('text=Export completed')).toBeVisible({ timeout: 10000 })

    // Verify download initiated
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Download")')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/nanopore-samples.*\.csv/)
  })

  test('should handle authentication and security scenarios', async ({ page }) => {
    // Test session timeout handling
    await page.click('button:has-text("Logout")')
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible()

    // Test invalid login
    await page.fill('[data-testid="username-input"]', 'invalid-user')
    await page.fill('[data-testid="password-input"]', 'invalid-password')
    await page.click('button:has-text("Login")')
    await expect(page.locator('text=Invalid credentials')).toBeVisible()

    // Test successful re-login
    await auth.login()
    await dashboardHelper.waitForDashboardLoad()
    await expect(page.locator('text=Dashboard')).toBeVisible()
  })

  test('should handle backup and recovery scenarios', async ({ page }) => {
    // Create test data
    await sampleHelper.createSample(generateTestSample({
      sampleName: 'BACKUP-TEST-001',
      submitterName: 'Backup Test User',
      submitterEmail: 'backup@test.com'
    }))

    // Access backup functionality (admin only)
    await page.click('button:has-text("Admin")')
    await expect(page.locator('[data-testid="admin-panel"]')).toBeVisible()

    // Initiate backup
    await page.click('button:has-text("Create Backup")')
    await expect(page.locator('text=Backup initiated')).toBeVisible()
    await expect(page.locator('text=Backup completed')).toBeVisible({ timeout: 30000 })

    // Verify system remains operational during backup
    await page.click('text=Dashboard')
    await dashboardHelper.verifyStatsCards()
    await sampleHelper.verifySampleExists('BACKUP-TEST-001')
  })

  test('should handle performance under load', async ({ page }) => {
    // Create multiple samples to simulate load
    const sampleCount = 10
    const samplePromises: Promise<void>[] = []

    for (let i = 0; i < sampleCount; i++) {
      samplePromises.push(
        sampleHelper.createSample(generateTestSample({
          sampleName: `LOAD-TEST-${i}-${Date.now()}`,
          submitterName: 'Load Test User',
          submitterEmail: 'load@test.com'
        }))
      )
    }

    // Measure performance
    const startTime = Date.now()
    await Promise.all(samplePromises)
    const endTime = Date.now()

    // Verify reasonable performance (should complete within 30 seconds)
    expect(endTime - startTime).toBeLessThan(30000)

    // Verify all samples are visible
    for (let i = 0; i < sampleCount; i++) {
      await expect(page.locator(`text=LOAD-TEST-${i}-`)).toBeVisible()
    }

    // Test pagination with large dataset
    await expect(page.locator('[data-testid="pagination-controls"]')).toBeVisible()
    
    // Test search functionality with large dataset
    await page.fill('[data-testid="search-input"]', 'LOAD-TEST')
    await expect(page.locator('text=LOAD-TEST-0-')).toBeVisible()
  })

  test('should handle real-time updates and notifications', async ({ page }) => {
    // Create a sample
    const testSample = generateTestSample({
      sampleName: 'REALTIME-TEST-001',
      submitterName: 'Realtime Test User',
      submitterEmail: 'realtime@test.com'
    })

    await sampleHelper.createSample(testSample)

    // Open sample in one view
    await page.click(`[data-testid="sample-row-${testSample.sampleName}"] button:has-text("View")`)
    await expect(page.locator('[data-testid="sample-details-modal"]')).toBeVisible()

    // Simulate status change (would normally come from another user/system)
    await page.evaluate(() => {
      // Simulate WebSocket update
      window.dispatchEvent(new CustomEvent('sampleStatusUpdate', {
        detail: {
          sampleId: 'REALTIME-TEST-001',
          newStatus: 'prep',
          timestamp: new Date().toISOString()
        }
      }))
    })

    // Verify real-time update
    await expect(page.locator('[data-testid="sample-status"]')).toHaveText('prep')
    await expect(page.locator('[data-testid="notification-toast"]')).toBeVisible()
  })
}) 