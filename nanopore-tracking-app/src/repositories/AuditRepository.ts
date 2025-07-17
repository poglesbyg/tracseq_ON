import { auditDb } from '../lib/database/service-databases'
import { getComponentLogger } from '../lib/logging/StructuredLogger'
import type { AuditEvent } from '../services/interfaces/IAuditLogger'

const logger = getComponentLogger('AuditRepository')

export interface AuditLog {
  id: string
  event_type: string
  user_id: string | null
  resource_type: string
  resource_id: string
  action: string
  details: Record<string, any>
  ip_address: string | null
  user_agent: string | null
  timestamp: Date
  created_at: Date
}

export interface ComplianceReport {
  id: string
  report_type: string
  period_start: Date
  period_end: Date
  generated_by: string
  data: Record<string, any>
  status: 'generating' | 'completed' | 'failed'
  created_at: Date
  updated_at: Date
}

export interface RetentionPolicy {
  id: string
  resource_type: string
  retention_days: number
  archive_after_days: number | null
  delete_after_days: number | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export class AuditRepository {
  private get db() {
    return auditDb()
  }

  // Audit Log Operations
  async createAuditLog(event: AuditEvent): Promise<AuditLog> {
    logger.info('Creating audit log entry', {
      action: 'create_audit_log',
      metadata: { eventType: event.type, resourceType: event.resourceType }
    })

    const result = await this.db
      .insertInto('audit_logs')
      .values({
        id: crypto.randomUUID(),
        event_type: event.type,
        user_id: event.userId || null,
        resource_type: event.resourceType,
        resource_id: event.resourceId,
        action: event.action,
        details: event.details,
        ip_address: event.ipAddress || null,
        user_agent: event.userAgent || null,
        timestamp: event.timestamp,
        created_at: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as AuditLog
  }

  async getAuditTrail(resourceType: string, resourceId: string): Promise<AuditLog[]> {
    const results = await this.db
      .selectFrom('audit_logs')
      .selectAll()
      .where('resource_type', '=', resourceType)
      .where('resource_id', '=', resourceId)
      .orderBy('timestamp', 'desc')
      .execute()

    return results as AuditLog[]
  }

  async getAuditLogsByUser(userId: string, limit?: number): Promise<AuditLog[]> {
    let query = this.db
      .selectFrom('audit_logs')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('timestamp', 'desc')

    if (limit) {
      query = query.limit(limit)
    }

    const results = await query.execute()
    return results as AuditLog[]
  }

  async getAuditLogsByEventType(eventType: string, limit?: number): Promise<AuditLog[]> {
    let query = this.db
      .selectFrom('audit_logs')
      .selectAll()
      .where('event_type', '=', eventType)
      .orderBy('timestamp', 'desc')

    if (limit) {
      query = query.limit(limit)
    }

    const results = await query.execute()
    return results as AuditLog[]
  }

  async getAuditLogsByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    const results = await this.db
      .selectFrom('audit_logs')
      .selectAll()
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .orderBy('timestamp', 'desc')
      .execute()

    return results as AuditLog[]
  }

  async searchAuditLogs(criteria: {
    eventType?: string
    userId?: string
    resourceType?: string
    resourceId?: string
    action?: string
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }): Promise<AuditLog[]> {
    let query = this.db
      .selectFrom('audit_logs')
      .selectAll()

    if (criteria.eventType) {
      query = query.where('event_type', '=', criteria.eventType)
    }

    if (criteria.userId) {
      query = query.where('user_id', '=', criteria.userId)
    }

    if (criteria.resourceType) {
      query = query.where('resource_type', '=', criteria.resourceType)
    }

    if (criteria.resourceId) {
      query = query.where('resource_id', '=', criteria.resourceId)
    }

    if (criteria.action) {
      query = query.where('action', '=', criteria.action)
    }

    if (criteria.startDate) {
      query = query.where('timestamp', '>=', criteria.startDate)
    }

    if (criteria.endDate) {
      query = query.where('timestamp', '<=', criteria.endDate)
    }

    query = query.orderBy('timestamp', 'desc')

    if (criteria.limit) {
      query = query.limit(criteria.limit)
    }

    if (criteria.offset) {
      query = query.offset(criteria.offset)
    }

    const results = await query.execute()
    return results as AuditLog[]
  }

  // Compliance Report Operations
  async createComplianceReport(data: {
    reportType: string
    periodStart: Date
    periodEnd: Date
    generatedBy: string
    reportData: Record<string, any>
  }): Promise<ComplianceReport> {
    logger.info('Creating compliance report', {
      action: 'create_compliance_report',
      metadata: { reportType: data.reportType, generatedBy: data.generatedBy }
    })

    const result = await this.db
      .insertInto('compliance_reports')
      .values({
        id: crypto.randomUUID(),
        report_type: data.reportType,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        generated_by: data.generatedBy,
        data: data.reportData,
        status: 'generating',
        created_at: new Date(),
        updated_at: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as ComplianceReport
  }

  async updateComplianceReport(id: string, updates: {
    status?: 'generating' | 'completed' | 'failed'
    data?: Record<string, any>
  }): Promise<ComplianceReport> {
    const updateData: any = {
      updated_at: new Date()
    }

    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.data !== undefined) updateData.data = updates.data

    const result = await this.db
      .updateTable('compliance_reports')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as ComplianceReport
  }

  async getComplianceReports(reportType?: string): Promise<ComplianceReport[]> {
    let query = this.db
      .selectFrom('compliance_reports')
      .selectAll()

    if (reportType) {
      query = query.where('report_type', '=', reportType)
    }

    const results = await query
      .orderBy('created_at', 'desc')
      .execute()

    return results as ComplianceReport[]
  }

  async getComplianceReportById(id: string): Promise<ComplianceReport | null> {
    const result = await this.db
      .selectFrom('compliance_reports')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    return result ? (result as ComplianceReport) : null
  }

  // Retention Policy Operations
  async createRetentionPolicy(data: {
    resourceType: string
    retentionDays: number
    archiveAfterDays?: number
    deleteAfterDays?: number
  }): Promise<RetentionPolicy> {
    logger.info('Creating retention policy', {
      action: 'create_retention_policy',
      metadata: { resourceType: data.resourceType, retentionDays: data.retentionDays }
    })

    const result = await this.db
      .insertInto('retention_policies')
      .values({
        id: crypto.randomUUID(),
        resource_type: data.resourceType,
        retention_days: data.retentionDays,
        archive_after_days: data.archiveAfterDays || null,
        delete_after_days: data.deleteAfterDays || null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as RetentionPolicy
  }

  async updateRetentionPolicy(id: string, updates: {
    retentionDays?: number
    archiveAfterDays?: number
    deleteAfterDays?: number
    isActive?: boolean
  }): Promise<RetentionPolicy> {
    const updateData: any = {
      updated_at: new Date()
    }

    if (updates.retentionDays !== undefined) updateData.retention_days = updates.retentionDays
    if (updates.archiveAfterDays !== undefined) updateData.archive_after_days = updates.archiveAfterDays
    if (updates.deleteAfterDays !== undefined) updateData.delete_after_days = updates.deleteAfterDays
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive

    const result = await this.db
      .updateTable('retention_policies')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as RetentionPolicy
  }

  async getRetentionPolicies(activeOnly: boolean = true): Promise<RetentionPolicy[]> {
    let query = this.db
      .selectFrom('retention_policies')
      .selectAll()

    if (activeOnly) {
      query = query.where('is_active', '=', true)
    }

    const results = await query
      .orderBy('resource_type', 'asc')
      .execute()

    return results as RetentionPolicy[]
  }

  async getRetentionPolicyByResourceType(resourceType: string): Promise<RetentionPolicy | null> {
    const result = await this.db
      .selectFrom('retention_policies')
      .selectAll()
      .where('resource_type', '=', resourceType)
      .where('is_active', '=', true)
      .executeTakeFirst()

    return result ? (result as RetentionPolicy) : null
  }

  // Analytics and Reporting
  async getAuditStatistics(): Promise<{
    totalLogs: number
    eventTypeDistribution: Record<string, number>
    userActivityDistribution: Record<string, number>
    resourceTypeDistribution: Record<string, number>
  }> {
    const totalResult = await this.db
      .selectFrom('audit_logs')
      .select((eb) => eb.fn.count('id').as('total'))
      .executeTakeFirst()

    const eventTypeResults = await this.db
      .selectFrom('audit_logs')
      .select(['event_type', (eb) => eb.fn.count('id').as('count')])
      .groupBy('event_type')
      .execute()

    const userResults = await this.db
      .selectFrom('audit_logs')
      .select(['user_id', (eb) => eb.fn.count('id').as('count')])
      .where('user_id', 'is not', null)
      .groupBy('user_id')
      .execute()

    const resourceResults = await this.db
      .selectFrom('audit_logs')
      .select(['resource_type', (eb) => eb.fn.count('id').as('count')])
      .groupBy('resource_type')
      .execute()

    const eventTypeDistribution: Record<string, number> = {}
    eventTypeResults.forEach(row => {
      eventTypeDistribution[row.event_type] = Number(row.count)
    })

    const userActivityDistribution: Record<string, number> = {}
    userResults.forEach(row => {
      if (row.user_id) {
        userActivityDistribution[row.user_id] = Number(row.count)
      }
    })

    const resourceTypeDistribution: Record<string, number> = {}
    resourceResults.forEach(row => {
      resourceTypeDistribution[row.resource_type] = Number(row.count)
    })

    return {
      totalLogs: Number(totalResult?.total || 0),
      eventTypeDistribution,
      userActivityDistribution,
      resourceTypeDistribution
    }
  }

  async getComplianceStatistics(): Promise<{
    totalReports: number
    statusDistribution: Record<string, number>
    reportTypeDistribution: Record<string, number>
  }> {
    const totalResult = await this.db
      .selectFrom('compliance_reports')
      .select((eb) => eb.fn.count('id').as('total'))
      .executeTakeFirst()

    const statusResults = await this.db
      .selectFrom('compliance_reports')
      .select(['status', (eb) => eb.fn.count('id').as('count')])
      .groupBy('status')
      .execute()

    const typeResults = await this.db
      .selectFrom('compliance_reports')
      .select(['report_type', (eb) => eb.fn.count('id').as('count')])
      .groupBy('report_type')
      .execute()

    const statusDistribution: Record<string, number> = {}
    statusResults.forEach(row => {
      statusDistribution[row.status] = Number(row.count)
    })

    const reportTypeDistribution: Record<string, number> = {}
    typeResults.forEach(row => {
      reportTypeDistribution[row.report_type] = Number(row.count)
    })

    return {
      totalReports: Number(totalResult?.total || 0),
      statusDistribution,
      reportTypeDistribution
    }
  }

  // Data Cleanup Operations
  async cleanupOldAuditLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    logger.info('Cleaning up old audit logs', {
      action: 'cleanup_audit_logs',
      metadata: { cutoffDate: cutoffDate.toISOString(), retentionDays }
    })

    const result = await this.db
      .deleteFrom('audit_logs')
      .where('timestamp', '<', cutoffDate)
      .execute()

    const deletedCount = result.length
    
    logger.info('Audit log cleanup completed', {
      action: 'cleanup_completed',
      metadata: { deletedCount }
    })

    return deletedCount
  }

  async archiveOldAuditLogs(archiveAfterDays: number): Promise<AuditLog[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - archiveAfterDays)

    const logsToArchive = await this.db
      .selectFrom('audit_logs')
      .selectAll()
      .where('timestamp', '<', cutoffDate)
      .execute()

    logger.info('Archiving old audit logs', {
      action: 'archive_audit_logs',
      metadata: { cutoffDate: cutoffDate.toISOString(), count: logsToArchive.length }
    })

    return logsToArchive as AuditLog[]
  }
} 