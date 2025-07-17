import type { APIRoute } from 'astro'
import { ServiceDiscovery } from '../../lib/discovery/ServiceDiscovery'
import { StructuredLogger } from '../../lib/logging/StructuredLogger'

const logger = new StructuredLogger('discovery-api')
const discovery = ServiceDiscovery.getInstance()

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'services':
        return await handleGetServices()
      
      case 'health':
        return await handleGetHealth()
      
      case 'metrics':
        return await handleGetMetrics()
      
      case 'endpoints':
        return await handleGetEndpoints()
      
      default:
        return await handleGetServices() // Default to listing all services
    }
  } catch (error) {
    logger.error('Discovery API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return new Response(JSON.stringify({
      error: 'Discovery service error',
      message: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'register':
        return await handleRegisterService(request)
      
      case 'heartbeat':
        return await handleHeartbeat(request)
      
      case 'deregister':
        return await handleDeregisterService(request)
      
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          message: 'Supported actions: register, heartbeat, deregister'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    logger.error('Discovery API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return new Response(JSON.stringify({
      error: 'Discovery service error',
      message: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function handleGetServices(): Promise<Response> {
  const services = discovery.getAllServiceEndpoints()
  
  return new Response(JSON.stringify({
    services,
    total: services.length,
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function handleGetHealth(): Promise<Response> {
  const healthStatus = await discovery.checkAllServicesHealth()
  const healthyServices = discovery.getHealthyServiceEndpoints()
  
  const overallHealth = Object.values(healthStatus).every(status => status)
  
  return new Response(JSON.stringify({
    healthy: overallHealth,
    services: healthStatus,
    healthyCount: healthyServices.length,
    totalCount: Object.keys(healthStatus).length,
    timestamp: new Date().toISOString()
  }), {
    status: overallHealth ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function handleGetMetrics(): Promise<Response> {
  const metrics = discovery.getMetrics()
  
  return new Response(JSON.stringify({
    metrics,
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function handleGetEndpoints(): Promise<Response> {
  const url = new URL(request.url)
  const serviceName = url.searchParams.get('service')
  
  if (serviceName) {
    const endpoint = discovery.getServiceEndpoint(serviceName)
    if (!endpoint) {
      return new Response(JSON.stringify({
        error: 'Service not found',
        message: `Service ${serviceName} is not registered`
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({
      service: endpoint,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Return all endpoints
  const endpoints = discovery.getAllServiceEndpoints()
  
  return new Response(JSON.stringify({
    endpoints,
    total: endpoints.length,
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function handleRegisterService(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['name', 'version', 'host', 'port']
    for (const field of requiredFields) {
      if (!body[field]) {
        return new Response(JSON.stringify({
          error: 'Missing required field',
          message: `Field ${field} is required`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Register the service
    discovery.registerService({
      name: body.name,
      version: body.version,
      host: body.host,
      port: parseInt(body.port),
      healthCheckUrl: body.healthCheckUrl || '/health',
      metadata: body.metadata || {},
      lastHeartbeat: Date.now(),
      status: 'unknown'
    })

    logger.info('Service registered', {
      service: body.name,
      version: body.version,
      host: body.host,
      port: body.port
    })

    return new Response(JSON.stringify({
      success: true,
      message: `Service ${body.name} registered successfully`,
      timestamp: new Date().toISOString()
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Invalid request body',
      message: 'Request body must be valid JSON'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function handleHeartbeat(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    
    if (!body.service) {
      return new Response(JSON.stringify({
        error: 'Missing service name',
        message: 'Service name is required for heartbeat'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update heartbeat
    discovery.updateHeartbeat(body.service)

    logger.debug('Heartbeat received', { service: body.service })

    return new Response(JSON.stringify({
      success: true,
      message: `Heartbeat for ${body.service} recorded`,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Invalid request body',
      message: 'Request body must be valid JSON'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function handleDeregisterService(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    
    if (!body.service) {
      return new Response(JSON.stringify({
        error: 'Missing service name',
        message: 'Service name is required for deregistration'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Deregister the service
    discovery.deregisterService(body.service)

    logger.info('Service deregistered', { service: body.service })

    return new Response(JSON.stringify({
      success: true,
      message: `Service ${body.service} deregistered successfully`,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Invalid request body',
      message: 'Request body must be valid JSON'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Health check endpoint for the discovery service itself
export const OPTIONS: APIRoute = async () => {
  return new Response(JSON.stringify({
    status: 'healthy',
    service: 'service-discovery',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }), {
    status: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}