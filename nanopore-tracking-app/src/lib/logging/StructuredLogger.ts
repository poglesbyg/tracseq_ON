import { config } from '../config'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

/**
 * Enhanced log context with correlation ID and tracing
 */
export interface StructuredLogContext {
  // Request context
  requestId?: string
  correlationId?: string
  sessionId?: string
  userId?: string
  
  // Application context
  component?: string
  action?: string
  service?: string
  version?: string
  
  // Business context
  sampleId?: string
  workflowStage?: string
  operationType?: string
  
  // Technical context
  method?: string
  url?: string
  statusCode?: number
  userAgent?: string
  ipAddress?: string
  
  // Performance context
  duration?: number
  memoryUsage?: number
  cpuUsage?: number
  
  // Custom metadata
  metadata?: Record<string, any>
  
  // Error context
  errorCode?: string
  errorType?: string
  stackTrace?: string
  
  // Environment context
  environment?: string
  hostname?: string
  processId?: number
  threadId?: string
}

/**
 * Structured log entry with complete context
 */
export interface StructuredLogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context: StructuredLogContext
  error?: {
    name: string
    message: string
    stack?: string
    cause?: any
  }
  tags: string[]
  source: {
    file?: string
    function?: string
    line?: number
  }
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel
  format: 'json' | 'pretty' | 'compact'
  includeStackTrace: boolean
  includeContext: boolean
  enableColors: boolean
  maxLogSize: number
  outputs: ('console' | 'file' | 'external')[]
  
  // External service configuration
  external?: {
    endpoint?: string
    apiKey?: string
    batchSize?: number
    flushInterval?: number
  }
  
  // File logging configuration
  file?: {
    path: string
    maxSize: number
    maxFiles: number
    rotateDaily: boolean
  }
  
  // Performance monitoring
  performance?: {
    trackMemory: boolean
    trackCpu: boolean
    slowRequestThreshold: number
  }
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
  level: (config.monitoring?.logLevel as LogLevel) || 'info',
  format: config.app.nodeEnv === 'production' ? 'json' : 'pretty',
  includeStackTrace: config.app.nodeEnv === 'development',
  includeContext: true,
  enableColors: config.app.nodeEnv === 'development',
  maxLogSize: 10000,
  outputs: ['console'],
  performance: {
    trackMemory: true,
    trackCpu: true,
    slowRequestThreshold: 1000
  }
}

/**
 * Enhanced structured logger class
 */
