import { getComponentLogger } from '../logging/StructuredLogger'
import { EventEmitter } from 'events'

const logger = getComponentLogger('CircuitBreaker')

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  name: string
  failureThreshold: number
  resetTimeout: number
  monitoringPeriod: number
  expectedErrors?: (error: Error) => boolean
  onStateChange?: (state: CircuitBreakerState, error?: Error) => void
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitBreakerState
  failureCount: number
  successCount: number
  totalCalls: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  nextAttemptTime?: Date
}

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly circuitBreakerName: string) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

/**
 * Circuit breaker implementation for resilience patterns
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private totalCalls: number = 0
  private lastFailureTime?: Date
  private lastSuccessTime?: Date
  private nextAttemptTime?: Date
  private resetTimeoutId?: NodeJS.Timeout

  constructor(private config: CircuitBreakerConfig) {
    super()
    this.setupMonitoring()
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.state === CircuitBreakerState.OPEN) {
        if (this.nextAttemptTime && Date.now() < this.nextAttemptTime.getTime()) {
          const error = new CircuitBreakerError(
            `Circuit breaker '${this.config.name}' is OPEN`,
            this.config.name
          )
          this.emit('callRejected', error)
          reject(error)
          return
        } else {
          // Time to try half-open
          this.setState(CircuitBreakerState.HALF_OPEN)
        }
      }

      this.totalCalls++
      
      logger.debug('Circuit breaker executing function', {
        action: 'execute',
        metadata: { 
          circuitBreakerName: this.config.name,
          state: this.state,
          totalCalls: this.totalCalls
        }
      })

      const startTime = Date.now()

      fn()
        .then((result) => {
          const executionTime = Date.now() - startTime
          this.onSuccess(executionTime)
          resolve(result)
        })
        .catch((error) => {
          const executionTime = Date.now() - startTime
          this.onFailure(error, executionTime)
          reject(error)
        })
    })
  }

  /**
   * Handle successful execution
   */
  private onSuccess(executionTime: number): void {
    this.successCount++
    this.lastSuccessTime = new Date()

    logger.debug('Circuit breaker call succeeded', {
      action: 'call_success',
      metadata: {
        circuitBreakerName: this.config.name,
        state: this.state,
        executionTime,
        successCount: this.successCount
      }
    })

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Success in half-open state - reset to closed
      this.setState(CircuitBreakerState.CLOSED)
      this.failureCount = 0
    }

    this.emit('callSuccess', { executionTime, successCount: this.successCount })
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error, executionTime: number): void {
    // Check if this is an expected error that shouldn't count as failure
    if (this.config.expectedErrors && this.config.expectedErrors(error)) {
      logger.debug('Circuit breaker ignoring expected error', {
        action: 'expected_error',
        metadata: {
          circuitBreakerName: this.config.name,
          errorType: error.name,
          errorMessage: error.message
        }
      })
      return
    }

    this.failureCount++
    this.lastFailureTime = new Date()

    logger.warn('Circuit breaker call failed', {
      action: 'call_failure',
      metadata: {
        circuitBreakerName: this.config.name,
        state: this.state,
        executionTime,
        failureCount: this.failureCount,
        errorType: error.name,
        errorMessage: error.message
      }
    })

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Failure in half-open state - back to open
      this.setState(CircuitBreakerState.OPEN)
      this.scheduleReset()
    } else if (this.state === CircuitBreakerState.CLOSED && 
               this.failureCount >= this.config.failureThreshold) {
      // Too many failures - open the circuit
      this.setState(CircuitBreakerState.OPEN)
      this.scheduleReset()
    }

    this.emit('callFailure', { error, executionTime, failureCount: this.failureCount })
  }

  /**
   * Change circuit breaker state
   */
  private setState(newState: CircuitBreakerState): void {
    const oldState = this.state
    this.state = newState

    logger.info('Circuit breaker state changed', {
      action: 'state_change',
      metadata: {
        circuitBreakerName: this.config.name,
        oldState,
        newState,
        failureCount: this.failureCount,
        successCount: this.successCount
      }
    })

    if (this.config.onStateChange) {
      this.config.onStateChange(newState)
    }

    this.emit('stateChange', { oldState, newState, stats: this.getStats() })
  }

  /**
   * Schedule circuit breaker reset
   */
  private scheduleReset(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }

    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout)

    this.resetTimeoutId = setTimeout(() => {
      if (this.state === CircuitBreakerState.OPEN) {
        logger.info('Circuit breaker reset timeout reached', {
          action: 'reset_timeout',
          metadata: {
            circuitBreakerName: this.config.name,
            resetTimeout: this.config.resetTimeout
          }
        })
        this.setState(CircuitBreakerState.HALF_OPEN)
      }
    }, this.config.resetTimeout)
  }

  /**
   * Setup monitoring and metrics collection
   */
  private setupMonitoring(): void {
    setInterval(() => {
      const stats = this.getStats()
      
      logger.debug('Circuit breaker metrics', {
        action: 'metrics',
        metadata: {
          circuitBreakerName: this.config.name,
          stats
        }
      })

      this.emit('metrics', stats)
    }, this.config.monitoringPeriod)
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      ...(this.lastFailureTime && { lastFailureTime: this.lastFailureTime }),
      ...(this.lastSuccessTime && { lastSuccessTime: this.lastSuccessTime }),
      ...(this.nextAttemptTime && { nextAttemptTime: this.nextAttemptTime })
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state
  }

  /**
   * Force circuit breaker to open state
   */
  forceOpen(): void {
    logger.warn('Circuit breaker forced to open state', {
      action: 'force_open',
      metadata: { circuitBreakerName: this.config.name }
    })
    
    this.setState(CircuitBreakerState.OPEN)
    this.scheduleReset()
  }

  /**
   * Force circuit breaker to closed state
   */
  forceClosed(): void {
    logger.info('Circuit breaker forced to closed state', {
      action: 'force_closed',
      metadata: { circuitBreakerName: this.config.name }
    })
    
    this.setState(CircuitBreakerState.CLOSED)
    this.failureCount = 0
    
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
      this.resetTimeoutId = undefined as any
    }
  }

  /**
   * Reset circuit breaker statistics
   */
  resetStats(): void {
    this.failureCount = 0
    this.successCount = 0
    this.totalCalls = 0
    this.lastFailureTime = undefined as any
    this.lastSuccessTime = undefined as any
    
    logger.info('Circuit breaker statistics reset', {
      action: 'reset_stats',
      metadata: { circuitBreakerName: this.config.name }
    })
  }

  /**
   * Health check
   */
  healthCheck(): {
    healthy: boolean
    state: CircuitBreakerState
    issues: string[]
  } {
    const issues: string[] = []
    
    if (this.state === CircuitBreakerState.OPEN) {
      issues.push('Circuit breaker is in OPEN state')
    }
    
    if (this.failureCount > 0) {
      const failureRate = this.failureCount / this.totalCalls
      if (failureRate > 0.5) {
        issues.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`)
      }
    }
    
    return {
      healthy: issues.length === 0,
      state: this.state,
      issues
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
    
    this.removeAllListeners()
    
    logger.info('Circuit breaker destroyed', {
      action: 'destroy',
      metadata: { circuitBreakerName: this.config.name }
    })
  }
}

/**
 * Circuit breaker factory for creating and managing circuit breakers
 */
export class CircuitBreakerFactory {
  private static circuitBreakers: Map<string, CircuitBreaker> = new Map()

  /**
   * Create or get existing circuit breaker
   */
  static create(config: CircuitBreakerConfig): CircuitBreaker {
    if (this.circuitBreakers.has(config.name)) {
      return this.circuitBreakers.get(config.name)!
    }

    const circuitBreaker = new CircuitBreaker(config)
    this.circuitBreakers.set(config.name, circuitBreaker)

    logger.info('Circuit breaker created', {
      action: 'create_circuit_breaker',
      metadata: { 
        circuitBreakerName: config.name,
        config: {
          failureThreshold: config.failureThreshold,
          resetTimeout: config.resetTimeout,
          monitoringPeriod: config.monitoringPeriod
        }
      }
    })

    return circuitBreaker
  }

  /**
   * Get existing circuit breaker
   */
  static get(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name)
  }

  /**
   * Get all circuit breakers
   */
  static getAll(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers)
  }

  /**
   * Remove circuit breaker
   */
  static remove(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name)
    if (circuitBreaker) {
      circuitBreaker.destroy()
      this.circuitBreakers.delete(name)
      return true
    }
    return false
  }

  /**
   * Get health status of all circuit breakers
   */
  static getHealthStatus(): {
    healthy: boolean
    circuitBreakers: Array<{
      name: string
      healthy: boolean
      state: CircuitBreakerState
      issues: string[]
    }>
  } {
    const circuitBreakers: Array<{
      name: string
      healthy: boolean
      state: CircuitBreakerState
      issues: string[]
    }> = []

    let allHealthy = true

    for (const [name, circuitBreaker] of this.circuitBreakers) {
      const health = circuitBreaker.healthCheck()
      circuitBreakers.push({
        name,
        healthy: health.healthy,
        state: health.state,
        issues: health.issues
      })

      if (!health.healthy) {
        allHealthy = false
      }
    }

    return {
      healthy: allHealthy,
      circuitBreakers
    }
  }

  /**
   * Cleanup all circuit breakers
   */
  static cleanup(): void {
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      circuitBreaker.destroy()
    }
    this.circuitBreakers.clear()
  }
}

/**
 * Decorator for applying circuit breaker to methods
 */
export function withCircuitBreaker(config: CircuitBreakerConfig) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const circuitBreaker = CircuitBreakerFactory.create(config)

    descriptor.value = async function (...args: any[]) {
      return circuitBreaker.execute(() => originalMethod.apply(this, args))
    }

    return descriptor
  }
}

/**
 * Default circuit breaker configurations for common services
 */
export const defaultCircuitBreakerConfigs = {
  database: {
    failureThreshold: 5,
    resetTimeout: 30000,
    monitoringPeriod: 10000,
    expectedErrors: (error: Error) => error.name === 'ValidationError'
  },
  
  externalApi: {
    failureThreshold: 3,
    resetTimeout: 60000,
    monitoringPeriod: 15000,
    expectedErrors: (error: Error) => error.message.includes('4')
  },
  
  aiService: {
    failureThreshold: 2,
    resetTimeout: 120000,
    monitoringPeriod: 30000,
    expectedErrors: (error: Error) => error.name === 'ModelNotFoundError'
  }
} 