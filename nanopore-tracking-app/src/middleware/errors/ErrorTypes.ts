/**
 * Custom error classes for the nanopore tracking application
 * Provides structured error handling with proper HTTP status codes
 */

export abstract class BaseError extends Error {
  abstract override readonly name: string
  abstract readonly httpStatusCode: number
  abstract readonly isOperational: boolean
  
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
    
    this.cause = cause
  }
}

/**
 * Validation errors - 400 Bad Request
 */
export class ValidationError extends BaseError {
  readonly name = 'ValidationError'
  readonly httpStatusCode = 400
  readonly isOperational = true
  
  constructor(message: string, public readonly field?: string, cause?: Error) {
    super(message, cause)
  }
}

/**
 * Authentication errors - 401 Unauthorized
 */
export class AuthenticationError extends BaseError {
  readonly name = 'AuthenticationError'
  readonly httpStatusCode = 401
  readonly isOperational = true
  
  constructor(message: string = 'Authentication required', cause?: Error) {
    super(message, cause)
  }
}

/**
 * Authorization errors - 403 Forbidden
 */
export class AuthorizationError extends BaseError {
  readonly name = 'AuthorizationError'
  readonly httpStatusCode = 403
  readonly isOperational = true
  
  constructor(message: string = 'Insufficient permissions', cause?: Error) {
    super(message, cause)
  }
}

/**
 * Resource not found errors - 404 Not Found
 */
export class NotFoundError extends BaseError {
  readonly name = 'NotFoundError'
  readonly httpStatusCode = 404
  readonly isOperational = true
  
  constructor(resource: string, id?: string, cause?: Error) {
    const message = id 
      ? `${resource} with ID '${id}' not found`
      : `${resource} not found`
    super(message, cause)
  }
}

/**
 * Conflict errors - 409 Conflict
 */
export class ConflictError extends BaseError {
  readonly name = 'ConflictError'
  readonly httpStatusCode = 409
  readonly isOperational = true
  
  constructor(message: string, cause?: Error) {
    super(message, cause)
  }
}

/**
 * Rate limiting errors - 429 Too Many Requests
 */
export class RateLimitError extends BaseError {
  readonly name = 'RateLimitError'
  readonly httpStatusCode = 429
  readonly isOperational = true
  
  constructor(message: string = 'Too many requests', cause?: Error) {
    super(message, cause)
  }
}

/**
 * Database errors - 500 Internal Server Error
 */
export class DatabaseError extends BaseError {
  readonly name = 'DatabaseError'
  readonly httpStatusCode = 500
  readonly isOperational = true
  
  constructor(message: string, cause?: Error) {
    super(message, cause)
  }
}

/**
 * External service errors - 502 Bad Gateway
 */
export class ExternalServiceError extends BaseError {
  readonly name = 'ExternalServiceError'
  readonly httpStatusCode = 502
  readonly isOperational = true
  
  constructor(service: string, message?: string, cause?: Error) {
    super(message || `External service ${service} is unavailable`, cause)
  }
}

/**
 * Configuration errors - 500 Internal Server Error
 */
export class ConfigurationError extends BaseError {
  readonly name = 'ConfigurationError'
  readonly httpStatusCode = 500
  readonly isOperational = false
  
  constructor(message: string, cause?: Error) {
    super(message, cause)
  }
}

/**
 * Business logic errors - 422 Unprocessable Entity
 */
export class BusinessLogicError extends BaseError {
  readonly name = 'BusinessLogicError'
  readonly httpStatusCode = 422
  readonly isOperational = true
  
  constructor(message: string, cause?: Error) {
    super(message, cause)
  }
}

/**
 * Type guard to check if an error is an operational error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.isOperational
  }
  return false
}

/**
 * Type guard to check if an error is a BaseError
 */
export function isBaseError(error: Error): error is BaseError {
  return error instanceof BaseError
}

/**
 * Error classification utility
 */
export function classifyError(error: Error): {
  isOperational: boolean
  httpStatusCode: number
  name: string
} {
  if (isBaseError(error)) {
    return {
      isOperational: error.isOperational,
      httpStatusCode: error.httpStatusCode,
      name: error.name
    }
  }
  
  // Handle known third-party errors
  if (error.name === 'ValidationError') {
    return { isOperational: true, httpStatusCode: 400, name: 'ValidationError' }
  }
  
  if (error.name === 'CastError') {
    return { isOperational: true, httpStatusCode: 400, name: 'ValidationError' }
  }
  
  if (error.message?.includes('duplicate key')) {
    return { isOperational: true, httpStatusCode: 409, name: 'ConflictError' }
  }
  
  // Default for unknown errors
  return { isOperational: false, httpStatusCode: 500, name: 'InternalError' }
} 