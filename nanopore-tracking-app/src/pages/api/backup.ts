import type { APIRoute } from 'astro'
import { backupManager } from '../../lib/backup/BackupManager'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'
import { applicationMetrics } from '../../lib/monitoring/MetricsCollector'

const logger = getComponentLogger('BackupAPI')

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { action, ...options } = body
    
    logger.info('Backup API request', {
      metadata: {
        action,
        userAgent: request.headers.get('User-Agent'),
        origin: request.headers.get('Origin')
      }
    })
    
    switch (action) {
      case 'create_backup':
        const backup = await backupManager.createFullBackup()
        
        logger.info('Backup created via API', {
          metadata: {
            backupId: backup.id,
            size: backup.size,
            duration: backup.duration
          }
        })
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Backup created successfully',
          backup: {
            id: backup.id,
            timestamp: backup.timestamp,
            size: backup.size,
            duration: backup.duration,
            status: backup.status
          }
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        })
        
      case 'restore':
        if (!options.backupId) {
          return new Response(JSON.stringify({
            success: false,
            message: 'backupId is required for restore operation'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        const recoveryOptions: any = {
          backupId: options.backupId,
          restoreSchema: options.restoreSchema !== false,
          restoreData: options.restoreData !== false,
          verifyIntegrity: options.verifyIntegrity !== false,
          dryRun: options.dryRun === true
        }
        
        if (options.pointInTime) {
          recoveryOptions.pointInTime = new Date(options.pointInTime)
        }
        
        if (options.targetDatabase) {
          recoveryOptions.targetDatabase = options.targetDatabase
        }
        
        if (options.restoreTables) {
          recoveryOptions.restoreTables = options.restoreTables
        }
        
        await backupManager.restoreFromBackup(recoveryOptions)
        
        logger.info('Restore completed via API', {
          metadata: {
            backupId: options.backupId,
            dryRun: options.dryRun,
            duration: Date.now() - startTime
          }
        })
        
        return new Response(JSON.stringify({
          success: true,
          message: options.dryRun ? 'Dry run restore completed' : 'Restore completed successfully',
          duration: Date.now() - startTime
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        })
        
      case 'test_disaster_recovery':
        if (!options.planId) {
          return new Response(JSON.stringify({
            success: false,
            message: 'planId is required for disaster recovery test'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        const testResult = await backupManager.testDisasterRecoveryPlan(options.planId)
        
        logger.info('Disaster recovery test completed via API', {
          metadata: {
            planId: options.planId,
            success: testResult,
            duration: Date.now() - startTime
          }
        })
        
        return new Response(JSON.stringify({
          success: testResult,
          message: testResult ? 'Disaster recovery test passed' : 'Disaster recovery test failed',
          duration: Date.now() - startTime
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        })
        
      default:
        return new Response(JSON.stringify({
          success: false,
          message: 'Invalid action',
          validActions: ['create_backup', 'restore', 'test_disaster_recovery']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
    
  } catch (error) {
    logger.error('Backup API error', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      }
    }, error instanceof Error ? error : undefined)
    
    applicationMetrics.recordError('backup_api_error', 'BackupAPI')
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'status'
    
    logger.info('Backup API status request', {
      metadata: {
        type,
        userAgent: request.headers.get('User-Agent')
      }
    })
    
    switch (type) {
      case 'status':
        const activeJobs = backupManager.getActiveJobs()
        const backupHistory = backupManager.getBackupHistory().slice(-10) // Last 10 backups
        
        return new Response(JSON.stringify({
          success: true,
          activeJobs: activeJobs.map(job => ({
            id: job.id,
            type: job.type,
            status: job.status,
            progress: job.progress,
            currentStep: job.currentStep,
            startTime: job.startTime,
            endTime: job.endTime,
            error: job.error?.message
          })),
          recentBackups: backupHistory.map(backup => ({
            id: backup.id,
            timestamp: backup.timestamp,
            type: backup.type,
            size: backup.size,
            duration: backup.duration,
            status: backup.status,
            recordCount: backup.recordCount
          })),
          summary: {
            totalBackups: backupManager.getBackupHistory().length,
            totalSize: backupManager.getBackupHistory().reduce((sum, b) => sum + b.size, 0),
            successRate: backupManager.getBackupHistory().filter(b => b.status === 'completed').length / backupManager.getBackupHistory().length * 100,
            lastBackup: backupHistory[backupHistory.length - 1]?.timestamp || null
          }
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        })
        
      case 'history':
        const fullHistory = backupManager.getBackupHistory()
        
        return new Response(JSON.stringify({
          success: true,
          backups: fullHistory.map(backup => ({
            id: backup.id,
            timestamp: backup.timestamp,
            type: backup.type,
            size: backup.size,
            compressed: backup.compressed,
            encrypted: backup.encrypted,
            duration: backup.duration,
            status: backup.status,
            tables: backup.tables,
            recordCount: backup.recordCount,
            checksum: backup.checksum
          }))
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60'
          }
        })
        
      case 'disaster_recovery':
        const recoveryPlans = backupManager.getDisasterRecoveryPlans()
        
        return new Response(JSON.stringify({
          success: true,
          recoveryPlans: recoveryPlans.map(plan => ({
            id: plan.id,
            name: plan.name,
            description: plan.description,
            priority: plan.priority,
            rto: plan.rto,
            rpo: plan.rpo,
            steps: plan.steps.map(step => ({
              id: step.id,
              name: step.name,
              description: step.description,
              automated: step.automated,
              estimatedTime: step.estimatedTime
            })),
            lastTested: plan.lastTested,
            testResults: plan.testResults.slice(-5) // Last 5 test results
          }))
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300'
          }
        })
        
      case 'report':
        const report = backupManager.generateBackupReport()
        
        return new Response(JSON.stringify({
          success: true,
          report,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300'
          }
        })
        
      default:
        return new Response(JSON.stringify({
          success: false,
          message: 'Invalid type parameter',
          validTypes: ['status', 'history', 'disaster_recovery', 'report']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
    
  } catch (error) {
    logger.error('Backup API status error', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : undefined)
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
} 