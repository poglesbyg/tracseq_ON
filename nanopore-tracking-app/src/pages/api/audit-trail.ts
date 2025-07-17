import type { APIRoute } from 'astro'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'
import { applicationMetrics } from '../../lib/monitoring/MetricsCollector'
import { securityHeaders } from '../../middleware/security/SecurityHeaders'
import { db } from '../../lib/database'
import { sql } from 'kysely'

const logger = getComponentLogger('AuditTrailAPI')

interface AuditLogQuery {
  startDate?: string
  endDate?: string
  eventType?: string
  category?: string
  severity?: string
  userId?: string
  resource?: string
  action?: string
  success?: boolean
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
}

interface AuditLogSummary {
  totalEvents: number
  eventsByType: Record<string, number>
  eventsByCategory: Record<string, number>
  eventsBySeverity: Record<string, number>
  successRate: number
  topUsers: Array<{ userId: string, username: string, eventCount: number }>
  topResources: Array<{ resource: string, eventCount: number }>
  recentEvents: any[]
}

export const GET: APIRoute = async ({ request, url }) => {
  const startTime = Date.now()
  
  try {
    const searchParams = new URL(request.url).searchParams
    const action = searchParams.get('action') || 'list'
    
    let result: any = {}
    
    switch (action) {
      case 'list':
        result = await getAuditLogs(parseQueryParams(searchParams))
        break
      case 'summary':
        result = await getAuditSummary(parseQueryParams(searchParams))
        break
      case 'export':
        return await exportAuditLogs(parseQueryParams(searchParams))
      case 'stats':
        result = await getAuditStats(parseQueryParams(searchParams))
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }
    
    const duration = (Date.now() - startTime) / 1000
    applicationMetrics.recordHttpRequest('GET', '/api/audit-trail', 200, duration)
    
    logger.info('Audit trail request completed', {
      duration,
      metadata: {
        action,
        recordCount: result.total || result.totalEvents || 0
      }
    })
    
    const response = new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
    return securityHeaders.applyHeaders(response)
    
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000
    
    logger.error('Audit trail request failed', {
      duration,
      errorType: error instanceof Error ? error.name : 'Unknown'
    }, error instanceof Error ? error : undefined)
    
    applicationMetrics.recordError('audit_trail_error', 'audit_trail_api')
    applicationMetrics.recordHttpRequest('GET', '/api/audit-trail', 500, duration)
    
    const errorResponse = new Response(JSON.stringify({
      error: 'Audit trail request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    return securityHeaders.applyHeaders(errorResponse)
  }
}

async function getAuditLogs(query: AuditLogQuery) {
  const page = query.page || 1
  const limit = Math.min(query.limit || 50, 1000) // Max 1000 records
  const offset = (page - 1) * limit
  
  // Build the query
  let dbQuery = db.selectFrom('audit_logs')
    .selectAll()
    .orderBy(query.sortBy || 'timestamp', query.sortOrder || 'desc')
    .limit(limit)
    .offset(offset)
  
  // Apply filters
  if (query.startDate) {
    dbQuery = dbQuery.where('timestamp', '>=', new Date(query.startDate))
  }
  
  if (query.endDate) {
    dbQuery = dbQuery.where('timestamp', '<=', new Date(query.endDate))
  }
  
  if (query.eventType) {
    dbQuery = dbQuery.where('event_type', '=', query.eventType)
  }
  
  if (query.category) {
    dbQuery = dbQuery.where('category', '=', query.category)
  }
  
  if (query.severity) {
    dbQuery = dbQuery.where('severity', '=', query.severity)
  }
  
  if (query.userId) {
    dbQuery = dbQuery.where('user_id', '=', query.userId)
  }
  
  if (query.resource) {
    dbQuery = dbQuery.where('resource', 'like', `%${query.resource}%`)
  }
  
  if (query.action) {
    dbQuery = dbQuery.where('action', 'like', `%${query.action}%`)
  }
  
  if (query.success !== undefined) {
    dbQuery = dbQuery.where('success', '=', query.success)
  }
  
  if (query.search) {
    dbQuery = dbQuery.where(eb => eb.or([
      eb('action', 'like', `%${query.search}%`),
      eb('resource', 'like', `%${query.search}%`),
      eb('username', 'like', `%${query.search}%`)
    ]))
  }
  
  // Execute query
  const logs = await dbQuery.execute()
  
  // Get total count
  let countQuery = db.selectFrom('audit_logs')
    .select(sql`count(*)`.as('total'))
  
  // Apply same filters for count
  if (query.startDate) {
    countQuery = countQuery.where('timestamp', '>=', new Date(query.startDate))
  }
  
  if (query.endDate) {
    countQuery = countQuery.where('timestamp', '<=', new Date(query.endDate))
  }
  
  if (query.eventType) {
    countQuery = countQuery.where('event_type', '=', query.eventType)
  }
  
  if (query.category) {
    countQuery = countQuery.where('category', '=', query.category)
  }
  
  if (query.severity) {
    countQuery = countQuery.where('severity', '=', query.severity)
  }
  
  if (query.userId) {
    countQuery = countQuery.where('user_id', '=', query.userId)
  }
  
  if (query.resource) {
    countQuery = countQuery.where('resource', 'like', `%${query.resource}%`)
  }
  
  if (query.action) {
    countQuery = countQuery.where('action', 'like', `%${query.action}%`)
  }
  
  if (query.success !== undefined) {
    countQuery = countQuery.where('success', '=', query.success)
  }
  
  if (query.search) {
    countQuery = countQuery.where(eb => eb.or([
      eb('action', 'like', `%${query.search}%`),
      eb('resource', 'like', `%${query.search}%`),
      eb('username', 'like', `%${query.search}%`)
    ]))
  }
  
  const countResult = await countQuery.executeTakeFirst()
  const total = Number(countResult?.total || 0)
  
  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  }
}

async function getAuditSummary(query: AuditLogQuery): Promise<AuditLogSummary> {
  const timeFilter = getTimeFilter(query)
  
  // Total events
  const totalResult = await db.selectFrom('audit_logs')
    .select(sql`count(*)`.as('total'))
    .where(timeFilter)
    .executeTakeFirst()
  
  const totalEvents = Number(totalResult?.total || 0)
  
  // Events by type
  const eventsByTypeResult = await db.selectFrom('audit_logs')
    .select(['event_type', sql`count(*)`.as('count')])
    .where(timeFilter)
    .groupBy('event_type')
    .execute()
  
  const eventsByType = Object.fromEntries(
    eventsByTypeResult.map(row => [row.event_type, Number(row.count)])
  )
  
  // Events by category
  const eventsByCategoryResult = await db.selectFrom('audit_logs')
    .select(['category', sql`count(*)`.as('count')])
    .where(timeFilter)
    .groupBy('category')
    .execute()
  
  const eventsByCategory = Object.fromEntries(
    eventsByCategoryResult.map(row => [row.category, Number(row.count)])
  )
  
  // Events by severity
  const eventsBySeverityResult = await db.selectFrom('audit_logs')
    .select(['severity', sql`count(*)`.as('count')])
    .where(timeFilter)
    .groupBy('severity')
    .execute()
  
  const eventsBySeverity = Object.fromEntries(
    eventsBySeverityResult.map(row => [row.severity, Number(row.count)])
  )
  
  // Success rate
  const successResult = await db.selectFrom('audit_logs')
    .select([
      sql`count(case when success = true then 1 end)`.as('success_count'),
      sql`count(*)`.as('total_count')
    ])
    .where(timeFilter)
    .executeTakeFirst()
  
  const successRate = Number(successResult?.total_count) > 0 
    ? (Number(successResult?.success_count) / Number(successResult?.total_count)) * 100
    : 0
  
  // Top users
  const topUsersResult = await db.selectFrom('audit_logs')
    .select(['user_id', 'username', sql`count(*)`.as('event_count')])
    .where(timeFilter)
    .where('user_id', 'is not', null)
    .groupBy(['user_id', 'username'])
    .orderBy('event_count', 'desc')
    .limit(10)
    .execute()
  
  const topUsers = topUsersResult.map(row => ({
    userId: row.user_id!,
    username: row.username || 'Unknown',
    eventCount: Number(row.event_count)
  }))
  
  // Top resources
  const topResourcesResult = await db.selectFrom('audit_logs')
    .select(['resource', sql`count(*)`.as('event_count')])
    .where(timeFilter)
    .groupBy('resource')
    .orderBy('event_count', 'desc')
    .limit(10)
    .execute()
  
  const topResources = topResourcesResult.map(row => ({
    resource: row.resource,
    eventCount: Number(row.event_count)
  }))
  
  // Recent events
  const recentEvents = await db.selectFrom('audit_logs')
    .selectAll()
    .where(timeFilter)
    .orderBy('timestamp', 'desc')
    .limit(10)
    .execute()
  
  return {
    totalEvents,
    eventsByType,
    eventsByCategory,
    eventsBySeverity,
    successRate,
    topUsers,
    topResources,
    recentEvents
  }
}

async function getAuditStats(query: AuditLogQuery) {
  const timeFilter = getTimeFilter(query)
  
  // Daily event counts for the last 30 days
  const dailyStats = await db.selectFrom('audit_logs')
    .select([
      sql`date_trunc('day', timestamp)`.as('date'),
      sql`count(*)`.as('count')
    ])
    .where(timeFilter)
    .where('timestamp', '>=', sql`now() - interval '30 days'`)
    .groupBy(sql`date_trunc('day', timestamp)`)
    .orderBy('date', 'asc')
    .execute()
  
  // Hourly distribution
  const hourlyStats = await db.selectFrom('audit_logs')
    .select([
      sql`extract(hour from timestamp)`.as('hour'),
      sql`count(*)`.as('count')
    ])
    .where(timeFilter)
    .groupBy(sql`extract(hour from timestamp)`)
    .orderBy('hour', 'asc')
    .execute()
  
  // Error rate by hour
  const errorRateStats = await db.selectFrom('audit_logs')
    .select([
      sql`extract(hour from timestamp)`.as('hour'),
      sql`count(case when success = false then 1 end)`.as('errors'),
      sql`count(*)`.as('total')
    ])
    .where(timeFilter)
    .groupBy(sql`extract(hour from timestamp)`)
    .orderBy('hour', 'asc')
    .execute()
  
  return {
    dailyStats: dailyStats.map(row => ({
      date: row.date,
      count: Number(row.count)
    })),
    hourlyStats: hourlyStats.map(row => ({
      hour: Number(row.hour),
      count: Number(row.count)
    })),
    errorRateStats: errorRateStats.map(row => ({
      hour: Number(row.hour),
      errorRate: Number(row.total) > 0 ? (Number(row.errors) / Number(row.total)) * 100 : 0,
      errors: Number(row.errors),
      total: Number(row.total)
    }))
  }
}

async function exportAuditLogs(query: AuditLogQuery) {
  const { logs } = await getAuditLogs({ ...query, limit: 10000 }) // Max 10k for export
  
  const format = query.search || 'json' // Use search param for format
  
  if (format === 'csv') {
    const csvData = convertToCSV(logs)
    return new Response(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  }
  
  // Default to JSON
  const response = new Response(JSON.stringify(logs, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`
    }
  })
  
  return securityHeaders.applyHeaders(response)
}

function parseQueryParams(searchParams: URLSearchParams): AuditLogQuery {
  return {
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    eventType: searchParams.get('eventType') || undefined,
    category: searchParams.get('category') || undefined,
    severity: searchParams.get('severity') || undefined,
    userId: searchParams.get('userId') || undefined,
    resource: searchParams.get('resource') || undefined,
    action: searchParams.get('action') || undefined,
    success: searchParams.get('success') ? searchParams.get('success') === 'true' : undefined,
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
    sortBy: searchParams.get('sortBy') || undefined,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined,
    search: searchParams.get('search') || undefined
  }
}

function getTimeFilter(query: AuditLogQuery) {
  const conditions = []
  
  if (query.startDate) {
    conditions.push(sql`timestamp >= ${new Date(query.startDate)}`)
  }
  
  if (query.endDate) {
    conditions.push(sql`timestamp <= ${new Date(query.endDate)}`)
  }
  
  if (conditions.length === 0) {
    return sql`1=1` // No time filter
  }
  
  return conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`
}

function convertToCSV(logs: any[]): string {
  if (logs.length === 0) return ''
  
  const headers = Object.keys(logs[0])
  const csvRows = [headers.join(',')]
  
  for (const log of logs) {
    const values = headers.map(header => {
      const value = log[header]
      if (value === null || value === undefined) return ''
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value).replace(/"/g, '""')
    })
    csvRows.push(values.map(value => `"${value}"`).join(','))
  }
  
  return csvRows.join('\n')
} 