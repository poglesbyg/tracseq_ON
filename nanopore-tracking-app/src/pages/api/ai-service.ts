import type { APIRoute } from 'astro'
import { resilientAIService } from '../../lib/ai/resilient-ai-service'

export const POST: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'health':
        return await handleHealthCheck()
      
      case 'metrics':
        return await handleGetMetrics()
      
      case 'reset-circuit-breaker':
        return await handleResetCircuitBreaker()
      
      case 'clear-cache':
        return await handleClearCache()
      
      case 'update-config':
        return await handleUpdateConfig(request)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action. Supported actions: health, metrics, reset-circuit-breaker, clear-cache, update-config'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('AI service API error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action') || 'health'

    switch (action) {
      case 'health':
        return await handleHealthCheck()
      
      case 'metrics':
        return await handleGetMetrics()
      
      case 'status':
        return await handleGetStatus()
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action. Supported actions: health, metrics, status'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('AI service API error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function handleHealthCheck(): Promise<Response> {
  const health = await resilientAIService.checkServiceHealth()
  
  const overallHealthy = health.aiService && health.ragService && health.pdfService
  const status = overallHealthy ? 200 : 503
  
  return new Response(JSON.stringify({
    healthy: overallHealthy,
    timestamp: new Date().toISOString(),
    services: {
      aiService: {
        healthy: health.aiService,
        status: health.aiService ? 'operational' : 'unavailable'
      },
      ragService: {
        healthy: health.ragService,
        status: health.ragService ? 'operational' : 'unavailable'
      },
      pdfService: {
        healthy: health.pdfService,
        status: health.pdfService ? 'operational' : 'unavailable'
      }
    },
    circuitBreaker: {
      state: health.circuitBreakerState,
      status: health.circuitBreakerState === 'closed' ? 'operational' : 'degraded'
    },
    metrics: health.metrics
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function handleGetMetrics(): Promise<Response> {
  const metrics = resilientAIService.getMetrics()
  
  const successRate = metrics.totalRequests > 0 
    ? (metrics.successfulRequests / metrics.totalRequests) * 100 
    : 0
  
  const failureRate = metrics.totalRequests > 0 
    ? (metrics.failedRequests / metrics.totalRequests) * 100 
    : 0
  
  const fallbackUsageRate = metrics.totalRequests > 0 
    ? (metrics.fallbackUsage / metrics.totalRequests) * 100 
    : 0

  return new Response(JSON.stringify({
    timestamp: new Date().toISOString(),
    metrics: {
      ...metrics,
      successRate: Math.round(successRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      fallbackUsageRate: Math.round(fallbackUsageRate * 100) / 100
    },
    health: {
      status: successRate > 80 ? 'healthy' : successRate > 50 ? 'degraded' : 'unhealthy',
      lastSuccessTime: metrics.lastSuccessTime ? new Date(metrics.lastSuccessTime).toISOString() : null,
      lastFailureTime: metrics.lastFailureTime ? new Date(metrics.lastFailureTime).toISOString() : null
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function handleGetStatus(): Promise<Response> {
  const health = await resilientAIService.checkServiceHealth()
  const metrics = resilientAIService.getMetrics()
  
  return new Response(JSON.stringify({
    timestamp: new Date().toISOString(),
    status: 'operational',
    services: {
      aiService: health.aiService,
      ragService: health.ragService,
      pdfService: health.pdfService
    },
    circuitBreaker: {
      state: health.circuitBreakerState,
      failures: health.metrics.failedRequests,
      trips: health.metrics.circuitBreakerTrips
    },
    performance: {
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      failedRequests: metrics.failedRequests,
      averageResponseTime: Math.round(metrics.averageResponseTime),
      fallbackUsage: metrics.fallbackUsage
    },
    recommendations: generateRecommendations(health, metrics)
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function handleResetCircuitBreaker(): Promise<Response> {
  resilientAIService.resetCircuitBreaker()
  
  return new Response(JSON.stringify({
    success: true,
    message: 'Circuit breaker reset successfully',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function handleClearCache(): Promise<Response> {
  resilientAIService.clearCache()
  
  return new Response(JSON.stringify({
    success: true,
    message: 'AI service cache cleared successfully',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function handleUpdateConfig(request: Request): Promise<Response> {
  const body = await request.json()
  const { retryConfig, fallbackConfig } = body
  
  resilientAIService.updateConfig(retryConfig, fallbackConfig)
  
  return new Response(JSON.stringify({
    success: true,
    message: 'AI service configuration updated successfully',
    timestamp: new Date().toISOString(),
    updatedConfig: {
      retryConfig: retryConfig || null,
      fallbackConfig: fallbackConfig || null
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

function generateRecommendations(health: any, metrics: any): string[] {
  const recommendations: string[] = []
  
  if (!health.aiService) {
    recommendations.push('Primary AI service is unavailable - check Ollama service status')
  }
  
  if (!health.ragService) {
    recommendations.push('RAG service is unavailable - enhancement features may be limited')
  }
  
  if (!health.pdfService) {
    recommendations.push('PDF service is unavailable - text extraction may fail')
  }
  
  if (health.circuitBreakerState === 'open') {
    recommendations.push('Circuit breaker is open - service will use fallback methods only')
  }
  
  if (health.circuitBreakerState === 'half-open') {
    recommendations.push('Circuit breaker is half-open - service is recovering from failures')
  }
  
  if (metrics.failedRequests > 0) {
    const failureRate = (metrics.failedRequests / metrics.totalRequests) * 100
    if (failureRate > 20) {
      recommendations.push(`High failure rate (${failureRate.toFixed(1)}%) - investigate service issues`)
    }
  }
  
  if (metrics.fallbackUsage > 0) {
    const fallbackRate = (metrics.fallbackUsage / metrics.totalRequests) * 100
    if (fallbackRate > 30) {
      recommendations.push(`High fallback usage (${fallbackRate.toFixed(1)}%) - primary services may be unstable`)
    }
  }
  
  if (metrics.averageResponseTime > 10000) {
    recommendations.push('High average response time - consider optimizing AI service performance')
  }
  
  if (metrics.circuitBreakerTrips > 5) {
    recommendations.push('Multiple circuit breaker trips detected - investigate recurring failures')
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All AI services are operating normally')
  }
  
  return recommendations
} 