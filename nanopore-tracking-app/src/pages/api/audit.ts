import type { APIContext } from 'astro'
import { auditLogger } from '../../lib/audit/AuditLogger'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'
import { applicationMetrics } from '../../lib/monitoring/MetricsCollector'
import { adminAuth } from '../../lib/auth/AdminAuth'

const logger = getComponentLogger('AuditAPI')

export async function GET(context: APIContext): Promise<Response> {
  try {
    const url = new URL(context.request.url)
    const action = url.searchParams.get('action')
    const limit = parseInt(url.searchParams.get('limit') || '50')

    // Check admin authentication via session cookie
    const sessionId = context.cookies.get('admin_session')?.value
    if (!sessionId) {
      return new Response(JSON.stringify({ success: false, error: 'No session found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const session = await adminAuth.validateSession(sessionId)
    if (!session) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if user has audit permissions
    if (!adminAuth.hasPermission(session, 'audit_logs')) {
      return new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let result: any = {}

    switch (action) {
      case 'logs':
        result = {
          success: true,
          data: await auditLogger.getAuditLogs(limit)
        }
        break

      case 'stats':
        result = {
          success: true,
          data: await auditLogger.getAuditStats()
        }
        break

      case 'cleanup':
        await auditLogger.cleanupOldLogs()
        result = {
          success: true,
          message: 'Audit logs cleanup completed'
        }
        break

      default:
        result = {
          success: false,
          error: 'Invalid action. Supported actions: logs, stats, cleanup'
        }
    }

    // Log the audit API access
    await auditLogger.logApiCall(
      '/api/audit',
      'GET',
      200,
      Date.now(),
      session.username,
      context.clientAddress,
      context.request.headers.get('User-Agent') || undefined
    )

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    logger.error('Audit API error', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : undefined)

    applicationMetrics.recordError('audit_api_error', 'AuditAPI')

    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function POST(context: APIContext): Promise<Response> {
  try {
    const requestBody = await context.request.json()
    const { action, ...params } = requestBody

    // Check admin authentication via session cookie
    const sessionId = context.cookies.get('admin_session')?.value
    if (!sessionId) {
      return new Response(JSON.stringify({ success: false, error: 'No session found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const session = await adminAuth.validateSession(sessionId)
    if (!session) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if user has audit permissions
    if (!adminAuth.hasPermission(session, 'audit_logs')) {
      return new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let result: any = {}

    switch (action) {
      case 'log_event':
        const {
          eventType,
          category,
          severity,
          resource,
          action: eventAction,
          details,
          options = {}
        } = params

        await auditLogger.logEvent(
          eventType,
          category,
          severity,
          resource,
          eventAction,
          details,
          {
            userId: session.username,
            username: session.username,
            ipAddress: context.clientAddress,
            userAgent: context.request.headers.get('User-Agent') || undefined,
            ...options
          }
        )

        result = {
          success: true,
          message: 'Audit event logged successfully'
        }
        break

      case 'log_admin_action':
        const { adminAction, adminDetails } = params

        await auditLogger.logAdminAction(
          adminAction,
          adminDetails,
          session.username,
          session.username
        )

        result = {
          success: true,
          message: 'Admin action logged successfully'
        }
        break

      case 'log_security_event':
        const { securityEventType, securityAction, securityDetails, securitySeverity = 'HIGH' } = params

        await auditLogger.logSecurityEvent(
          securityEventType,
          securityAction,
          securityDetails,
          securitySeverity,
          session.username,
          session.username
        )

        result = {
          success: true,
          message: 'Security event logged successfully'
        }
        break

      default:
        result = {
          success: false,
          error: 'Invalid action. Supported actions: log_event, log_admin_action, log_security_event'
        }
    }

    // Log the audit API access
    await auditLogger.logApiCall(
      '/api/audit',
      'POST',
      200,
      Date.now(),
      session.username,
      context.clientAddress,
      context.request.headers.get('User-Agent') || undefined
    )

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    logger.error('Audit API POST error', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : undefined)

    applicationMetrics.recordError('audit_api_post_error', 'AuditAPI')

    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
} 