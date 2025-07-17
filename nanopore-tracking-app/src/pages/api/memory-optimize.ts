import type { APIRoute } from 'astro'
import { memoryManager } from '../../lib/performance/MemoryManager'
import { cacheManager } from '../../lib/cache/CacheManager'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'
import { applicationMetrics } from '../../lib/monitoring/MetricsCollector'

const logger = getComponentLogger('MemoryOptimizationAPI')

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const action = url.searchParams.get('action') || 'optimize'
    const startTime = Date.now()
    
    logger.info('Memory optimization requested', {
      action,
      metadata: {
        userAgent: request.headers.get('User-Agent') || 'Unknown',
        timestamp: new Date().toISOString()
      }
    })
    
    let result: any = {}
    
    switch (action) {
      case 'optimize':
        await performMemoryOptimization()
        result = {
          success: true,
          message: 'Memory optimization completed',
          actions: ['garbage_collection', 'cache_cleanup', 'resource_cleanup']
        }
        break
        
      case 'report':
        result = {
          success: true,
          report: memoryManager.generateMemoryReport(),
          stats: memoryManager.getMemoryStats(),
          resources: memoryManager.getResourceStats()
        }
        break
        
      case 'gc':
        if (global.gc) {
          global.gc()
          result = {
            success: true,
            message: 'Garbage collection forced',
            gcAvailable: true
          }
        } else {
          result = {
            success: false,
            message: 'Garbage collection not available (run with --expose-gc)',
            gcAvailable: false
          }
        }
        break
        
      case 'clear-cache':
        await cacheManager.clear()
        result = {
          success: true,
          message: 'Cache cleared',
          cacheStats: cacheManager.getStats()
        }
        break
        
      default:
        throw new Error(`Unknown action: ${action}`)
    }
    
    const duration = Date.now() - startTime
    
    // Record metrics
    applicationMetrics.recordHttpRequest('POST', '/api/memory-optimize', 200, duration / 1000)
    
    logger.info('Memory optimization completed', {
      action,
      duration,
      metadata: {
        success: result.success,
        actionsPerformed: result.actions || [action]
      }
    })
    
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
  } catch (error) {
    const duration = Date.now() - Date.now()
    
    logger.error('Memory optimization failed', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        action: url.searchParams.get('action') || 'optimize'
      }
    }, error instanceof Error ? error : undefined)
    
    applicationMetrics.recordError('memory_optimization_error', 'MemoryOptimizationAPI')
    applicationMetrics.recordHttpRequest('POST', '/api/memory-optimize', 500, duration / 1000)
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Memory optimization failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const format = url.searchParams.get('format') || 'json'
    const startTime = Date.now()
    
    const memoryStats = memoryManager.getMemoryStats()
    const resourceStats = memoryManager.getResourceStats()
    const cacheStats = cacheManager.getStats()
    
    if (format === 'report') {
      const report = memoryManager.generateMemoryReport()
      const duration = Date.now() - startTime
      
      applicationMetrics.recordHttpRequest('GET', '/api/memory-optimize', 200, duration / 1000)
      
      return new Response(report, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }
    
    const result = {
      timestamp: new Date().toISOString(),
      memory: {
        heapUsed: `${Math.round(memoryStats.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryStats.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryStats.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryStats.rss / 1024 / 1024)}MB`,
        arrayBuffers: `${Math.round(memoryStats.arrayBuffers / 1024 / 1024)}MB`,
        heapUsedPercent: `${memoryStats.heapUsedPercent.toFixed(1)}%`,
        trend: memoryStats.trend,
        gcRuns: memoryStats.gcRuns,
        gcDuration: `${memoryStats.gcDuration}ms`
      },
      resources: {
        activeTimers: resourceStats.activeTimers,
        activeIntervals: resourceStats.activeIntervals,
        activeListeners: resourceStats.activeListeners,
        activeStreams: resourceStats.activeStreams,
        activeConnections: resourceStats.activeConnections
      },
      cache: {
        hitRate: `${cacheStats.hitRate.toFixed(1)}%`,
        totalOperations: cacheStats.totalOperations,
        currentSize: cacheStats.currentSize,
        maxSize: cacheStats.maxSize,
        hits: cacheStats.hits,
        misses: cacheStats.misses
      }
    }
    
    const duration = Date.now() - startTime
    applicationMetrics.recordHttpRequest('GET', '/api/memory-optimize', 200, duration / 1000)
    
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
  } catch (error) {
    logger.error('Memory stats retrieval failed', {
      errorType: error instanceof Error ? error.name : 'Unknown'
    }, error instanceof Error ? error : undefined)
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve memory stats'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

/**
 * Perform comprehensive memory optimization
 */
async function performMemoryOptimization(): Promise<void> {
  logger.info('Starting comprehensive memory optimization')
  
  // 1. Clear cache
  await cacheManager.clear()
  logger.debug('Cache cleared')
  
  // 2. Optimize memory manager
  await memoryManager.optimizeMemory()
  logger.debug('Memory manager optimized')
  
  // 3. Force garbage collection multiple times
  if (global.gc) {
    for (let i = 0; i < 3; i++) {
      global.gc()
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    logger.debug('Multiple garbage collections performed')
  }
  
  // 4. Log final stats
  const finalStats = memoryManager.getMemoryStats()
  logger.info('Memory optimization completed', {
    metadata: {
      heapUsedMB: Math.round(finalStats.heapUsed / 1024 / 1024),
      heapUsedPercent: finalStats.heapUsedPercent.toFixed(1),
      rssMB: Math.round(finalStats.rss / 1024 / 1024),
      gcRuns: finalStats.gcRuns
    }
  })
} 