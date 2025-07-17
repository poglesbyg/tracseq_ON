import { v4 as uuidv4 } from 'uuid'
import { db } from '../database/connection.js'
import { logger, logAuditEvent, logUserActivity, logAlert, logReportGeneration, logDataRetention } from '../utils/logger.js'
import type {
  AuditEvent,
  CreateAuditEventRequest,
  AuditLog,
  CreateAuditLogRequest,
  UserActivity,
  CreateUserActivityRequest,
  AuditSearchFilters,
  AuditSearchResult,
  AuditReport,
  CreateAuditReportRequest,
  AuditAlert,
  CreateAuditAlertRequest,
  AuditStats,
  ActivityMetrics,
  ExportOptions,
  ExportResult,
  ApiResponse
} from '../types/index.js'

export class AuditService {
  private retentionDays: number
  private maxEventsPerRequest: number
  private enableRealTimeAlerts: boolean
  private enableScheduledReports: boolean
  private enableDataRetention: boolean

  constructor(config: {
    retentionDays?: number
    maxEventsPerRequest?: number
    enableRealTimeAlerts?: boolean
    enableScheduledReports?: boolean
    enableDataRetention?: boolean
  } = {}) {
    this.retentionDays = config.retentionDays || 90
    this.maxEventsPerRequest = config.maxEventsPerRequest || 1000
    this.enableRealTimeAlerts = config.enableRealTimeAlerts ?? true
    this.enableScheduledReports = config.enableScheduledReports ?? true
    this.enableDataRetention = config.enableDataRetention ?? true
  }

  // Audit Events Management
  async createAuditEvent(request: CreateAuditEventRequest): Promise<AuditEvent> {
    try {
      const eventId = uuidv4()
      const timestamp = new Date()

      const eventData = {
        id: eventId,
        timestamp,
        user_id: request.userId,
        user_email: request.userEmail,
        service: request.service,
        action: request.action,
        resource: request.resource,
        resource_id: request.resourceId,
        details: request.details || {},
        ip_address: request.ipAddress,
        user_agent: request.userAgent,
        session_id: request.sessionId,
        severity: request.severity || 'info',
        category: request.category || 'system',
        tags: request.tags || [],
        metadata: request.metadata || {},
        created_at: timestamp
      }

      const event = await db
        .insertInto('audit_events')
        .values(eventData)
        .returningAll()
        .executeTakeFirstOrThrow()

      // Log the audit event
      logAuditEvent({
        service: request.service,
        action: request.action,
        resource: request.resource,
        userId: request.userId,
        userEmail: request.userEmail,
        severity: request.severity || 'info',
        category: request.category || 'system',
        details: request.details
      })

      // Check for real-time alerts
      if (this.enableRealTimeAlerts) {
        await this.checkAndTriggerAlerts(event)
      }

      return this.mapDatabaseEventToAuditEvent(event)
    } catch (error) {
      logger.error('Failed to create audit event', { error: error instanceof Error ? error.message : 'Unknown error', request })
      throw new Error('Failed to create audit event')
    }
  }

