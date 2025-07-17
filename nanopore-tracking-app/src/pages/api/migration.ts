import type { APIContext } from 'astro'
import { migrationManager } from '../../lib/migration/MigrationManager'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'
import { applicationMetrics } from '../../lib/monitoring/MetricsCollector'
import { adminAuth } from '../../lib/auth/AdminAuth'
import { auditLogger } from '../../lib/audit/AuditLogger'

const logger = getComponentLogger('MigrationAPI')

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
        const stats = await migrationManager.getMigrationStats()
        result = {
          success: true,
          data: stats
        }
        break

      case 'history':
        const history = await migrationManager.getMigrationHistory()
        result = {
          success: true,
          data: history
        }
        break

      case 'pending':
        const pending = await migrationManager.getPendingMigrations()
        result = {
          success: true,
          data: pending.map(m => ({
            id: m.id,
            version: m.version,
            name: m.name,
            description: m.description,
            filename: m.filename,
            author: m.author,
            estimatedDuration: m.estimatedDuration,
            requiresDowntime: m.requiresDowntime,
            backupRequired: m.backupRequired,
            tags: m.tags,
            dependencies: m.dependencies
          }))
        }
        break

      case 'applied':
        const applied = await migrationManager.getAppliedMigrations()
        result = {
          success: true,
          data: applied.map(m => ({
            id: m.id,
            version: m.version,
            name: m.name,
            description: m.description,
            filename: m.filename,
            author: m.author,
            createdAt: m.createdAt
          }))
        }
        break

      case 'plan':
        const targetVersion = url.searchParams.get('version')
        const direction = url.searchParams.get('direction') as 'up' | 'down' || 'up'
        
        try {
          const plan = await migrationManager.createMigrationPlan(targetVersion || undefined, direction)
          result = {
            success: true,
            data: {
              migrations: plan.migrations.map(m => ({
                id: m.id,
                version: m.version,
                name: m.name,
                description: m.description,
                estimatedDuration: m.estimatedDuration,
                requiresDowntime: m.requiresDowntime,
                backupRequired: m.backupRequired,
                tags: m.tags
              })),
              direction: plan.direction,
              targetVersion: plan.targetVersion,
              estimatedDuration: plan.estimatedDuration,
              requiresDowntime: plan.requiresDowntime,
              backupRequired: plan.backupRequired,
              warnings: plan.warnings
            }
          }
        } catch (error) {
          result = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create migration plan'
          }
        }
        break

      case 'validate':
        const validation = await migrationManager.validateMigrations()
        result = {
          success: true,
          data: validation
        }
        break

      default:
        result = {
          success: false,
          error: 'Invalid action. Supported actions: status, history, pending, applied, plan, validate'
        }
    }

    // Log the migration API access
    await auditLogger.logApiCall(
      '/api/migration',
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
    logger.error('Migration API error', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : undefined)

    applicationMetrics.recordError('migration_api_error', 'MigrationAPI')

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

    // Check if user has system administration permissions (required for migrations)
    if (!adminAuth.hasPermission(session, 'system_monitoring')) {
      return new Response(JSON.stringify({ success: false, error: 'Insufficient permissions for migration operations' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let result: any = {}

    switch (action) {
      case 'execute_plan':
        const { targetVersion, direction = 'up', dryRun = false, force = false } = params
        
        try {
          // Create migration plan
          const plan = await migrationManager.createMigrationPlan(targetVersion, direction)
          
          // Execute the plan
          const results = await migrationManager.executePlan(plan, {
            dryRun,
            userId: session.username,
            username: session.username,
            force
          })
          
          // Log the migration execution
          await auditLogger.logAdminAction(
            'migration_plan_executed',
            {
              direction,
              targetVersion,
              migrationsCount: plan.migrations.length,
              successCount: results.filter(r => r.success).length,
              failureCount: results.filter(r => !r.success).length,
              dryRun
            },
            session.username,
            session.username
          )
          
          result = {
            success: true,
            data: {
              plan: {
                direction: plan.direction,
                targetVersion: plan.targetVersion,
                migrationsCount: plan.migrations.length,
                estimatedDuration: plan.estimatedDuration,
                requiresDowntime: plan.requiresDowntime,
                backupRequired: plan.backupRequired,
                warnings: plan.warnings
              },
              results: results.map(r => ({
                success: r.success,
                migrationId: r.migrationId,
                version: r.version,
                direction: r.direction,
                duration: r.duration,
                appliedAt: r.appliedAt,
                error: r.error,
                rollbackRequired: r.rollbackRequired,
                affectedRows: r.affectedRows,
                warnings: r.warnings
              }))
            }
          }
        } catch (error) {
          result = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to execute migration plan'
          }
        }
        break

      case 'rollback':
        const { rollbackVersion, rollbackForce = false } = params
        
        if (!rollbackVersion) {
          result = {
            success: false,
            error: 'Rollback version is required'
          }
          break
        }
        
        try {
          // Create rollback plan
          const plan = await migrationManager.createMigrationPlan(rollbackVersion, 'down')
          
          // Execute rollback
          const results = await migrationManager.executePlan(plan, {
            dryRun: false,
            userId: session.username,
            username: session.username,
            force: rollbackForce
          })
          
          // Log the rollback
          await auditLogger.logAdminAction(
            'migration_rollback_executed',
            {
              rollbackVersion,
              migrationsCount: plan.migrations.length,
              successCount: results.filter(r => r.success).length,
              failureCount: results.filter(r => !r.success).length
            },
            session.username,
            session.username
          )
          
          result = {
            success: true,
            data: {
              plan: {
                direction: plan.direction,
                targetVersion: plan.targetVersion,
                migrationsCount: plan.migrations.length,
                warnings: plan.warnings
              },
              results: results.map(r => ({
                success: r.success,
                migrationId: r.migrationId,
                version: r.version,
                duration: r.duration,
                error: r.error,
                affectedRows: r.affectedRows
              }))
            }
          }
        } catch (error) {
          result = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to execute rollback'
          }
        }
        break

      case 'dry_run':
        const { dryRunTargetVersion, dryRunDirection = 'up' } = params
        
        try {
          // Create migration plan
          const plan = await migrationManager.createMigrationPlan(dryRunTargetVersion, dryRunDirection)
          
          // Execute dry run
          const results = await migrationManager.executePlan(plan, {
            dryRun: true,
            userId: session.username,
            username: session.username
          })
          
          result = {
            success: true,
            data: {
              plan: {
                direction: plan.direction,
                targetVersion: plan.targetVersion,
                migrationsCount: plan.migrations.length,
                estimatedDuration: plan.estimatedDuration,
                requiresDowntime: plan.requiresDowntime,
                backupRequired: plan.backupRequired,
                warnings: plan.warnings
              },
              results: results.map(r => ({
                success: r.success,
                migrationId: r.migrationId,
                version: r.version,
                direction: r.direction,
                duration: r.duration,
                error: r.error
              }))
            }
          }
        } catch (error) {
          result = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to execute dry run'
          }
        }
        break

      default:
        result = {
          success: false,
          error: 'Invalid action. Supported actions: execute_plan, rollback, dry_run'
        }
    }

    // Log the migration API access
    await auditLogger.logApiCall(
      '/api/migration',
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
    logger.error('Migration API POST error', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : undefined)

    applicationMetrics.recordError('migration_api_post_error', 'MigrationAPI')

    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
} 