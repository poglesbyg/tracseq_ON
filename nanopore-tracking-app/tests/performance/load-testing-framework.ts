import { performance } from 'perf_hooks'
import { getComponentLogger } from '../../src/lib/logging/StructuredLogger'

const logger = getComponentLogger('LoadTestingFramework')

export interface LoadTestConfig {
  name: string
  targetUrl: string
  concurrency: number
  duration: number // seconds
  requestsPerSecond?: number
  headers?: Record<string, string>
  body?: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  timeout?: number
  warmupTime?: number
  cooldownTime?: number
}

export interface LoadTestResult {
  testName: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  p50ResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  maxResponseTime: number
  minResponseTime: number
  requestsPerSecond: number
  errorRate: number
  throughput: number
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
  }
  cpuUsage: number
  errors: Array<{
    message: string
    count: number
    percentage: number
  }>
  latencyDistribution: number[]
  timestamps: number[]
}

export interface ServiceMeshMetrics {
  circuitBreakerTrips: number
  retryAttempts: number
  loadBalancerFailovers: number
  healthCheckFailures: number
  averageServiceTime: number
  queueDepth: number
  connectionPoolUtilization: number
}

/**
 * Load testing framework optimized for quota-constrained environments
 */
export class LoadTestingFramework {
  private results: LoadTestResult[] = []
  private isRunning = false
  private abortController: AbortController | null = null

  constructor(protected baseUrl: string = 'http://localhost:3001') {}

  /**
   * Run a single load test
   */
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    logger.info('Starting load test', {
      action: 'load_test_start',
      metadata: { 
        testName: config.name,
        concurrency: config.concurrency,
        duration: config.duration,
        targetUrl: config.targetUrl
      }
    })

    this.isRunning = true
    this.abortController = new AbortController()

    const startTime = performance.now()
    const responses: Array<{
      responseTime: number
      success: boolean
      error?: string
      timestamp: number
    }> = []

    const errors: Map<string, number> = new Map()
    let activeRequests = 0
    const maxConcurrency = config.concurrency

    // Warmup phase
    if (config.warmupTime) {
      await this.warmup(config)
    }

    // Main load test phase
    const testPromises: Promise<void>[] = []
    const testEndTime = startTime + (config.duration * 1000)

    // Request rate limiter
    const requestInterval = config.requestsPerSecond 
      ? 1000 / config.requestsPerSecond 
      : 0

    let requestCount = 0
    const startRequests = async () => {
      while (performance.now() < testEndTime && this.isRunning) {
        if (activeRequests < maxConcurrency) {
          activeRequests++
          requestCount++

          const requestPromise = this.makeRequest(config)
            .then(result => {
              responses.push(result)
              activeRequests--
            })
            .catch(error => {
              const errorMessage = error.message || 'Unknown error'
              errors.set(errorMessage, (errors.get(errorMessage) || 0) + 1)
              responses.push({
                responseTime: 0,
                success: false,
                error: errorMessage,
                timestamp: performance.now()
              })
              activeRequests--
            })

          testPromises.push(requestPromise)

          // Rate limiting
          if (requestInterval > 0) {
            await this.sleep(requestInterval)
          }
        } else {
          // Wait a bit if we're at max concurrency
          await this.sleep(10)
        }
      }
    }

    await startRequests()

    // Wait for all requests to complete
    await Promise.allSettled(testPromises)

    // Cooldown phase
    if (config.cooldownTime) {
      await this.cooldown(config)
    }

    const endTime = performance.now()
    const totalDuration = (endTime - startTime) / 1000

    // Calculate metrics
    const result = this.calculateMetrics(config, responses, errors, totalDuration)

    this.results.push(result)
    this.isRunning = false

    logger.info('Load test completed', {
      action: 'load_test_complete',
      metadata: {
        testName: config.name,
        totalRequests: result.totalRequests,
        successfulRequests: result.successfulRequests,
        averageResponseTime: result.averageResponseTime,
        requestsPerSecond: result.requestsPerSecond,
        errorRate: result.errorRate
      }
    })

