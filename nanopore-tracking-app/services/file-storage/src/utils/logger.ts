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
    filename: path.join('logs', 'file-storage-error-%DATE%.log'),
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
    filename: path.join('logs', 'file-storage-%DATE%.log'),
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

// File operation logging helper
export const logFileOperation = (operation: string, fileId: string, userId?: string, additionalData?: Record<string, any>) => {
  logger.info(`File ${operation}`, {
    fileId,
    userId,
    timestamp: new Date().toISOString(),
    ...additionalData
  })
}

// Storage statistics logging helper
export const logStorageStats = (stats: {
  totalFiles: number
  totalSizeBytes: number
  averageFileSizeBytes: number
}) => {
  logger.info('Storage statistics updated', {
    ...stats,
    totalSizeMB: Math.round(stats.totalSizeBytes / (1024 * 1024) * 100) / 100,
    averageSizeKB: Math.round(stats.averageFileSizeBytes / 1024 * 100) / 100
  })
}

export default logger