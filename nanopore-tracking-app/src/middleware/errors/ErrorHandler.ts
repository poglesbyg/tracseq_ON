import { TRPCError } from '@trpc/server'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'
import { BaseError, classifyError, isBaseError, isOperationalError } from './ErrorTypes'

const logger = getComponentLogger('ErrorHandler')

/**
 * Standard error response format for API responses
 */
export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: any
    timestamp: string
    traceId?: string
  }
  success: false
}

/**
 * Error context for logging and debugging
 */
export interface ErrorContext {
  userId?: string
  requestId?: string
  endpoint?: string
  method?: string
  userAgent?: string
  ip?: string
  [key: string]: any
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  includeStackTrace: boolean
  includeCauseChain: boolean
  logLevel: 'error' | 'warn' | 'info'
  enableMetrics: boolean
}

/**
 * Default error handler configuration
 */
const defaultConfig: ErrorHandlerConfig = {
  includeStackTrace: process.env.NODE_ENV === 'development',
  includeCauseChain: process.env.NODE_ENV === 'development',
  logLevel: 'error',
  enableMetrics: true
}

/**
 * Error handler class for centralized error processing
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Handle an error and return a formatted response
   */
  public handleError(error: Error, context: ErrorContext = {}): ErrorResponse {
    const errorInfo = this.processError(error, context)
    
    // Log the error
    this.logError(error, errorInfo, context)
    
    // Track metrics if enabled
    if (this.config.enableMetrics) {
      this.trackErrorMetrics(errorInfo)
    }

    // Return formatted response
    return this.formatErrorResponse(errorInfo, error)
  }

  /**
   * Convert error to tRPC error format
   */
  public toTRPCError(error: Error, context: ErrorContext = {}): TRPCError {
    const errorInfo = this.processError(error, context)
    
    // Log the error
    this.logError(error, errorInfo, context)
    
    // Track metrics if enabled
    if (this.config.enableMetrics) {
      this.trackErrorMetrics(errorInfo)
    }

    return new TRPCError({
      code: this.mapToTRPCCode(errorInfo.httpStatusCode),
      message: errorInfo.message,
      cause: error
    })
  }

  /**
   * Process error and extract relevant information
   */
  private processError(error: Error, context: ErrorContext) {
    const classification = classifyError(error)
    
    return {
      ...classification,
      message: error.message,
      stack: this.config.includeStackTrace ? error.stack : undefined,
      cause: this.config.includeCauseChain ? this.getCauseChain(error) : undefined,
      timestamp: new Date().toISOString(),
      context
    }
  }

  /**
   * Log error with appropriate level and context
   */
  private logError(error: Error, errorInfo: any, context: ErrorContext) {
    const logContext = {
      ...(context.userId && { userId: context.userId }),
      ...(context.requestId && { requestId: context.requestId }),
      component: 'ErrorHandler',
      action: 'handleError',
      metadata: {
        errorName: error.name,
        httpStatusCode: errorInfo.httpStatusCode,
        isOperational: errorInfo.isOperational,
        endpoint: context.endpoint,
        method: context.method,
        timestamp: errorInfo.timestamp
      }
    }

    if (errorInfo.isOperational) {
      logger.warn('Operational error occurred', logContext)
    } else {
      logger.error('System error occurred', logContext)
    }
  }

  /**
   * Track error metrics (placeholder for future implementation)
   */
  private trackErrorMetrics(errorInfo: any) {
    // TODO: Implement metrics tracking
    // This could integrate with Prometheus, DataDog, etc.
    logger.debug('Error metrics tracked', {
      component: 'ErrorHandler',
      action: 'trackMetrics',
      metadata: {
        errorType: errorInfo.name,
        httpStatusCode: errorInfo.httpStatusCode,
        isOperational: errorInfo.isOperational
      }
    })
  }

  /**
   * Format error response for API consumers
   */
  private formatErrorResponse(errorInfo: any, originalError: Error): ErrorResponse {
    const response: ErrorResponse = {
      error: {
        code: errorInfo.name,
        message: errorInfo.message,
        timestamp: errorInfo.timestamp
      },
      success: false
    }

    // Add stack trace in development
    if (this.config.includeStackTrace && errorInfo.stack) {
      response.error.details = {
        stack: errorInfo.stack
      }
    }

    // Add cause chain if enabled
    if (this.config.includeCauseChain && errorInfo.cause) {
      response.error.details = {
        ...response.error.details,
        cause: errorInfo.cause
      }
    }

    // Add validation field if available
    if (isBaseError(originalError) && 'field' in originalError) {
      response.error.details = {
        ...response.error.details,
        field: (originalError as any).field
      }
    }

    return response
  }

  /**
   * Map HTTP status codes to tRPC error codes
   */
  private mapToTRPCCode(httpStatusCode: number): TRPCError['code'] {
    switch (httpStatusCode) {
      case 400:
        return 'BAD_REQUEST'
      case 401:
        return 'UNAUTHORIZED'
      case 403:
        return 'FORBIDDEN'
      case 404:
        return 'NOT_FOUND'
      case 409:
        return 'CONFLICT'
      case 422:
        return 'UNPROCESSABLE_CONTENT'
      case 429:
        return 'TOO_MANY_REQUESTS'
      case 500:
        return 'INTERNAL_SERVER_ERROR'
      case 502:
        return 'BAD_GATEWAY'
      case 503:
        return 'SERVICE_UNAVAILABLE'
      default:
        return 'INTERNAL_SERVER_ERROR'
    }
  }

  /**
   * Get the full cause chain for an error
   */
  private getCauseChain(error: Error): any[] {
    const chain = []
    let current = error

    while (current) {
      chain.push({
        name: current.name,
        message: current.message,
        stack: current.stack
      })
      
      current = (current as any).cause
    }

    return chain
  }

  /**
   * Check if error should trigger an alert
   */
  public shouldAlert(error: Error): boolean {
    // Alert for non-operational errors
    if (!isOperationalError(error)) {
      return true
    }

    // Alert for specific error types
    if (error.name === 'DatabaseError' || error.name === 'ExternalServiceError') {
      return true
    }

    return false
  }

  /**
   * Get error summary for monitoring
   */
  public getErrorSummary(error: Error): {
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    actionRequired: boolean
  } {
    const classification = classifyError(error)
    
    if (!classification.isOperational) {
      return {
        type: classification.name,
        severity: 'critical',
        actionRequired: true
      }
    }

    // Determine severity based on error type
    switch (classification.name) {
      case 'DatabaseError':
        return { type: classification.name, severity: 'high', actionRequired: true }
      case 'ExternalServiceError':
        return { type: classification.name, severity: 'medium', actionRequired: true }
      case 'ValidationError':
        return { type: classification.name, severity: 'low', actionRequired: false }
      default:
        return { type: classification.name, severity: 'medium', actionRequired: false }
    }
  }
}

