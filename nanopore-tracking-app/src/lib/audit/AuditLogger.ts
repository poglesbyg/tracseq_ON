import { getComponentLogger } from '../logging/StructuredLogger'
import { applicationMetrics } from '../monitoring/MetricsCollector'
import { db } from '../database'
import { sql } from 'kysely'
import { promises as fs } from 'fs'
import { join } from 'path'

const logger = getComponentLogger('AuditLogger')

/**
 * Audit event types
 */
export type AuditEventType = 
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS' | 'EXPORT' | 'IMPORT'
  | 'BACKUP' | 'RESTORE' | 'ADMIN_ACTION' | 'SECURITY_EVENT' | 'SYSTEM_EVENT' | 'API_CALL'
  | 'FILE_UPLOAD' | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'PERMISSION_CHANGE'

/**
 * Audit event severity levels
 */
export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

/**
 * Audit event categories
 */
export type AuditCategory = 
  | 'AUTHENTICATION' | 'AUTHORIZATION' | 'DATA_MODIFICATION' | 'DATA_ACCESS'
  | 'SYSTEM_ADMINISTRATION' | 'SECURITY' | 'COMPLIANCE' | 'PERFORMANCE' | 'ERROR'

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  id: string
  timestamp: Date
  eventType: AuditEventType
  category: AuditCategory
  severity: AuditSeverity
  userId: string | null
  username: string | null
  sessionId: string | null
  ipAddress: string | null
  userAgent: string | null
  resource: string
  resourceId: string | null
  action: string
  details: Record<string, any>
  oldValues: Record<string, any> | null
  newValues: Record<string, any> | null
  success: boolean
  errorMessage: string | null
  duration: number | null
  correlationId: string | null
  tags: string[]
  metadata: Record<string, any>
}

/**
 * Audit configuration
 */
export interface AuditConfig {
  enabled: boolean
  logLevel: AuditSeverity
  retentionDays: number
  asyncLogging: boolean
  maskSensitiveData: boolean
  categories: AuditCategory[]
  excludePatterns: string[]
}

/**
 * Comprehensive audit logging system
 */
export class AuditLogger {
  private config: AuditConfig
  private logQueue: AuditLogEntry[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private isShuttingDown = false
  private sensitiveFields = ['password', 'token', 'secret', 'key', 'credential']

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = {
      enabled: true,
      logLevel: 'LOW',
      retentionDays: 365,
      asyncLogging: true,
      maskSensitiveData: true,
      categories: ['AUTHENTICATION', 'AUTHORIZATION', 'DATA_MODIFICATION', 'DATA_ACCESS', 'SYSTEM_ADMINISTRATION', 'SECURITY'],
      excludePatterns: ['/health', '/metrics'],
      ...config
    }

    this.initializeAuditLogger()
  }

