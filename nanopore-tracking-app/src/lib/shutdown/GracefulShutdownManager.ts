import { getComponentLogger } from '../logging/StructuredLogger'
import { applicationMetrics } from '../monitoring/MetricsCollector'
import { auditLogger } from '../audit/AuditLogger'
import { configManager } from '../config/ConfigManager'
import { shutdownDatabase } from '../database'

const logger = getComponentLogger('GracefulShutdownManager')

/**
 * Shutdown hook function type
 */
export type ShutdownHook = {
  name: string
  priority: number // Lower numbers execute first
  timeout: number // Maximum time in milliseconds
  cleanup: () => Promise<void>
  required: boolean // If true, failure will prevent shutdown
}

/**
 * Shutdown status
 */
export type ShutdownStatus = 'idle' | 'shutting_down' | 'completed' | 'failed'

/**
 * Shutdown result
 */
export interface ShutdownResult {
  success: boolean
  duration: number
  completedHooks: string[]
  failedHooks: Array<{ name: string; error: string }>
  timedOutHooks: string[]
  forcedShutdown: boolean
}

/**
 * Graceful shutdown configuration
 */
export interface GracefulShutdownConfig {
  enabled: boolean
  timeout: number // Overall shutdown timeout in milliseconds
  forceTimeout: number // Force shutdown timeout in milliseconds
  signals: string[] // Signals to handle
  exitCode: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  notifyInterval: number // Interval for shutdown progress notifications
}

/**
 * Graceful shutdown manager
 */
export class GracefulShutdownManager {
  private config: GracefulShutdownConfig
  private hooks: Map<string, ShutdownHook> = new Map()
  private status: ShutdownStatus = 'idle'
  private shutdownPromise: Promise<ShutdownResult> | null = null
  private shutdownStartTime: number = 0
  private shutdownTimeout: NodeJS.Timeout | null = null
  private forceTimeout: NodeJS.Timeout | null = null
  private notificationInterval: NodeJS.Timeout | null = null
  private isShuttingDown: boolean = false

  constructor(config: Partial<GracefulShutdownConfig> = {}) {
    this.config = {
      enabled: true,
      timeout: 30000, // 30 seconds
      forceTimeout: 60000, // 1 minute
      signals: ['SIGTERM', 'SIGINT'],
      exitCode: 0,
      logLevel: 'info',
      notifyInterval: 5000, // 5 seconds
      ...config
    }

    this.setupSignalHandlers()
    this.registerDefaultHooks()
  }

