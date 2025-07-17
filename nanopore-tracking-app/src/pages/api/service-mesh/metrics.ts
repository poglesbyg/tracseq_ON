import type { APIRoute } from 'astro'
import { getComponentLogger } from '../../../lib/logging/StructuredLogger'

const logger = getComponentLogger('ServiceMeshMetrics')

// Simple metrics store (in production, use proper metrics library)
let metrics = {
  requests_total: 0,
  requests_failed: 0,
  requests_duration_seconds: [] as number[],
  circuit_breaker_state: 'closed',
  circuit_breaker_failures: 0,
  load_balancer_endpoints: 1,
  load_balancer_healthy_endpoints: 1,
  memory_usage_bytes: 0,
  uptime_seconds: 0
}

export const GET: APIRoute = async ({ request }) => {
  try {
    logger.debug('Service mesh metrics requested', {
      action: 'metrics_request',
      metadata: { 
        userAgent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date().toISOString()
      }
    })

    // Update runtime metrics
    updateRuntimeMetrics()

    // Generate Prometheus-compatible metrics
    const prometheusMetrics = generatePrometheusMetrics()

    return new Response(prometheusMetrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'x-service-mesh': 'quota-optimized',
        'x-service-mesh-version': '1.0.0',
        'x-metrics-format': 'prometheus'
      }
    })

  } catch (error) {
    logger.error('Service mesh metrics failed', {
      action: 'metrics_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
      metadata: { 
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    })

    return new Response('# ERROR: Failed to generate metrics\n', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-service-mesh': 'quota-optimized',
        'x-service-mesh-version': '1.0.0',
        'x-metrics-format': 'prometheus'
      }
    })
  }
}

function updateRuntimeMetrics(): void {
  // Update memory usage
  const memoryUsage = process.memoryUsage()
  metrics.memory_usage_bytes = memoryUsage.heapUsed

  // Update uptime
  metrics.uptime_seconds = Math.round(process.uptime())

  // Increment request counter
  metrics.requests_total++

  // Simulate some metrics (in production, these would come from actual service mesh)
  if (Math.random() < 0.01) { // 1% failure rate simulation
    metrics.requests_failed++
  }

  // Add response time sample
  const responseTime = Math.random() * 100 + 10 // 10-110ms
  metrics.requests_duration_seconds.push(responseTime / 1000)
  
  // Keep only last 1000 samples
  if (metrics.requests_duration_seconds.length > 1000) {
    metrics.requests_duration_seconds.shift()
  }
}

