import { config } from './config'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export interface LogContext {
  userId?: string
  sessionId?: string
  requestId?: string
  component?: string
  action?: string
  metadata?: Record<string, any>
}

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  context?: LogContext
  error?: Error
  duration?: number
}

class Logger {
  private logLevel: LogLevel

  constructor() {
    this.logLevel = config.monitoring.logLevel
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug']
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    
    return messageLevelIndex <= currentLevelIndex
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString()
    const level = entry.level.toUpperCase().padEnd(5)
    
    let message = `[${timestamp}] ${level} ${entry.message}`
    
    if (entry.context) {
      const contextStr = Object.entries(entry.context)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ')
      
      if (contextStr) {
        message += ` | ${contextStr}`
      }
    }
    
    if (entry.duration !== undefined) {
      message += ` | duration=${entry.duration}ms`
    }
    
    if (entry.error) {
      message += `\n  Error: ${entry.error.message}`
      if (entry.error.stack) {
        message += `\n  Stack: ${entry.error.stack}`
      }
    }
    
    return message
  }

  private writeLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return
    }

    const formattedMessage = this.formatLogEntry(entry)
    
    // Console output with colors
    switch (entry.level) {
      case 'error':
        console.error('\x1b[31m%s\x1b[0m', formattedMessage)
        break
      case 'warn':
        console.warn('\x1b[33m%s\x1b[0m', formattedMessage)
        break
      case 'info':
        console.info('\x1b[36m%s\x1b[0m', formattedMessage)
        break
      case 'debug':
        console.debug('\x1b[90m%s\x1b[0m', formattedMessage)
        break
    }

    // In production, you might want to send logs to external services
    if (config.app.nodeEnv === 'production') {
      this.sendToExternalService(entry)
    }
  }

  private sendToExternalService(entry: LogEntry): void {
    // Example: Send to Sentry, CloudWatch, or other logging services
    if (config.monitoring.sentryDsn && entry.level === 'error') {
      // Sentry integration would go here
      console.log('Would send to Sentry:', entry.message)
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.writeLog({
      timestamp: new Date(),
      level: 'error',
      message,
      context,
      error
    })
  }

  warn(message: string, context?: LogContext): void {
    this.writeLog({
      timestamp: new Date(),
      level: 'warn',
      message,
      context
    })
  }

  info(message: string, context?: LogContext): void {
    this.writeLog({
      timestamp: new Date(),
      level: 'info',
      message,
      context
    })
  }

  debug(message: string, context?: LogContext): void {
    this.writeLog({
      timestamp: new Date(),
      level: 'debug',
      message,
      context
    })
  }

  // Utility methods for common logging patterns
  logRequest(method: string, url: string, context?: LogContext): void {
    this.info(`${method} ${url}`, {
      ...context,
      component: 'http',
      action: 'request'
    })
  }

  logResponse(method: string, url: string, statusCode: number, duration: number, context?: LogContext): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
    
    this.writeLog({
      timestamp: new Date(),
      level,
      message: `${method} ${url} ${statusCode}`,
      context: {
        ...context,
        component: 'http',
        action: 'response',
        metadata: { statusCode }
      },
      duration
    })
  }

  logDatabaseQuery(query: string, duration: number, context?: LogContext): void {
    this.debug(`Database query executed`, {
      ...context,
      component: 'database',
      action: 'query',
      metadata: { query: query.substring(0, 100) + '...' }
    })
  }

  logAIRequest(prompt: string, model: string, duration: number, context?: LogContext): void {
    this.info(`AI request processed`, {
      ...context,
      component: 'ai',
      action: 'request',
      metadata: { 
        model,
        promptLength: prompt.length
      }
    })
  }

  logUserAction(action: string, userId: string, context?: LogContext): void {
    this.info(`User action: ${action}`, {
      ...context,
      userId,
      component: 'user',
      action
    })
  }

  logSystemEvent(event: string, context?: LogContext): void {
    this.info(`System event: ${event}`, {
      ...context,
      component: 'system',
      action: 'event'
    })
  }

  // Performance monitoring
  time(label: string): { end: (context?: LogContext) => void } {
    const start = Date.now()
    
    return {
      end: (context?: LogContext) => {
        const duration = Date.now() - start
        this.debug(`Timer: ${label}`, {
          ...context,
          component: 'performance',
          action: 'timer',
          metadata: { label }
        })
      }
    }
  }

  // Audit logging for security-sensitive operations
  audit(action: string, userId: string, details: Record<string, any>, context?: LogContext): void {
    this.info(`AUDIT: ${action}`, {
      ...context,
      userId,
      component: 'audit',
      action,
      metadata: details
    })
  }
}

export const logger = new Logger()

// Express middleware for request logging
export function requestLoggingMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now()
    const requestId = Math.random().toString(36).substring(7)
    
    // Add request ID to request object
    req.requestId = requestId
    
    logger.logRequest(req.method, req.url, {
      requestId,
      metadata: {
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    })
    
    // Override res.end to log response
    const originalEnd = res.end
    res.end = function(...args: any[]) {
      const duration = Date.now() - start
      
      logger.logResponse(req.method, req.url, res.statusCode, duration, {
        requestId,
        metadata: {
          contentLength: res.get('Content-Length')
        }
      })
      
      originalEnd.apply(this, args)
    }
    
    next()
  }
}

// Error handling middleware
export function errorLoggingMiddleware() {
  return (error: Error, req: any, res: any, next: any) => {
    logger.error(`Unhandled error in ${req.method} ${req.url}`, {
      requestId: req.requestId,
      component: 'error-handler',
      metadata: {
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    }, error)
    
    next(error)
  }
}

// Utility functions for common logging scenarios
export const logUserLogin = (userId: string, email: string, success: boolean) => {
  logger.audit('user_login', userId, { email, success })
}

export const logSampleCreated = (sampleId: string, userId: string, sampleName: string) => {
  logger.audit('sample_created', userId, { sampleId, sampleName })
}

export const logSampleUpdated = (sampleId: string, userId: string, changes: Record<string, any>) => {
  logger.audit('sample_updated', userId, { sampleId, changes })
}

export const logConfigurationChanged = (userId: string, setting: string, oldValue: any, newValue: any) => {
  logger.audit('config_changed', userId, { setting, oldValue, newValue })
}

export const logFileUploaded = (userId: string, fileName: string, fileSize: number) => {
  logger.audit('file_uploaded', userId, { fileName, fileSize })
}

export const logDataExported = (userId: string, exportType: string, recordCount: number) => {
  logger.audit('data_exported', userId, { exportType, recordCount })
} 