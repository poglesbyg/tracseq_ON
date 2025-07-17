import type { APIRoute } from 'astro'
import { adminAuth } from '../../../lib/auth/AdminAuth'
import { getComponentLogger } from '../../../lib/logging/StructuredLogger'

const logger = getComponentLogger('AdminLogoutAPI')

export const POST: APIRoute = async ({ request }) => {
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
    
    // Validate session first to get user info for logging
    const session = await adminAuth.validateSession(sessionId)
    
    if (session) {
      logger.info('Admin logout initiated', {
        metadata: {
          username: session.username,
          sessionId: session.id,
          sessionDuration: Date.now() - session.loginTime.getTime()
        }
      })
    }

    // Logout the session
    await adminAuth.logout(sessionId)

    return new Response(JSON.stringify({
      success: true,
      message: 'Logout successful'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    logger.error('Admin logout API error', {
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