import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'

// Log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

// Colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
}

// Tell winston that you want to link the colors
winston.addColors(colors)

// Custom format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
)

// Define which level to log based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development'
  const isDevelopment = env === 'development'
  return isDevelopment ? 'debug' : 'warn'
}

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  
  // File transport for errors
  new DailyRotateFile({
    filename: path.join('logs', 'audit-error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  
  // File transport for all logs
  new DailyRotateFile({
    filename: path.join('logs', 'audit-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
]

// Create the logger
export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false,
})

// Create a stream object for Morgan HTTP logging
export const stream = {
  write: (message: string) => {
    logger.http(message.trim())
  },
}

// Structured logging helper
export const logWithContext = (level: 'error' | 'warn' | 'info' | 'debug', message: string, context?: Record<string, any>) => {
  if (context) {
    logger.log(level, message, context)
  } else {
    logger.log(level, message)
  }
}

// Error logging helper
export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context
  })
}

// Request logging helper
export const logRequest = (req: any, res: any, next: any) => {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    })
  })
  
  next()
}

// Audit event logging helper
export const logAuditEvent = (event: {
  service: string
  action: string
  resource: string
  userId?: string
  userEmail?: string
  severity?: string
  category?: string
  details?: Record<string, any>
}) => {
  logger.info('Audit Event', {
    service: event.service,
    action: event.action,
    resource: event.resource,
    userId: event.userId,
    userEmail: event.userEmail,
    severity: event.severity || 'info',
    category: event.category || 'system',
    details: event.details,
    timestamp: new Date().toISOString()
  })
}

// User activity logging helper
export const logUserActivity = (activity: {
  userId: string
  userEmail: string
  action: string
  service: string
  resource: string
  success: boolean
  duration?: number
  details?: Record<string, any>
}) => {
  logger.info('User Activity', {
    userId: activity.userId,
    userEmail: activity.userEmail,
    action: activity.action,
    service: activity.service,
    resource: activity.resource,
    success: activity.success,
    duration: activity.duration,
    details: activity.details,
    timestamp: new Date().toISOString()
  })
}

// Alert logging helper
export const logAlert = (alert: {
  name: string
  severity: string
  service: string
  condition: Record<string, any>
  recipients: string[]
  eventCount: number
}) => {
  logger.warn('Alert Triggered', {
    name: alert.name,
    severity: alert.severity,
    service: alert.service,
    condition: alert.condition,
    recipients: alert.recipients,
    eventCount: alert.eventCount,
    timestamp: new Date().toISOString()
  })
}

// Report generation logging helper
export const logReportGeneration = (report: {
  name: string
  type: string
  format: string
  recordCount: number
  duration: number
}) => {
  logger.info('Report Generated', {
    name: report.name,
    type: report.type,
    format: report.format,
    recordCount: report.recordCount,
    duration: `${report.duration}ms`,
    timestamp: new Date().toISOString()
  })
}

// Data retention logging helper
export const logDataRetention = (retention: {
  retentionDays: number
  deletedEvents: number
  deletedLogs: number
  deletedActivities: number
  deletedAlertHistory: number
}) => {
  logger.info('Data Retention Cleanup', {
    retentionDays: retention.retentionDays,
    deletedEvents: retention.deletedEvents,
    deletedLogs: retention.deletedLogs,
    deletedActivities: retention.deletedActivities,
    deletedAlertHistory: retention.deletedAlertHistory,
    timestamp: new Date().toISOString()
  })
}

export default logger