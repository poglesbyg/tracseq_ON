import { getComponentLogger } from '../logging/StructuredLogger'
import { applicationMetrics } from '../monitoring/MetricsCollector'
import { EventEmitter } from 'events'

// Express types for middleware
interface Request {
  path: string
  method: string
  headers: Record<string, string | string[] | undefined>
}

interface Response {
  setHeader(name: string, value: string): void
}

interface NextFunction {
  (error?: any): void
}

const logger = getComponentLogger('QuotaOptimizedServiceMesh')

/**
 * Service mesh configuration optimized for resource quota constraints
 */
export interface ServiceMeshConfig {
  enabled: boolean
  mode: 'integrated' | 'sidecar'
  features: {
    circuitBreaker: {
      enabled: boolean
      failureThreshold: number
      timeout: string
      halfOpenRequests: number
    }
    loadBalancer: {
      strategy: 'round-robin' | 'least-connections' | 'random'
      healthCheck: {
        enabled: boolean
        interval: string
        timeout: string
        path: string
      }
    }
    retry: {
      enabled: boolean
      maxAttempts: number
      backoff: 'linear' | 'exponential'
      initialDelay: string
    }
    metrics: {
      enabled: boolean
      port: number
      path: string
      interval: string
    }
    tracing: {
      enabled: boolean
    }
    mutualTLS: {
      enabled: boolean
    }
  }
  routing: {
    rules: Array<{
      match: {
        headers?: Record<string, string>
        path?: string
        method?: string
      }
      route: {
        destination: string
        weight: number
        timeout?: string
      }
    }>
  }
  resilience: {
    timeout: string
    retry: {
      attempts: number
      backoff: 'linear' | 'exponential'
    }
    circuitBreaker: {
      enabled: boolean
      threshold: number
      timeout: string
    }
  }
}

/**
 * Circuit breaker states
 */
enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open'
}

/**
 * Circuit breaker implementation
 */
class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failures = 0
  private lastFailureTime = 0
  private halfOpenRequests = 0

  constructor(
    private threshold: number,
    private timeout: number,
    private maxHalfOpenRequests: number
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = CircuitBreakerState.HALF_OPEN
        this.halfOpenRequests = 0
        logger.info('Circuit breaker transitioning to half-open state')
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.halfOpenRequests >= this.maxHalfOpenRequests) {
        throw new Error('Circuit breaker half-open request limit exceeded')
      }
      this.halfOpenRequests++
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED
      logger.info('Circuit breaker closed after successful request')
    }
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.threshold) {
      this.state = CircuitBreakerState.OPEN
      logger.warn('Circuit breaker opened due to failures', {
        metadata: {
          failures: this.failures,
          threshold: this.threshold
        }
      })
    }
  }

  getState(): CircuitBreakerState {
    return this.state
  }

  getMetrics() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      halfOpenRequests: this.halfOpenRequests
    }
  }
}

/**
 * Load balancer implementation
 */
class LoadBalancer {
  private currentIndex = 0
  private endpoints: Array<{ url: string; healthy: boolean; weight: number }> = []

  constructor(private strategy: 'round-robin' | 'least-connections' | 'random') {}

  addEndpoint(url: string, weight = 1): void {
    this.endpoints.push({ url, healthy: true, weight })
  }

  removeEndpoint(url: string): void {
    this.endpoints = this.endpoints.filter(ep => ep.url !== url)
  }

  getNextEndpoint(): string | null {
    const healthyEndpoints = this.endpoints.filter(ep => ep.healthy)
    
    if (healthyEndpoints.length === 0) {
      return null
    }

    switch (this.strategy) {
      case 'round-robin':
        const endpoint = healthyEndpoints[this.currentIndex % healthyEndpoints.length]
        this.currentIndex++
        return endpoint?.url || null

      case 'random':
        const randomIndex = Math.floor(Math.random() * healthyEndpoints.length)
        return healthyEndpoints[randomIndex]?.url || null

      case 'least-connections':
        // Simplified implementation - would need connection tracking in production
        return healthyEndpoints[0]?.url || null

      default:
        return healthyEndpoints[0]?.url || null
    }
  }

  markUnhealthy(url: string): void {
    const endpoint = this.endpoints.find(ep => ep.url === url)
    if (endpoint) {
      endpoint.healthy = false
      logger.warn('Endpoint marked unhealthy', { metadata: { url } })
    }
  }

  markHealthy(url: string): void {
    const endpoint = this.endpoints.find(ep => ep.url === url)
    if (endpoint) {
      endpoint.healthy = true
      logger.info('Endpoint marked healthy', { metadata: { url } })
    }
  }

  getEndpoints() {
    return [...this.endpoints]
  }
}

/**
 * Retry mechanism implementation
 */