function generatePrometheusMetrics(): string {
  const timestamp = Date.now()
  const labels = 'app="nanopore-tracking-app",service_mesh="quota-optimized",namespace="dept-barc"'
  
  let output = ''

  // Add metadata
  output += '# HELP service_mesh_info Service mesh information\n'
  output += '# TYPE service_mesh_info gauge\n'
  output += `service_mesh_info{${labels},version="1.0.0",mode="integrated"} 1 ${timestamp}\n\n`

  // Request metrics
  output += '# HELP service_mesh_requests_total Total number of requests processed\n'
  output += '# TYPE service_mesh_requests_total counter\n'
  output += `service_mesh_requests_total{${labels}} ${metrics.requests_total} ${timestamp}\n\n`

  output += '# HELP service_mesh_requests_failed_total Total number of failed requests\n'
  output += '# TYPE service_mesh_requests_failed_total counter\n'
  output += `service_mesh_requests_failed_total{${labels}} ${metrics.requests_failed} ${timestamp}\n\n`

  // Request duration metrics
  if (metrics.requests_duration_seconds.length > 0) {
    const sorted = [...metrics.requests_duration_seconds].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0
    const avg = sorted.reduce((sum, val) => sum + val, 0) / sorted.length

    output += '# HELP service_mesh_request_duration_seconds Request duration in seconds\n'
    output += '# TYPE service_mesh_request_duration_seconds histogram\n'
    output += `service_mesh_request_duration_seconds{${labels},quantile="0.5"} ${p50.toFixed(3)} ${timestamp}\n`
    output += `service_mesh_request_duration_seconds{${labels},quantile="0.95"} ${p95.toFixed(3)} ${timestamp}\n`
    output += `service_mesh_request_duration_seconds{${labels},quantile="0.99"} ${p99.toFixed(3)} ${timestamp}\n`
    output += `service_mesh_request_duration_seconds_sum{${labels}} ${(avg * sorted.length).toFixed(3)} ${timestamp}\n`
    output += `service_mesh_request_duration_seconds_count{${labels}} ${sorted.length} ${timestamp}\n\n`
  }

  // Circuit breaker metrics
  output += '# HELP service_mesh_circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half-open)\n'
  output += '# TYPE service_mesh_circuit_breaker_state gauge\n'
  const stateValue = metrics.circuit_breaker_state === 'closed' ? 0 : 
                     metrics.circuit_breaker_state === 'open' ? 1 : 2
  output += `service_mesh_circuit_breaker_state{${labels},state="${metrics.circuit_breaker_state}"} ${stateValue} ${timestamp}\n\n`

  output += '# HELP service_mesh_circuit_breaker_failures_total Total circuit breaker failures\n'
  output += '# TYPE service_mesh_circuit_breaker_failures_total counter\n'
  output += `service_mesh_circuit_breaker_failures_total{${labels}} ${metrics.circuit_breaker_failures} ${timestamp}\n\n`

  // Load balancer metrics
  output += '# HELP service_mesh_load_balancer_endpoints Total number of endpoints\n'
  output += '# TYPE service_mesh_load_balancer_endpoints gauge\n'
  output += `service_mesh_load_balancer_endpoints{${labels}} ${metrics.load_balancer_endpoints} ${timestamp}\n\n`

  output += '# HELP service_mesh_load_balancer_healthy_endpoints Number of healthy endpoints\n'
  output += '# TYPE service_mesh_load_balancer_healthy_endpoints gauge\n'
  output += `service_mesh_load_balancer_healthy_endpoints{${labels}} ${metrics.load_balancer_healthy_endpoints} ${timestamp}\n\n`

  // Memory metrics
  output += '# HELP service_mesh_memory_usage_bytes Memory usage in bytes\n'
  output += '# TYPE service_mesh_memory_usage_bytes gauge\n'
  output += `service_mesh_memory_usage_bytes{${labels}} ${metrics.memory_usage_bytes} ${timestamp}\n\n`

  // Uptime metrics
  output += '# HELP service_mesh_uptime_seconds Service mesh uptime in seconds\n'
  output += '# TYPE service_mesh_uptime_seconds counter\n'
  output += `service_mesh_uptime_seconds{${labels}} ${metrics.uptime_seconds} ${timestamp}\n\n`

  // Quota metrics
  output += '# HELP service_mesh_quota_pods_used Number of pods used in quota\n'
  output += '# TYPE service_mesh_quota_pods_used gauge\n'
  output += `service_mesh_quota_pods_used{${labels}} 9 ${timestamp}\n\n`

  output += '# HELP service_mesh_quota_pods_limit Pod quota limit\n'
  output += '# TYPE service_mesh_quota_pods_limit gauge\n'
  output += `service_mesh_quota_pods_limit{${labels}} 10 ${timestamp}\n\n`

  output += '# HELP service_mesh_quota_services_used Number of services used in quota\n'
  output += '# TYPE service_mesh_quota_services_used gauge\n'
  output += `service_mesh_quota_services_used{${labels}} 10 ${timestamp}\n\n`

  output += '# HELP service_mesh_quota_services_limit Service quota limit\n'
  output += '# TYPE service_mesh_quota_services_limit gauge\n'
  output += `service_mesh_quota_services_limit{${labels}} 10 ${timestamp}\n\n`

  // Feature flags
  output += '# HELP service_mesh_feature_enabled Feature enablement status\n'
  output += '# TYPE service_mesh_feature_enabled gauge\n'
  output += `service_mesh_feature_enabled{${labels},feature="circuit_breaker"} 1 ${timestamp}\n`
  output += `service_mesh_feature_enabled{${labels},feature="load_balancer"} 1 ${timestamp}\n`
  output += `service_mesh_feature_enabled{${labels},feature="metrics"} 1 ${timestamp}\n`
  output += `service_mesh_feature_enabled{${labels},feature="routing"} 1 ${timestamp}\n`
  output += `service_mesh_feature_enabled{${labels},feature="tracing"} 0 ${timestamp}\n`
  output += `service_mesh_feature_enabled{${labels},feature="mutual_tls"} 0 ${timestamp}\n\n`

  return output
}

// Export metrics for internal use
export function getMetrics() {
  return { ...metrics }
}

// Update metrics from external sources
export function updateMetrics(newMetrics: Partial<typeof metrics>) {
  metrics = { ...metrics, ...newMetrics }
}

// Reset metrics (for testing)
export function resetMetrics() {
  metrics = {
    requests_total: 0,
    requests_failed: 0,
    requests_duration_seconds: [],
    circuit_breaker_state: 'closed',
    circuit_breaker_failures: 0,
    load_balancer_endpoints: 1,
    load_balancer_healthy_endpoints: 1,
    memory_usage_bytes: 0,
    uptime_seconds: 0
  }
} 