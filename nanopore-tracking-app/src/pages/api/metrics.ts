import type { APIRoute } from 'astro'
import { metricsRegistry, applicationMetrics } from '../../lib/monitoring/MetricsCollector'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'

const logger = getComponentLogger('MetricsEndpoint')

export const GET: APIRoute = async ({ request }) => {
  try {
    const startTime = Date.now()
    
    // Get metrics in Prometheus format
    const prometheusMetrics = metricsRegistry.getPrometheusMetrics()
    
    // Add some additional system metrics
    const memUsage = process.memoryUsage()
    const uptime = process.uptime()
    
    const additionalMetrics = [
      `# HELP process_uptime_seconds Process uptime in seconds`,
      `# TYPE process_uptime_seconds gauge`,
      `process_uptime_seconds ${uptime}`,
      '',
      `# HELP nodejs_memory_heap_total_bytes Node.js heap total memory`,
      `# TYPE nodejs_memory_heap_total_bytes gauge`,
      `nodejs_memory_heap_total_bytes ${memUsage.heapTotal}`,
      '',
      `# HELP nodejs_memory_heap_used_bytes Node.js heap used memory`,
      `# TYPE nodejs_memory_heap_used_bytes gauge`,
      `nodejs_memory_heap_used_bytes ${memUsage.heapUsed}`,
      '',
      `# HELP nodejs_memory_external_bytes Node.js external memory`,
      `# TYPE nodejs_memory_external_bytes gauge`,
      `nodejs_memory_external_bytes ${memUsage.external}`,
      '',
      `# HELP nodejs_memory_rss_bytes Node.js RSS memory`,
      `# TYPE nodejs_memory_rss_bytes gauge`,
      `nodejs_memory_rss_bytes ${memUsage.rss}`,
      ''
    ].join('\n')
    
    const fullMetrics = [additionalMetrics, prometheusMetrics].join('\n')
    
    const duration = (Date.now() - startTime) / 1000
    
    // Record metrics request
    applicationMetrics.recordHttpRequest('GET', '/api/metrics', 200, duration)
    
    logger.info('Metrics endpoint accessed', {
      duration,
      userAgent: request.headers.get('User-Agent') || 'Unknown',
      metadata: {
        requestPath: '/api/metrics'
      }
    })
    
    return new Response(fullMetrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    logger.error('Failed to serve metrics', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        requestPath: '/api/metrics'
      }
    }, error instanceof Error ? error : undefined)
    
    applicationMetrics.recordError('metrics_endpoint_error', 'metrics_endpoint')
    applicationMetrics.recordHttpRequest('GET', '/api/metrics', 500, 0)
    
    return new Response('Internal Server Error', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain'
      }
    })
  }
} 