import { getComponentLogger } from '../logging/StructuredLogger'

/**
 * Metric types supported by the monitoring system
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary'

/**
 * Metric data structure
 */
export interface Metric {
  name: string
  type: MetricType
  value: number
  labels: Record<string, string>
  timestamp: number
  help?: string
  unit?: string
}

/**
 * Histogram bucket configuration
 */
export interface HistogramBucket {
  le: number // Less than or equal to
  count: number
}

/**
 * Summary quantile configuration
 */
export interface SummaryQuantile {
  quantile: number
  value: number
}

/**
 * Counter metric - monotonically increasing value
 */
export class Counter {
  private value = 0
  private readonly labels: Record<string, string> = {}

  constructor(
    private readonly name: string,
    private readonly help: string,
    labels: Record<string, string> = {}
  ) {
    this.labels = labels
  }

  /**
   * Increment the counter by a value (default 1)
   */
  inc(value: number = 1): void {
    this.value += value
  }

  /**
   * Get current value
   */
  getValue(): number {
    return this.value
  }

  /**
   * Get metric representation
   */
  getMetric(): Metric {
    return {
      name: this.name,
      type: 'counter',
      value: this.value,
      labels: this.labels,
      timestamp: Date.now(),
      help: this.help
    }
  }
}

/**
 * Gauge metric - value that can go up and down
 */
export class Gauge {
  private value = 0
  private readonly labels: Record<string, string> = {}

  constructor(
    private readonly name: string,
    private readonly help: string,
    labels: Record<string, string> = {}
  ) {
    this.labels = labels
  }

  /**
   * Set the gauge value
   */
  set(value: number): void {
    this.value = value
  }

  /**
   * Increment the gauge by a value
   */
  inc(value: number = 1): void {
    this.value += value
  }

  /**
   * Decrement the gauge by a value
   */
  dec(value: number = 1): void {
    this.value -= value
  }

  /**
   * Get current value
   */
  getValue(): number {
    return this.value
  }

  /**
   * Get metric representation
   */
  getMetric(): Metric {
    return {
      name: this.name,
      type: 'gauge',
      value: this.value,
      labels: this.labels,
      timestamp: Date.now(),
      help: this.help
    }
  }
}

/**
 * Histogram metric - tracks distribution of values
 */
export class Histogram {
  private buckets: Map<number, number> = new Map()
  private sum = 0
  private count = 0
  private readonly labels: Record<string, string> = {}

  constructor(
    private readonly name: string,
    private readonly help: string,
    private readonly bucketBounds: number[] = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0],
    labels: Record<string, string> = {}
  ) {
    this.labels = labels
    // Initialize buckets
    for (const bound of bucketBounds) {
      this.buckets.set(bound, 0)
    }
    this.buckets.set(Infinity, 0) // +Inf bucket
  }

  /**
   * Observe a value
   */
  observe(value: number): void {
    this.sum += value
    this.count += 1

    // Update buckets
    for (const [bound, count] of this.buckets) {
      if (value <= bound) {
        this.buckets.set(bound, count + 1)
      }
    }
  }

  /**
   * Get histogram buckets
   */
  getBuckets(): HistogramBucket[] {
    return Array.from(this.buckets.entries()).map(([le, count]) => ({
      le,
      count
    }))
  }

  /**
   * Get metric representation
   */
  getMetric(): Metric {
    return {
      name: this.name,
      type: 'histogram',
      value: this.sum,
      labels: this.labels,
      timestamp: Date.now(),
      help: this.help
    }
  }

  /**
   * Get count of observations
   */
  getCount(): number {
    return this.count
  }

  /**
   * Get sum of all observations
   */
  getSum(): number {
    return this.sum
  }
}

/**
 * Timer utility for measuring duration
 */
export class Timer {
  private startTime: number

  constructor(private readonly histogram: Histogram) {
    this.startTime = Date.now()
  }

  /**
   * Stop the timer and record the duration
   */
  stop(): number {
    const duration = (Date.now() - this.startTime) / 1000 // Convert to seconds
    this.histogram.observe(duration)
    return duration
  }
}

/**
 * Metrics registry - central store for all metrics
 */
export class MetricsRegistry {
  private metrics: Map<string, Counter | Gauge | Histogram> = new Map()
  private readonly logger = getComponentLogger('MetricsRegistry')

  /**
   * Register a counter metric
   */
  registerCounter(name: string, help: string, labels: Record<string, string> = {}): Counter {
    const key = this.generateKey(name, labels)
    if (this.metrics.has(key)) {
      const existing = this.metrics.get(key)
      if (existing instanceof Counter) {
        return existing
      }
      throw new Error(`Metric ${key} already exists with different type`)
    }

    const counter = new Counter(name, help, labels)
    this.metrics.set(key, counter)
    return counter
  }

