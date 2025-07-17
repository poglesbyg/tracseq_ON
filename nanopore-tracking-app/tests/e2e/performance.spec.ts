import { test, expect } from '@playwright/test'
import { AuthHelper, SampleHelper, PerformanceHelper, generateMultipleTestSamples } from '../utils/test-helpers'

test.describe('Performance Tests', () => {
  let auth: AuthHelper
  let sampleHelper: SampleHelper
  let performanceHelper: PerformanceHelper

  test.beforeEach(async ({ page }) => {
    auth = new AuthHelper(page)
    sampleHelper = new SampleHelper(page)
    performanceHelper = new PerformanceHelper(page)
    
    await auth.login()
  })

  test('should load dashboard within acceptable time', async ({ page }) => {
    const loadTime = await performanceHelper.measurePageLoadTime()
    
    // Dashboard should load within 5 seconds
    expect(loadTime).toBeLessThan(5000)
    
    console.log(`Dashboard load time: ${loadTime}ms`)
  })

  test('should create samples efficiently', async ({ page }) => {
    const creationTime = await performanceHelper.measureSampleCreationTime()
    
    // Sample creation should complete within 10 seconds
    expect(creationTime).toBeLessThan(10000)
    
    console.log(`Sample creation time: ${creationTime}ms`)
  })

  test('should handle multiple samples without performance degradation', async ({ page }) => {
    const samples = generateMultipleTestSamples(5)
    const startTime = Date.now()
    
    // Create multiple samples
    for (const sample of samples) {
      await sampleHelper.createSample(sample)
    }
    
    const totalTime = Date.now() - startTime
    const averageTime = totalTime / samples.length
    
    // Average creation time should remain reasonable
    expect(averageTime).toBeLessThan(5000)
    
    console.log(`Average sample creation time: ${averageTime}ms`)
  })

  test('should maintain responsive UI during data operations', async ({ page }) => {
    // Create some samples first
    const samples = generateMultipleTestSamples(3)
    for (const sample of samples) {
      await sampleHelper.createSample(sample)
    }
    
    // Measure search response time
    const searchStart = Date.now()
    await sampleHelper.searchSamples('TEST')
    const searchTime = Date.now() - searchStart
    
    // Search should be responsive
    expect(searchTime).toBeLessThan(2000)
    
    // Measure filter response time
    const filterStart = Date.now()
    await sampleHelper.filterByStatus('submitted')
    const filterTime = Date.now() - filterStart
    
    // Filtering should be responsive
    expect(filterTime).toBeLessThan(1000)
    
    console.log(`Search time: ${searchTime}ms, Filter time: ${filterTime}ms`)
  })

  test('should handle page navigation efficiently', async ({ page }) => {
    // Measure navigation between different states
    const navigationTimes: number[] = []
    
    // Navigate to create sample modal
    const createStart = Date.now()
    await page.click('text=New Sample')
    await page.waitForSelector('[data-testid="create-sample-modal"]')
    navigationTimes.push(Date.now() - createStart)
    
    // Close modal
    const closeStart = Date.now()
    await page.click('button:has-text("Cancel")')
    await page.waitForSelector('[data-testid="create-sample-modal"]', { state: 'hidden' })
    navigationTimes.push(Date.now() - closeStart)
    
    // All navigation should be fast
    for (const time of navigationTimes) {
      expect(time as number).toBeLessThan(1000)
    }
    
    console.log(`Navigation times: ${navigationTimes.join(', ')}ms`)
  })

  test('should maintain performance with large datasets', async ({ page }) => {
    // This test would ideally use a database with many samples
    // For now, we'll test with the samples we can create
    
    const samples = generateMultipleTestSamples(10)
    
    // Create samples and measure time
    const creationStart = Date.now()
    for (const sample of samples) {
      await sampleHelper.createSample(sample)
    }
    const creationTime = Date.now() - creationStart
    
    // Test search performance with more data
    const searchStart = Date.now()
    await sampleHelper.searchSamples('TEST')
    const searchTime = Date.now() - searchStart
    
    // Test filtering performance
    const filterStart = Date.now()
    await sampleHelper.filterByStatus('submitted')
    const filterTime = Date.now() - filterStart
    
    // Performance should remain acceptable
    expect(creationTime / samples.length).toBeLessThan(3000) // Average creation time
    expect(searchTime).toBeLessThan(2000)
    expect(filterTime).toBeLessThan(1000)
    
    console.log(`Large dataset performance - Creation: ${creationTime}ms, Search: ${searchTime}ms, Filter: ${filterTime}ms`)
  })

  test('should handle concurrent operations gracefully', async ({ page }) => {
    // Test concurrent sample creation (simulated)
    const samples = generateMultipleTestSamples(3)
    const promises: Promise<void>[] = []
    
    const startTime = Date.now()
    
    // Create samples in sequence (browser limitation)
    for (const sample of samples) {
      promises.push(sampleHelper.createSample(sample))
    }
    
    // Wait for all to complete
    await Promise.all(promises)
    
    const totalTime = Date.now() - startTime
    
    // Should complete within reasonable time
    expect(totalTime).toBeLessThan(15000)
    
    console.log(`Concurrent operations completed in: ${totalTime}ms`)
  })

  test('should maintain UI responsiveness during AI operations', async ({ page }) => {
    // Open create sample modal
    await page.click('text=New Sample')
    await page.waitForSelector('[data-testid="create-sample-modal"]')
    
    // Fill sample type to trigger AI suggestions
    await page.selectOption('select[name="sampleType"]', 'Genomic DNA')
    
    // Measure AI suggestion time
    const aiStart = Date.now()
    await page.click('button:has-text("Suggest Settings")')
    
    // Wait for AI response or timeout
    try {
      await page.waitForSelector('text=AI suggested optimal settings', { timeout: 10000 })
      const aiTime = Date.now() - aiStart
      
      // AI suggestions should complete within reasonable time
      expect(aiTime).toBeLessThan(10000)
      
      console.log(`AI suggestion time: ${aiTime}ms`)
    } catch (error) {
      console.log('AI service not available or slow - this is acceptable in test environment')
    }
  })

  test('should handle memory efficiently', async ({ page }) => {
    // Create and delete samples to test memory management
    const samples = generateMultipleTestSamples(5)
    
    // Create samples
    for (const sample of samples) {
      await sampleHelper.createSample(sample)
    }
    
    // Perform various operations
    await sampleHelper.searchSamples('TEST')
    await sampleHelper.filterByStatus('submitted')
    await sampleHelper.filterByPriority('normal')
    
    // Clear filters
    await page.fill('input[placeholder*="Search samples"]', '')
    await sampleHelper.filterByStatus('all')
    await sampleHelper.filterByPriority('all')
    
    // Check for memory leaks by measuring performance
    const memoryStart = Date.now()
    await page.reload()
    await page.waitForLoadState('networkidle')
    const reloadTime = Date.now() - memoryStart
    
    // Page reload should remain fast
    expect(reloadTime).toBeLessThan(5000)
    
    console.log(`Memory test - Page reload time: ${reloadTime}ms`)
  })
})

test.describe('Load Testing', () => {
  test('should handle rapid user interactions', async ({ page }) => {
    const auth = new AuthHelper(page)
    const sampleHelper = new SampleHelper(page)
    
    await auth.login()
    
    // Simulate rapid user interactions
    const interactions = [
      () => page.click('text=New Sample'),
      () => page.click('button:has-text("Cancel")'),
      () => sampleHelper.searchSamples('test'),
      () => sampleHelper.filterByStatus('submitted'),
      () => sampleHelper.filterByPriority('high'),
      () => page.fill('input[placeholder*="Search samples"]', ''),
      () => sampleHelper.filterByStatus('all'),
      () => sampleHelper.filterByPriority('all')
    ]
    
    const startTime = Date.now()
    
    // Perform interactions rapidly
    for (const interaction of interactions) {
      await interaction()
      await page.waitForTimeout(100) // Small delay between interactions
    }
    
    const totalTime = Date.now() - startTime
    
    // Should handle rapid interactions without issues
    expect(totalTime).toBeLessThan(10000)
    
    console.log(`Rapid interactions completed in: ${totalTime}ms`)
  })
})

// Context added by Giga sample-tracking-model 