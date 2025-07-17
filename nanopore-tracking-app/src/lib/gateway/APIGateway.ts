import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { ConfigManager } from '../config/ConfigManager'
import { StructuredLogger } from '../logging/StructuredLogger'

// Service endpoint configuration
interface ServiceEndpoint {
  name: string
  baseUrl: string
  healthCheckUrl: string
  timeout: number
  retries: number
  circuitBreaker: {
    failureThreshold: number
    recoveryTimeout: number
  }
}

// Circuit breaker state
interface CircuitBreakerState {
  failures: number
  lastFailureTime: number | null
  state: 'closed' | 'open' | 'half-open'
}

// Request context for tracking
interface RequestContext {
  requestId: string
  timestamp: number
  service: string
  method: string
  path: string
  userId?: string
  ip?: string
}

export class APIGateway {
  private static instance: APIGateway
  private config: ConfigManager
  private logger: StructuredLogger
  private services: Map<string, ServiceEndpoint> = new Map()
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map()
  private rateLimiters: Map<string, { requests: number; resetTime: number }> = new Map()

  private constructor() {
    this.config = ConfigManager.getInstance()
    this.logger = new StructuredLogger('api-gateway')
    this.initializeServices()
  }

  static getInstance(): APIGateway {
    if (!APIGateway.instance) {
      APIGateway.instance = new APIGateway()
    }
    return APIGateway.instance
  }

  private initializeServices(): void {
    // Sample Management Service
    this.services.set('sample-management', {
      name: 'sample-management',
      baseUrl: this.config.get('SAMPLE_SERVICE_URL', 'http://localhost:3002'),
      healthCheckUrl: '/health',
      timeout: 30000,
      retries: 3,
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 60000
      }
    })

    // AI Processing Service
    this.services.set('ai-processing', {
      name: 'ai-processing',
      baseUrl: this.config.get('AI_SERVICE_URL', 'http://localhost:3003'),
      healthCheckUrl: '/health',
      timeout: 60000,
      retries: 2,
      circuitBreaker: {
        failureThreshold: 3,
        recoveryTimeout: 30000
      }
    })

