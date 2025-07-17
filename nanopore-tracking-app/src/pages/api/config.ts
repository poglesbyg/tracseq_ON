import type { APIContext } from 'astro'
import { configManager } from '../../lib/config/ConfigManager'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'
import { applicationMetrics } from '../../lib/monitoring/MetricsCollector'
import { adminAuth } from '../../lib/auth/AdminAuth'
import { auditLogger } from '../../lib/audit/AuditLogger'

const logger = getComponentLogger('ConfigAPI')

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
      case 'get':
        result = {
          success: true,
          data: {
            config: configManager.export(),
            environment: configManager.getEnvironment(),
            configHash: configManager.getConfigHash(),
            features: configManager.get('features')
          }
        }
        break

      case 'environment':
        const memoryUsage = process.memoryUsage()
        const cpuUsage = process.cpuUsage()
        const uptime = process.uptime()
        
        result = {
          success: true,
          data: {
            nodeVersion: process.version,
            platform: process.platform,
            uptime: uptime,
            memory: {
              used: memoryUsage.heapUsed,
              total: memoryUsage.heapTotal,
              percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
            },
            cpu: {
              usage: ((cpuUsage.user + cpuUsage.system) / 1000000) / uptime * 100,
              loadAverage: process.platform === 'linux' ? (await import('os')).loadavg() : [0, 0, 0]
            },
            diskSpace: {
              used: 0, // Simplified - would need fs.stat in real implementation
              total: 0,
              percentage: 0
            },
            environment: configManager.getEnvironment(),
            debug: configManager.get('debug'),
            version: configManager.get('version')
          }
        }
        break

      case 'features':
        result = {
          success: true,
          data: configManager.get('features')
        }
        break

      case 'validate':
        try {
          await configManager.validate()
          result = {
            success: true,
            message: 'Configuration validation passed'
          }
        } catch (error) {
          result = {
            success: false,
            error: error instanceof Error ? error.message : 'Validation failed'
          }
        }
        break

      case 'hash':
        result = {
          success: true,
          data: {
            configHash: configManager.getConfigHash(),
            environment: configManager.getEnvironment(),
            timestamp: new Date().toISOString()
          }
        }
        break

      default:
        result = {
          success: false,
          error: 'Invalid action. Supported actions: get, environment, features, validate, hash'
        }
    }

    // Log the config API access
    await auditLogger.logApiCall(
      '/api/config',
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
    logger.error('Config API error', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : undefined)

    applicationMetrics.recordError('config_api_error', 'ConfigAPI')

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

    // Check if user has security settings permissions (required for config changes)
    if (!adminAuth.hasPermission(session, 'security_settings')) {
      return new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let result: any = {}

    switch (action) {
      case 'set_override':
        const { path, value } = params

        if (!path || value === undefined) {
          result = {
            success: false,
            error: 'Path and value are required'
          }
          break
        }

        try {
          configManager.setOverride(path, value)
          
          // Log the configuration change
          await auditLogger.logAdminAction(
            'config_override_set',
            {
              path,
              value: typeof value === 'string' && value.includes('secret') ? '***' : value,
              environment: configManager.getEnvironment()
            },
            session.username,
            session.username
          )

          result = {
            success: true,
            message: `Configuration override set for ${path}`,
            data: {
              path,
              configHash: configManager.getConfigHash()
            }
          }
        } catch (error) {
          result = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to set override'
          }
        }
        break

      case 'reload':
        try {
          // This would require implementing a reload method
          result = {
            success: false,
            error: 'Hot reload not implemented for this endpoint'
          }
        } catch (error) {
          result = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to reload configuration'
          }
        }
        break

      case 'toggle_feature':
        const { feature } = params

        if (!feature) {
          result = {
            success: false,
            error: 'Feature name is required'
          }
          break
        }

        try {
          const currentValue = configManager.get(`features.${feature}`)
          if (currentValue === undefined) {
            result = {
              success: false,
              error: `Feature ${feature} not found`
            }
            break
          }

          const newValue = !currentValue
          configManager.setOverride(`features.${feature}`, newValue)
          
          // Log the feature toggle
          await auditLogger.logAdminAction(
            'feature_toggle',
            {
              feature,
              oldValue: currentValue,
              newValue,
              environment: configManager.getEnvironment()
            },
            session.username,
            session.username
          )

          result = {
            success: true,
            message: `Feature ${feature} ${newValue ? 'enabled' : 'disabled'}`,
            data: {
              feature,
              enabled: newValue
            }
          }
        } catch (error) {
          result = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to toggle feature'
          }
        }
        break

      default:
        result = {
          success: false,
          error: 'Invalid action. Supported actions: set_override, reload, toggle_feature'
        }
    }

    // Log the config API access
    await auditLogger.logApiCall(
      '/api/config',
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
    logger.error('Config API POST error', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : undefined)

    applicationMetrics.recordError('config_api_post_error', 'ConfigAPI')

    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
} 