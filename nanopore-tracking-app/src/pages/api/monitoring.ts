import type { APIRoute } from 'astro'
import { applicationMetrics } from '../../lib/monitoring/MetricsCollector'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'
import { memoryManager } from '../../lib/performance/MemoryManager'
import { cacheManager } from '../../lib/cache/CacheManager'
import { securityHeaders } from '../../middleware/security/SecurityHeaders'
import { db } from '../../lib/database'

const logger = getComponentLogger('MonitoringAPI')

interface MonitoringData {
  timestamp: string
  system: {
    uptime: number
    nodeVersion: string
    platform: string
    arch: string
    loadAverage: number[]
    cpuUsage: number
  }
  memory: {
    heapUsed: number
    heapTotal: number
    rss: number
    external: number
    arrayBuffers: number
    heapUsedPercent: number
    gcRuns: number
    gcDuration: number
    trend: 'increasing' | 'decreasing' | 'stable'
  }
  database: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    connections: {
      active: number
      idle: number
      total: number
    }
    queryMetrics: {
      avgResponseTime: number
      slowQueries: number
      errorRate: number
    }
  }
  cache: {
    hitRate: number
    totalOperations: number
    currentSize: number
    maxSize: number
    evictions: number
  }
  http: {
    requestsPerSecond: number
    avgResponseTime: number
    errorRate: number
    statusCodes: Record<string, number>
  }
  alerts: Array<{
    level: 'info' | 'warning' | 'error' | 'critical'
    message: string
    timestamp: string
    component: string
    resolved: boolean
  }>
  metrics: {
    counters: Record<string, number>
    gauges: Record<string, number>
    histograms: Record<string, any>
  }
}