export class StructuredLogger {
  private config: LoggerConfig
  private logBuffer: StructuredLogEntry[] = []
  private correlationId: string | null = null
  private baseContext: StructuredLogContext = {}

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.initializeBaseContext()
  }

  /**
   * Initialize base context with environment information
   */
  private initializeBaseContext(): void {
    this.baseContext = {
      environment: config.app.nodeEnv,
      hostname: process.env.HOSTNAME || 'unknown',
      processId: process.pid,
      service: 'nanopore-tracking',
      version: process.env.npm_package_version || '1.0.0'
    }
  }

  /**
   * Set correlation ID for request tracing
   */
  public setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId
  }

  /**
   * Get or generate correlation ID
   */
  public getCorrelationId(): string {
    if (!this.correlationId) {
      this.correlationId = this.generateCorrelationId()
    }
    return this.correlationId
  }

  /**
   * Generate a unique correlation ID
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Create a child logger with additional context
   */
  public child(context: Partial<StructuredLogContext>): StructuredLogger {
    const childLogger = new StructuredLogger(this.config)
    childLogger.correlationId = this.correlationId
    childLogger.baseContext = { ...this.baseContext, ...context }
    return childLogger
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug']
    const currentLevelIndex = levels.indexOf(this.config.level)
    const messageLevelIndex = levels.indexOf(level)
    
    return messageLevelIndex <= currentLevelIndex
  }

  /**
   * Create a complete log entry with all context
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context: Partial<StructuredLogContext> = {},
    error?: Error,
    tags: string[] = []
  ): StructuredLogEntry {
    const timestamp = new Date().toISOString()
    const correlationId = this.getCorrelationId()
    
    // Merge contexts
    const fullContext: StructuredLogContext = {
      ...this.baseContext,
      ...context,
      correlationId
    }

    // Add performance data if enabled
    if (this.config.performance?.trackMemory) {
      const memUsage = process.memoryUsage()
      fullContext.memoryUsage = memUsage.heapUsed
    }

    // Add error details
    let errorDetails
    if (error) {
      errorDetails = {
        name: error.name,
        message: error.message,
        ...(this.config.includeStackTrace && error.stack && { stack: error.stack }),
        ...((error as any).cause && { cause: (error as any).cause })
      }
      
      fullContext.errorType = error.name
      fullContext.errorCode = (error as any).code
    }

    // Get stack trace for source information
    const source = this.getSourceInfo()

    return {
      timestamp,
      level,
      message,
      context: fullContext,
      error: errorDetails,
      tags: [...tags, level, fullContext.component || 'unknown'],
      source
    }
  }

  /**
   * Get source file information from stack trace
   */
  private getSourceInfo(): { file?: string; function?: string; line?: number } {
    const stack = new Error().stack
    if (!stack) return {}
    
    const lines = stack.split('\n')
    const callerLine = lines[4] // Skip Error, getSourceInfo, createLogEntry, and the log method
    
    if (callerLine) {
      const match = callerLine.match(/at\s+(.+?)\s+\((.+):(\d+):\d+\)/)
      if (match && match[1] && match[2] && match[3]) {
        return {
          function: match[1],
          file: match[2],
          line: parseInt(match[3])
        }
      }
    }
    
    return {}
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: StructuredLogEntry): string {
    switch (this.config.format) {
      case 'json':
        return JSON.stringify(entry)
      
      case 'compact':
        return `${entry.timestamp} ${entry.level.toUpperCase()} ${entry.message} ${entry.context.correlationId}`
      
      case 'pretty':
      default:
        return this.formatPrettyLog(entry)
    }
  }

  /**
   * Format pretty log entry for development
   */
  private formatPrettyLog(entry: StructuredLogEntry): string {
    const { timestamp, level, message, context, error, tags } = entry
    
    let output = `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}`
    
    // Add important context
    const importantContext = [
      context.correlationId && `correlationId=${context.correlationId}`,
      context.requestId && `requestId=${context.requestId}`,
      context.userId && `userId=${context.userId}`,
      context.component && `component=${context.component}`,
      context.action && `action=${context.action}`,
      context.duration && `duration=${context.duration}ms`,
      context.statusCode && `status=${context.statusCode}`
    ].filter(Boolean).join(' ')
    
    if (importantContext) {
      output += ` | ${importantContext}`
    }
    
    // Add tags
    if (tags.length > 0) {
      output += ` | tags=[${tags.join(', ')}]`
    }
    
    // Add error details
    if (error) {
      output += `\n  Error: ${error.message}`
      if (error.stack && this.config.includeStackTrace) {
        output += `\n  Stack: ${error.stack}`
      }
    }
    
    // Add metadata if present
    if (context.metadata && Object.keys(context.metadata).length > 0) {
      output += `\n  Metadata: ${JSON.stringify(context.metadata, null, 2)}`
    }
    
    return output
  }

  /**
   * Write log entry to configured outputs
   */
  private writeLog(entry: StructuredLogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return
    }

    const formattedMessage = this.formatLogEntry(entry)
    
    // Console output
    if (this.config.outputs.includes('console')) {
      this.writeToConsole(formattedMessage, entry.level)
    }
    
    // File output
    if (this.config.outputs.includes('file')) {
      this.writeToFile(formattedMessage)
    }
    
    // External service
    if (this.config.outputs.includes('external')) {
      this.writeToExternal(entry)
    }
    
    // Buffer for batch processing
    this.logBuffer.push(entry)
    if (this.logBuffer.length > 100) {
      this.flushBuffer()
    }
  }

  /**
   * Write to console with colors
   */
  private writeToConsole(message: string, level: LogLevel): void {
    if (!this.config.enableColors) {
      console.log(message)
      return
    }

    switch (level) {
      case 'error':
        console.error('\x1b[31m%s\x1b[0m', message)
        break
      case 'warn':
        console.warn('\x1b[33m%s\x1b[0m', message)
        break
      case 'info':
        console.info('\x1b[36m%s\x1b[0m', message)
        break
      case 'debug':
        console.debug('\x1b[90m%s\x1b[0m', message)
        break
    }
  }

  /**
   * Write to file (placeholder for file logging implementation)
   */
  private writeToFile(message: string): void {
    // TODO: Implement file logging with rotation
    // This would integrate with libraries like winston-daily-rotate-file
  }

  /**
   * Send to external logging service
   */
  private writeToExternal(entry: StructuredLogEntry): void {
    // TODO: Implement external service integration
    // This would send to services like Elasticsearch, Splunk, etc.
  }

  /**
   * Flush log buffer
   */
  private flushBuffer(): void {
    // Process buffered logs for batch operations
    this.logBuffer.splice(0, this.logBuffer.length)
  }

  /**
   * Log error message
   */
  public error(message: string, context?: Partial<StructuredLogContext>, error?: Error): void {
    const entry = this.createLogEntry('error', message, context, error, ['error'])
    this.writeLog(entry)
  }

  /**
   * Log warning message
   */
  public warn(message: string, context?: Partial<StructuredLogContext>): void {
    const entry = this.createLogEntry('warn', message, context, undefined, ['warning'])
    this.writeLog(entry)
  }

  /**
   * Log info message
   */
  public info(message: string, context?: Partial<StructuredLogContext>): void {
    const entry = this.createLogEntry('info', message, context, undefined, ['info'])
    this.writeLog(entry)
  }

  /**
   * Log debug message
   */
  public debug(message: string, context?: Partial<StructuredLogContext>): void {
    const entry = this.createLogEntry('debug', message, context, undefined, ['debug'])
    this.writeLog(entry)
  }

  /**
   * Log HTTP request
   */
  public httpRequest(method: string, url: string, context?: Partial<StructuredLogContext>): void {
    this.info(`HTTP ${method} ${url}`, {
      ...context,
      method,
      url,
      operationType: 'http_request'
    })
  }

  /**
   * Log HTTP response
   */
  public httpResponse(method: string, url: string, statusCode: number, duration: number, context?: Partial<StructuredLogContext>): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
    const tags = ['http_response', statusCode >= 400 ? 'error' : 'success']
    
    if (duration > (this.config.performance?.slowRequestThreshold || 1000)) {
      tags.push('slow_request')
    }
    
    const entry = this.createLogEntry(level, `HTTP ${method} ${url} ${statusCode}`, {
      ...context,
      method,
      url,
      statusCode,
      duration,
      operationType: 'http_response'
    }, undefined, tags)
    
    this.writeLog(entry)
  }

  /**
   * Log database operation
   */
  public database(operation: string, table: string, duration: number, context?: Partial<StructuredLogContext>): void {
    const level = duration > 1000 ? 'warn' : 'debug'
    const tags = ['database', operation, duration > 1000 ? 'slow_query' : 'fast_query']
    
    const entry = this.createLogEntry(level, `DB ${operation} ${table}`, {
      ...context,
      operationType: 'database',
      action: operation,
      duration,
      metadata: { table }
    }, undefined, tags)
    
    this.writeLog(entry)
  }

  /**
   * Log business event
   */
  public businessEvent(event: string, context?: Partial<StructuredLogContext>): void {
    this.info(`Business event: ${event}`, {
      ...context,
      operationType: 'business_event',
      action: event
    })
  }

  /**
   * Log audit event
   */
  public audit(action: string, userId: string, resourceType: string, resourceId: string, context?: Partial<StructuredLogContext>): void {
    const entry = this.createLogEntry('info', `AUDIT: ${action}`, {
      ...context,
      userId,
      operationType: 'audit',
      action,
      metadata: {
        resourceType,
        resourceId
      }
    }, undefined, ['audit', action])
    
    this.writeLog(entry)
  }

  /**
   * Log performance metric
   */
  public performance(metric: string, value: number, unit: string, context?: Partial<StructuredLogContext>): void {
    this.info(`Performance: ${metric} = ${value}${unit}`, {
      ...context,
      operationType: 'performance',
      metadata: {
        metric,
        value,
        unit
      }
    })
  }

  /**
   * Log security event
   */
  public security(event: string, context?: Partial<StructuredLogContext>): void {
    this.warn(`Security event: ${event}`, {
      ...context,
      operationType: 'security',
      action: event
    })
  }

  /**
   * Start a timer for performance measurement
   */
  public startTimer(label: string): () => void {
    const start = Date.now()
    return () => {
      const duration = Date.now() - start
      this.performance(`Timer: ${label}`, duration, 'ms', {
        metadata: { label }
      })
    }
  }

  /**
   * Create a request logger with correlation ID
   */
  public forRequest(requestId: string, method: string, url: string): StructuredLogger {
    const correlationId = this.generateCorrelationId()
    return this.child({
      requestId,
      correlationId,
      method,
      url,
      operationType: 'request'
    })
  }
}

/**
 * Global structured logger instance
 */
export const structuredLogger = new StructuredLogger()

/**
 * Get logger for a specific component
 */
export function getComponentLogger(component: string): StructuredLogger {
  return structuredLogger.child({ component })
}

/**
 * Express middleware for request logging
 */
export function requestLoggingMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now()
    const requestId = req.headers['x-request-id'] || structuredLogger.getCorrelationId()
    const logger = structuredLogger.forRequest(requestId, req.method, req.url)
    
    // Add logger to request
    req.logger = logger
    
    // Log request
    logger.httpRequest(req.method, req.url, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: {
        headers: req.headers,
        query: req.query
      }
    })
    
    // Override res.end to log response
    const originalEnd = res.end
    res.end = function(chunk: any, encoding: any) {
      const duration = Date.now() - start
      logger.httpResponse(req.method, req.url, res.statusCode, duration, {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      })
      originalEnd.call(this, chunk, encoding)
    }
    
    next()
  }
} 