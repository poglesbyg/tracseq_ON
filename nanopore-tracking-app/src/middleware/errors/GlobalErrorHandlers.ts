import { handleUnhandledRejection, handleUncaughtException } from './ErrorHandler'
import { logger } from '../../lib/logger'

/**
 * Initialize global error handlers
 */
export function initializeGlobalErrorHandlers() {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', handleUnhandledRejection)
  
  // Handle uncaught exceptions
  process.on('uncaughtException', handleUncaughtException)
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully')
    process.exit(0)
  })
  
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully')
    process.exit(0)
  })
  
  logger.info('Global error handlers initialized')
}

/**
 * Clean up global error handlers (for testing)
 */
export function cleanupGlobalErrorHandlers() {
  process.removeListener('unhandledRejection', handleUnhandledRejection)
  process.removeListener('uncaughtException', handleUncaughtException)
} 