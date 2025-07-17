import type { APIRoute } from 'astro'
import { serviceMeshLoadTester } from '../../../../tests/performance/load-testing-framework'
import { performanceTuner } from '../../../lib/performance/PerformanceTuner'
import { getComponentLogger } from '../../../lib/logging/StructuredLogger'

const logger = getComponentLogger('LoadTestAPI')

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { testType, config } = body

    logger.info('Starting load test', {
      action: 'load_test_start',
      metadata: { testType, config }
    })

    let result

    switch (testType) {
      case 'circuit-breaker':
        result = await serviceMeshLoadTester.testCircuitBreaker()
        break
      case 'retry-mechanism':
        result = await serviceMeshLoadTester.testRetryMechanism()
        break
      case 'load-balancer':
        result = await serviceMeshLoadTester.testLoadBalancer()
        break
      case 'memory-pressure':
        result = await serviceMeshLoadTester.testMemoryPressure()
        break
      case 'full-suite':
        result = await serviceMeshLoadTester.runServiceMeshTestSuite()
        break
      case 'custom':
        if (!config) {
          return new Response(JSON.stringify({ error: 'Config required for custom test' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        result = await serviceMeshLoadTester.runLoadTest(config)
        break
      default:
        return new Response(JSON.stringify({ error: 'Invalid test type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }

    // Get performance recommendations
    const recommendations = await performanceTuner.analyzePerformance()

    logger.info('Load test completed', {
      action: 'load_test_complete',
      metadata: { testType, result: Array.isArray(result) ? result.length : 1 }
    })

    return new Response(JSON.stringify({
      success: true,
      testType,
      result,
      recommendations,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    logger.error('Load test failed', {
      action: 'load_test_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
      metadata: { errorMessage: error instanceof Error ? error.message : 'Unknown error' }
    })

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const GET: APIRoute = async () => {
  try {
    const results = serviceMeshLoadTester.getResults()
    const report = serviceMeshLoadTester.generateReport()
    const performanceReport = performanceTuner.generatePerformanceReport()

    return new Response(JSON.stringify({
      success: true,
      results,
      report,
      performanceReport,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    logger.error('Failed to get load test results', {
      action: 'get_results_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
      metadata: { errorMessage: error instanceof Error ? error.message : 'Unknown error' }
    })

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const DELETE: APIRoute = async () => {
  try {
    serviceMeshLoadTester.stopTests()
    serviceMeshLoadTester.clearResults()
    
    logger.info('Load tests stopped and results cleared')

    return new Response(JSON.stringify({
      success: true,
      message: 'Load tests stopped and results cleared',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    logger.error('Failed to stop load tests', {
      action: 'stop_tests_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
      metadata: { errorMessage: error instanceof Error ? error.message : 'Unknown error' }
    })

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
} 