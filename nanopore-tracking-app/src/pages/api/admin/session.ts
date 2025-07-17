import type { APIRoute } from 'astro'
import { adminAuth } from '../../../lib/auth/AdminAuth'
import { getComponentLogger } from '../../../lib/logging/StructuredLogger'

const logger = getComponentLogger('AdminSessionAPI')

export const GET: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authorization header required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const sessionId = authHeader.substring(7) // Remove 'Bearer ' prefix
    const session = await adminAuth.validateSession(sessionId)

    if (!session) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or expired session'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    logger.info('Admin session validated', {
      metadata: {
        username: session.username,
        sessionId: session.id,
        role: session.role
      }
    })

    return new Response(JSON.stringify({
      success: true,
      session: {
        id: session.id,
        username: session.username,
        role: session.role,
        permissions: session.permissions,
        loginTime: session.loginTime,
        lastActivity: session.lastActivity,
        ipAddress: session.ipAddress,
        expiresAt: session.expiresAt
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    logger.error('Admin session API error', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : undefined)

    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
} 