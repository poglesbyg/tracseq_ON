import { TRPCError } from '@trpc/server'
import { errorHandler } from './ErrorHandler'
import { DatabaseError, ValidationError, NotFoundError, BusinessLogicError } from './ErrorTypes'

/**
 * Global error handler function for tRPC procedures
 * Catches all errors and formats them consistently
 */
export function handleTRPCProcedureError(error: Error, context: any = {}): never {
  // Convert known database errors to our custom types
  const convertedError = convertDatabaseError(error)
  
  // Use the error handler to convert to tRPC error
  throw errorHandler.toTRPCError(convertedError, {
    requestId: context.requestId,
    userId: context.userId,
    endpoint: context.endpoint
  })
}

/**
 * Async wrapper for tRPC procedures with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: any = {}
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      handleTRPCProcedureError(error as Error, context)
    }
  }) as T
}

/**
 * Convert database errors to our custom error types
 */
function convertDatabaseError(error: Error): Error {
  // PostgreSQL specific error handling
  if (error.message.includes('duplicate key value violates unique constraint')) {
    return new ValidationError('A record with this value already exists')
  }
  
  if (error.message.includes('violates foreign key constraint')) {
    return new ValidationError('Referenced record does not exist')
  }
  
  if (error.message.includes('violates not-null constraint')) {
    return new ValidationError('Required field is missing')
  }
  
  if (error.message.includes('invalid input syntax for type uuid')) {
    return new ValidationError('Invalid ID format')
  }
  
  if (error.message.includes('value too long')) {
    return new ValidationError('Input value is too long')
  }
  
  if (error.message.includes('invalid input syntax for type')) {
    return new ValidationError('Invalid input format')
  }
  
  // Connection errors
  if (error.message.includes('ECONNREFUSED') || error.message.includes('connection terminated')) {
    return new DatabaseError('Database connection failed')
  }
  
  // Timeout errors
  if (error.message.includes('timeout')) {
    return new DatabaseError('Database operation timed out')
  }
  
  // Kysely specific errors
  if (error.name === 'NoResultError') {
    return new NotFoundError('Record')
  }
  
  // Default to database error for database-related issues
  if (error.name === 'DatabaseError' || error.stack?.includes('node_modules/pg')) {
    return new DatabaseError(error.message)
  }
  
  return error
}

/**
 * Validation error handler for Zod validation errors
 */
export function handleValidationError(error: Error): ValidationError {
  if (error.name === 'ZodError') {
    const zodError = error as any
    const firstError = zodError.errors[0]
    
    return new ValidationError(
      firstError.message,
      firstError.path?.join('.') || 'unknown'
    )
  }
  
  return error as ValidationError
}

/**
 * Utility function to extract request context from tRPC context
 */
export function extractRequestContext(ctx: any): any {
  return {
    requestId: ctx.requestId || generateRequestId(),
    userId: ctx.userId,
    endpoint: ctx.endpoint,
    timestamp: Date.now()
  }
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return Math.random().toString(36).substring(7)
}

/**
 * Log procedure execution (for debugging)
 */
export function logProcedureExecution(path: string, duration: number, error?: Error) {
  if (error) {
    console.error(`[ERROR] ${path} - ${duration}ms - ${error.message}`)
  } else if (duration > 1000) {
    console.warn(`[SLOW] ${path} - ${duration}ms`)
  }
} 