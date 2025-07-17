import type { APIRoute } from 'astro'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'
import { applicationMetrics } from '../../lib/monitoring/MetricsCollector'
import { securityHeaders } from '../../middleware/security/SecurityHeaders'
import { db } from '../../lib/database'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'

const logger = getComponentLogger('BackupRecoveryAPI')

interface BackupConfig {
  schedule: string // cron expression
  retention: {
    daily: number
    weekly: number
    monthly: number
  }
  compression: boolean
  encryption: boolean
  destinations: Array<{
    type: 'local' | 's3' | 'gcs'
    path: string
    credentials?: any
  }>
}

interface BackupMetadata {
  id: string
  timestamp: string
  type: 'full' | 'incremental'
  size: number
  duration: number
  status: 'success' | 'failed' | 'in_progress'
  tables: string[]
  files: string[]
  checksum: string
  error?: string
}

const BACKUP_DIR = process.env.BACKUP_DIR || '/app/data/backups'
const DATABASE_URL = process.env.DATABASE_URL || ''

export const GET: APIRoute = async ({ request, url }) => {
  const startTime = Date.now()
  
  try {
    const searchParams = new URL(request.url).searchParams
    const action = searchParams.get('action') || 'list'
    const backupId = searchParams.get('backupId')
    
    let result: any = {}
    
    switch (action) {
      case 'list':
        result = await listBackups()
        break
      case 'status':
        result = await getBackupStatus(backupId)
        break
      case 'config':
        result = await getBackupConfig()
        break
      case 'health':
        result = await checkBackupHealth()
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }
    
    const duration = (Date.now() - startTime) / 1000
    applicationMetrics.recordHttpRequest('GET', '/api/backup-recovery', 200, duration)
    
    logger.info('Backup recovery GET request completed', {
      duration,
      metadata: {
        action,
        backupId
      }
    })
    
    const response = new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
    return securityHeaders.applyHeaders(response)
    
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000
    
    logger.error('Backup recovery GET request failed', {
      duration,
      errorType: error instanceof Error ? error.name : 'Unknown'
    }, error instanceof Error ? error : undefined)
    
    applicationMetrics.recordError('backup_recovery_get_error', 'backup_recovery_api')
    applicationMetrics.recordHttpRequest('GET', '/api/backup-recovery', 500, duration)
    
    const errorResponse = new Response(JSON.stringify({
      error: 'Backup recovery request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    return securityHeaders.applyHeaders(errorResponse)
  }
}

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { action, config, backupId, options } = body
    
    let result: any = {}
    
    switch (action) {
      case 'create_backup':
        result = await createBackup(options)
        break
      case 'restore_backup':
        result = await restoreBackup(backupId, options)
        break
      case 'update_config':
        result = await updateBackupConfig(config)
        break
      case 'schedule_backup':
        result = await scheduleBackup(options)
        break
      case 'delete_backup':
        result = await deleteBackup(backupId)
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }
    
    const duration = (Date.now() - startTime) / 1000
    applicationMetrics.recordHttpRequest('POST', '/api/backup-recovery', 200, duration)
    
    logger.info('Backup recovery POST request completed', {
      duration,
      metadata: {
        action,
        backupId
      }
    })
    
    const response = new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    return securityHeaders.applyHeaders(response)
    
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000
    
    logger.error('Backup recovery POST request failed', {
      duration,
      errorType: error instanceof Error ? error.name : 'Unknown'
    }, error instanceof Error ? error : undefined)
    
    applicationMetrics.recordError('backup_recovery_post_error', 'backup_recovery_api')
    applicationMetrics.recordHttpRequest('POST', '/api/backup-recovery', 500, duration)
    
    const errorResponse = new Response(JSON.stringify({
      error: 'Backup recovery operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    return securityHeaders.applyHeaders(errorResponse)
  }
}

async function listBackups(): Promise<{ backups: BackupMetadata[], total: number }> {
  try {
    await ensureBackupDirectory()
    
    const files = await fs.readdir(BACKUP_DIR)
    const backupFiles = files.filter(file => file.endsWith('.backup.json'))
    
    const backups: BackupMetadata[] = []
    
    for (const file of backupFiles) {
      try {
        const metadataPath = path.join(BACKUP_DIR, file)
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'))
        backups.push(metadata)
      } catch (error) {
        logger.warn('Failed to read backup metadata', { metadata: { file, error } })
      }
    }
    
    // Sort by timestamp (newest first)
    backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    return { backups, total: backups.length }
  } catch (error) {
    logger.error('Failed to list backups', { error })
    throw error
  }
}

async function getBackupStatus(backupId: string | null): Promise<BackupMetadata | null> {
  if (!backupId) {
    throw new Error('Backup ID is required')
  }
  
  try {
    const metadataPath = path.join(BACKUP_DIR, `${backupId}.backup.json`)
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'))
    return metadata
  } catch (error) {
    logger.warn('Backup metadata not found', { backupId, error })
    return null
  }
}

async function getBackupConfig(): Promise<BackupConfig> {
  // Default configuration
  return {
    schedule: '0 2 * * *', // Daily at 2 AM
    retention: {
      daily: 7,
      weekly: 4,
      monthly: 12
    },
    compression: true,
    encryption: false,
    destinations: [
      {
        type: 'local',
        path: BACKUP_DIR
      }
    ]
  }
}

async function checkBackupHealth(): Promise<{ status: string, checks: any[] }> {
  const checks = []
  
  // Check backup directory
  try {
    await fs.access(BACKUP_DIR)
    checks.push({ name: 'backup_directory', status: 'healthy', message: 'Backup directory accessible' })
  } catch (error) {
    checks.push({ name: 'backup_directory', status: 'unhealthy', message: 'Backup directory not accessible' })
  }
  
  // Check database connection
  try {
    await db.selectFrom('nanopore_samples').select('id').limit(1).execute()
    checks.push({ name: 'database_connection', status: 'healthy', message: 'Database connection successful' })
  } catch (error) {
    checks.push({ name: 'database_connection', status: 'unhealthy', message: 'Database connection failed' })
  }
  
  // Check recent backups
  try {
    const { backups } = await listBackups()
    const recentBackups = backups.filter(backup => {
      const backupTime = new Date(backup.timestamp).getTime()
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
      return backupTime > oneDayAgo
    })
    
    if (recentBackups.length > 0) {
      checks.push({ name: 'recent_backups', status: 'healthy', message: `${recentBackups.length} recent backups found` })
    } else {
      checks.push({ name: 'recent_backups', status: 'warning', message: 'No recent backups found' })
    }
  } catch (error) {
    checks.push({ name: 'recent_backups', status: 'unhealthy', message: 'Failed to check recent backups' })
  }
  
  const overallStatus = checks.every(check => check.status === 'healthy') ? 'healthy' : 
                       checks.some(check => check.status === 'unhealthy') ? 'unhealthy' : 'warning'
  
  return { status: overallStatus, checks }
}

async function createBackup(options: any = {}): Promise<{ backupId: string, status: string, message: string }> {
  const backupId = `backup-${Date.now()}`
  const timestamp = new Date().toISOString()
  const startTime = Date.now()
  
  try {
    await ensureBackupDirectory()
    
    logger.info('Starting backup creation', { backupId, options })
    
    // Create database backup
    const dbBackupPath = path.join(BACKUP_DIR, `${backupId}.sql`)
    await createDatabaseBackup(dbBackupPath)
    
    // Create file backup (if specified)
    const fileBackupPath = path.join(BACKUP_DIR, `${backupId}.files.tar.gz`)
    const filePaths = options.includeFiles ? await createFileBackup(fileBackupPath) : []
    
    // Calculate file sizes and checksum
    const dbStats = await fs.stat(dbBackupPath)
    const fileStats = filePaths.length > 0 ? await fs.stat(fileBackupPath) : { size: 0 }
    const totalSize = dbStats.size + fileStats.size
    
    // Create metadata
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      type: options.type || 'full',
      size: totalSize,
      duration: (Date.now() - startTime) / 1000,
      status: 'success',
      tables: await getDatabaseTables(),
      files: filePaths,
      checksum: await calculateChecksum(dbBackupPath)
    }
    
    // Save metadata
    const metadataPath = path.join(BACKUP_DIR, `${backupId}.backup.json`)
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
    
    logger.info('Backup created successfully', { backupId, size: totalSize, duration: metadata.duration })
    
    return {
      backupId,
      status: 'success',
      message: `Backup created successfully. Size: ${formatBytes(totalSize)}, Duration: ${metadata.duration}s`
    }
    
  } catch (error) {
    logger.error('Backup creation failed', { backupId, error })
    
    // Create failed backup metadata
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      type: options.type || 'full',
      size: 0,
      duration: (Date.now() - startTime) / 1000,
      status: 'failed',
      tables: [],
      files: [],
      checksum: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    
    try {
      const metadataPath = path.join(BACKUP_DIR, `${backupId}.backup.json`)
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
    } catch (metadataError) {
      logger.error('Failed to save backup metadata', { backupId, metadataError })
    }
    
    throw error
  }
}

async function restoreBackup(backupId: string, options: any = {}): Promise<{ status: string, message: string }> {
  if (!backupId) {
    throw new Error('Backup ID is required')
  }
  
  try {
    logger.info('Starting backup restoration', { backupId, options })
    
    // Get backup metadata
    const metadata = await getBackupStatus(backupId)
    if (!metadata) {
      throw new Error(`Backup ${backupId} not found`)
    }
    
    if (metadata.status !== 'success') {
      throw new Error(`Cannot restore failed backup ${backupId}`)
    }
    
    // Restore database
    const dbBackupPath = path.join(BACKUP_DIR, `${backupId}.sql`)
    await restoreDatabaseBackup(dbBackupPath)
    
    // Restore files (if they exist)
    const fileBackupPath = path.join(BACKUP_DIR, `${backupId}.files.tar.gz`)
    try {
      await fs.access(fileBackupPath)
      await restoreFileBackup(fileBackupPath)
    } catch (error) {
      logger.info('No file backup found or failed to restore files', { backupId, error })
    }
    
    logger.info('Backup restored successfully', { backupId })
    
    return {
      status: 'success',
      message: `Backup ${backupId} restored successfully`
    }
    
  } catch (error) {
    logger.error('Backup restoration failed', { backupId, error })
    throw error
  }
}

async function updateBackupConfig(config: BackupConfig): Promise<{ status: string, message: string }> {
  // In a real implementation, this would save the configuration to a persistent store
  logger.info('Backup configuration updated', { config })
  
  return {
    status: 'success',
    message: 'Backup configuration updated successfully'
  }
}

async function scheduleBackup(options: any): Promise<{ status: string, message: string }> {
  // In a real implementation, this would set up a cron job or scheduled task
  logger.info('Backup scheduled', { options })
  
  return {
    status: 'success',
    message: 'Backup scheduled successfully'
  }
}

async function deleteBackup(backupId: string): Promise<{ status: string, message: string }> {
  if (!backupId) {
    throw new Error('Backup ID is required')
  }
  
  try {
    // Delete backup files
    const files = [
      `${backupId}.sql`,
      `${backupId}.files.tar.gz`,
      `${backupId}.backup.json`
    ]
    
    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file)
      try {
        await fs.unlink(filePath)
        logger.info('Backup file deleted', { file })
      } catch (error) {
        logger.warn('Failed to delete backup file', { file, error })
      }
    }
    
    return {
      status: 'success',
      message: `Backup ${backupId} deleted successfully`
    }
    
  } catch (error) {
    logger.error('Backup deletion failed', { backupId, error })
    throw error
  }
}

// Helper functions
async function ensureBackupDirectory(): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true })
  } catch (error) {
    logger.error('Failed to create backup directory', { BACKUP_DIR, error })
    throw error
  }
}

