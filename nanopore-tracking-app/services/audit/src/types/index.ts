import { z } from 'zod'

// Audit event types
export interface AuditEvent {
  id: string
  timestamp: Date
  userId?: string
  userEmail?: string
  service: string
  action: string
  resource: string
  resourceId?: string
  details: Record<string, any>
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  severity: 'info' | 'warn' | 'error' | 'critical'
  category: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system' | 'security'
  tags?: string[]
  metadata?: Record<string, any>
}

export interface CreateAuditEventRequest {
  userId?: string
  userEmail?: string
  service: string
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  severity?: 'info' | 'warn' | 'error' | 'critical'
  category?: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system' | 'security'
  tags?: string[]
  metadata?: Record<string, any>
}

// Audit log types
export interface AuditLog {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  service: string
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  details?: Record<string, any>
  stackTrace?: string
  tags?: string[]
}

export interface CreateAuditLogRequest {
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  service: string
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  details?: Record<string, any>
  stackTrace?: string
  tags?: string[]
}

// Activity tracking types
export interface UserActivity {
  id: string
  userId: string
  userEmail: string
  timestamp: Date
  action: string
  service: string
  resource: string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  duration?: number // milliseconds
  success: boolean
  details?: Record<string, any>
}

export interface CreateUserActivityRequest {
  userId: string
  userEmail: string
  action: string
  service: string
  resource: string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  duration?: number
  success: boolean
  details?: Record<string, any>
}

// Search and filtering types
export interface AuditSearchFilters {
  userId?: string
  userEmail?: string
  service?: string
  action?: string
  resource?: string
  resourceId?: string
  severity?: 'info' | 'warn' | 'error' | 'critical'
  category?: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system' | 'security'
  dateFrom?: Date
  dateTo?: Date
  tags?: string[]
  sessionId?: string
  ipAddress?: string
}