    return result
  }

  /**
   * Run multiple load tests in sequence
   */
  async runTestSuite(configs: LoadTestConfig[]): Promise<LoadTestResult[]> {
    const results: LoadTestResult[] = []

    for (const config of configs) {
      try {
        const result = await this.runLoadTest(config)
        results.push(result)

        // Brief pause between tests
        await this.sleep(2000)
      } catch (error) {
        logger.error('Load test failed', {
          action: 'load_test_failed',
          errorType: error instanceof Error ? error.name : 'UnknownError',
          metadata: {
            testName: config.name,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }
    }

    return results
  }

  /**
   * Make a single HTTP request
   */
  private async makeRequest(config: LoadTestConfig): Promise<{
    responseTime: number
    success: boolean
    error?: string
    timestamp: number
  }> {
    const startTime = performance.now()
    const timestamp = startTime

    try {
      const response = await fetch(config.targetUrl, {
        method: config.method || 'GET',
        headers: config.headers || {},
        body: config.body,
        signal: this.abortController?.signal,
        // @ts-ignore - timeout is not in standard fetch but works in Node.js
        timeout: config.timeout || 30000
      })

      const responseTime = performance.now() - startTime
      const success = response.ok

      return {
        responseTime,
        success,
        error: success ? undefined : `HTTP ${response.status}`,
        timestamp
      }
    } catch (error) {
      const responseTime = performance.now() - startTime
      return {
        responseTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp
      }
    }
  }

  /**
   * Calculate test metrics
   */
  private calculateMetrics(
    config: LoadTestConfig,
    responses: Array<{
      responseTime: number
      success: boolean
      error?: string
      timestamp: number
    }>,
    errors: Map<string, number>,
    duration: number
  ): LoadTestResult {
    const totalRequests = responses.length
    const successfulRequests = responses.filter(r => r.success).length
    const failedRequests = totalRequests - successfulRequests

    const responseTimes = responses
      .filter(r => r.success)
      .map(r => r.responseTime)
      .sort((a, b) => a - b)

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0

    const p50ResponseTime = this.getPercentile(responseTimes, 0.5)
    const p95ResponseTime = this.getPercentile(responseTimes, 0.95)
    const p99ResponseTime = this.getPercentile(responseTimes, 0.99)
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0
    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0

    const requestsPerSecond = totalRequests / duration
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0
    const throughput = successfulRequests / duration

    // Memory usage
    const memoryUsage = process.memoryUsage()

    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage()
    const cpuPercentage = (cpuUsage.user + cpuUsage.system) / 1000000 / duration * 100

    // Error summary
    const errorSummary = Array.from(errors.entries()).map(([message, count]) => ({
      message,
      count,
      percentage: (count / totalRequests) * 100
    }))

    return {
      testName: config.name,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      p50ResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      maxResponseTime,
      minResponseTime,
      requestsPerSecond,
      errorRate,
      throughput,
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      cpuUsage: cpuPercentage,
      errors: errorSummary,
      latencyDistribution: responseTimes,
      timestamps: responses.map(r => r.timestamp)
    }
  }

  /**
   * Get percentile value from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0
    const index = Math.floor(sortedArray.length * percentile)
    return sortedArray[Math.min(index, sortedArray.length - 1)]
  }

  /**
   * Warmup phase
   */
  private async warmup(config: LoadTestConfig): Promise<void> {
    logger.info('Starting warmup phase', {
      action: 'warmup_start',
      metadata: { testName: config.name, duration: config.warmupTime }
    })

    const warmupRequests = Math.min(config.concurrency, 10)
    const warmupPromises = Array.from({ length: warmupRequests }, () => 
      this.makeRequest(config).catch(() => {})
    )

    await Promise.allSettled(warmupPromises)
    await this.sleep((config.warmupTime || 5) * 1000)
  }

  /**
   * Cooldown phase
   */
  private async cooldown(config: LoadTestConfig): Promise<void> {
    logger.info('Starting cooldown phase', {
      action: 'cooldown_start',
      metadata: { testName: config.name, duration: config.cooldownTime }
    })

    await this.sleep((config.cooldownTime || 2) * 1000)
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Stop running tests
   */
  stopTests(): void {
    this.isRunning = false
    if (this.abortController) {
      this.abortController.abort()
    }
  }

  /**
   * Get all test results
   */
  getResults(): LoadTestResult[] {
    return [...this.results]
  }

  /**
   * Clear test results
   */
  clearResults(): void {
    this.results = []
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    if (this.results.length === 0) {
      return 'No test results available'
    }

    let report = '# Load Testing Performance Report\n\n'
    
    for (const result of this.results) {
      report += `## Test: ${result.testName}\n\n`
      report += `### Summary\n`
      report += `- **Total Requests**: ${result.totalRequests}\n`
      report += `- **Successful Requests**: ${result.successfulRequests}\n`
      report += `- **Failed Requests**: ${result.failedRequests}\n`
      report += `- **Error Rate**: ${result.errorRate.toFixed(2)}%\n`
      report += `- **Requests/Second**: ${result.requestsPerSecond.toFixed(2)}\n`
      report += `- **Throughput**: ${result.throughput.toFixed(2)} successful requests/second\n\n`

      report += `### Response Times\n`
      report += `- **Average**: ${result.averageResponseTime.toFixed(2)}ms\n`
      report += `- **P50**: ${result.p50ResponseTime.toFixed(2)}ms\n`
      report += `- **P95**: ${result.p95ResponseTime.toFixed(2)}ms\n`
      report += `- **P99**: ${result.p99ResponseTime.toFixed(2)}ms\n`
      report += `- **Min**: ${result.minResponseTime.toFixed(2)}ms\n`
      report += `- **Max**: ${result.maxResponseTime.toFixed(2)}ms\n\n`

      report += `### Resource Usage\n`
      report += `- **Memory (Heap Used)**: ${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB\n`
      report += `- **Memory (Heap Total)**: ${(result.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB\n`
      report += `- **CPU Usage**: ${result.cpuUsage.toFixed(2)}%\n\n`

      if (result.errors.length > 0) {
        report += `### Errors\n`
        for (const error of result.errors) {
          report += `- **${error.message}**: ${error.count} (${error.percentage.toFixed(2)}%)\n`
        }
        report += '\n'
      }

      report += '---\n\n'
    }

    return report
  }
}

/**
 * Service mesh specific load testing
 */
export class ServiceMeshLoadTester extends LoadTestingFramework {
  /**
   * Test service mesh circuit breaker
   */
  async testCircuitBreaker(): Promise<LoadTestResult> {
    return this.runLoadTest({
      name: 'Circuit Breaker Test',
      targetUrl: `${this.baseUrl}/api/service-mesh/health`,
      concurrency: 50,
      duration: 30,
      requestsPerSecond: 100,
      method: 'GET',
      timeout: 5000
    })
  }

  /**
   * Test service mesh retry mechanism
   */
  async testRetryMechanism(): Promise<LoadTestResult> {
    return this.runLoadTest({
      name: 'Retry Mechanism Test',
      targetUrl: `${this.baseUrl}/api/service-mesh/metrics`,
      concurrency: 20,
      duration: 60,
      requestsPerSecond: 50,
      method: 'GET',
      timeout: 10000
    })
  }

  /**
   * Test load balancer performance
   */
  async testLoadBalancer(): Promise<LoadTestResult> {
    return this.runLoadTest({
      name: 'Load Balancer Test',
      targetUrl: `${this.baseUrl}/health`,
      concurrency: 100,
      duration: 45,
      requestsPerSecond: 200,
      method: 'GET',
      timeout: 3000
    })
  }

  /**
   * Test under memory pressure
   */
  async testMemoryPressure(): Promise<LoadTestResult> {
    return this.runLoadTest({
      name: 'Memory Pressure Test',
      targetUrl: `${this.baseUrl}/api/service-mesh/metrics`,
      concurrency: 30,
      duration: 120,
      requestsPerSecond: 25,
      method: 'GET',
      timeout: 15000,
      warmupTime: 10,
      cooldownTime: 5
    })
  }

  /**
   * Run comprehensive service mesh test suite
   */
  async runServiceMeshTestSuite(): Promise<LoadTestResult[]> {
    const configs: LoadTestConfig[] = [
      {
        name: 'Baseline Performance',
        targetUrl: `${this.baseUrl}/health`,
        concurrency: 10,
        duration: 30,
        requestsPerSecond: 20,
        method: 'GET'
      },
      {
        name: 'Service Mesh Health Check',
        targetUrl: `${this.baseUrl}/api/service-mesh/health`,
        concurrency: 25,
        duration: 45,
        requestsPerSecond: 40,
        method: 'GET'
      },
      {
        name: 'Service Mesh Metrics',
        targetUrl: `${this.baseUrl}/api/service-mesh/metrics`,
        concurrency: 15,
        duration: 60,
        requestsPerSecond: 30,
        method: 'GET'
      },
      {
        name: 'High Concurrency Test',
        targetUrl: `${this.baseUrl}/api/service-mesh/health`,
        concurrency: 50,
        duration: 30,
        requestsPerSecond: 80,
        method: 'GET',
        timeout: 5000
      },
      {
        name: 'Sustained Load Test',
        targetUrl: `${this.baseUrl}/health`,
        concurrency: 20,
        duration: 180,
        requestsPerSecond: 35,
        method: 'GET',
        warmupTime: 15,
        cooldownTime: 10
      }
    ]

    return this.runTestSuite(configs)
  }
}

// Export singleton instance
export const serviceMeshLoadTester = new ServiceMeshLoadTester()
export const loadTestingFramework = new LoadTestingFramework() 