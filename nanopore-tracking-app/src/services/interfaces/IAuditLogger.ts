export interface AuditEvent {
  type: string
  userId: string
  resourceType: string
  resourceId: string
  action: string
  details: Record<string, any>
  ipAddress?: string
  userAgent?: string
  timestamp: Date
}

export interface IAuditLogger {
  log(event: AuditEvent): Promise<void>
  logSampleCreated(sampleId: string, userId: string, details: Record<string, any>): Promise<void>
  logSampleUpdated(sampleId: string, userId: string, changes: Record<string, any>): Promise<void>
  logSampleDeleted(sampleId: string, userId: string): Promise<void>
  logSampleAssigned(sampleId: string, userId: string, assignedTo: string): Promise<void>
  logStatusChange(sampleId: string, userId: string, oldStatus: string, newStatus: string): Promise<void>
  getAuditTrail(resourceType: string, resourceId: string): Promise<AuditEvent[]>
} 