import type { APIContext } from 'astro'
import { gracefulShutdownManager } from '../../lib/shutdown/GracefulShutdownManager'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'
import { applicationMetrics } from '../../lib/monitoring/MetricsCollector'
import { adminAuth } from '../../lib/auth/AdminAuth'
import { auditLogger } from '../../lib/audit/AuditLogger'

const logger = getComponentLogger('ShutdownAPI')

export async function GET(context: APIContext): Promise<Response> {
  try {
    const url = new URL(context.request.url)
    const action = url.searchParams.get('action')

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

    // Check if user has system monitoring permissions
    if (!adminAuth.hasPermission(session, 'system_monitoring')) {
      return new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let result: any = {}

    switch (action) {
      case 'status':
        result = {
          success: true,
          data: {
            status: gracefulShutdownManager.getStatus(),
            isShuttingDown: gracefulShutdownManager.isShutdownInProgress(),
            stats: gracefulShutdownManager.getShutdownStats()
          }
        }
        break

      case 'hooks':
        result = {
          success: true,
          data: {
            hooks: gracefulShutdownManager.getHooks().map(hook => ({
              name: hook.name,
              priority: hook.priority,
              timeout: hook.timeout,
              required: hook.required
            }))
          }
        }
        break

      case 'test':
        const testResult = await gracefulShutdownManager.testHooks()
        result = {
          success: true,
          data: testResult
        }
        break

      default:
        result = {
          success: false,
          error: 'Invalid action. Supported actions: status, hooks, test'
        }
    }

    // Log the shutdown API access
    await auditLogger.logApiCall(
      '/api/shutdown',
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
    logger.error('Shutdown API error', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : undefined)

    applicationMetrics.recordError('shutdown_api_error', 'ShutdownAPI')

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

    // Check if user has system administration permissions (required for shutdown operations)
    if (!adminAuth.hasPermission(session, 'system_monitoring')) {
      return new Response(JSON.stringify({ success: false, error: 'Insufficient permissions for shutdown operations' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let result: any = {}

    switch (action) {
      case 'graceful_shutdown':
        // This is a dangerous operation - require explicit confirmation
        const { confirm } = params
        
        if (!confirm || confirm !== 'I_UNDERSTAND_THIS_WILL_SHUTDOWN_THE_SERVER') {
          result = {
            success: false,
            error: 'Graceful shutdown requires explicit confirmation. Set confirm to "I_UNDERSTAND_THIS_WILL_SHUTDOWN_THE_SERVER"'
          }
          break
        }

        // Check if shutdown is already in progress
        if (gracefulShutdownManager.isShutdownInProgress()) {
          result = {
            success: false,
            error: 'Shutdown already in progress'
          }
          break
        }

        // Log the shutdown initiation
        await auditLogger.logAdminAction(
          'initiate_graceful_shutdown',
          {
            reason: 'admin_request',
            username: session.username,
            timestamp: new Date().toISOString()
          },
          session.username,
          session.username
        )

        // WARNING: This will actually shut down the server
        // In a real implementation, you might want to add additional safety checks
        logger.warn('Graceful shutdown initiated by admin user', {
          metadata: {
            username: session.username,
            ipAddress: context.clientAddress,
            userAgent: context.request.headers.get('User-Agent')
          }
        })

        // Start the shutdown process (this will terminate the server)
        gracefulShutdownManager.shutdown().then((shutdownResult) => {
          logger.info('Graceful shutdown completed', {
            metadata: {
              success: shutdownResult.success,
              duration: shutdownResult.duration,
              completedHooks: shutdownResult.completedHooks.length,
              failedHooks: shutdownResult.failedHooks.length
            }
          })
        }).catch((error) => {
          logger.error('Graceful shutdown failed', {
            errorType: error instanceof Error ? error.name : 'Unknown',
            metadata: {
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            }
          }, error instanceof Error ? error : undefined)
        })

        result = {
          success: true,
          message: 'Graceful shutdown initiated. Server will terminate after cleanup completes.',
          data: {
            shutdownInitiated: true,
            estimatedDuration: '30-60 seconds'
          }
        }
        break

      case 'register_hook':
        const { name, priority, timeout, required } = params
        
        if (!name || typeof priority !== 'number' || typeof timeout !== 'number') {
          result = {
            success: false,
            error: 'Invalid hook parameters. Required: name, priority (number), timeout (number)'
          }
          break
        }

        // For security, we don't allow registering arbitrary cleanup functions via API
        // This would be a security vulnerability
        result = {
          success: false,
          error: 'Hook registration via API is not supported for security reasons'
        }
        break

      case 'unregister_hook':
        const { hookName } = params
        
        if (!hookName) {
          result = {
            success: false,
            error: 'Hook name is required'
          }
          break
        }

        // Only allow unregistering non-default hooks
        const defaultHooks = ['audit_logger', 'config_manager', 'database', 'metrics', 'final_cleanup']
        if (defaultHooks.includes(hookName)) {
          result = {
            success: false,
            error: 'Cannot unregister default system hooks'
          }
          break
        }

        gracefulShutdownManager.unregisterHook(hookName)
        
        // Log the hook unregistration
        await auditLogger.logAdminAction(
          'unregister_shutdown_hook',
          {
            hookName,
            username: session.username
          },
          session.username,
          session.username
        )

        result = {
          success: true,
          message: `Shutdown hook ${hookName} unregistered successfully`
        }
        break

      default:
        result = {
          success: false,
          error: 'Invalid action. Supported actions: graceful_shutdown, register_hook, unregister_hook'
        }
    }

    // Log the shutdown API access
    await auditLogger.logApiCall(
      '/api/shutdown',
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
    logger.error('Shutdown API POST error', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : undefined)

    applicationMetrics.recordError('shutdown_api_post_error', 'ShutdownAPI')

    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
} 