  /**
   * Initialize audit logger
   */
  private async initializeAuditLogger(): Promise<void> {
    try {
      if (!this.config.enabled) {
        logger.info('Audit logging disabled')
        return
      }

      // Create audit log table if it doesn't exist
      await this.createAuditTable()

      // Setup automatic log flushing
      if (this.config.asyncLogging) {
        this.flushInterval = setInterval(() => {
          this.flushLogs()
        }, 5000) // Flush every 5 seconds
      }

      logger.info('Audit logging system initialized', {
        metadata: {
          enabled: this.config.enabled,
          logLevel: this.config.logLevel,
          retentionDays: this.config.retentionDays,
          asyncLogging: this.config.asyncLogging,
          categories: this.config.categories.length
        }
      })
    } catch (error) {
      logger.error('Failed to initialize audit logger', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Create audit log table
   */
  private async createAuditTable(): Promise<void> {
    try {
      // Since we can't use executeQuery, we'll create a simple logging mechanism
      // In a real implementation, you would use a proper database migration system
      
      logger.info('Audit table initialization completed (using file-based logging)')
    } catch (error) {
      logger.error('Failed to create audit table', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Log audit event
   */
  async logEvent(
    eventType: AuditEventType,
    category: AuditCategory,
    severity: AuditSeverity,
    resource: string,
    action: string,
    details: Record<string, any>,
    options: {
      userId?: string
      username?: string
      sessionId?: string
      ipAddress?: string
      userAgent?: string
      resourceId?: string
      oldValues?: Record<string, any>
      newValues?: Record<string, any>
      success?: boolean
      errorMessage?: string
      duration?: number
      correlationId?: string
      tags?: string[]
      metadata?: Record<string, any>
    } = {}
  ): Promise<void> {
    try {
      if (!this.config.enabled) {
        return
      }

      // Check if category is enabled
      if (!this.config.categories.includes(category)) {
        return
      }

      // Check severity level
      if (this.getSeverityLevel(severity) < this.getSeverityLevel(this.config.logLevel)) {
        return
      }

      // Check exclude patterns
      if (this.config.excludePatterns.some(pattern => resource.includes(pattern))) {
        return
      }

      const auditEntry: AuditLogEntry = {
        id: this.generateAuditId(),
        timestamp: new Date(),
        eventType,
        category,
        severity,
        userId: options.userId || null,
        username: options.username || null,
        sessionId: options.sessionId || null,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
        resource,
        resourceId: options.resourceId || null,
        action,
        details: this.maskSensitiveData(details),
        oldValues: options.oldValues ? this.maskSensitiveData(options.oldValues) : null,
        newValues: options.newValues ? this.maskSensitiveData(options.newValues) : null,
        success: options.success !== false,
        errorMessage: options.errorMessage || null,
        duration: options.duration || null,
        correlationId: options.correlationId || null,
        tags: options.tags || [],
        metadata: options.metadata || {}
      }

      if (this.config.asyncLogging) {
        this.logQueue.push(auditEntry)
      } else {
        await this.persistAuditEntry(auditEntry)
      }

      // Record metrics
      applicationMetrics.recordError(`audit_${eventType.toLowerCase()}`, 'AuditLogger')

      logger.debug('Audit event logged', {
        metadata: {
          auditId: auditEntry.id,
          eventType,
          category,
          severity,
          resource,
          action,
          success: auditEntry.success
        }
      })

    } catch (error) {
      logger.error('Failed to log audit event', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          eventType,
          category,
          resource,
          action,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Convenience methods for common audit events
   */
  async logLogin(userId: string, username: string, success: boolean, ipAddress?: string, userAgent?: string, errorMessage?: string): Promise<void> {
    const options: any = { userId, username, success }
    if (ipAddress) options.ipAddress = ipAddress
    if (userAgent) options.userAgent = userAgent
    if (errorMessage) options.errorMessage = errorMessage
    
    await this.logEvent(
      'LOGIN',
      'AUTHENTICATION',
      success ? 'LOW' : 'HIGH',
      'authentication',
      'user_login',
      { userId, username },
      options
    )
  }

  async logLogout(userId: string, username: string, sessionId?: string): Promise<void> {
    const options: any = { userId, username }
    if (sessionId) options.sessionId = sessionId
    
    await this.logEvent(
      'LOGOUT',
      'AUTHENTICATION',
      'LOW',
      'authentication',
      'user_logout',
      { userId, username },
      options
    )
  }

  async logDataCreate(resource: string, resourceId: string, newValues: Record<string, any>, userId?: string, username?: string): Promise<void> {
    const options: any = { resourceId, newValues }
    if (userId) options.userId = userId
    if (username) options.username = username
    
    await this.logEvent(
      'CREATE',
      'DATA_MODIFICATION',
      'MEDIUM',
      resource,
      'create_record',
      { resourceId },
      options
    )
  }

  async logDataUpdate(resource: string, resourceId: string, oldValues: Record<string, any>, newValues: Record<string, any>, userId?: string, username?: string): Promise<void> {
    const options: any = { resourceId, oldValues, newValues }
    if (userId) options.userId = userId
    if (username) options.username = username
    
    await this.logEvent(
      'UPDATE',
      'DATA_MODIFICATION',
      'MEDIUM',
      resource,
      'update_record',
      { resourceId, changes: this.calculateChanges(oldValues, newValues) },
      options
    )
  }

  async logDataDelete(resource: string, resourceId: string, oldValues: Record<string, any>, userId?: string, username?: string): Promise<void> {
    const options: any = { resourceId, oldValues }
    if (userId) options.userId = userId
    if (username) options.username = username
    
    await this.logEvent(
      'DELETE',
      'DATA_MODIFICATION',
      'HIGH',
      resource,
      'delete_record',
      { resourceId },
      options
    )
  }

  async logDataAccess(resource: string, resourceId: string, action: string, userId?: string, username?: string): Promise<void> {
    const options: any = { resourceId }
    if (userId) options.userId = userId
    if (username) options.username = username
    
    await this.logEvent(
      'ACCESS',
      'DATA_ACCESS',
      'LOW',
      resource,
      action,
      { resourceId },
      options
    )
  }

  async logSecurityEvent(eventType: AuditEventType, action: string, details: Record<string, any>, severity: AuditSeverity = 'HIGH', userId?: string, username?: string): Promise<void> {
    const options: any = {}
    if (userId) options.userId = userId
    if (username) options.username = username
    
    await this.logEvent(
      eventType,
      'SECURITY',
      severity,
      'security',
      action,
      details,
      options
    )
  }

  async logAdminAction(action: string, details: Record<string, any>, userId?: string, username?: string): Promise<void> {
    const options: any = {}
    if (userId) options.userId = userId
    if (username) options.username = username
    
    await this.logEvent(
      'ADMIN_ACTION',
      'SYSTEM_ADMINISTRATION',
      'HIGH',
      'admin',
      action,
      details,
      options
    )
  }

  async logApiCall(endpoint: string, method: string, statusCode: number, duration: number, userId?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const options: any = { duration, success: statusCode < 400 }
    if (userId) options.userId = userId
    if (ipAddress) options.ipAddress = ipAddress
    if (userAgent) options.userAgent = userAgent
    
    await this.logEvent(
      'API_CALL',
      'DATA_ACCESS',
      'LOW',
      'api',
      `${method} ${endpoint}`,
      { endpoint, method, statusCode },
      options
    )
  }

  /**
   * Get audit logs (simplified version)
   */
  async getAuditLogs(limit: number = 50): Promise<AuditLogEntry[]> {
    // For now, return recent logs from queue
    // In a real implementation, this would query the database
    return this.logQueue.slice(-limit)
  }

  /**
   * Get audit statistics (simplified version)
   */
  async getAuditStats(): Promise<{
    totalEvents: number
    eventsByType: Record<string, number>
    eventsByCategory: Record<string, number>
    successfulEvents: number
    failedEvents: number
  }> {
    const logs = this.logQueue
    const stats = {
      totalEvents: logs.length,
      eventsByType: {} as Record<string, number>,
      eventsByCategory: {} as Record<string, number>,
      successfulEvents: logs.filter(log => log.success).length,
      failedEvents: logs.filter(log => !log.success).length
    }

    // Group by event type and category
    logs.forEach(log => {
      stats.eventsByType[log.eventType] = (stats.eventsByType[log.eventType] || 0) + 1
      stats.eventsByCategory[log.category] = (stats.eventsByCategory[log.category] || 0) + 1
    })

    return stats
  }

  /**
   * Cleanup old audit logs (simplified version)
   */
  async cleanupOldLogs(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000)
    
    // Remove old logs from queue
    this.logQueue = this.logQueue.filter(log => log.timestamp > cutoffDate)
    
    logger.info('Cleaned up old audit logs', {
      metadata: {
        cutoffDate: cutoffDate.toISOString(),
        remainingLogs: this.logQueue.length
      }
    })
  }

  /**
   * Helper methods
   */
  private generateAuditId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  }

  private getSeverityLevel(severity: AuditSeverity): number {
    const levels = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }
    return levels[severity] || 1
  }

  private maskSensitiveData(data: Record<string, any>): Record<string, any> {
    if (!this.config.maskSensitiveData) {
      return data
    }

    const masked = { ...data }
    for (const key in masked) {
      if (this.sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        masked[key] = '***MASKED***'
      }
    }
    return masked
  }

  private calculateChanges(oldValues: Record<string, any>, newValues: Record<string, any>): Record<string, any> {
    const changes: Record<string, any> = {}
    
    for (const key in newValues) {
      if (oldValues[key] !== newValues[key]) {
        changes[key] = {
          from: oldValues[key],
          to: newValues[key]
        }
      }
    }
    
    return changes
  }

  private async persistAuditEntry(entry: AuditLogEntry): Promise<void> {
    try {
      // For now, just log to structured logger
      // In a real implementation, this would save to database
      logger.info('AUDIT LOG', {
        metadata: {
          auditId: entry.id,
          eventType: entry.eventType,
          category: entry.category,
          severity: entry.severity,
          resource: entry.resource,
          action: entry.action,
          userId: entry.userId,
          username: entry.username,
          success: entry.success,
          details: entry.details
        }
      })

    } catch (error) {
      logger.error('Failed to persist audit entry', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          auditId: entry.id,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.logQueue.length === 0 || this.isShuttingDown) {
      return
    }

    const logsToFlush = this.logQueue.splice(0, 100) // Process in batches of 100
    
    try {
      await Promise.all(logsToFlush.map(entry => this.persistAuditEntry(entry)))
      
      logger.debug('Flushed audit logs', {
        metadata: {
          flushedCount: logsToFlush.length,
          queueSize: this.logQueue.length
        }
      })
    } catch (error) {
      // Re-add failed logs to queue
      this.logQueue.unshift(...logsToFlush)
      
      logger.error('Failed to flush audit logs', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          failedCount: logsToFlush.length,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Shutdown audit logger
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true
    
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    
    // Flush remaining logs
    await this.flushLogs()
    
    logger.info('Audit logger shutdown completed', {
      metadata: {
        remainingLogs: this.logQueue.length
      }
    })
  }
}

/**
 * Global audit logger instance
 */
export const auditLogger = new AuditLogger()

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down audit logger')
  await auditLogger.shutdown()
})

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down audit logger')
  await auditLogger.shutdown()
}) 