  /**
   * Register a gauge metric
   */
  registerGauge(name: string, help: string, labels: Record<string, string> = {}): Gauge {
    const key = this.generateKey(name, labels)
    if (this.metrics.has(key)) {
      const existing = this.metrics.get(key)
      if (existing instanceof Gauge) {
        return existing
      }
      throw new Error(`Metric ${key} already exists with different type`)
    }

    const gauge = new Gauge(name, help, labels)
    this.metrics.set(key, gauge)
    return gauge
  }

  /**
   * Register a histogram metric
   */
  registerHistogram(name: string, help: string, buckets?: number[], labels: Record<string, string> = {}): Histogram {
    const key = this.generateKey(name, labels)
    if (this.metrics.has(key)) {
      const existing = this.metrics.get(key)
      if (existing instanceof Histogram) {
        return existing
      }
      throw new Error(`Metric ${key} already exists with different type`)
    }

    const histogram = new Histogram(name, help, buckets, labels)
    this.metrics.set(key, histogram)
    return histogram
  }

  /**
   * Get or create a counter
   */
  getOrCreateCounter(name: string, help: string, labels: Record<string, string> = {}): Counter {
    const key = this.generateKey(name, labels)
    const existing = this.metrics.get(key)
    if (existing instanceof Counter) {
      return existing
    }
    return this.registerCounter(name, help, labels)
  }

  /**
   * Get or create a gauge
   */
  getOrCreateGauge(name: string, help: string, labels: Record<string, string> = {}): Gauge {
    const key = this.generateKey(name, labels)
    const existing = this.metrics.get(key)
    if (existing instanceof Gauge) {
      return existing
    }
    return this.registerGauge(name, help, labels)
  }

