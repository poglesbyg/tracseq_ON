export abstract class DomainError extends Error {
  public readonly code: string
  public readonly context?: Record<string, unknown>
  public readonly timestamp: Date

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.context = context
    this.timestamp = new Date()

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class CrisprError extends DomainError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
  ) {
    super(message, code, context)
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
  ) {
    super(message, code, context)
  }
}

export class AIError extends DomainError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
  ) {
    super(message, code, context)
  }
}

export class RepositoryError extends DomainError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
  ) {
    super(message, code, context)
  }
}

export class NetworkError extends DomainError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
  ) {
    super(message, code, context)
  }
}

export class AuthenticationError extends DomainError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
  ) {
    super(message, code, context)
  }
}

export class AuthorizationError extends DomainError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
  ) {
    super(message, code, context)
  }
}

// Error code constants
export const ERROR_CODES = {
  // CRISPR errors
  DESIGN_FAILED: 'DESIGN_FAILED',
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  OPTIMIZATION_FAILED: 'OPTIMIZATION_FAILED',
  BATCH_PROCESSING_FAILED: 'BATCH_PROCESSING_FAILED',
  HISTORY_RETRIEVAL_FAILED: 'HISTORY_RETRIEVAL_FAILED',

  // Validation errors
  SEQUENCE_TOO_SHORT: 'SEQUENCE_TOO_SHORT',
  SEQUENCE_TOO_LONG: 'SEQUENCE_TOO_LONG',
  INVALID_DNA_SEQUENCE: 'INVALID_DNA_SEQUENCE',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  INVALID_GUIDE_RNA: 'INVALID_GUIDE_RNA',

  // AI errors
  SEQUENCE_ANALYSIS_FAILED: 'SEQUENCE_ANALYSIS_FAILED',
  GUIDE_OPTIMIZATION_FAILED: 'GUIDE_OPTIMIZATION_FAILED',
  EXPERIMENT_SUGGESTIONS_FAILED: 'EXPERIMENT_SUGGESTIONS_FAILED',
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',

  // Repository errors
  DATA_SAVE_FAILED: 'DATA_SAVE_FAILED',
  DATA_RETRIEVAL_FAILED: 'DATA_RETRIEVAL_FAILED',
  DATA_DELETE_FAILED: 'DATA_DELETE_FAILED',

  // Network errors
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  SERVER_ERROR: 'SERVER_ERROR',

  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

// Error factory functions
export function createCrisprError(
  message: string,
  code: ErrorCode,
  context?: Record<string, unknown>,
): CrisprError {
  return new CrisprError(message, code, context)
}

export function createValidationError(
  message: string,
  code: ErrorCode,
  context?: Record<string, unknown>,
): ValidationError {
  return new ValidationError(message, code, context)
}

export function createAIError(
  message: string,
  code: ErrorCode,
  context?: Record<string, unknown>,
): AIError {
  return new AIError(message, code, context)
}

export function createRepositoryError(
  message: string,
  code: ErrorCode,
  context?: Record<string, unknown>,
): RepositoryError {
  return new RepositoryError(message, code, context)
}

// Generic error class for unknown errors
export class UnknownError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'UNKNOWN_ERROR', context)
  }
}

// Error handler utility
export function handleError(error: unknown): DomainError {
  if (error instanceof DomainError) {
    return error
  }

  if (error instanceof Error) {
    return new UnknownError(error.message, { originalError: error })
  }

  return new UnknownError('An unknown error occurred', { originalError: error })
}