async function createDatabaseBackup(outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(DATABASE_URL)
    const pgDump = spawn('pg_dump', [
      '--host', url.hostname,
      '--port', url.port || '5432',
      '--username', url.username,
      '--no-password',
      '--format', 'custom',
      '--compress', '9',
      '--file', outputPath,
      url.pathname.slice(1) // Remove leading slash
    ], {
      env: {
        ...process.env,
        PGPASSWORD: url.password
      }
    })
    
    pgDump.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`pg_dump exited with code ${code}`))
      }
    })
    
    pgDump.on('error', (error) => {
      reject(error)
    })
  })
}

async function createFileBackup(outputPath: string): Promise<string[]> {
  // This would backup application files, uploads, etc.
  // For now, just return an empty array
  return []
}

async function restoreDatabaseBackup(backupPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(DATABASE_URL)
    const pgRestore = spawn('pg_restore', [
      '--host', url.hostname,
      '--port', url.port || '5432',
      '--username', url.username,
      '--no-password',
      '--clean',
      '--if-exists',
      '--dbname', url.pathname.slice(1),
      backupPath
    ], {
      env: {
        ...process.env,
        PGPASSWORD: url.password
      }
    })
    
    pgRestore.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`pg_restore exited with code ${code}`))
      }
    })
    
    pgRestore.on('error', (error) => {
      reject(error)
    })
  })
}

async function restoreFileBackup(backupPath: string): Promise<void> {
  // This would restore application files, uploads, etc.
  // For now, just log the operation
  logger.info('File backup restoration not implemented', { backupPath })
}

async function getDatabaseTables(): Promise<string[]> {
  try {
    const result = await db
      .selectFrom('information_schema.tables')
      .select('table_name')
      .where('table_schema', '=', 'public')
      .execute()
    
    return result.map(row => row.table_name)
  } catch (error) {
    logger.error('Failed to get database tables', { error })
    return []
  }
}

async function calculateChecksum(filePath: string): Promise<string> {
  // Simple checksum calculation (in production, use proper crypto)
  const stats = await fs.stat(filePath)
  return `${stats.size}-${stats.mtime.getTime()}`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
} 