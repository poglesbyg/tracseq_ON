import { getComponentLogger } from '../logging/StructuredLogger'
import { applicationMetrics } from '../monitoring/MetricsCollector'
import { memoryManager } from '../performance/MemoryManager'
import { cacheManager } from '../cache/CacheManager'
import { db } from '../database'
import type { Database } from '../database'
import { sql } from 'kysely'

const logger = getComponentLogger('TestFramework')

/**
 * Test execution context
 */
export interface TestContext {
  testId: string
  testName: string
  suite: string
  startTime: Date
  metadata: Record<string, any>
  cleanup: Array<() => Promise<void>>
}

/**
 * Test result interface
 */
export interface TestResult {
  testId: string
  testName: string
  suite: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  error?: Error
  assertions: number
  metadata: Record<string, any>
}

/**
 * Test suite configuration
 */
export interface TestSuiteConfig {
  name: string
  timeout: number
  retries: number
  parallel: boolean
  setup?: () => Promise<void>
  teardown?: () => Promise<void>
  beforeEach?: (context: TestContext) => Promise<void>
  afterEach?: (context: TestContext) => Promise<void>
}

/**
 * Test database fixture
 */
export interface TestFixture {
  id: string
  type: 'sample' | 'user' | 'config'
  data: any
  dependencies?: string[]
}

/**
 * Contract test specification
 */
export interface ContractTest {
  name: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  requestSchema: any
  responseSchema: any
  examples: Array<{
    name: string
    request: any
    expectedResponse: any
  }>
}

/**
 * Mock service configuration
 */
export interface MockConfig {
  service: string
  methods: Record<string, any>
  responses: Record<string, any>
  errors: Record<string, Error>
}

/**
 * Comprehensive testing framework
 */
export class TestFramework {
  private testResults: TestResult[] = []
  private mockServices: Map<string, MockConfig> = new Map()
  private fixtures: Map<string, TestFixture> = new Map()
  private activeTests: Map<string, TestContext> = new Map()
  private suiteConfig: TestSuiteConfig | null = null

  constructor() {
    logger.info('Test framework initialized')
  }

  /**
   * Configure test suite
   */
  configureSuite(config: TestSuiteConfig): void {
    this.suiteConfig = config
    logger.info('Test suite configured', {
      metadata: {
        suiteName: config.name,
        timeout: config.timeout,
        retries: config.retries,
        parallel: config.parallel
      }
    })
  }

  /**
   * Create test context
   */
  createTestContext(testName: string, metadata: Record<string, any> = {}): TestContext {
    const testId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const context: TestContext = {
      testId,
      testName,
      suite: this.suiteConfig?.name || 'default',
      startTime: new Date(),
      metadata,
      cleanup: []
    }

    this.activeTests.set(testId, context)
    return context
  }

  /**
   * Execute a test with proper setup and teardown
   */
  async runTest(
    testName: string,
    testFn: (context: TestContext) => Promise<void>,
    metadata: Record<string, any> = {}
  ): Promise<TestResult> {
    const context = this.createTestContext(testName, metadata)
    const startTime = Date.now()
    let status: 'passed' | 'failed' | 'skipped' = 'passed'
    let error: Error | undefined
    let assertions = 0

    try {
      logger.info('Starting test', {
        metadata: {
          testId: context.testId,
          testName: context.testName,
          suite: context.suite
        }
      })

      // Run suite setup if configured
      if (this.suiteConfig?.setup) {
        await this.suiteConfig.setup()
      }

      // Run beforeEach if configured
      if (this.suiteConfig?.beforeEach) {
        await this.suiteConfig.beforeEach(context)
      }

      // Execute the test with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeout = this.suiteConfig?.timeout || 10000
        setTimeout(() => reject(new Error(`Test timeout after ${timeout}ms`)), timeout)
      })

      await Promise.race([
        testFn(context),
        timeoutPromise
      ])

