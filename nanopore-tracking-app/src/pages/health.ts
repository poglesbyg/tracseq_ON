import type { APIRoute } from 'astro'
import { applicationMetrics } from '../lib/monitoring/MetricsCollector'
import { getComponentLogger } from '../lib/logging/StructuredLogger'
import { db } from '../lib/database'
import { cacheManager } from '../lib/cache/CacheManager'
import { memoryManager } from '../lib/performance/MemoryManager'
import { securityHeaders } from '../middleware/security/SecurityHeaders'

const logger = getComponentLogger('HealthCheck')

/**
 * Health check status levels
 */
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

/**
 * Health check for individual components
 */
interface ComponentHealth {
  status: HealthStatus
  message?: string
  responseTime?: number
  details?: Record<string, any>
}

/**
 * Overall health check response
 */
interface HealthResponse {
  status: HealthStatus
  timestamp: string
  service: string
  version: string
  uptime: number
  environment: string
  components: {
    database: ComponentHealth
    memory: ComponentHealth
    system: ComponentHealth
    cache: ComponentHealth
  }
  metrics: {
    memoryUsage: {
      heapUsed: number
      heapTotal: number
      external: number
      rss: number
    }
    cpuUsage: number
    activeConnections: number
    requestsPerSecond: number
  }
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<ComponentHealth> {
  try {
    const start = Date.now()
    
    // Simple database connectivity check
    await db.selectFrom('nanopore_samples')
      .select('id')
      .limit(1)
      .execute()
    
    const responseTime = Date.now() - start
    
    return {
      status: 'healthy',
      message: 'Database connection successful',
      responseTime,
      details: {
        connected: true,
        type: 'postgresql'
      }
    }
  } catch (error) {
    logger.error('Database health check failed', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        component: 'database'
      }
    }, error instanceof Error ? error : undefined)
    
    return {
      status: 'unhealthy',
      message: 'Database connection failed',
      details: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * Check memory health
 */
function checkMemoryHealth(): ComponentHealth {
  const memoryStats = memoryManager.getMemoryStats()
  const resourceStats = memoryManager.getResourceStats()
  
  const heapUsedMB = Math.round(memoryStats.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(memoryStats.heapTotal / 1024 / 1024)
  const rssMB = Math.round(memoryStats.rss / 1024 / 1024)
  const heapUsagePercent = Math.round(memoryStats.heapUsedPercent)
  
  let status: HealthStatus = 'healthy'
  let message = `Memory usage: ${heapUsedMB}MB/${heapTotalMB}MB (${heapUsagePercent}%)`
  
  // Check for critical memory usage - adjusted thresholds for production
  if (heapUsagePercent > 95 || rssMB > 350) {
    status = 'unhealthy'
    message = `Critical memory usage: ${heapUsagePercent}% heap, ${rssMB}MB RSS`
  } else if (heapUsagePercent > 85 || rssMB > 300) {
    status = 'degraded'
    message = `High memory usage: ${heapUsagePercent}% heap, ${rssMB}MB RSS`
  }
  
  // Check for memory leaks
  if (resourceStats.activeTimers > 100 || resourceStats.activeIntervals > 50) {
    status = status === 'healthy' ? 'degraded' : status
    message += ` | Resource leak detected`
  }
  
  return {
    status,
    message,
    details: {
      heapUsed: memoryStats.heapUsed,
      heapTotal: memoryStats.heapTotal,
      external: memoryStats.external,
      rss: memoryStats.rss,
      arrayBuffers: memoryStats.arrayBuffers,
      usagePercent: heapUsagePercent,
      trend: memoryStats.trend,
      gcRuns: memoryStats.gcRuns,
      gcDuration: memoryStats.gcDuration,
      activeTimers: resourceStats.activeTimers,
      activeIntervals: resourceStats.activeIntervals,
      activeListeners: resourceStats.activeListeners
    }
  }
}

/**
 * Check system health
 */
function checkSystemHealth(): ComponentHealth {
  const uptime = process.uptime()
  const uptimeHours = Math.floor(uptime / 3600)
  
  return {
    status: 'healthy',
    message: `System running for ${uptimeHours} hours`,
    details: {
      uptime,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    }
  }
}

/**
 * Check cache health
 */
async function checkCacheHealth(): Promise<ComponentHealth> {
  try {
    const start = Date.now()
    
    // Check cache health
    const isHealthy = await cacheManager.isHealthy()
    const responseTime = Date.now() - start
    
    if (isHealthy) {
      const stats = cacheManager.getStats()
      
      return {
        status: 'healthy',
        message: 'Cache is operational',
        responseTime,
        details: {
          type: 'in-memory',
          connected: true,
          hitRate: stats.hitRate,
          totalOperations: stats.totalOperations,
          currentSize: stats.currentSize,
          maxSize: stats.maxSize
        }
      }
    } else {
      return {
        status: 'degraded',
        message: 'Cache health check failed',
        responseTime,
        details: {
          type: 'in-memory',
          connected: false
        }
      }
    }
    
  } catch (error) {
    logger.error('Cache health check failed', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        component: 'cache'
      }
    }, error instanceof Error ? error : undefined)
    
    return {
      status: 'unhealthy',
      message: 'Cache health check error',
      details: {
        type: 'in-memory',
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * Determine overall health status
 */
function determineOverallStatus(components: HealthResponse['components']): HealthStatus {
  const statuses = Object.values(components).map(c => c.status)
  
  if (statuses.includes('unhealthy')) {
    return 'unhealthy'
  }
  
  if (statuses.includes('degraded')) {
    return 'degraded'
  }
  
  return 'healthy'
}

export const GET: APIRoute = async ({ request }) => {
  const startTime = Date.now()
  
  try {
    // Check all components
    const [databaseHealth, memoryHealth, systemHealth, cacheHealth] = await Promise.all([
      checkDatabaseHealth(),
      Promise.resolve(checkMemoryHealth()),
      Promise.resolve(checkSystemHealth()),
      checkCacheHealth()
    ])
    
    const components = {
      database: databaseHealth,
      memory: memoryHealth,
      system: systemHealth,
      cache: cacheHealth
    }
    
    // Determine overall status
    const overallStatus = determineOverallStatus(components)
    
    // Get current metrics
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    const health: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'nanopore-tracking-app',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      components,
      metrics: {
        memoryUsage: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss
        },
        cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000,
        activeConnections: 0, // TODO: Implement active connection tracking
        requestsPerSecond: 0 // TODO: Implement RPS calculation
      }
    }
    
    const duration = (Date.now() - startTime) / 1000
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503
    
    // Record metrics
    applicationMetrics.recordHttpRequest('GET', '/health', statusCode, duration)
    
    logger.info('Health check completed', {
      duration,
      userAgent: request.headers.get('User-Agent') || 'Unknown',
      metadata: {
        overallStatus,
        components: Object.fromEntries(
          Object.entries(components).map(([key, value]) => [key, value.status])
        )
      }
    })
    
    const response = new Response(JSON.stringify(health, null, 2), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
    return securityHeaders.applyHeaders(response)
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000
    
    logger.error('Health check failed', {
      duration,
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        userAgent: request.headers.get('User-Agent') || 'Unknown'
      }
    }, error instanceof Error ? error : undefined)
    
    applicationMetrics.recordError('health_check_error', 'health_endpoint')
    applicationMetrics.recordHttpRequest('GET', '/health', 503, duration)
    
    const errorResponse = new Response(JSON.stringify({
      status: 'unhealthy',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
    return securityHeaders.applyHeaders(errorResponse)
  }
} 