/**
 * Global error handler instance
 */
export const errorHandler = new ErrorHandler()

/**
 * Express-style error handler middleware
 */
export function expressErrorHandler(error: Error, req: any, res: any, next: any) {
  const context: ErrorContext = {
    endpoint: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId: req.id
  }

  const errorResponse = errorHandler.handleError(error, context)
  
  const statusCode = classifyError(error).httpStatusCode
  res.status(statusCode).json(errorResponse)
}

/**
 * tRPC error handler
 */
export function handleTRPCError(error: Error, context: ErrorContext = {}): never {
  throw errorHandler.toTRPCError(error, context)
}

/**
 * Async error wrapper for tRPC procedures
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: ErrorContext = {}
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      throw errorHandler.toTRPCError(error as Error, context)
    }
  }) as T
}

/**
 * Unhandled rejection handler
 */
export function handleUnhandledRejection(reason: any, promise: Promise<any>) {
  logger.error('Unhandled Promise Rejection', {
    component: 'ErrorHandler',
    action: 'unhandledRejection',
    metadata: {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString()
    }
  })
  
  // In production, you might want to exit the process
  if (process.env.NODE_ENV === 'production') {
    process.exit(1)
  }
}

/**
 * Uncaught exception handler
 */
export function handleUncaughtException(error: Error) {
  logger.error('Uncaught Exception', {
    component: 'ErrorHandler',
    action: 'uncaughtException',
    metadata: {
      message: error.message,
      stack: error.stack
    }
  })
  
  // Exit the process - uncaught exceptions are not recoverable
  process.exit(1)
} 