    // Authentication Service
    this.services.set('authentication', {
      name: 'authentication',
      baseUrl: this.config.get('AUTH_SERVICE_URL', 'http://localhost:3004'),
      healthCheckUrl: '/health',
      timeout: 10000,
      retries: 3,
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 30000
      }
    })

    // File Storage Service
    this.services.set('file-storage', {
      name: 'file-storage',
      baseUrl: this.config.get('FILE_SERVICE_URL', 'http://localhost:3005'),
      healthCheckUrl: '/health',
      timeout: 45000,
      retries: 2,
      circuitBreaker: {
        failureThreshold: 3,
        recoveryTimeout: 45000
      }
    })

    // Audit Service
    this.services.set('audit', {
      name: 'audit',
      baseUrl: this.config.get('AUDIT_SERVICE_URL', 'http://localhost:3006'),
      healthCheckUrl: '/health',
      timeout: 15000,
      retries: 3,
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 30000
      }
    })

    // Initialize circuit breakers
    for (const [serviceName] of this.services) {
      this.circuitBreakers.set(serviceName, {
        failures: 0,
        lastFailureTime: null,
        state: 'closed'
      })
    }
  }

  /**
   * Route request to appropriate service
   */
  async routeRequest(
    serviceName: string,
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: any,
    context?: Partial<RequestContext>
  ): Promise<Response> {
    const requestId = context?.requestId || this.generateRequestId()
    const requestContext: RequestContext = {
      requestId,
      timestamp: Date.now(),
      service: serviceName,
      method,
      path,
      userId: context?.userId,
      ip: context?.ip
    }

    try {
      // Log incoming request
      this.logger.info('Incoming request', { ...requestContext })

      // Validate service exists
      const service = this.services.get(serviceName)
      if (!service) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Service ${serviceName} not found`
        })
      }

      // Check rate limiting
      if (!this.checkRateLimit(serviceName, requestContext)) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded'
        })
      }

      // Check circuit breaker
      if (!this.checkCircuitBreaker(serviceName)) {
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: `Service ${serviceName} is temporarily unavailable`
        })
      }

      // Forward request to service
      const response = await this.forwardRequest(service, method, path, headers, body, requestContext)

      // Log successful response
      this.logger.info('Request completed successfully', {
        ...requestContext,
        statusCode: response.status,
        responseTime: Date.now() - requestContext.timestamp
      })

      return response

    } catch (error) {
      // Log error
      this.logger.error('Request failed', {
        ...requestContext,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })

      // Update circuit breaker on failure
      this.recordFailure(serviceName)

      // Re-throw error
      throw error
    }
  }

  /**
   * Forward request to target service
   */
  private async forwardRequest(
    service: ServiceEndpoint,
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: any,
    context?: RequestContext
  ): Promise<Response> {
    const url = `${service.baseUrl}${path}`
    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-Request-ID': context?.requestId || '',
      'X-User-ID': context?.userId || '',
      'X-Forwarded-For': context?.ip || '',
      ...headers
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), service.timeout)

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Record success
      this.recordSuccess(service.name)

      return response

    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  /**
   * Check service health
   */
  async checkServiceHealth(serviceName: string): Promise<boolean> {
    const service = this.services.get(serviceName)
    if (!service) {
      return false
    }

    try {
      const response = await fetch(`${service.baseUrl}${service.healthCheckUrl}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      })

      return response.ok
    } catch (error) {
      this.logger.warn('Health check failed', { serviceName, error: error instanceof Error ? error.message : 'Unknown error' })
      return false
    }
  }

  /**
   * Check all services health
   */
  async checkAllServicesHealth(): Promise<Record<string, boolean>> {
    const healthStatus: Record<string, boolean> = {}

    for (const [serviceName] of this.services) {
      healthStatus[serviceName] = await this.checkServiceHealth(serviceName)
    }

    return healthStatus
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(serviceName: string, context: RequestContext): boolean {
    const key = `${serviceName}:${context.ip || 'unknown'}`
    const now = Date.now()
    const windowMs = 60000 // 1 minute window
    const maxRequests = 100 // Max requests per minute

    const current = this.rateLimiters.get(key)
    if (!current || now > current.resetTime) {
      this.rateLimiters.set(key, { requests: 1, resetTime: now + windowMs })
      return true
    }

    if (current.requests >= maxRequests) {
      return false
    }

    current.requests++
    return true
  }

  /**
   * Circuit breaker check
   */
  private checkCircuitBreaker(serviceName: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(serviceName)
    if (!circuitBreaker) {
      return true
    }

    const now = Date.now()

    switch (circuitBreaker.state) {
      case 'closed':
        return true

      case 'open':
        if (circuitBreaker.lastFailureTime && 
            now - circuitBreaker.lastFailureTime > this.services.get(serviceName)?.circuitBreaker.recoveryTimeout) {
          circuitBreaker.state = 'half-open'
          return true
        }
        return false

      case 'half-open':
        return true

      default:
        return true
    }
  }

  /**
   * Record service failure
   */
  private recordFailure(serviceName: string): void {
    const circuitBreaker = this.circuitBreakers.get(serviceName)
    const service = this.services.get(serviceName)
    
    if (!circuitBreaker || !service) {
      return
    }

    circuitBreaker.failures++
    circuitBreaker.lastFailureTime = Date.now()

    if (circuitBreaker.state === 'half-open') {
      circuitBreaker.state = 'open'
    } else if (circuitBreaker.failures >= service.circuitBreaker.failureThreshold) {
      circuitBreaker.state = 'open'
    }
  }

  /**
   * Record service success
   */
  private recordSuccess(serviceName: string): void {
    const circuitBreaker = this.circuitBreakers.get(serviceName)
    if (!circuitBreaker) {
      return
    }

    circuitBreaker.failures = 0
    circuitBreaker.lastFailureTime = null
    circuitBreaker.state = 'closed'
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get gateway metrics
   */
  getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {
      services: {},
      circuitBreakers: {},
      rateLimiters: {}
    }

    // Service metrics
    for (const [serviceName, service] of this.services) {
      const circuitBreaker = this.circuitBreakers.get(serviceName)
      metrics.services[serviceName] = {
        baseUrl: service.baseUrl,
        timeout: service.timeout,
        retries: service.retries,
        circuitBreakerState: circuitBreaker?.state || 'unknown',
        failures: circuitBreaker?.failures || 0
      }
    }

    // Circuit breaker metrics
    for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
      metrics.circuitBreakers[serviceName] = {
        state: circuitBreaker.state,
        failures: circuitBreaker.failures,
        lastFailureTime: circuitBreaker.lastFailureTime
      }
    }

    return metrics
  }

  /**
   * Reset circuit breaker for a service
   */
  resetCircuitBreaker(serviceName: string): void {
    const circuitBreaker = this.circuitBreakers.get(serviceName)
    if (circuitBreaker) {
      circuitBreaker.failures = 0
      circuitBreaker.lastFailureTime = null
      circuitBreaker.state = 'closed'
    }
  }

  /**
   * Clear rate limiters
   */
  clearRateLimiters(): void {
    this.rateLimiters.clear()
  }
}