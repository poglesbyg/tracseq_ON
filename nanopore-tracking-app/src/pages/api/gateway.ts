import type { APIRoute } from 'astro'
import { APIGateway } from '../../lib/gateway/APIGateway'
import { StructuredLogger } from '../../lib/logging/StructuredLogger'

const logger = new StructuredLogger('gateway-api')
const gateway = APIGateway.getInstance()

// Route mapping configuration
const routeMapping = {
  // Sample Management Service routes
  '/api/samples': 'sample-management',
  '/api/sample': 'sample-management',
  '/api/nanopore': 'sample-management',
  
  // AI Processing Service routes
  '/api/ai': 'ai-processing',
  '/api/process-pdf': 'ai-processing',
  '/api/extract': 'ai-processing',
  
  // Authentication Service routes
  '/api/auth': 'authentication',
  '/api/admin': 'authentication',
  '/api/login': 'authentication',
  '/api/logout': 'authentication',
  '/api/session': 'authentication',
  
  // File Storage Service routes
  '/api/files': 'file-storage',
  '/api/upload': 'file-storage',
  '/api/storage': 'file-storage',
  
  // Audit Service routes
  '/api/audit': 'audit',
  '/api/metrics': 'audit',
  '/api/monitoring': 'audit',
  '/api/backup': 'audit'
}

export const GET: APIRoute = async ({ request }) => {
  return await handleRequest(request, 'GET')
}

export const POST: APIRoute = async ({ request }) => {
  return await handleRequest(request, 'POST')
}

export const PUT: APIRoute = async ({ request }) => {
  return await handleRequest(request, 'PUT')
}

export const DELETE: APIRoute = async ({ request }) => {
  return await handleRequest(request, 'DELETE')
}

export const PATCH: APIRoute = async ({ request }) => {
  return await handleRequest(request, 'PATCH')
}

async function handleRequest(request: Request, method: string): Promise<Response> {
  try {
    const url = new URL(request.url)
    const path = url.pathname
    const searchParams = url.searchParams.toString()
    const fullPath = searchParams ? `${path}?${searchParams}` : path

    // Extract client IP
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

    // Extract user ID from headers or session
    const userId = request.headers.get('x-user-id') || 
                  request.headers.get('authorization')?.split(' ')[1] || 
                  'anonymous'

    // Determine target service based on path
    const targetService = determineTargetService(path)
    
    if (!targetService) {
      logger.warn('No service found for path', { path, method })
      return new Response(JSON.stringify({
        error: 'Service not found',
        message: `No service configured for path: ${path}`
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Extract headers (excluding host and connection)
    const headers: Record<string, string> = {}
    for (const [key, value] of request.headers.entries()) {
      if (!['host', 'connection'].includes(key.toLowerCase())) {
        headers[key] = value
      }
    }

    // Extract request body for non-GET requests
    let body: any = undefined
    if (method !== 'GET' && method !== 'HEAD') {
      const contentType = request.headers.get('content-type') || ''
      
      if (contentType.includes('application/json')) {
        try {
          body = await request.json()
        } catch (error) {
          logger.warn('Failed to parse JSON body', { error: error instanceof Error ? error.message : 'Unknown error' })
        }
      } else if (contentType.includes('multipart/form-data')) {
        // Handle form data
        const formData = await request.formData()
        body = Object.fromEntries(formData.entries())
      } else {
        // Handle raw body
        body = await request.text()
      }
    }

    // Route request to target service
    const response = await gateway.routeRequest(
      targetService,
      method,
      fullPath,
      headers,
      body,
      {
        ip: clientIP,
        userId: userId
      }
    )

    // Forward response headers
    const responseHeaders: Record<string, string> = {}
    for (const [key, value] of response.headers.entries()) {
      responseHeaders[key] = value
    }

    // Add gateway-specific headers
    responseHeaders['X-Gateway-Service'] = targetService
    responseHeaders['X-Gateway-Timestamp'] = new Date().toISOString()

    // Return response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    })

  } catch (error) {
    logger.error('Gateway request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      url: request.url,
      method
    })

    return new Response(JSON.stringify({
      error: 'Gateway error',
      message: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

function determineTargetService(path: string): string | null {
  // Check exact matches first
  for (const [route, service] of Object.entries(routeMapping)) {
    if (path.startsWith(route)) {
      return service
    }
  }

  // Check for specific patterns
  if (path.includes('/health')) {
    // Health checks can go to any service, default to audit
    return 'audit'
  }

  if (path.includes('/metrics')) {
    return 'audit'
  }

  if (path.includes('/admin')) {
    return 'authentication'
  }

  if (path.includes('/pdf') || path.includes('/file')) {
    return 'file-storage'
  }

  if (path.includes('/ai') || path.includes('/process')) {
    return 'ai-processing'
  }

  if (path.includes('/sample') || path.includes('/nanopore')) {
    return 'sample-management'
  }

  return null
}

// Health check endpoint for the gateway itself
export const OPTIONS: APIRoute = async () => {
  return new Response(JSON.stringify({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }), {
    status: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID, X-User-ID'
    }
  })
}