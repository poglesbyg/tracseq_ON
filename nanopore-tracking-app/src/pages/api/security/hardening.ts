import type { APIRoute } from 'astro'
import { securityHardening } from '../../../lib/security/SecurityHardening'
import { getComponentLogger } from '../../../lib/logging/StructuredLogger'

const logger = getComponentLogger('SecurityHardeningAPI')

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'metrics':
        const metrics = securityHardening.getSecurityMetrics()
        return new Response(JSON.stringify({
          success: true,
          metrics,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })

      case 'threats':
        const limit = parseInt(url.searchParams.get('limit') || '100')
        const threats = securityHardening.getThreatDetections(limit)
        return new Response(JSON.stringify({
          success: true,
          threats,
          count: threats.length,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })

      case 'audit':
        const auditLimit = parseInt(url.searchParams.get('limit') || '100')
        const auditLogs = securityHardening.getAuditLogs(auditLimit)
        return new Response(JSON.stringify({
          success: true,
          auditLogs,
          count: auditLogs.length,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })

      case 'report':
        const report = securityHardening.generateSecurityReport()
        return new Response(JSON.stringify({
          success: true,
          report,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })

      default:
        // Return comprehensive security status
        const securityMetrics = securityHardening.getSecurityMetrics()
        const recentThreats = securityHardening.getThreatDetections(10)
        const recentAudit = securityHardening.getAuditLogs(10)
        const securityReport = securityHardening.generateSecurityReport()

        return new Response(JSON.stringify({
          success: true,
          status: {
            metrics: securityMetrics,
            recentThreats,
            recentAudit,
            report: securityReport
          },
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
    }

  } catch (error) {
    logger.error('Security hardening API error', {
      action: 'api_error',
      errorType: error instanceof Error ? error.name : 'UnknownError',
      metadata: { errorMessage: error instanceof Error ? error.message : 'Unknown error' }
    })

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { action, data } = body

    // Get client IP for security logging
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

    switch (action) {
      case 'authenticate':
        const { token } = data
        if (!token) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Token is required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const authResult = await securityHardening.authenticateRequest(token, clientIP)
        return new Response(JSON.stringify({
          success: authResult.success,
          userId: authResult.userId,
          role: authResult.role,
          error: authResult.error,
          timestamp: new Date().toISOString()
        }), {
          status: authResult.success ? 200 : 401,
          headers: { 'Content-Type': 'application/json' }
        })

      case 'authorize':
        const { userId, role, resource, actionType } = data
        if (!userId || !role || !resource || !actionType) {
          return new Response(JSON.stringify({
            success: false,
            error: 'userId, role, resource, and actionType are required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const authzResult = await securityHardening.authorizeAction(userId, role, resource, actionType)
        return new Response(JSON.stringify({
          success: authzResult.authorized,
          reason: authzResult.reason,
          timestamp: new Date().toISOString()
        }), {
          status: authzResult.authorized ? 200 : 403,
          headers: { 'Content-Type': 'application/json' }
        })

      case 'validate':
        const { input, type } = data
        if (!input || !type) {
          return new Response(JSON.stringify({
            success: false,
            error: 'input and type are required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const validationResult = securityHardening.validateInput(input, type)
        return new Response(JSON.stringify({
          success: validationResult.valid,
          sanitized: validationResult.sanitized,
          error: validationResult.error,
          timestamp: new Date().toISOString()
        }), {
          status: validationResult.valid ? 200 : 400,
          headers: { 'Content-Type': 'application/json' }
        })

      case 'rate-limit':
        const { identifier } = data
        if (!identifier) {
          return new Response(JSON.stringify({
            success: false,
            error: 'identifier is required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const rateLimitResult = securityHardening.checkRateLimit(identifier)
        return new Response(JSON.stringify({
          success: true,
          allowed: rateLimitResult.allowed,
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime,
          timestamp: new Date().toISOString()
        }), {
          status: rateLimitResult.allowed ? 200 : 429,
          headers: { 'Content-Type': 'application/json' }
        })

      case 'encrypt':
        const { plaintext, keyId } = data
        if (!plaintext) {
          return new Response(JSON.stringify({
            success: false,
            error: 'plaintext is required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const encryptResult = securityHardening.encrypt(plaintext, keyId)
        return new Response(JSON.stringify({
          success: true,
          encrypted: encryptResult.encrypted,
          iv: encryptResult.iv,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })

      case 'decrypt':
        const { encrypted, iv, decryptKeyId } = data
        if (!encrypted || !iv) {
          return new Response(JSON.stringify({
            success: false,
            error: 'encrypted and iv are required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const decryptResult = securityHardening.decrypt(encrypted, iv, decryptKeyId)
        return new Response(JSON.stringify({
          success: true,
          decrypted: decryptResult,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })

      case 'detect-threats':
        const { requestData } = data
        if (!requestData) {
          return new Response(JSON.stringify({
            success: false,
            error: 'requestData is required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const threatResult = securityHardening.detectThreat({
          method: requestData.method || 'GET',
          url: requestData.url || '',
          headers: requestData.headers || {},
          body: requestData.body,
          ipAddress: clientIP,
          userAgent: request.headers.get('user-agent') || 'unknown'
        })

        return new Response(JSON.stringify({
          success: true,
          threats: threatResult,
          threatsDetected: threatResult.length > 0,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }

  } catch (error) {
    logger.error('Security hardening POST API error', {
      action: 'api_post_error',
      errorType: error instanceof Error ? error.name : 'UnknownError',
      metadata: { errorMessage: error instanceof Error ? error.message : 'Unknown error' }
    })

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
} 