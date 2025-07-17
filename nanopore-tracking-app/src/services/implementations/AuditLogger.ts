import type { IAuditLogger, AuditEvent } from '../interfaces/IAuditLogger'

export class AuditLogger implements IAuditLogger {
  async log(event: AuditEvent): Promise<void> {
    // For now, log to console. In production, this would go to a database
    console.log(`[AUDIT] ${event.timestamp.toISOString()} - ${event.type}:`, {
      userId: event.userId,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      action: event.action,
      details: event.details,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    })
  }

  async logSampleCreated(sampleId: string, userId: string, details: Record<string, any>): Promise<void> {
    await this.log({
      type: 'sample.created',
      userId,
      resourceType: 'sample',
      resourceId: sampleId,
      action: 'create',
      details,
      timestamp: new Date(),
    })
  }

  async logSampleUpdated(sampleId: string, userId: string, changes: Record<string, any>): Promise<void> {
    await this.log({
      type: 'sample.updated',
      userId,
      resourceType: 'sample',
      resourceId: sampleId,
      action: 'update',
      details: { changes },
      timestamp: new Date(),
    })
  }

  async logSampleDeleted(sampleId: string, userId: string): Promise<void> {
    await this.log({
      type: 'sample.deleted',
      userId,
      resourceType: 'sample',
      resourceId: sampleId,
      action: 'delete',
      details: {},
      timestamp: new Date(),
    })
  }

  async logSampleAssigned(sampleId: string, userId: string, assignedTo: string): Promise<void> {
    await this.log({
      type: 'sample.assigned',
      userId,
      resourceType: 'sample',
      resourceId: sampleId,
      action: 'assign',
      details: { assignedTo },
      timestamp: new Date(),
    })
  }

  async logStatusChange(sampleId: string, userId: string, oldStatus: string, newStatus: string): Promise<void> {
    await this.log({
      type: 'sample.status_changed',
      userId,
      resourceType: 'sample',
      resourceId: sampleId,
      action: 'status_change',
      details: { oldStatus, newStatus },
      timestamp: new Date(),
    })
  }

  async getAuditTrail(resourceType: string, resourceId: string): Promise<AuditEvent[]> {
    // For now, return empty array. In production, this would query the database
    console.log(`[AUDIT] Getting audit trail for ${resourceType}:${resourceId}`)
    return []
  }
} 