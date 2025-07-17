import type { APIRoute } from 'astro'
import { adminAuth } from '../../../lib/auth/AdminAuth'
import { getComponentLogger } from '../../../lib/logging/StructuredLogger'

const logger = getComponentLogger('AdminLoginAPI')

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Username and password are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     '127.0.0.1'
    
    const userAgent = request.headers.get('user-agent') || 'Unknown'

    const result = await adminAuth.login(username, password, clientIP, userAgent)

    if (result.success) {
      logger.info('Admin login successful', {
        metadata: {
          username,
          clientIP,
          sessionId: result.sessionId
        }
      })

      return new Response(JSON.stringify({
        success: true,
        sessionId: result.sessionId,
        message: 'Login successful'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      logger.warn('Admin login failed', {
        metadata: {
          username,
          clientIP,
          error: result.error
        }
      })

      return new Response(JSON.stringify({
        success: false,
        error: result.error
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    logger.error('Admin login API error', {
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