  async getAuditEvents(filters: AuditSearchFilters, page: number = 1, limit: number = 20): Promise<AuditSearchResult> {
    try {
      let query = db.selectFrom('audit_events')

      // Apply filters
      if (filters.userId) {
        query = query.where('user_id', '=', filters.userId)
      }
      if (filters.userEmail) {
        query = query.where('user_email', '=', filters.userEmail)
      }
      if (filters.service) {
        query = query.where('service', '=', filters.service)
      }
      if (filters.action) {
        query = query.where('action', '=', filters.action)
      }
      if (filters.resource) {
        query = query.where('resource', '=', filters.resource)
      }
      if (filters.resourceId) {
        query = query.where('resource_id', '=', filters.resourceId)
      }
      if (filters.severity) {
        query = query.where('severity', '=', filters.severity)
      }
      if (filters.category) {
        query = query.where('category', '=', filters.category)
      }
      if (filters.dateFrom) {
        query = query.where('timestamp', '>=', filters.dateFrom)
      }
      if (filters.dateTo) {
        query = query.where('timestamp', '<=', filters.dateTo)
      }
      if (filters.sessionId) {
        query = query.where('session_id', '=', filters.sessionId)
      }
      if (filters.ipAddress) {
        query = query.where('ip_address', '=', filters.ipAddress)
      }
      if (filters.tags && filters.tags.length > 0) {
        query = query.where('tags', '@>', filters.tags)
      }

      // Get total count
      const totalResult = await query.execute()
      const total = totalResult.length

      // Apply pagination
      const offset = (page - 1) * limit
      const events = await query
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()

      return {
        events: events.map(this.mapDatabaseEventToAuditEvent),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    } catch (error) {
      logger.error('Failed to get audit events', { error: error instanceof Error ? error.message : 'Unknown error', filters })
      throw new Error('Failed to get audit events')
    }
  }

  // Audit Logs Management
  async createAuditLog(request: CreateAuditLogRequest): Promise<AuditLog> {
    try {
      const logId = uuidv4()
      const timestamp = new Date()

      const logData = {
        id: logId,
        timestamp,
        level: request.level,
        message: request.message,
        service: request.service,
        user_id: request.userId,
        session_id: request.sessionId,
        ip_address: request.ipAddress,
        user_agent: request.userAgent,
        details: request.details || {},
        stack_trace: request.stackTrace,
        tags: request.tags || [],
        created_at: timestamp
      }

      const log = await db
        .insertInto('audit_logs')
        .values(logData)
        .returningAll()
        .executeTakeFirstOrThrow()

      return this.mapDatabaseLogToAuditLog(log)
    } catch (error) {
      logger.error('Failed to create audit log', { error: error instanceof Error ? error.message : 'Unknown error', request })
      throw new Error('Failed to create audit log')
    }
  }

  async getAuditLogs(filters: {
    level?: string
    service?: string
    userId?: string
    dateFrom?: Date
    dateTo?: Date
  }, page: number = 1, limit: number = 100): Promise<{ logs: AuditLog[], total: number, page: number, limit: number, totalPages: number }> {
    try {
      let query = db.selectFrom('audit_logs')

      if (filters.level) {
        query = query.where('level', '=', filters.level)
      }
      if (filters.service) {
        query = query.where('service', '=', filters.service)
      }
      if (filters.userId) {
        query = query.where('user_id', '=', filters.userId)
      }
      if (filters.dateFrom) {
        query = query.where('timestamp', '>=', filters.dateFrom)
      }
      if (filters.dateTo) {
        query = query.where('timestamp', '<=', filters.dateTo)
      }

      const totalResult = await query.execute()
      const total = totalResult.length

      const logs = await query
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset((page - 1) * limit)
        .execute()

      return {
        logs: logs.map(this.mapDatabaseLogToAuditLog),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    } catch (error) {
      logger.error('Failed to get audit logs', { error: error instanceof Error ? error.message : 'Unknown error', filters })
      throw new Error('Failed to get audit logs')
    }
  }

  // User Activities Management
  async createUserActivity(request: CreateUserActivityRequest): Promise<UserActivity> {
    try {
      const activityId = uuidv4()
      const timestamp = new Date()

      const activityData = {
        id: activityId,
        user_id: request.userId,
        user_email: request.userEmail,
        timestamp,
        action: request.action,
        service: request.service,
        resource: request.resource,
        resource_id: request.resourceId,
        ip_address: request.ipAddress,
        user_agent: request.userAgent,
        session_id: request.sessionId,
        duration: request.duration,
        success: request.success,
        details: request.details || {},
        created_at: timestamp
      }

      const activity = await db
        .insertInto('user_activities')
        .values(activityData)
        .returningAll()
        .executeTakeFirstOrThrow()

      // Log the user activity
      logUserActivity({
        userId: request.userId,
        userEmail: request.userEmail,
        action: request.action,
        service: request.service,
        resource: request.resource,
        success: request.success,
        duration: request.duration,
        details: request.details
      })

      return this.mapDatabaseActivityToUserActivity(activity)
    } catch (error) {
      logger.error('Failed to create user activity', { error: error instanceof Error ? error.message : 'Unknown error', request })
      throw new Error('Failed to create user activity')
    }
  }

  async getUserActivities(filters: {
    userId?: string
    userEmail?: string
    service?: string
    action?: string
    success?: boolean
    dateFrom?: Date
    dateTo?: Date
  }, page: number = 1, limit: number = 50): Promise<{ activities: UserActivity[], total: number, page: number, limit: number, totalPages: number }> {
    try {
      let query = db.selectFrom('user_activities')

      if (filters.userId) {
        query = query.where('user_id', '=', filters.userId)
      }
      if (filters.userEmail) {
        query = query.where('user_email', '=', filters.userEmail)
      }
      if (filters.service) {
        query = query.where('service', '=', filters.service)
      }
      if (filters.action) {
        query = query.where('action', '=', filters.action)
      }
      if (filters.success !== undefined) {
        query = query.where('success', '=', filters.success)
      }
      if (filters.dateFrom) {
        query = query.where('timestamp', '>=', filters.dateFrom)
      }
      if (filters.dateTo) {
        query = query.where('timestamp', '<=', filters.dateTo)
      }

      const totalResult = await query.execute()
      const total = totalResult.length

      const activities = await query
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset((page - 1) * limit)
        .execute()

      return {
        activities: activities.map(this.mapDatabaseActivityToUserActivity),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    } catch (error) {
      logger.error('Failed to get user activities', { error: error instanceof Error ? error.message : 'Unknown error', filters })
      throw new Error('Failed to get user activities')
    }
  }

  // Statistics and Metrics
  async getAuditStats(daysBack: number = 30): Promise<AuditStats> {
    try {
      const result = await db
        .selectFrom(db.fn.get_audit_stats(daysBack))
        .selectAll()
        .executeTakeFirstOrThrow()

      return {
        totalEvents: Number(result.total_events),
        eventsByService: result.events_by_service,
        eventsByCategory: result.events_by_category,
        eventsBySeverity: result.events_by_severity,
        eventsByDate: result.events_by_date,
        topUsers: result.top_users,
        topActions: result.top_actions,
        topResources: result.top_resources,
        errorRate: Number(result.error_rate),
        averageResponseTime: Number(result.avg_response_time)
      }
    } catch (error) {
      logger.error('Failed to get audit stats', { error: error instanceof Error ? error.message : 'Unknown error', daysBack })
      throw new Error('Failed to get audit statistics')
    }
  }

  async getActivityMetrics(daysBack: number = 30): Promise<ActivityMetrics> {
    try {
      const result = await db
        .selectFrom(db.fn.get_activity_metrics(daysBack))
        .selectAll()
        .executeTakeFirstOrThrow()

      return {
        totalActivities: Number(result.total_activities),
        activitiesByService: result.activities_by_service,
        activitiesByUser: result.activities_by_user,
        activitiesByDate: result.activities_by_date,
        successRate: Number(result.success_rate),
        averageDuration: Number(result.avg_duration),
        topActions: result.top_actions,
        topResources: result.top_resources
      }
    } catch (error) {
      logger.error('Failed to get activity metrics', { error: error instanceof Error ? error.message : 'Unknown error', daysBack })
      throw new Error('Failed to get activity metrics')
    }
  }

  // Reports Management
  async createAuditReport(request: CreateAuditReportRequest): Promise<AuditReport> {
    try {
      const reportId = uuidv4()
      const now = new Date()

      const reportData = {
        id: reportId,
        name: request.name,
        description: request.description,
        type: request.type,
        filters: request.filters,
        schedule: request.schedule,
        recipients: request.recipients || [],
        format: request.format,
        is_active: true,
        created_at: now,
        updated_at: now
      }

      const report = await db
        .insertInto('audit_reports')
        .values(reportData)
        .returningAll()
        .executeTakeFirstOrThrow()

      return this.mapDatabaseReportToAuditReport(report)
    } catch (error) {
      logger.error('Failed to create audit report', { error: error instanceof Error ? error.message : 'Unknown error', request })
      throw new Error('Failed to create audit report')
    }
  }

  async generateReport(reportId: string, options?: ExportOptions): Promise<ExportResult> {
    try {
      const report = await db
        .selectFrom('audit_reports')
        .selectAll()
        .where('id', '=', reportId)
        .executeTakeFirstOrThrow()

      const startTime = Date.now()
      const events = await this.getAuditEvents(report.filters as AuditSearchFilters, 1, this.maxEventsPerRequest)
      
      let data: string | Buffer
      let filename: string
      let mimeType: string

      switch (report.format) {
        case 'json':
          data = JSON.stringify(events.events, null, 2)
          filename = `${report.name}_${new Date().toISOString().split('T')[0]}.json`
          mimeType = 'application/json'
          break
        case 'csv':
          data = this.convertToCSV(events.events)
          filename = `${report.name}_${new Date().toISOString().split('T')[0]}.csv`
          mimeType = 'text/csv'
          break
        case 'pdf':
          data = Buffer.from('PDF generation not implemented yet')
          filename = `${report.name}_${new Date().toISOString().split('T')[0]}.pdf`
          mimeType = 'application/pdf'
          break
        default:
          throw new Error(`Unsupported format: ${report.format}`)
      }

      const duration = Date.now() - startTime

      // Log report generation
      logReportGeneration({
        name: report.name,
        type: report.type,
        format: report.format,
        recordCount: events.events.length,
        duration
      })

      // Update report last run
      await db
        .updateTable('audit_reports')
        .set({ last_run: new Date() })
        .where('id', '=', reportId)
        .execute()

      return {
        data,
        filename,
        mimeType,
        recordCount: events.events.length
      }
    } catch (error) {
      logger.error('Failed to generate report', { error: error instanceof Error ? error.message : 'Unknown error', reportId })
      throw new Error('Failed to generate report')
    }
  }

  // Alerts Management
  async createAuditAlert(request: CreateAuditAlertRequest): Promise<AuditAlert> {
    try {
      const alertId = uuidv4()
      const now = new Date()

      const alertData = {
        id: alertId,
        name: request.name,
        description: request.description,
        condition: request.condition,
        severity: request.severity,
        service: request.service,
        is_active: true,
        recipients: request.recipients,
        cooldown_minutes: request.cooldownMinutes || 60,
        created_at: now,
        updated_at: now
      }

      const alert = await db
        .insertInto('audit_alerts')
        .values(alertData)
        .returningAll()
        .executeTakeFirstOrThrow()

      return this.mapDatabaseAlertToAuditAlert(alert)
    } catch (error) {
      logger.error('Failed to create audit alert', { error: error instanceof Error ? error.message : 'Unknown error', request })
      throw new Error('Failed to create audit alert')
    }
  }

  async checkAndTriggerAlerts(event: any): Promise<void> {
    try {
      const alerts = await db
        .selectFrom(db.fn.check_alert_conditions())
        .selectAll()
        .execute()

      for (const alert of alerts) {
        // Log the alert
        logAlert({
          name: alert.alert_name,
          severity: alert.alert_severity,
          service: 'audit',
          condition: { field: 'service', value: 'audit' },
          recipients: alert.alert_recipients,
          eventCount: Number(alert.event_count)
        })

        // Update alert last triggered
        await db
          .updateTable('audit_alerts')
          .set({ last_triggered: new Date() })
          .where('id', '=', alert.alert_id)
          .execute()

        // Create alert history record
        await db
          .insertInto('audit_alert_history')
          .values({
            id: uuidv4(),
            alert_id: alert.alert_id,
            triggered_at: new Date(),
            event_data: event,
            recipients_notified: alert.alert_recipients,
            created_at: new Date()
          })
          .execute()
      }
    } catch (error) {
      logger.error('Failed to check and trigger alerts', { error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  // Data Retention
  async cleanupOldData(retentionDays?: number): Promise<number> {
    try {
      const days = retentionDays || this.retentionDays
      const result = await db.fn.cleanup_old_audit_data(days).execute()
      const deletedCount = Number(result)

      logDataRetention({
        retentionDays: days,
        deletedEvents: deletedCount,
        deletedLogs: 0,
        deletedActivities: 0,
        deletedAlertHistory: 0
      })

      return deletedCount
    } catch (error) {
      logger.error('Failed to cleanup old data', { error: error instanceof Error ? error.message : 'Unknown error', retentionDays })
      throw new Error('Failed to cleanup old data')
    }
  }

  // Utility methods
  private mapDatabaseEventToAuditEvent(dbEvent: any): AuditEvent {
    return {
      id: dbEvent.id,
      timestamp: dbEvent.timestamp,
      userId: dbEvent.user_id,
      userEmail: dbEvent.user_email,
      service: dbEvent.service,
      action: dbEvent.action,
      resource: dbEvent.resource,
      resourceId: dbEvent.resource_id,
      details: dbEvent.details,
      ipAddress: dbEvent.ip_address,
      userAgent: dbEvent.user_agent,
      sessionId: dbEvent.session_id,
      severity: dbEvent.severity,
      category: dbEvent.category,
      tags: dbEvent.tags,
      metadata: dbEvent.metadata
    }
  }

  private mapDatabaseLogToAuditLog(dbLog: any): AuditLog {
    return {
      id: dbLog.id,
      timestamp: dbLog.timestamp,
      level: dbLog.level,
      message: dbLog.message,
      service: dbLog.service,
      userId: dbLog.user_id,
      sessionId: dbLog.session_id,
      ipAddress: dbLog.ip_address,
      userAgent: dbLog.user_agent,
      details: dbLog.details,
      stackTrace: dbLog.stack_trace,
      tags: dbLog.tags
    }
  }

  private mapDatabaseActivityToUserActivity(dbActivity: any): UserActivity {
    return {
      id: dbActivity.id,
      userId: dbActivity.user_id,
      userEmail: dbActivity.user_email,
      timestamp: dbActivity.timestamp,
      action: dbActivity.action,
      service: dbActivity.service,
      resource: dbActivity.resource,
      resourceId: dbActivity.resource_id,
      ipAddress: dbActivity.ip_address,
      userAgent: dbActivity.user_agent,
      sessionId: dbActivity.session_id,
      duration: dbActivity.duration,
      success: dbActivity.success,
      details: dbActivity.details
    }
  }

  private mapDatabaseReportToAuditReport(dbReport: any): AuditReport {
    return {
      id: dbReport.id,
      name: dbReport.name,
      description: dbReport.description,
      type: dbReport.type,
      filters: dbReport.filters,
      schedule: dbReport.schedule,
      recipients: dbReport.recipients,
      format: dbReport.format,
      createdAt: dbReport.created_at,
      updatedAt: dbReport.updated_at,
      lastRun: dbReport.last_run,
      nextRun: dbReport.next_run,
      isActive: dbReport.is_active
    }
  }

  private mapDatabaseAlertToAuditAlert(dbAlert: any): AuditAlert {
    return {
      id: dbAlert.id,
      name: dbAlert.name,
      description: dbAlert.description,
      condition: dbAlert.condition,
      severity: dbAlert.severity,
      service: dbAlert.service,
      isActive: dbAlert.is_active,
      recipients: dbAlert.recipients,
      cooldownMinutes: dbAlert.cooldown_minutes,
      lastTriggered: dbAlert.last_triggered,
      createdAt: dbAlert.created_at,
      updatedAt: dbAlert.updated_at
    }
  }

  private convertToCSV(events: AuditEvent[]): string {
    if (events.length === 0) return ''

    const headers = ['timestamp', 'service', 'action', 'resource', 'userId', 'userEmail', 'severity', 'category']
    const rows = events.map(event => [
      event.timestamp.toISOString(),
      event.service,
      event.action,
      event.resource,
      event.userId || '',
      event.userEmail || '',
      event.severity,
      event.category
    ])

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
  }
}

export default AuditService