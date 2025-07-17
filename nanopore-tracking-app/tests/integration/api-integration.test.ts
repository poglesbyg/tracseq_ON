import { describe, it, expect, testFramework } from '../../src/lib/testing/TestFramework'
import type { TestContext } from '../../src/lib/testing/TestFramework'

describe('API Integration Tests', {
  name: 'API Integration Tests',
  timeout: 10000,
  retries: 1,
  parallel: false,
  setup: async () => {
    // Setup test environment
    console.log('Setting up API integration tests')
  },
  teardown: async () => {
    // Cleanup after all tests
    testFramework.clearResults()
  },
  beforeEach: async (context: TestContext) => {
    await testFramework.setupIntegrationTest(context)
  }
})

// Test health endpoint
it('should return healthy status from health endpoint', async (context: TestContext) => {
  const result = await testFramework.measurePerformance(
    'healthCheck',
    async () => {
      const response = await fetch('http://localhost:3002/health')
      return {
        status: response.status,
        data: await response.json()
      }
    },
    context
  )

  expect.equals(result.result.status, 200, 'Health endpoint should return 200')
  expect.hasProperty(result.result.data, 'status', 'Should have status property')
  expect.hasProperty(result.result.data, 'components', 'Should have components property')
  expect.truthy(result.duration < 1000, 'Health check should be fast')
  
  context.metadata.assertions = 4
})

// Test version info endpoint
it('should return version information', async (context: TestContext) => {
  const result = await testFramework.measurePerformance(
    'versionInfo',
    async () => {
      const response = await fetch('http://localhost:3002/api/version-info')
      return {
        status: response.status,
        data: await response.json()
      }
    },
    context
  )

  expect.equals(result.result.status, 200, 'Version info should return 200')
  expect.hasProperty(result.result.data, 'api', 'Should have api property')
  expect.hasProperty(result.result.data, 'versioning', 'Should have versioning property')
  expect.hasProperty(result.result.data, 'statistics', 'Should have statistics property')
  expect.truthy(result.duration < 500, 'Version info should be fast')
  
  context.metadata.assertions = 5
})

// Test memory optimization endpoint
it('should handle memory optimization requests', async (context: TestContext) => {
  const result = await testFramework.measurePerformance(
    'memoryOptimization',
    async () => {
      const response = await fetch('http://localhost:3002/api/memory-optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      return {
        status: response.status,
        data: await response.json()
      }
    },
    context
  )

  expect.equals(result.result.status, 200, 'Memory optimization should return 200')
  expect.hasProperty(result.result.data, 'success', 'Should have success property')
  expect.hasProperty(result.result.data, 'message', 'Should have message property')
  expect.truthy(result.duration < 2000, 'Memory optimization should complete quickly')
  
  context.metadata.assertions = 4
})

// Test API versioning
it('should handle different API versions correctly', async (context: TestContext) => {
  const versions = ['v1', 'v2', 'v3']
  
  for (const version of versions) {
    const result = await testFramework.measurePerformance(
      `versionTest_${version}`,
      async () => {
        const response = await fetch('http://localhost:3002/api/version-info', {
          headers: {
            'X-API-Version': version
          }
        })
        return {
          status: response.status,
          data: await response.json(),
          version: response.headers.get('X-API-Version')
        }
      },
      context
    )

    expect.equals(result.result.status, 200, `Version ${version} should return 200`)
    expect.equals(result.result.version, version, `Response should be for version ${version}`)
    expect.equals(result.result.data.requestInfo.detectedVersion, version, 'Detected version should match')
  }
  
  context.metadata.assertions = 9 // 3 assertions per version
})

// Test error handling
it('should handle invalid endpoints gracefully', async (context: TestContext) => {
  const result = await testFramework.measurePerformance(
    'invalidEndpoint',
    async () => {
      const response = await fetch('http://localhost:3002/api/nonexistent')
      return {
        status: response.status,
        statusText: response.statusText
      }
    },
    context
  )

  expect.equals(result.result.status, 404, 'Invalid endpoint should return 404')
  expect.truthy(result.duration < 500, 'Error response should be fast')
  
  context.metadata.assertions = 2
})