export interface AuditSearchResult {
  events: AuditEvent[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Report types
export interface AuditReport {
  id: string
  name: string
  description: string
  type: 'activity' | 'security' | 'compliance' | 'performance' | 'custom'
  filters: AuditSearchFilters
  schedule?: string // cron expression
  recipients?: string[]
  format: 'json' | 'csv' | 'pdf'
  createdAt: Date
  updatedAt: Date
  lastRun?: Date
  nextRun?: Date
  isActive: boolean
}

export interface CreateAuditReportRequest {
  name: string
  description: string
  type: 'activity' | 'security' | 'compliance' | 'performance' | 'custom'
  filters: AuditSearchFilters
  schedule?: string
  recipients?: string[]
  format: 'json' | 'csv' | 'pdf'
}

// Statistics and metrics types
export interface AuditStats {
  totalEvents: number
  eventsByService: Record<string, number>
  eventsByCategory: Record<string, number>
  eventsBySeverity: Record<string, number>
  eventsByDate: Record<string, number>
  topUsers: Array<{ userId: string; userEmail: string; count: number }>
  topActions: Array<{ action: string; count: number }>
  topResources: Array<{ resource: string; count: number }>
  errorRate: number
  averageResponseTime: number
}

export interface ActivityMetrics {
  totalActivities: number
  activitiesByService: Record<string, number>
  activitiesByUser: Record<string, number>
  activitiesByDate: Record<string, number>
  successRate: number
  averageDuration: number
  topActions: Array<{ action: string; count: number }>
  topResources: Array<{ resource: string; count: number }>
}

// Alert types
export interface AuditAlert {
  id: string
  name: string
  description: string
  condition: {
    field: string
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in'
    value: any
  }
  severity: 'low' | 'medium' | 'high' | 'critical'
  service: string
  isActive: boolean
  recipients: string[]
  cooldownMinutes: number
  lastTriggered?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CreateAuditAlertRequest {
  name: string
  description: string
  condition: {
    field: string
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in'
    value: any
  }
  severity: 'low' | 'medium' | 'high' | 'critical'
  service: string
  recipients: string[]
  cooldownMinutes?: number
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Validation schemas
export const createAuditEventSchema = z.object({
  userId: z.string().optional(),
  userEmail: z.string().email().optional(),
  service: z.string().min(1, 'Service is required'),
  action: z.string().min(1, 'Action is required'),
  resource: z.string().min(1, 'Resource is required'),
  resourceId: z.string().optional(),
  details: z.record(z.any()).optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  sessionId: z.string().optional(),
  severity: z.enum(['info', 'warn', 'error', 'critical']).optional().default('info'),
  category: z.enum(['authentication', 'authorization', 'data_access', 'data_modification', 'system', 'security']).optional().default('system'),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
})

export const createAuditLogSchema = z.object({
  level: z.enum(['info', 'warn', 'error', 'debug']),
  message: z.string().min(1, 'Message is required'),
  service: z.string().min(1, 'Service is required'),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  details: z.record(z.any()).optional(),
  stackTrace: z.string().optional(),
  tags: z.array(z.string()).optional()
})

export const createUserActivitySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  userEmail: z.string().email('Valid email is required'),
  action: z.string().min(1, 'Action is required'),
  service: z.string().min(1, 'Service is required'),
  resource: z.string().min(1, 'Resource is required'),
  resourceId: z.string().optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  sessionId: z.string().optional(),
  duration: z.number().positive().optional(),
  success: z.boolean(),
  details: z.record(z.any()).optional()
})

export const auditSearchSchema = z.object({
  userId: z.string().optional(),
  userEmail: z.string().email().optional(),
  service: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  resourceId: z.string().optional(),
  severity: z.enum(['info', 'warn', 'error', 'critical']).optional(),
  category: z.enum(['authentication', 'authorization', 'data_access', 'data_modification', 'system', 'security']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
  ipAddress: z.string().optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20)
})

// Database types
export interface Database {
  audit_events: AuditEventsTable
  audit_logs: AuditLogsTable
  user_activities: UserActivitiesTable
  audit_reports: AuditReportsTable
  audit_alerts: AuditAlertsTable
  audit_alert_history: AuditAlertHistoryTable
}

export interface AuditEventsTable {
  id: string
  timestamp: Date
  user_id?: string
  user_email?: string
  service: string
  action: string
  resource: string
  resource_id?: string
  details: Record<string, any>
  ip_address?: string
  user_agent?: string
  session_id?: string
  severity: 'info' | 'warn' | 'error' | 'critical'
  category: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system' | 'security'
  tags?: string[]
  metadata?: Record<string, any>
  created_at: Date
}

export interface AuditLogsTable {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  service: string
  user_id?: string
  session_id?: string
  ip_address?: string
  user_agent?: string
  details?: Record<string, any>
  stack_trace?: string
  tags?: string[]
  created_at: Date
}

export interface UserActivitiesTable {
  id: string
  user_id: string
  user_email: string
  timestamp: Date
  action: string
  service: string
  resource: string
  resource_id?: string
  ip_address?: string
  user_agent?: string
  session_id?: string
  duration?: number
  success: boolean
  details?: Record<string, any>
  created_at: Date
}

export interface AuditReportsTable {
  id: string
  name: string
  description: string
  type: 'activity' | 'security' | 'compliance' | 'performance' | 'custom'
  filters: Record<string, any>
  schedule?: string
  recipients?: string[]
  format: 'json' | 'csv' | 'pdf'
  created_at: Date
  updated_at: Date
  last_run?: Date
  next_run?: Date
  is_active: boolean
}

export interface AuditAlertsTable {
  id: string
  name: string
  description: string
  condition: Record<string, any>
  severity: 'low' | 'medium' | 'high' | 'critical'
  service: string
  is_active: boolean
  recipients: string[]
  cooldown_minutes: number
  last_triggered?: Date
  created_at: Date
  updated_at: Date
}

export interface AuditAlertHistoryTable {
  id: string
  alert_id: string
  triggered_at: Date
  event_data: Record<string, any>
  recipients_notified: string[]
  created_at: Date
}

// Service configuration
export interface AuditServiceConfig {
  databaseUrl: string
  port: number
  environment: string
  corsOrigin: string
  retentionDays: number
  maxEventsPerRequest: number
  enableRealTimeAlerts: boolean
  enableScheduledReports: boolean
  enableDataRetention: boolean
}

// Real-time event types
export interface RealTimeEvent {
  type: 'audit_event' | 'audit_log' | 'user_activity' | 'alert_triggered'
  data: AuditEvent | AuditLog | UserActivity | AuditAlert
  timestamp: Date
}

// Export types
export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf'
  filters: AuditSearchFilters
  dateFrom: Date
  dateTo: Date
  includeDetails: boolean
  includeMetadata: boolean
}

export interface ExportResult {
  data: string | Buffer
  filename: string
  mimeType: string
  recordCount: number
}