export const GET: APIRoute = async ({ request, url }) => {
  const startTime = Date.now()
  
  try {
    const searchParams = new URL(request.url).searchParams
    const format = searchParams.get('format') || 'json'
    const timeRange = searchParams.get('timeRange') || '1h'
    const includeMetrics = searchParams.get('includeMetrics') !== 'false'
    
    // Collect system metrics
    const systemMetrics = await collectSystemMetrics()
    const memoryMetrics = await collectMemoryMetrics()
    const databaseMetrics = await collectDatabaseMetrics()
    const cacheMetrics = await collectCacheMetrics()
    const httpMetrics = await collectHttpMetrics()
    const alerts = await collectAlerts()
    
    const monitoringData: MonitoringData = {
      timestamp: new Date().toISOString(),
      system: systemMetrics,
      memory: memoryMetrics,
      database: databaseMetrics,
      cache: cacheMetrics,
      http: httpMetrics,
      alerts,
      metrics: includeMetrics ? await collectCustomMetrics() : { counters: {}, gauges: {}, histograms: {} }
    }
    
    const duration = (Date.now() - startTime) / 1000
    
    // Record monitoring API metrics
    applicationMetrics.recordHttpRequest('GET', '/api/monitoring', 200, duration)
    
    logger.info('Monitoring data collected', {
      duration,
      metadata: {
        format,
        timeRange,
        includeMetrics,
        alertCount: alerts.length
      }
    })
    
    // Handle different response formats
    if (format === 'prometheus') {
      const prometheusData = convertToPrometheusFormat(monitoringData)
      const response = new Response(prometheusData, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
      return securityHeaders.applyHeaders(response)
    }
    
    const response = new Response(JSON.stringify(monitoringData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
    return securityHeaders.applyHeaders(response)
    
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000
    
    logger.error('Monitoring data collection failed', {
      duration,
      errorType: error instanceof Error ? error.name : 'Unknown'
    }, error instanceof Error ? error : undefined)
    
    applicationMetrics.recordError('monitoring_collection_error', 'monitoring_api')
    applicationMetrics.recordHttpRequest('GET', '/api/monitoring', 500, duration)
    
    const errorResponse = new Response(JSON.stringify({
      error: 'Monitoring data collection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
    return securityHeaders.applyHeaders(errorResponse)
  }
}

async function collectSystemMetrics() {
  const uptime = process.uptime()
  const loadAverage = process.platform === 'linux' ? (await import('os')).loadavg() : [0, 0, 0]
  
  // CPU usage calculation (simplified)
  const cpuUsage = process.cpuUsage()
  const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000) / uptime * 100
  
  return {
    uptime,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    loadAverage,
    cpuUsage: Math.min(cpuPercent, 100)
  }
}

async function collectMemoryMetrics() {
  const memoryUsage = process.memoryUsage()
  const memoryStats = await memoryManager.getMemoryStats()
  
  return {
    heapUsed: memoryUsage.heapUsed,
    heapTotal: memoryUsage.heapTotal,
    rss: memoryUsage.rss,
    external: memoryUsage.external,
    arrayBuffers: memoryUsage.arrayBuffers,
    heapUsedPercent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
    gcRuns: memoryStats.gcRuns,
    gcDuration: memoryStats.gcDuration,
    trend: memoryStats.trend
  }
}

async function collectDatabaseMetrics() {
  try {
    // Test database connection
    const startTime = Date.now()
    await db.selectFrom('nanopore_samples').select('id').limit(1).execute()
    const responseTime = Date.now() - startTime
    
    return {
      status: 'healthy' as const,
      connections: {
        active: 1, // Simplified - would need connection pool info
        idle: 0,
        total: 1
      },
      queryMetrics: {
        avgResponseTime: responseTime,
        slowQueries: 0,
        errorRate: 0
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      connections: {
        active: 0,
        idle: 0,
        total: 0
      },
      queryMetrics: {
        avgResponseTime: 0,
        slowQueries: 0,
        errorRate: 100
      }
    }
  }
}

async function collectCacheMetrics() {
  const cacheStats = await cacheManager.getStats()
  
  return {
    hitRate: cacheStats.hitRate,
    totalOperations: cacheStats.hits + cacheStats.misses,
    currentSize: cacheStats.hits + cacheStats.misses, // Use total operations as size proxy
    maxSize: cacheStats.maxSize,
    evictions: cacheStats.evictions || 0
  }
}

async function collectHttpMetrics() {
  // This would typically come from a metrics store
  // For now, return simplified metrics
  return {
    requestsPerSecond: 0,
    avgResponseTime: 0,
    errorRate: 0,
    statusCodes: {
      '200': 0,
      '400': 0,
      '401': 0,
      '403': 0,
      '404': 0,
      '500': 0
    }
  }
}

async function collectAlerts() {
  const alerts = []
  
  // Memory usage alert
  const memoryUsage = process.memoryUsage()
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
  
  if (heapUsedPercent > 90) {
    alerts.push({
      level: 'critical' as const,
      message: `Memory usage is critically high: ${heapUsedPercent.toFixed(1)}%`,
      timestamp: new Date().toISOString(),
      component: 'memory',
      resolved: false
    })
  } else if (heapUsedPercent > 80) {
    alerts.push({
      level: 'warning' as const,
      message: `Memory usage is high: ${heapUsedPercent.toFixed(1)}%`,
      timestamp: new Date().toISOString(),
      component: 'memory',
      resolved: false
    })
  }
  
  // Database connection alert
  try {
    await db.selectFrom('nanopore_samples').select('id').limit(1).execute()
  } catch (error) {
    alerts.push({
      level: 'critical' as const,
      message: 'Database connection failed',
      timestamp: new Date().toISOString(),
      component: 'database',
      resolved: false
    })
  }
  
  return alerts
}

async function collectCustomMetrics() {
  // This would collect custom application metrics
  // For now, return empty structure
  return {
    counters: {},
    gauges: {},
    histograms: {}
  }
}

function convertToPrometheusFormat(data: MonitoringData): string {
  const lines: string[] = []
  
  // System metrics
  lines.push(`# HELP nodejs_heap_size_used_bytes Process heap memory used`)
  lines.push(`# TYPE nodejs_heap_size_used_bytes gauge`)
  lines.push(`nodejs_heap_size_used_bytes ${data.memory.heapUsed}`)
  
  lines.push(`# HELP nodejs_heap_size_total_bytes Process heap memory total`)
  lines.push(`# TYPE nodejs_heap_size_total_bytes gauge`)
  lines.push(`nodejs_heap_size_total_bytes ${data.memory.heapTotal}`)
  
  lines.push(`# HELP nodejs_process_cpu_usage_percent Process CPU usage percentage`)
  lines.push(`# TYPE nodejs_process_cpu_usage_percent gauge`)
  lines.push(`nodejs_process_cpu_usage_percent ${data.system.cpuUsage}`)
  
  lines.push(`# HELP nodejs_process_uptime_seconds Process uptime in seconds`)
  lines.push(`# TYPE nodejs_process_uptime_seconds gauge`)
  lines.push(`nodejs_process_uptime_seconds ${data.system.uptime}`)
  
  // Cache metrics
  lines.push(`# HELP cache_hit_rate_percent Cache hit rate percentage`)
  lines.push(`# TYPE cache_hit_rate_percent gauge`)
  lines.push(`cache_hit_rate_percent ${data.cache.hitRate}`)
  
  lines.push(`# HELP cache_operations_total Total cache operations`)
  lines.push(`# TYPE cache_operations_total counter`)
  lines.push(`cache_operations_total ${data.cache.totalOperations}`)
  
  return lines.join('\n')
}

// POST endpoint for updating monitoring configuration
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { action, config } = body
    
    if (action === 'update_config') {
      // Update monitoring configuration
      logger.info('Monitoring configuration updated', { metadata: { config } })
    } else if (action === 'acknowledge_alert') {
      // Acknowledge an alert
      logger.info('Alert acknowledged', { metadata: { alertId: body.alertId } })
    }
    
    const duration = (Date.now() - startTime) / 1000
    applicationMetrics.recordHttpRequest('POST', '/api/monitoring', 200, duration)
    
    const response = new Response(JSON.stringify({
      success: true,
      message: 'Monitoring configuration updated',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    return securityHeaders.applyHeaders(response)
    
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000
    
    logger.error('Monitoring configuration update failed', {
      duration,
      errorType: error instanceof Error ? error.name : 'Unknown'
    }, error instanceof Error ? error : undefined)
    
    applicationMetrics.recordError('monitoring_config_error', 'monitoring_api')
    applicationMetrics.recordHttpRequest('POST', '/api/monitoring', 500, duration)
    
    const errorResponse = new Response(JSON.stringify({
      error: 'Monitoring configuration update failed',
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