// Test multiple sequential requests
it('should handle multiple sequential requests', async (context: TestContext) => {
  const requestCount = 3
  const results: Array<{index: number, status: number, data: any}> = []
  
  for (let i = 0; i < requestCount; i++) {
    const response = await fetch('http://localhost:3002/api/version-info')
    const data = await response.json()
    results.push({
      index: i,
      status: response.status,
      data
    })
  }

  expect.equals(results.length, requestCount, 'All requests should complete')
  expect.truthy(results.every(r => r.status === 200), 'All requests should succeed')
  
  // Check that all requests have unique request IDs
  const requestIds = results.map(r => r.data.requestInfo.requestId)
  const uniqueIds = new Set(requestIds)
  expect.equals(uniqueIds.size, requestCount, 'All requests should have unique IDs')
  
  context.metadata.assertions = 3
})

// Test memory usage tracking
it('should track memory usage during operations', async (context: TestContext) => {
  const result = await testFramework.measurePerformance(
    'memoryUsageTracking',
          async () => {
        // Perform multiple operations sequentially
        const results: any[] = []
        for (let i = 0; i < 5; i++) {
          const response = await fetch('http://localhost:3002/api/version-info')
          const data = await response.json()
          results.push(data)
        }
        return results
      },
    context
  )

  expect.equals(result.result.length, 5, 'All operations should complete')
  expect.truthy(result.memoryUsage >= 0, 'Memory usage should be tracked')
  expect.truthy(result.duration < 5000, 'Operations should complete in reasonable time')
  
  context.metadata.assertions = 3
  context.metadata.memoryUsage = result.memoryUsage
})

// Test response headers
it('should include proper response headers', async (context: TestContext) => {
  const result = await testFramework.measurePerformance(
    'responseHeaders',
    async () => {
      const response = await fetch('http://localhost:3002/api/version-info')
      return {
        status: response.status,
        headers: {
          contentType: response.headers.get('Content-Type'),
          cacheControl: response.headers.get('Cache-Control'),
          apiVersion: response.headers.get('X-API-Version'),
          requestId: response.headers.get('X-Request-ID')
        }
      }
    },
    context
  )

  expect.equals(result.result.status, 200, 'Should return 200')
  expect.equals(result.result.headers.contentType, 'application/json', 'Should return JSON')
  expect.truthy(result.result.headers.cacheControl, 'Should have cache control header')
  expect.truthy(result.result.headers.apiVersion, 'Should have API version header')
  expect.truthy(result.result.headers.requestId, 'Should have request ID header')
  
  context.metadata.assertions = 5
})

// Test performance benchmarks
it('should meet performance benchmarks', async (context: TestContext) => {
  const benchmarks = [
    { endpoint: '/health', maxDuration: 100 },
    { endpoint: '/api/version-info', maxDuration: 200 },
    { endpoint: '/api/memory-optimize', maxDuration: 1000 }
  ]

  for (const benchmark of benchmarks) {
    const result = await testFramework.measurePerformance(
      `benchmark_${benchmark.endpoint.replace(/\//g, '_')}`,
      async () => {
        const method = benchmark.endpoint === '/api/memory-optimize' ? 'POST' : 'GET'
        const response = await fetch(`http://localhost:3002${benchmark.endpoint}`, {
          method
        })
        return {
          status: response.status,
          duration: result.duration
        }
      },
      context
    )

    expect.equals(result.result.status, 200, `${benchmark.endpoint} should return 200`)
    expect.truthy(
      result.duration < benchmark.maxDuration, 
      `${benchmark.endpoint} should complete within ${benchmark.maxDuration}ms`
    )
  }
  
  context.metadata.assertions = benchmarks.length * 2
})

// Export test results
export default async function runTests() {
  const results = testFramework.getTestResults()
  console.log('\n=== API Integration Test Results ===')
  console.log(testFramework.generateReport())
  
  return results
} 