  /**
   * Get or create a histogram
   */
  getOrCreateHistogram(name: string, help: string, buckets?: number[], labels: Record<string, string> = {}): Histogram {
    const key = this.generateKey(name, labels)
    const existing = this.metrics.get(key)
    if (existing instanceof Histogram) {
      return existing
    }
    return this.registerHistogram(name, help, buckets, labels)
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Metric[] {
    return Array.from(this.metrics.values()).map(metric => metric.getMetric())
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = []
    const metrics = this.getAllMetrics()

    for (const metric of metrics) {
      // Add help comment
      if (metric.help) {
        lines.push(`# HELP ${metric.name} ${metric.help}`)
      }
      
      // Add type comment
      lines.push(`# TYPE ${metric.name} ${metric.type}`)

      // Format labels
      const labelStr = Object.entries(metric.labels)
        .map(([key, value]) => `${key}="${value}"`)
        .join(',')
      
      const labelPart = labelStr ? `{${labelStr}}` : ''

      if (metric.type === 'histogram') {
        const histogramMetric = this.metrics.get(this.generateKey(metric.name, metric.labels))
        if (histogramMetric instanceof Histogram) {
          // Add bucket metrics
          for (const bucket of histogramMetric.getBuckets()) {
            const bucketLabelStr = labelStr ? `${labelStr},le="${bucket.le}"` : `le="${bucket.le}"`
            lines.push(`${metric.name}_bucket{${bucketLabelStr}} ${bucket.count}`)
          }
          
          // Add sum and count
          lines.push(`${metric.name}_sum${labelPart} ${histogramMetric.getSum()}`)
          lines.push(`${metric.name}_count${labelPart} ${histogramMetric.getCount()}`)
        }
      } else {
        lines.push(`${metric.name}${labelPart} ${metric.value}`)
      }
    }

    return lines.join('\n')
  }

  /**
   * Generate a unique key for a metric
   */
  private generateKey(name: string, labels: Record<string, string>): string {
    const labelKeys = Object.keys(labels).sort()
    const labelStr = labelKeys.map(key => `${key}=${labels[key]}`).join(',')
    return `${name}{${labelStr}}`
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clear(): void {
    this.metrics.clear()
  }
}

/**
 * Application metrics - predefined metrics for the nanopore tracking app
 */
export class ApplicationMetrics {
  private readonly registry: MetricsRegistry
  private readonly logger = getComponentLogger('ApplicationMetrics')

  // HTTP metrics
  public readonly httpRequestsTotal: Counter
  public readonly httpRequestDuration: Histogram
  public readonly httpRequestSize: Histogram
  public readonly httpResponseSize: Histogram

  // Database metrics
  public readonly dbQueriesTotal: Counter
  public readonly dbQueryDuration: Histogram
  public readonly dbConnectionsActive: Gauge

  // Business metrics
  public readonly samplesTotal: Counter
  public readonly samplesByStatus: Gauge
  public readonly samplesByPriority: Gauge
  public readonly sampleProcessingTime: Histogram

  // System metrics
  public readonly memoryUsage: Gauge
  public readonly cpuUsage: Gauge
  public readonly activeRequests: Gauge

  // Error metrics
  public readonly errorsTotal: Counter
  public readonly errorsByType: Counter

  constructor(registry: MetricsRegistry) {
    this.registry = registry

    // Initialize HTTP metrics
    this.httpRequestsTotal = registry.registerCounter(
      'http_requests_total',
      'Total number of HTTP requests'
    )
    this.httpRequestDuration = registry.registerHistogram(
      'http_request_duration_seconds',
      'Duration of HTTP requests',
      [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
    )
    this.httpRequestSize = registry.registerHistogram(
      'http_request_size_bytes',
      'Size of HTTP requests in bytes'
    )
    this.httpResponseSize = registry.registerHistogram(
      'http_response_size_bytes',
      'Size of HTTP responses in bytes'
    )

    // Initialize database metrics
    this.dbQueriesTotal = registry.registerCounter(
      'db_queries_total',
      'Total number of database queries'
    )
    this.dbQueryDuration = registry.registerHistogram(
      'db_query_duration_seconds',
      'Duration of database queries',
      [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
    )
    this.dbConnectionsActive = registry.registerGauge(
      'db_connections_active',
      'Number of active database connections'
    )

    // Initialize business metrics
    this.samplesTotal = registry.registerCounter(
      'samples_total',
      'Total number of samples created'
    )
    this.samplesByStatus = registry.registerGauge(
      'samples_by_status',
      'Number of samples by status'
    )
    this.samplesByPriority = registry.registerGauge(
      'samples_by_priority',
      'Number of samples by priority'
    )
    this.sampleProcessingTime = registry.registerHistogram(
      'sample_processing_time_seconds',
      'Time taken to process samples through workflow stages'
    )

    // Initialize system metrics
    this.memoryUsage = registry.registerGauge(
      'memory_usage_bytes',
      'Memory usage in bytes'
    )
    this.cpuUsage = registry.registerGauge(
      'cpu_usage_percent',
      'CPU usage percentage'
    )
    this.activeRequests = registry.registerGauge(
      'active_requests',
      'Number of active requests'
    )

    // Initialize error metrics
    this.errorsTotal = registry.registerCounter(
      'errors_total',
      'Total number of errors'
    )
    this.errorsByType = registry.registerCounter(
      'errors_by_type',
      'Number of errors by type'
    )

    // Start collecting system metrics
    this.startSystemMetricsCollection()
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method: string, path: string, statusCode: number, duration: number, requestSize?: number, responseSize?: number): void {
    const labels = { method, path, status_code: statusCode.toString() }
    
    this.registry.getOrCreateCounter('http_requests_total', 'Total HTTP requests', labels).inc()
    this.registry.getOrCreateHistogram('http_request_duration_seconds', 'HTTP request duration', undefined, labels).observe(duration)
    
    if (requestSize) {
      this.httpRequestSize.observe(requestSize)
    }
    if (responseSize) {
      this.httpResponseSize.observe(responseSize)
    }
  }

  /**
   * Record database query metrics
   */
  recordDatabaseQuery(operation: string, table: string, duration: number): void {
    const labels = { operation, table }
    
    this.registry.getOrCreateCounter('db_queries_total', 'Total database queries', labels).inc()
    this.registry.getOrCreateHistogram('db_query_duration_seconds', 'Database query duration', undefined, labels).observe(duration)
  }

  /**
   * Record sample creation
   */
  recordSampleCreated(sampleType: string, priority: string): void {
    const labels = { sample_type: sampleType, priority }
    this.registry.getOrCreateCounter('samples_total', 'Total samples created', labels).inc()
  }

  /**
   * Record error
   */
  recordError(errorType: string, component: string): void {
    const labels = { error_type: errorType, component }
    this.registry.getOrCreateCounter('errors_total', 'Total errors', labels).inc()
  }

  /**
   * Start collecting system metrics
   */
  private startSystemMetricsCollection(): void {
    setInterval(() => {
      try {
        // Memory usage
        const memUsage = process.memoryUsage()
        this.memoryUsage.set(memUsage.heapUsed)
        
        // CPU usage (simplified)
        const cpuUsage = process.cpuUsage()
        this.cpuUsage.set((cpuUsage.user + cpuUsage.system) / 1000000) // Convert to percentage
        
      } catch (error) {
        this.logger.error('Failed to collect system metrics', {
          errorType: error instanceof Error ? error.name : 'Unknown'
        }, error instanceof Error ? error : undefined)
      }
    }, 10000) // Collect every 10 seconds
  }
}

/**
 * Global metrics registry and application metrics
 */
export const metricsRegistry = new MetricsRegistry()
export const applicationMetrics = new ApplicationMetrics(metricsRegistry)

/**
 * Helper function to time function execution
 */
export function timeFunction<T>(histogram: Histogram, fn: () => T): T {
  const timer = new Timer(histogram)
  try {
    const result = fn()
    timer.stop()
    return result
  } catch (error) {
    timer.stop()
    throw error
  }
}

/**
 * Helper function to time async function execution
 */
export async function timeAsyncFunction<T>(histogram: Histogram, fn: () => Promise<T>): Promise<T> {
  const timer = new Timer(histogram)
  try {
    const result = await fn()
    timer.stop()
    return result
  } catch (error) {
    timer.stop()
    throw error
  }
} 