class RetryManager {
  constructor(
    private maxAttempts: number,
    private backoffStrategy: 'linear' | 'exponential',
    private initialDelay: number
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt === this.maxAttempts) {
          logger.error('All retry attempts exhausted', {
            attempts: attempt,
            error: lastError.message
          })
          break
        }

        const delay = this.calculateDelay(attempt)
        logger.warn('Request failed, retrying', {
          attempt,
          delay,
          error: lastError.message
        })
        
        await this.sleep(delay)
      }
    }

    throw lastError
  }

  private calculateDelay(attempt: number): number {
    switch (this.backoffStrategy) {
      case 'linear':
        return this.initialDelay * attempt
      case 'exponential':
        return this.initialDelay * Math.pow(2, attempt - 1)
      default:
        return this.initialDelay
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Quota-optimized service mesh implementation
 * Integrates directly into the application without requiring additional pods/services
 */
export class QuotaOptimizedServiceMesh extends EventEmitter {
  private config: ServiceMeshConfig
  private circuitBreaker: CircuitBreaker | null = null
  private loadBalancer: LoadBalancer | null = null
  private retryManager: RetryManager | null = null
  private metrics = {
    requests: 0,
    failures: 0,
    retries: 0,
    circuitBreakerTrips: 0,
    averageResponseTime: 0,
    responseTimes: [] as number[]
  }

  constructor(config: ServiceMeshConfig) {
    super()
    this.config = config
    this.initialize()
  }

  private initialize(): void {
    logger.info('Initializing quota-optimized service mesh', {
      mode: this.config.mode,
      features: Object.keys(this.config.features).filter(
        key => this.config.features[key as keyof typeof this.config.features]?.enabled
      )
    })

    if (this.config.features.circuitBreaker.enabled) {
      this.circuitBreaker = new CircuitBreaker(
        this.config.features.circuitBreaker.failureThreshold,
        this.parseTimeString(this.config.features.circuitBreaker.timeout),
        this.config.features.circuitBreaker.halfOpenRequests
      )
    }

    if (this.config.features.loadBalancer) {
      this.loadBalancer = new LoadBalancer(this.config.features.loadBalancer.strategy)
      // Add self as endpoint for internal routing
      this.loadBalancer.addEndpoint('http://localhost:3001', 1)
    }

    if (this.config.features.retry.enabled) {
      this.retryManager = new RetryManager(
        this.config.features.retry.maxAttempts,
        this.config.features.retry.backoff,
        this.parseTimeString(this.config.features.retry.initialDelay)
      )
    }

    // Start health check if enabled
    if (this.config.features.loadBalancer.healthCheck.enabled) {
      this.startHealthCheck()
    }

    // Start metrics collection if enabled
    if (this.config.features.metrics.enabled) {
      this.startMetricsCollection()
    }
  }

  /**
   * Express middleware for service mesh integration
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now()
      
      try {
        // Apply routing rules
        const routingResult = this.applyRoutingRules(req)
        if (routingResult.shouldRoute) {
          req.headers['x-service-mesh-route'] = routingResult.destination
        }

        // Apply circuit breaker if enabled
        if (this.circuitBreaker) {
          await this.circuitBreaker.execute(async () => {
            await this.processRequest(req, res, next)
          })
        } else {
          await this.processRequest(req, res, next)
        }

        // Record metrics
        this.recordMetrics(startTime, true)
        
      } catch (error) {
        this.recordMetrics(startTime, false)
        
        logger.error('Service mesh middleware error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path,
          method: req.method
        })
        
        // Pass error to next middleware
        next(error)
      }
    }
  }

  private async processRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Add service mesh headers
    res.setHeader('x-service-mesh', 'quota-optimized')
    res.setHeader('x-service-mesh-version', '1.0.0')
    
    // Continue to next middleware
    next()
  }

  private applyRoutingRules(req: Request): { shouldRoute: boolean; destination: string } {
    for (const rule of this.config.routing.rules) {
      let matches = true

      // Check header matches
      if (rule.match.headers) {
        for (const [headerName, headerValue] of Object.entries(rule.match.headers)) {
          if (req.headers[headerName.toLowerCase()] !== headerValue) {
            matches = false
            break
          }
        }
      }

      // Check path matches
      if (rule.match.path && matches) {
        const pathPattern = new RegExp(rule.match.path.replace('*', '.*'))
        matches = pathPattern.test(req.path)
      }

      // Check method matches
      if (rule.match.method && matches) {
        matches = req.method === rule.match.method
      }

      if (matches) {
        return {
          shouldRoute: true,
          destination: rule.route.destination
        }
      }
    }

    return { shouldRoute: false, destination: '' }
  }

  private recordMetrics(startTime: number, success: boolean): void {
    const responseTime = Date.now() - startTime
    
    this.metrics.requests++
    if (!success) {
      this.metrics.failures++
    }
    
    this.metrics.responseTimes.push(responseTime)
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes.shift()
    }
    
    this.metrics.averageResponseTime = 
      this.metrics.responseTimes.reduce((sum, time) => sum + time, 0) / 
      this.metrics.responseTimes.length
  }

  private startHealthCheck(): void {
    const interval = this.parseTimeString(this.config.features.loadBalancer.healthCheck.interval)
    
    setInterval(async () => {
      if (this.loadBalancer) {
        const endpoints = this.loadBalancer.getEndpoints()
        
        for (const endpoint of endpoints) {
          try {
            // Simplified health check - in production would use actual HTTP requests
            const isHealthy = await this.checkEndpointHealth(endpoint.url)
            
            if (isHealthy) {
              this.loadBalancer.markHealthy(endpoint.url)
            } else {
              this.loadBalancer.markUnhealthy(endpoint.url)
            }
          } catch (error) {
            this.loadBalancer.markUnhealthy(endpoint.url)
          }
        }
      }
    }, interval)
  }

  private async checkEndpointHealth(url: string): Promise<boolean> {
    // Simplified health check - always return true for localhost
    if (url.includes('localhost')) {
      return true
    }
    
    // In production, implement actual HTTP health check
    return true
  }

  private startMetricsCollection(): void {
    const interval = this.parseTimeString(this.config.features.metrics.interval)
    
    setInterval(() => {
      this.emit('metrics', this.getMetrics())
    }, interval)
  }

  private parseTimeString(timeStr: string): number {
    const match = timeStr.match(/^(\d+)(ms|s|m|h)$/)
    if (!match) {
      return 1000 // Default to 1 second
    }
    
    const value = parseInt(match[1])
    const unit = match[2]
    
    switch (unit) {
      case 'ms': return value
      case 's': return value * 1000
      case 'm': return value * 60 * 1000
      case 'h': return value * 60 * 60 * 1000
      default: return value
    }
  }

  /**
   * Get service mesh health status
   */
  async getHealth(): Promise<{
    healthy: boolean
    components: Record<string, { healthy: boolean; details?: any }>
  }> {
    const components: Record<string, { healthy: boolean; details?: any }> = {}

    // Check circuit breaker
    if (this.circuitBreaker) {
      const metrics = this.circuitBreaker.getMetrics()
      components.circuitBreaker = {
        healthy: metrics.state !== 'open',
        details: metrics
      }
    }

    // Check load balancer
    if (this.loadBalancer) {
      const endpoints = this.loadBalancer.getEndpoints()
      const healthyEndpoints = endpoints.filter(ep => ep.healthy)
      components.loadBalancer = {
        healthy: healthyEndpoints.length > 0,
        details: { endpoints: endpoints.length, healthy: healthyEndpoints.length }
      }
    }

    // Overall health
    const allHealthy = Object.values(components).every(comp => comp.healthy)

    return {
      healthy: allHealthy,
      components
    }
  }

  /**
   * Get service mesh metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      circuitBreaker: this.circuitBreaker?.getMetrics(),
      loadBalancer: this.loadBalancer?.getEndpoints(),
      config: {
        mode: this.config.mode,
        features: Object.keys(this.config.features).filter(
          key => this.config.features[key as keyof typeof this.config.features]?.enabled
        )
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ServiceMeshConfig>): void {
    this.config = { ...this.config, ...newConfig }
    logger.info('Service mesh configuration updated', { config: this.config })
    this.emit('configUpdated', this.config)
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down quota-optimized service mesh')
    this.removeAllListeners()
  }
}

// Export singleton instance
export const quotaOptimizedServiceMesh = new QuotaOptimizedServiceMesh({
  enabled: true,
  mode: 'integrated',
  features: {
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      timeout: '30s',
      halfOpenRequests: 3
    },
    loadBalancer: {
      strategy: 'round-robin',
      healthCheck: {
        enabled: true,
        interval: '30s',
        timeout: '5s',
        path: '/health'
      }
    },
    retry: {
      enabled: true,
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelay: '100ms'
    },
    metrics: {
      enabled: true,
      port: 8080,
      path: '/metrics',
      interval: '15s'
    },
    tracing: {
      enabled: false
    },
    mutualTLS: {
      enabled: false
    }
  },
  routing: {
    rules: [
      {
        match: { headers: { 'x-canary-user': 'true' } },
        route: { destination: 'nanopore-tracking-app', weight: 100 }
      },
      {
        match: { path: '/api/*' },
        route: { destination: 'nanopore-tracking-app', weight: 100, timeout: '60s' }
      }
    ]
  },
  resilience: {
    timeout: '30s',
    retry: {
      attempts: 3,
      backoff: 'exponential'
    },
    circuitBreaker: {
      enabled: true,
      threshold: 5,
      timeout: '30s'
    }
  }
})

export default quotaOptimizedServiceMesh 