/**
 * PDF Processing Error Handler
 * Provides comprehensive error handling, retry mechanisms, and user feedback
 */

export enum PdfErrorType {
  FILE_INVALID = 'FILE_INVALID',
  FILE_CORRUPTED = 'FILE_CORRUPTED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_PASSWORD_PROTECTED = 'FILE_PASSWORD_PROTECTED',
  WORKER_FAILED = 'WORKER_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PARSER_ERROR = 'PARSER_ERROR',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface PdfError {
  type: PdfErrorType
  message: string
  userMessage: string
  recoverable: boolean
  retryable: boolean
  details?: any
  timestamp: Date
  context?: {
    fileName?: string
    fileSize?: number
    processingStep?: string
    attempt?: number
    maxAttempts?: number
  }
}

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
  retryableErrors: PdfErrorType[]
}

export class PdfErrorHandler {
  private static instance: PdfErrorHandler
  private errors: PdfError[] = []
  private retryConfig: RetryConfig

  private constructor() {
    this.retryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      retryableErrors: [
        PdfErrorType.NETWORK_ERROR,
        PdfErrorType.WORKER_FAILED,
        PdfErrorType.TIMEOUT_ERROR,
        PdfErrorType.PARSER_ERROR
      ]
    }
  }

  static getInstance(): PdfErrorHandler {
    if (!PdfErrorHandler.instance) {
      PdfErrorHandler.instance = new PdfErrorHandler()
    }
    return PdfErrorHandler.instance
  }

  /**
   * Create a standardized PDF error
   */
  createError(
    type: PdfErrorType,
    originalError: Error | unknown,
    context?: Partial<PdfError['context']>
  ): PdfError {
    const message = originalError instanceof Error ? originalError.message : String(originalError)
    
    const error: PdfError = {
      type,
      message,
      userMessage: this.getUserMessage(type, message),
      recoverable: this.isRecoverable(type),
      retryable: this.isRetryable(type),
      details: originalError,
      timestamp: new Date(),
      ...(context && { context })
    }

    this.errors.push(error)
    return error
  }

  /**
   * Get user-friendly error message
   */
  private getUserMessage(type: PdfErrorType, originalMessage: string): string {
    const userMessages = {
      [PdfErrorType.FILE_INVALID]: 'Please select a valid PDF file. The file you selected is not a PDF or is corrupted.',
      [PdfErrorType.FILE_CORRUPTED]: 'The PDF file appears to be corrupted. Please try a different file or contact the file creator.',
      [PdfErrorType.FILE_TOO_LARGE]: 'The PDF file is too large to process. Please try a smaller file or contact support.',
      [PdfErrorType.FILE_PASSWORD_PROTECTED]: 'This PDF is password protected. Please provide an unprotected version.',
      [PdfErrorType.WORKER_FAILED]: 'PDF processing service is temporarily unavailable. Please try again in a moment.',
      [PdfErrorType.NETWORK_ERROR]: 'Network connection issue. Please check your internet connection and try again.',
      [PdfErrorType.PARSER_ERROR]: 'Unable to read the PDF content. The file may be corrupted or in an unsupported format.',
      [PdfErrorType.EXTRACTION_FAILED]: 'Could not extract text from the PDF. The document may contain only images or unsupported content.',
      [PdfErrorType.VALIDATION_ERROR]: 'The extracted data does not meet required standards. Please check the PDF content.',
      [PdfErrorType.TIMEOUT_ERROR]: 'Processing is taking too long. Please try again or contact support if the issue persists.',
      [PdfErrorType.MEMORY_ERROR]: 'The PDF is too complex to process. Please try a simpler file or contact support.',
      [PdfErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again or contact support if the issue persists.'
    }

    return userMessages[type] || `PDF processing error: ${originalMessage}`
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(type: PdfErrorType): boolean {
    const recoverableErrors = [
      PdfErrorType.NETWORK_ERROR,
      PdfErrorType.WORKER_FAILED,
      PdfErrorType.TIMEOUT_ERROR,
      PdfErrorType.PARSER_ERROR
    ]
    return recoverableErrors.includes(type)
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(type: PdfErrorType): boolean {
    return this.retryConfig.retryableErrors.includes(type)
  }

  /**
   * Classify error based on the original error
   */
  classifyError(error: Error | unknown, context?: Partial<PdfError['context']>): PdfErrorType {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

    // File-related errors
    if (message.includes('invalid pdf') || message.includes('not a pdf') || message.includes('invalid file')) {
      return PdfErrorType.FILE_INVALID
    }
    
    if (message.includes('corrupted') || message.includes('damaged') || message.includes('invalid format')) {
      return PdfErrorType.FILE_CORRUPTED
    }
    
    if (message.includes('too large') || message.includes('file size') || message.includes('quota exceeded')) {
      return PdfErrorType.FILE_TOO_LARGE
    }
    
    if (message.includes('password') || message.includes('encrypted') || message.includes('protected')) {
      return PdfErrorType.FILE_PASSWORD_PROTECTED
    }

    // Processing errors
    if (message.includes('worker') || message.includes('webworker') || message.includes('worker failed')) {
      return PdfErrorType.WORKER_FAILED
    }
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return PdfErrorType.NETWORK_ERROR
    }
    
    if (message.includes('timeout') || message.includes('timed out') || message.includes('time limit')) {
      return PdfErrorType.TIMEOUT_ERROR
    }
    
    if (message.includes('memory') || message.includes('out of memory') || message.includes('allocation')) {
      return PdfErrorType.MEMORY_ERROR
    }
    
    if (message.includes('parse') || message.includes('parsing') || message.includes('syntax')) {
      return PdfErrorType.PARSER_ERROR
    }
    
    if (message.includes('extract') || message.includes('text content') || message.includes('content extraction')) {
      return PdfErrorType.EXTRACTION_FAILED
    }
    
    if (message.includes('validation') || message.includes('invalid data') || message.includes('validation failed')) {
      return PdfErrorType.VALIDATION_ERROR
    }

    return PdfErrorType.UNKNOWN_ERROR
  }

  /**
   * Execute function with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    context?: Partial<PdfError['context']>,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig }
    let lastError: Error | unknown
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await this.withTimeout(operation, 30000) // 30 second timeout
      } catch (error) {
        lastError = error
        const errorType = this.classifyError(error, { ...context, attempt, maxAttempts: config.maxAttempts })
        
        // Create error record
        const pdfError = this.createError(errorType, error, { ...context, attempt, maxAttempts: config.maxAttempts })
        
        // If not retryable or last attempt, throw error
        if (!pdfError.retryable || attempt === config.maxAttempts) {
          throw pdfError
        }
        
        // Calculate delay for next attempt
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
          config.maxDelay
        )
        
        console.warn(`PDF processing attempt ${attempt} failed, retrying in ${delay}ms:`, error)
        await this.delay(delay)
      }
    }
    
    throw lastError
  }

  /**
   * Execute function with timeout
   */
  private async withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      })
    ])
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get error history
   */
  getErrorHistory(): PdfError[] {
    return [...this.errors]
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errors = []
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number
    byType: Record<PdfErrorType, number>
    recoverable: number
    retryable: number
  } {
    const stats = {
      total: this.errors.length,
      byType: {} as Record<PdfErrorType, number>,
      recoverable: 0,
      retryable: 0
    }

    // Initialize counts
    Object.values(PdfErrorType).forEach(type => {
      stats.byType[type] = 0
    })

    // Count errors
    this.errors.forEach(error => {
      stats.byType[error.type]++
      if (error.recoverable) stats.recoverable++
      if (error.retryable) stats.retryable++
    })

    return stats
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config }
  }

  /**
   * Create recovery suggestions
   */
  getRecoverySuggestions(error: PdfError): string[] {
    const suggestions: Record<PdfErrorType, string[]> = {
      [PdfErrorType.FILE_INVALID]: [
        'Verify the file is a valid PDF',
        'Try opening the file in a PDF reader first',
        'Re-save the file as a PDF if possible'
      ],
      [PdfErrorType.FILE_CORRUPTED]: [
        'Try opening the file in a different PDF reader',
        'Request a new copy of the file',
        'Use PDF repair tools if available'
      ],
      [PdfErrorType.FILE_TOO_LARGE]: [
        'Compress the PDF file',
        'Split the PDF into smaller sections',
        'Contact support for higher limits'
      ],
      [PdfErrorType.FILE_PASSWORD_PROTECTED]: [
        'Remove password protection from the PDF',
        'Contact the file creator for an unprotected version',
        'Provide the password if supported'
      ],
      [PdfErrorType.WORKER_FAILED]: [
        'Refresh the page and try again',
        'Clear browser cache and cookies',
        'Try using a different browser'
      ],
      [PdfErrorType.NETWORK_ERROR]: [
        'Check your internet connection',
        'Try again in a few minutes',
        'Contact support if the issue persists'
      ],
      [PdfErrorType.PARSER_ERROR]: [
        'Try a different PDF file',
        'Check if the PDF is corrupted',
        'Convert the document to PDF again'
      ],
      [PdfErrorType.EXTRACTION_FAILED]: [
        'Ensure the PDF contains selectable text',
        'Try a PDF with clearer text formatting',
        'Use OCR if the PDF contains scanned images'
      ],
      [PdfErrorType.VALIDATION_ERROR]: [
        'Check the PDF content format',
        'Ensure all required fields are present',
        'Contact support for format requirements'
      ],
      [PdfErrorType.TIMEOUT_ERROR]: [
        'Try a smaller PDF file',
        'Check your internet connection',
        'Contact support if the issue continues'
      ],
      [PdfErrorType.MEMORY_ERROR]: [
        'Try a simpler PDF file',
        'Close other browser tabs',
        'Restart your browser'
      ],
      [PdfErrorType.UNKNOWN_ERROR]: [
        'Try refreshing the page',
        'Clear browser cache',
        'Contact support with error details'
      ]
    }

    return suggestions[error.type] || []
  }
}

// Export singleton instance
export const pdfErrorHandler = PdfErrorHandler.getInstance()

// Export convenience functions
export function createPdfError(type: PdfErrorType, error: Error | unknown, context?: Partial<PdfError['context']>): PdfError {
  return pdfErrorHandler.createError(type, error, context)
}

export function withPdfRetry<T>(
  operation: () => Promise<T>,
  context?: Partial<PdfError['context']>,
  customConfig?: Partial<RetryConfig>
): Promise<T> {
  return pdfErrorHandler.withRetry(operation, context, customConfig)
} 