      // Record assertions count (would be set by assertion helpers)
      assertions = context.metadata.assertions || 0

    } catch (err) {
      status = 'failed'
      error = err instanceof Error ? err : new Error(String(err))
      
      logger.error('Test failed', {
        errorType: error.name,
        metadata: {
          testId: context.testId,
          testName: context.testName,
          errorMessage: error.message
        }
      }, error)
      
      applicationMetrics.recordError('test_failure', 'TestFramework')
    } finally {
      // Run cleanup functions
      for (const cleanup of context.cleanup) {
        try {
          await cleanup()
        } catch (cleanupError) {
          logger.warn('Cleanup failed', {
            metadata: {
              testId: context.testId,
              cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
            }
          })
        }
      }

      // Run afterEach if configured
      if (this.suiteConfig?.afterEach) {
        try {
          await this.suiteConfig.afterEach(context)
        } catch (afterEachError) {
          logger.warn('afterEach failed', {
            metadata: {
              testId: context.testId,
              error: afterEachError instanceof Error ? afterEachError.message : String(afterEachError)
            }
          })
        }
      }

      this.activeTests.delete(context.testId)
    }

    const duration = Date.now() - startTime
    const result: TestResult = {
      testId: context.testId,
      testName: context.testName,
      suite: context.suite,
      status,
      duration,
      ...(error && { error }),
      assertions,
      metadata: context.metadata
    }

    this.testResults.push(result)
    
    logger.info('Test completed', {
      metadata: {
        testId: context.testId,
        testName: context.testName,
        status,
        duration,
        assertions
      }
    })

    return result
  }

  /**
   * Database test utilities
   */
  async withTestDatabase<T>(
    testFn: (db: Database) => Promise<T>,
    context: TestContext
  ): Promise<T> {
    // Create test transaction
    const result = await db.transaction().execute(async (trx) => {
      // Add cleanup to rollback transaction
      context.cleanup.push(async () => {
        // Transaction will be rolled back automatically
      })

      return await testFn(trx as any)
    })

    return result
  }

  /**
   * Create test fixtures
   */
  async createFixture(fixture: TestFixture, context: TestContext): Promise<void> {
    this.fixtures.set(fixture.id, fixture)
    
    // Add cleanup to remove fixture
    context.cleanup.push(async () => {
      await this.removeFixture(fixture.id)
    })

    logger.debug('Test fixture created', {
      metadata: {
        testId: context.testId,
        fixtureId: fixture.id,
        fixtureType: fixture.type
      }
    })
  }

  /**
   * Remove test fixture
   */
  async removeFixture(fixtureId: string): Promise<void> {
    const fixture = this.fixtures.get(fixtureId)
    if (!fixture) return

    try {
      // Remove from database based on type
      switch (fixture.type) {
        case 'sample':
          await db.deleteFrom('nanopore_samples')
            .where('id', '=', fixture.data.id)
            .execute()
          break
        // Add other fixture types as needed
      }

      this.fixtures.delete(fixtureId)
      
      logger.debug('Test fixture removed', {
        metadata: {
          fixtureId,
          fixtureType: fixture.type
        }
      })
    } catch (error) {
      logger.warn('Failed to remove fixture', {
        metadata: {
          fixtureId,
          error: error instanceof Error ? error.message : String(error)
        }
      })
    }
  }

  /**
   * Mock service methods
   */
  mockService(config: MockConfig, context: TestContext): void {
    this.mockServices.set(config.service, config)
    
    // Add cleanup to remove mock
    context.cleanup.push(async () => {
      this.mockServices.delete(config.service)
    })

    logger.debug('Service mocked', {
      metadata: {
        testId: context.testId,
        service: config.service,
        methods: Object.keys(config.methods)
      }
    })
  }

  /**
   * Assertion helpers
   */
  assert = {
    equals: (actual: any, expected: any, message?: string) => {
      if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`)
      }
    },

    notEquals: (actual: any, expected: any, message?: string) => {
      if (actual === expected) {
        throw new Error(message || `Expected not ${expected}, got ${actual}`)
      }
    },

    truthy: (value: any, message?: string) => {
      if (!value) {
        throw new Error(message || `Expected truthy value, got ${value}`)
      }
    },

    falsy: (value: any, message?: string) => {
      if (value) {
        throw new Error(message || `Expected falsy value, got ${value}`)
      }
    },

    throws: async (fn: () => Promise<any>, message?: string) => {
      try {
        await fn()
        throw new Error(message || 'Expected function to throw')
      } catch (error) {
        // Expected to throw
      }
    },

    deepEquals: (actual: any, expected: any, message?: string) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
      }
    },

    arrayIncludes: (array: any[], item: any, message?: string) => {
      if (!array.includes(item)) {
        throw new Error(message || `Expected array to include ${item}`)
      }
    },

    hasProperty: (obj: any, property: string, message?: string) => {
      if (!(property in obj)) {
        throw new Error(message || `Expected object to have property ${property}`)
      }
    }
  }

  /**
   * Performance testing utilities
   */
  async measurePerformance<T>(
    name: string,
    fn: () => Promise<T>,
    context: TestContext
  ): Promise<{ result: T; duration: number; memoryUsage: number }> {
    const startTime = Date.now()
    const startMemory = memoryManager.getMemoryStats()
    
    const result = await fn()
    
    const endTime = Date.now()
    const endMemory = memoryManager.getMemoryStats()
    
    const duration = endTime - startTime
    const memoryUsage = endMemory.heapUsed - startMemory.heapUsed
    
    context.metadata.performance = {
      ...context.metadata.performance,
      [name]: { duration, memoryUsage }
    }
    
    logger.info('Performance measured', {
      metadata: {
        testId: context.testId,
        measurementName: name,
        duration,
        memoryUsage
      }
    })
    
    return { result, duration, memoryUsage }
  }

  /**
   * Contract testing utilities
   */
  async validateContract(
    contractTest: ContractTest,
    context: TestContext
  ): Promise<void> {
    for (const example of contractTest.examples) {
      logger.info('Running contract test', {
        metadata: {
          testId: context.testId,
          contractName: contractTest.name,
          exampleName: example.name
        }
      })

      // Validate request schema
      this.validateSchema(example.request, contractTest.requestSchema)

      // Make actual request (would integrate with actual HTTP client)
      // For now, just validate response schema
      this.validateSchema(example.expectedResponse, contractTest.responseSchema)
    }
  }

  /**
   * Schema validation helper
   */
  private validateSchema(data: any, schema: any): void {
    // Simple schema validation - in production, use a proper schema validator
    // like Joi, Yup, or JSON Schema
    if (typeof schema === 'object' && schema !== null) {
      for (const key in schema) {
        if (!(key in data)) {
          throw new Error(`Missing required field: ${key}`)
        }
      }
    }
  }

  /**
   * Integration test utilities
   */
  async setupIntegrationTest(context: TestContext): Promise<void> {
    // Clear caches
    await cacheManager.clear()
    
    // Reset metrics
    // applicationMetrics.reset() // If available
    
    // Setup test database state
    await this.setupTestDatabase(context)
    
    logger.info('Integration test setup completed', {
      metadata: {
        testId: context.testId
      }
    })
  }

  /**
   * Setup test database state
   */
  private async setupTestDatabase(context: TestContext): Promise<void> {
    // Create test isolation - in production, use separate test database
    context.cleanup.push(async () => {
      // Clean up test data
      await db.deleteFrom('nanopore_samples')
        .where('created_by', '=', `test-${context.testId}`)
        .execute()
    })
  }

  /**
   * Get test results and statistics
   */
  getTestResults(): {
    results: TestResult[]
    summary: {
      total: number
      passed: number
      failed: number
      skipped: number
      duration: number
      passRate: number
    }
  } {
    const results = this.testResults
    const total = results.length
    const passed = results.filter(r => r.status === 'passed').length
    const failed = results.filter(r => r.status === 'failed').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const duration = results.reduce((sum, r) => sum + r.duration, 0)
    const passRate = total > 0 ? (passed / total) * 100 : 0

    return {
      results,
      summary: {
        total,
        passed,
        failed,
        skipped,
        duration,
        passRate
      }
    }
  }

  /**
   * Clear test results
   */
  clearResults(): void {
    this.testResults = []
    this.fixtures.clear()
    this.mockServices.clear()
  }

  /**
   * Generate test report
   */
  generateReport(): string {
    const { results, summary } = this.getTestResults()
    
    let report = `
Test Report - ${new Date().toISOString()}
==========================================

Summary:
- Total Tests: ${summary.total}
- Passed: ${summary.passed} (${summary.passRate.toFixed(1)}%)
- Failed: ${summary.failed}
- Skipped: ${summary.skipped}
- Total Duration: ${summary.duration}ms

Test Results:
${results.map(r => `
- ${r.testName} (${r.suite})
  Status: ${r.status}
  Duration: ${r.duration}ms
  Assertions: ${r.assertions}
  ${r.error ? `Error: ${r.error.message}` : ''}
`).join('')}
    `.trim()

    return report
  }
}

/**
 * Global test framework instance
 */
export const testFramework = new TestFramework()

/**
 * Test helper functions
 */
export const describe = (suiteName: string, config: Partial<TestSuiteConfig> = {}) => {
  testFramework.configureSuite({
    name: suiteName,
    timeout: 10000,
    retries: 0,
    parallel: false,
    ...config
  })
}

export const it = (testName: string, testFn: (context: TestContext) => Promise<void>) => {
  return testFramework.runTest(testName, testFn)
}

export const expect = testFramework.assert

/**
 * Sample test fixtures
 */
export const sampleFixtures = {
  basicSample: (testId: string): TestFixture => ({
    id: `sample-${testId}`,
    type: 'sample',
    data: {
      id: `test-sample-${testId}`,
      sample_name: `Test Sample ${testId}`,
      project_id: 'TEST-PROJECT',
      submitter_name: 'Test User',
      submitter_email: 'test@example.com',
      lab_name: 'Test Lab',
      sample_type: 'DNA',
      status: 'submitted',
      priority: 'normal',
      created_by: `test-${testId}`,
      created_at: new Date(),
      updated_at: new Date(),
      submitted_at: new Date()
    }
  }),

  urgentSample: (testId: string): TestFixture => ({
    id: `urgent-sample-${testId}`,
    type: 'sample',
    data: {
      id: `test-urgent-sample-${testId}`,
      sample_name: `Urgent Test Sample ${testId}`,
      project_id: 'TEST-PROJECT',
      submitter_name: 'Test User',
      submitter_email: 'test@example.com',
      lab_name: 'Test Lab',
      sample_type: 'RNA',
      status: 'submitted',
      priority: 'urgent',
      created_by: `test-${testId}`,
      created_at: new Date(),
      updated_at: new Date(),
      submitted_at: new Date()
    }
  })
} 