  /**
   * Setup signal handlers
   */
  private setupSignalHandlers(): void {
    if (!this.config.enabled) {
      return
    }

    this.config.signals.forEach(signal => {
      process.on(signal as NodeJS.Signals, async () => {
        logger.info(`Received ${signal} signal, initiating graceful shutdown`)
        
        try {
          await this.shutdown()
          process.exit(this.config.exitCode)
        } catch (error) {
          logger.error('Graceful shutdown failed, forcing exit', {
            errorType: error instanceof Error ? error.name : 'Unknown',
            metadata: {
              signal,
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            }
          }, error instanceof Error ? error : undefined)
          
          process.exit(1)
        }
      })
    })

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception, initiating emergency shutdown', {
        errorType: error.name,
        metadata: {
          errorMessage: error.message,
          stack: error.stack
        }
      }, error)

      try {
        await this.shutdown()
      } catch (shutdownError) {
        logger.error('Emergency shutdown failed', {
          errorType: shutdownError instanceof Error ? shutdownError.name : 'Unknown',
          metadata: {
            errorMessage: shutdownError instanceof Error ? shutdownError.message : 'Unknown error'
          }
        }, shutdownError instanceof Error ? shutdownError : undefined)
      }

      process.exit(1)
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled promise rejection, initiating emergency shutdown', {
        metadata: {
          reason: reason instanceof Error ? reason.message : String(reason),
          promise: String(promise)
        }
      })

      try {
        await this.shutdown()
      } catch (shutdownError) {
        logger.error('Emergency shutdown failed', {
          errorType: shutdownError instanceof Error ? shutdownError.name : 'Unknown',
          metadata: {
            errorMessage: shutdownError instanceof Error ? shutdownError.message : 'Unknown error'
          }
        }, shutdownError instanceof Error ? shutdownError : undefined)
      }

      process.exit(1)
    })

    logger.info('Graceful shutdown manager initialized', {
      metadata: {
        enabled: this.config.enabled,
        timeout: this.config.timeout,
        forceTimeout: this.config.forceTimeout,
        signals: this.config.signals
      }
    })
  }

  /**
   * Register default shutdown hooks
   */
  private registerDefaultHooks(): void {
    // Audit logger shutdown
    this.registerHook({
      name: 'audit_logger',
      priority: 10,
      timeout: 5000,
      required: false,
      cleanup: async () => {
        await auditLogger.shutdown()
      }
    })

    // Configuration manager shutdown
    this.registerHook({
      name: 'config_manager',
      priority: 20,
      timeout: 3000,
      required: false,
      cleanup: async () => {
        await configManager.shutdown()
      }
    })

    // Database shutdown
    this.registerHook({
      name: 'database',
      priority: 30,
      timeout: 10000,
      required: true,
      cleanup: async () => {
        await shutdownDatabase()
      }
    })

    // Application metrics shutdown
    this.registerHook({
      name: 'metrics',
      priority: 40,
      timeout: 2000,
      required: false,
      cleanup: async () => {
        // Metrics don't need explicit shutdown, but we can log final metrics
        logger.info('Application metrics shutdown completed')
      }
    })

    // Final cleanup
    this.registerHook({
      name: 'final_cleanup',
      priority: 100,
      timeout: 1000,
      required: false,
      cleanup: async () => {
        // Clear any remaining timers, close file handles, etc.
        logger.info('Final cleanup completed')
      }
    })
  }

  /**
   * Register a shutdown hook
   */
  registerHook(hook: ShutdownHook): void {
    if (this.hooks.has(hook.name)) {
      logger.warn('Shutdown hook already registered, overwriting', {
        metadata: {
          hookName: hook.name,
          priority: hook.priority
        }
      })
    }

    this.hooks.set(hook.name, hook)
    
    logger.debug('Shutdown hook registered', {
      metadata: {
        hookName: hook.name,
        priority: hook.priority,
        timeout: hook.timeout,
        required: hook.required
      }
    })
  }

  /**
   * Unregister a shutdown hook
   */
  unregisterHook(name: string): void {
    if (this.hooks.delete(name)) {
      logger.debug('Shutdown hook unregistered', {
        metadata: { hookName: name }
      })
    }
  }

  /**
   * Get registered hooks
   */
  getHooks(): ShutdownHook[] {
    return Array.from(this.hooks.values()).sort((a, b) => a.priority - b.priority)
  }

  /**
   * Get shutdown status
   */
  getStatus(): ShutdownStatus {
    return this.status
  }

  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown
  }

  /**
   * Initiate graceful shutdown
   */
  async shutdown(): Promise<ShutdownResult> {
    if (this.isShuttingDown) {
      logger.info('Shutdown already in progress, returning existing promise')
      return this.shutdownPromise!
    }

    this.isShuttingDown = true
    this.status = 'shutting_down'
    this.shutdownStartTime = Date.now()

    // Log shutdown initiation
    await auditLogger.logAdminAction(
      'system_shutdown',
      {
        timestamp: new Date().toISOString(),
        hooksCount: this.hooks.size,
        timeout: this.config.timeout
      },
      'system',
      'system'
    )

    this.shutdownPromise = this.executeShutdown()
    return this.shutdownPromise
  }

  /**
   * Execute the shutdown process
   */
  private async executeShutdown(): Promise<ShutdownResult> {
    const result: ShutdownResult = {
      success: false,
      duration: 0,
      completedHooks: [],
      failedHooks: [],
      timedOutHooks: [],
      forcedShutdown: false
    }

    try {
      logger.info('Starting graceful shutdown', {
        metadata: {
          hooksCount: this.hooks.size,
          timeout: this.config.timeout,
          forceTimeout: this.config.forceTimeout
        }
      })

      // Setup overall timeout
      this.shutdownTimeout = setTimeout(() => {
        logger.warn('Shutdown timeout reached, initiating force shutdown')
        this.forceShutdown()
      }, this.config.timeout)

      // Setup force timeout
      this.forceTimeout = setTimeout(() => {
        logger.error('Force shutdown timeout reached, exiting immediately')
        result.forcedShutdown = true
        process.exit(1)
      }, this.config.forceTimeout)

      // Setup progress notifications
      this.notificationInterval = setInterval(() => {
        const elapsed = Date.now() - this.shutdownStartTime
        logger.info('Shutdown in progress', {
          metadata: {
            elapsedMs: elapsed,
            completedHooks: result.completedHooks.length,
            totalHooks: this.hooks.size,
            status: this.status
          }
        })
      }, this.config.notifyInterval)

      // Execute hooks in priority order
      const sortedHooks = this.getHooks()
      
      for (const hook of sortedHooks) {
        try {
          logger.debug(`Executing shutdown hook: ${hook.name}`)
          
          const hookPromise = this.executeHook(hook)
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Hook ${hook.name} timed out after ${hook.timeout}ms`))
            }, hook.timeout)
          })

          await Promise.race([hookPromise, timeoutPromise])
          
          result.completedHooks.push(hook.name)
          logger.debug(`Shutdown hook completed: ${hook.name}`)
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          
          if (errorMessage.includes('timed out')) {
            result.timedOutHooks.push(hook.name)
            logger.warn(`Shutdown hook timed out: ${hook.name}`, {
              metadata: {
                hookName: hook.name,
                timeout: hook.timeout,
                required: hook.required
              }
            })
          } else {
            result.failedHooks.push({ name: hook.name, error: errorMessage })
            logger.error(`Shutdown hook failed: ${hook.name}`, {
              errorType: error instanceof Error ? error.name : 'Unknown',
              metadata: {
                hookName: hook.name,
                required: hook.required,
                errorMessage
              }
            }, error instanceof Error ? error : undefined)
          }

          // If it's a required hook and it failed, stop the shutdown process
          if (hook.required) {
            throw new Error(`Required shutdown hook failed: ${hook.name} - ${errorMessage}`)
          }
        }
      }

      // Clear timeouts
      this.clearTimeouts()

      // Calculate final result
      result.duration = Date.now() - this.shutdownStartTime
      result.success = result.failedHooks.length === 0 && result.timedOutHooks.length === 0
      this.status = result.success ? 'completed' : 'failed'

      logger.info('Graceful shutdown completed', {
        metadata: {
          success: result.success,
          duration: result.duration,
          completedHooks: result.completedHooks.length,
          failedHooks: result.failedHooks.length,
          timedOutHooks: result.timedOutHooks.length,
          forcedShutdown: result.forcedShutdown
        }
      })

      // Log final audit event
      await auditLogger.logAdminAction(
        'system_shutdown_completed',
        {
          result: {
            success: result.success,
            duration: result.duration,
            completedHooks: result.completedHooks.length,
            failedHooks: result.failedHooks.length,
            timedOutHooks: result.timedOutHooks.length
          }
        },
        'system',
        'system'
      )

      return result

    } catch (error) {
      this.clearTimeouts()
      
      result.duration = Date.now() - this.shutdownStartTime
      result.success = false
      this.status = 'failed'

      logger.error('Graceful shutdown failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          duration: result.duration,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)

      return result
    }
  }

  /**
   * Execute a single shutdown hook
   */
  private async executeHook(hook: ShutdownHook): Promise<void> {
    const startTime = Date.now()
    
    try {
      await hook.cleanup()
      
      const duration = Date.now() - startTime
      logger.debug(`Hook ${hook.name} completed`, {
        metadata: {
          hookName: hook.name,
          duration,
          required: hook.required
        }
      })
      
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error(`Hook ${hook.name} failed`, {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          hookName: hook.name,
          duration,
          required: hook.required,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      
      throw error
    }
  }

  /**
   * Force shutdown when timeout is reached
   */
  private forceShutdown(): void {
    logger.warn('Initiating force shutdown due to timeout')
    
    // Clear remaining timeouts
    this.clearTimeouts()
    
    // Set status
    this.status = 'failed'
    
    // Log force shutdown
    auditLogger.logAdminAction(
      'system_force_shutdown',
      {
        reason: 'timeout',
        elapsedTime: Date.now() - this.shutdownStartTime
      },
      'system',
      'system'
    ).catch(() => {
      // Ignore errors during force shutdown
    })
  }

  /**
   * Clear all timeouts
   */
  private clearTimeouts(): void {
    if (this.shutdownTimeout) {
      clearTimeout(this.shutdownTimeout)
      this.shutdownTimeout = null
    }
    
    if (this.forceTimeout) {
      clearTimeout(this.forceTimeout)
      this.forceTimeout = null
    }
    
    if (this.notificationInterval) {
      clearInterval(this.notificationInterval)
      this.notificationInterval = null
    }
  }

  /**
   * Get shutdown statistics
   */
  getShutdownStats(): {
    status: ShutdownStatus
    isShuttingDown: boolean
    registeredHooks: number
    elapsedTime: number
  } {
    return {
      status: this.status,
      isShuttingDown: this.isShuttingDown,
      registeredHooks: this.hooks.size,
      elapsedTime: this.isShuttingDown ? Date.now() - this.shutdownStartTime : 0
    }
  }

  /**
   * Test shutdown hooks without actually shutting down
   */
  async testHooks(): Promise<{
    success: boolean
    results: Array<{
      name: string
      success: boolean
      duration: number
      error?: string
    }>
  }> {
    const results: Array<{
      name: string
      success: boolean
      duration: number
      error?: string
    }> = []

    const sortedHooks = this.getHooks()
    
    for (const hook of sortedHooks) {
      const startTime = Date.now()
      
      try {
        // For testing, we'll just validate the hook exists and is callable
        if (typeof hook.cleanup !== 'function') {
          throw new Error('Cleanup function is not callable')
        }
        
        results.push({
          name: hook.name,
          success: true,
          duration: Date.now() - startTime
        })
        
      } catch (error) {
        results.push({
          name: hook.name,
          success: false,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const success = results.every(result => result.success)
    
    logger.info('Shutdown hooks test completed', {
      metadata: {
        success,
        totalHooks: results.length,
        passedHooks: results.filter(r => r.success).length,
        failedHooks: results.filter(r => !r.success).length
      }
    })

    return { success, results }
  }
}

/**
 * Global graceful shutdown manager instance
 */
export const gracefulShutdownManager = new GracefulShutdownManager() 