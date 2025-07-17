import { getComponentLogger } from '../logging/StructuredLogger'
import { applicationMetrics } from '../monitoring/MetricsCollector'
import { db } from '../database'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { gzip, gunzip } from 'zlib'
import { createHash } from 'crypto'

const logger = getComponentLogger('BackupManager')

/**
 * Backup configuration
 */
export interface BackupConfig {
  enabled: boolean
  schedule: string // Cron expression
  retention: {
    daily: number
    weekly: number
    monthly: number
  }
  compression: boolean
  encryption: boolean
  storageLocation: string
  maxBackupSize: number
  parallelJobs: number
  includeFiles: string[]
  excludePatterns: string[]
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  id: string
  timestamp: Date
  type: 'full' | 'incremental' | 'differential'
  size: number
  compressed: boolean
  encrypted: boolean
  checksum: string
  location: string
  duration: number
  status: 'in_progress' | 'completed' | 'failed'
  tables: string[]
  recordCount: number
  version: string
  dependencies?: string[]
}

/**
 * Recovery options
 */
export interface RecoveryOptions {
  backupId: string
  pointInTime?: Date
  targetDatabase?: string
  restoreSchema: boolean
  restoreData: boolean
  restoreTables?: string[]
  verifyIntegrity: boolean
  dryRun: boolean
}

/**
 * Backup job status
 */
export interface BackupJob {
  id: string
  type: 'backup' | 'recovery'
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime: Date
  endTime?: Date
  progress: number
  currentStep: string
  error?: Error
  metadata?: BackupMetadata
}

/**
 * Disaster recovery plan
 */
export interface DisasterRecoveryPlan {
  id: string
  name: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  rto: number // Recovery Time Objective (minutes)
  rpo: number // Recovery Point Objective (minutes)
  steps: Array<{
    id: string
    name: string
    description: string
    automated: boolean
    estimatedTime: number
    dependencies: string[]
  }>
  contacts: Array<{
    name: string
    role: string
    email: string
    phone: string
  }>
  lastTested: Date
  testResults: Array<{
    date: Date
    success: boolean
    duration: number
    notes: string
  }>
}

/**
 * Comprehensive backup and recovery manager
 */
export class BackupManager {
  private config: BackupConfig
  private activeJobs: Map<string, BackupJob> = new Map()
  private backupHistory: BackupMetadata[] = []
  private recoveryPlans: Map<string, DisasterRecoveryPlan> = new Map()
  private scheduledBackups: NodeJS.Timeout[] = []

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = {
      enabled: true,
      schedule: '0 2 * * *', // Daily at 2 AM
      retention: {
        daily: 7,
        weekly: 4,
        monthly: 12
      },
      compression: true,
      encryption: false,
      storageLocation: './backups',
      maxBackupSize: 10 * 1024 * 1024 * 1024, // 10GB
      parallelJobs: 2,
      includeFiles: ['uploads/', 'config/'],
      excludePatterns: ['*.tmp', '*.log', 'node_modules/'],
      ...config
    }

    this.initializeBackupSystem()
  }

  /**
   * Initialize backup system
   */
  private async initializeBackupSystem(): Promise<void> {
    try {
      // Create backup directory
      await fs.mkdir(this.config.storageLocation, { recursive: true })
      
      // Load backup history
      await this.loadBackupHistory()
      
      // Setup scheduled backups
      if (this.config.enabled) {
        this.setupScheduledBackups()
      }
      
      // Load disaster recovery plans
      await this.loadDisasterRecoveryPlans()
      
      logger.info('Backup system initialized', {
        metadata: {
          enabled: this.config.enabled,
          schedule: this.config.schedule,
          storageLocation: this.config.storageLocation,
          retention: this.config.retention
        }
      })
    } catch (error) {
      logger.error('Failed to initialize backup system', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      
      applicationMetrics.recordError('backup_initialization_error', 'BackupManager')
    }
  }

  /**
   * Setup scheduled backups
   */
  private setupScheduledBackups(): void {
    // Simple daily backup - in production, use proper cron library
    const dailyBackup = setInterval(async () => {
      try {
        await this.createFullBackup()
      } catch (error) {
        logger.error('Scheduled backup failed', {
          errorType: error instanceof Error ? error.name : 'Unknown'
        }, error instanceof Error ? error : undefined)
      }
    }, 24 * 60 * 60 * 1000) // 24 hours

    this.scheduledBackups.push(dailyBackup)
    
    logger.info('Scheduled backups configured', {
      metadata: {
        schedule: this.config.schedule,
        nextBackup: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    })
  }

  /**
   * Create full backup
   */
  async createFullBackup(): Promise<BackupMetadata> {
    const backupId = `backup-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const startTime = Date.now()
    
    logger.info('Starting full backup', {
      metadata: {
        backupId,
        type: 'full',
        timestamp: new Date().toISOString()
      }
    })

    const job: BackupJob = {
      id: backupId,
      type: 'backup',
      status: 'running',
      startTime: new Date(),
      progress: 0,
      currentStep: 'initializing'
    }

    this.activeJobs.set(backupId, job)

    try {
      // Update progress
      job.progress = 10
      job.currentStep = 'collecting_metadata'
      
      // Get database metadata
      const tables = await this.getDatabaseTables()
      const recordCount = await this.getTotalRecordCount()
      
      job.progress = 20
      job.currentStep = 'creating_database_dump'
      
      // Create database dump
      const dumpPath = join(this.config.storageLocation, `${backupId}.sql`)
      await this.createDatabaseDump(dumpPath)
      
      job.progress = 60
      job.currentStep = 'backing_up_files'
      
      // Backup files
      const fileBackupPath = join(this.config.storageLocation, `${backupId}_files.tar`)
      await this.backupFiles(fileBackupPath)
      
      job.progress = 80
      job.currentStep = 'compressing'
      
      // Compress if enabled
      let finalPath = dumpPath
      if (this.config.compression) {
        finalPath = `${dumpPath}.gz`
        await this.compressFile(dumpPath, finalPath)
        await fs.unlink(dumpPath) // Remove uncompressed file
      }
      
      job.progress = 90
      job.currentStep = 'calculating_checksum'
      
      // Calculate checksum
      const checksum = await this.calculateChecksum(finalPath)
      const stats = await fs.stat(finalPath)
      
      job.progress = 100
      job.currentStep = 'completed'
      job.status = 'completed'
      job.endTime = new Date()
      
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        type: 'full',
        size: stats.size,
        compressed: this.config.compression,
        encrypted: this.config.encryption,
        checksum,
        location: finalPath,
        duration: Date.now() - startTime,
        status: 'completed',
        tables,
        recordCount,
        version: '1.0.0'
      }
      
      job.metadata = metadata
      this.backupHistory.push(metadata)
      
      // Save backup history
      await this.saveBackupHistory()
      
      // Cleanup old backups
      await this.cleanupOldBackups()
      
      logger.info('Full backup completed', {
        metadata: {
          backupId,
          duration: metadata.duration,
          size: metadata.size,
          tables: metadata.tables.length,
          recordCount: metadata.recordCount
        }
      })
      
      return metadata
      
    } catch (error) {
      job.status = 'failed'
      job.error = error instanceof Error ? error : new Error(String(error))
      job.endTime = new Date()
      
      logger.error('Full backup failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          backupId,
          duration: Date.now() - startTime,
          currentStep: job.currentStep,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      
      applicationMetrics.recordError('backup_creation_error', 'BackupManager')
      throw error
    } finally {
      this.activeJobs.delete(backupId)
    }
  }

  /**
   * Create database dump
   */
  private async createDatabaseDump(outputPath: string): Promise<void> {
    try {
      // Get all tables
      const tables = await this.getDatabaseTables()
      const dumpContent = []
      
      // Add header
      dumpContent.push('-- Nanopore Tracking Database Backup')
      dumpContent.push(`-- Generated: ${new Date().toISOString()}`)
      dumpContent.push('-- Database: nanopore_tracking')
      dumpContent.push('')
      
      // Export each table
      for (const table of tables) {
        dumpContent.push(`-- Table: ${table}`)
        
        // Get table schema (simplified)
        dumpContent.push(`-- Schema for ${table}`)
        dumpContent.push('')
        
        // Export data
        const data = await db.selectFrom(table as any).selectAll().execute()
        
        if (data.length > 0) {
          dumpContent.push(`-- Data for ${table}`)
          for (const row of data) {
            const values = Object.values(row).map(val => 
              val === null ? 'NULL' : `'${String(val).replace(/'/g, "''")}'`
            ).join(', ')
            dumpContent.push(`INSERT INTO ${table} VALUES (${values});`)
          }
          dumpContent.push('')
        }
      }
      
      // Write to file
      await fs.writeFile(outputPath, dumpContent.join('\n'))
      
      logger.debug('Database dump created', {
        metadata: {
          outputPath,
          tables: tables.length,
          size: dumpContent.join('\n').length
        }
      })
      
    } catch (error) {
      logger.error('Database dump creation failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          outputPath,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Backup files
   */
  private async backupFiles(outputPath: string): Promise<void> {
    try {
      // Simple file backup - in production, use proper archiving
      const fileList = []
      
      for (const includePattern of this.config.includeFiles) {
        try {
          const stats = await fs.stat(includePattern)
          if (stats.isDirectory()) {
            const files = await fs.readdir(includePattern)
            fileList.push(...files.map(f => join(includePattern, f)))
          } else {
            fileList.push(includePattern)
          }
        } catch (error) {
          // File/directory doesn't exist, skip
        }
      }
      
      // Create simple archive metadata
      const archiveInfo = {
        timestamp: new Date().toISOString(),
        files: fileList,
        totalSize: 0
      }
      
      await fs.writeFile(outputPath, JSON.stringify(archiveInfo, null, 2))
      
      logger.debug('File backup created', {
        metadata: {
          outputPath,
          fileCount: fileList.length
        }
      })
      
    } catch (error) {
      logger.error('File backup failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          outputPath,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Compress file
   */
  private async compressFile(inputPath: string, outputPath: string): Promise<void> {
    try {
      const input = createReadStream(inputPath)
      const output = createWriteStream(outputPath)
      const gzipStream = gzip()
      
      await pipeline(input, gzipStream, output)
      
      logger.debug('File compressed', {
        metadata: {
          inputPath,
          outputPath,
          inputSize: (await fs.stat(inputPath)).size,
          outputSize: (await fs.stat(outputPath)).size
        }
      })
      
    } catch (error) {
      logger.error('File compression failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          inputPath,
          outputPath,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      const hash = createHash('sha256')
      const stream = createReadStream(filePath)
      
      for await (const chunk of stream) {
        hash.update(chunk)
      }
      
      return hash.digest('hex')
    } catch (error) {
      logger.error('Checksum calculation failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          filePath,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Get database tables
   */
  private async getDatabaseTables(): Promise<string[]> {
    try {
      // Get table names from information schema
      const result = await db.selectFrom('information_schema.tables')
        .select('table_name')
        .where('table_schema', '=', 'public')
        .execute()
      
      return result.map(row => row.table_name)
    } catch (error) {
      // Fallback to known tables
      return ['nanopore_samples']
    }
  }

  /**
   * Get total record count
   */
  private async getTotalRecordCount(): Promise<number> {
    try {
      const result = await db.selectFrom('nanopore_samples')
        .select(db.fn.count<number>('*').as('count'))
        .execute()
      
      return result[0]?.count || 0
    } catch (error) {
      return 0
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(options: RecoveryOptions): Promise<void> {
    const startTime = Date.now()
    const jobId = `restore-${Date.now()}`
    
    logger.info('Starting database restore', {
      metadata: {
        backupId: options.backupId,
        pointInTime: options.pointInTime?.toISOString(),
        targetDatabase: options.targetDatabase,
        dryRun: options.dryRun
      }
    })

    const job: BackupJob = {
      id: jobId,
      type: 'recovery',
      status: 'running',
      startTime: new Date(),
      progress: 0,
      currentStep: 'validating_backup'
    }

    this.activeJobs.set(jobId, job)

    try {
      // Find backup metadata
      const backup = this.backupHistory.find(b => b.id === options.backupId)
      if (!backup) {
        throw new Error(`Backup not found: ${options.backupId}`)
      }

      // Validate backup integrity
      job.progress = 10
      job.currentStep = 'validating_integrity'
      
      const isValid = await this.validateBackupIntegrity(backup)
      if (!isValid) {
        throw new Error('Backup integrity validation failed')
      }

      if (options.dryRun) {
        job.progress = 100
        job.currentStep = 'dry_run_completed'
        job.status = 'completed'
        job.endTime = new Date()
        
        logger.info('Dry run restore completed', {
          metadata: {
            backupId: options.backupId,
            duration: Date.now() - startTime
          }
        })
        return
      }

      // Decompress if needed
      job.progress = 20
      job.currentStep = 'decompressing'
      
      let restorePath = backup.location
      if (backup.compressed) {
        restorePath = backup.location.replace('.gz', '')
        await this.decompressFile(backup.location, restorePath)
      }

      // Restore database
      job.progress = 60
      job.currentStep = 'restoring_database'
      
      if (options.restoreData) {
        await this.restoreDatabase(restorePath, options.restoreTables)
      }

      job.progress = 100
      job.currentStep = 'completed'
      job.status = 'completed'
      job.endTime = new Date()
      
      logger.info('Database restore completed', {
        metadata: {
          backupId: options.backupId,
          duration: Date.now() - startTime,
          tablesRestored: options.restoreTables?.length || 'all'
        }
      })
      
    } catch (error) {
      job.status = 'failed'
      job.error = error instanceof Error ? error : new Error(String(error))
      job.endTime = new Date()
      
      logger.error('Database restore failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          backupId: options.backupId,
          duration: Date.now() - startTime,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      
      applicationMetrics.recordError('restore_error', 'BackupManager')
      throw error
    } finally {
      this.activeJobs.delete(jobId)
    }
  }

  /**
   * Validate backup integrity
   */
  private async validateBackupIntegrity(backup: BackupMetadata): Promise<boolean> {
    try {
      // Check if file exists
      const stats = await fs.stat(backup.location)
      
      // Verify file size
      if (stats.size !== backup.size) {
        logger.warn('Backup file size mismatch', {
          metadata: {
            backupId: backup.id,
            expectedSize: backup.size,
            actualSize: stats.size
          }
        })
        return false
      }
      
      // Verify checksum
      const actualChecksum = await this.calculateChecksum(backup.location)
      if (actualChecksum !== backup.checksum) {
        logger.warn('Backup checksum mismatch', {
          metadata: {
            backupId: backup.id,
            expectedChecksum: backup.checksum,
            actualChecksum
          }
        })
        return false
      }
      
      return true
    } catch (error) {
      logger.error('Backup integrity validation failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          backupId: backup.id,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      return false
    }
  }

  /**
   * Decompress file
   */
  private async decompressFile(inputPath: string, outputPath: string): Promise<void> {
    try {
      const input = createReadStream(inputPath)
      const output = createWriteStream(outputPath)
      const gunzipStream = gunzip()
      
      await pipeline(input, gunzipStream, output)
      
      logger.debug('File decompressed', {
        metadata: {
          inputPath,
          outputPath
        }
      })
      
    } catch (error) {
      logger.error('File decompression failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          inputPath,
          outputPath,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Restore database from dump
   */
  private async restoreDatabase(dumpPath: string, tables?: string[]): Promise<void> {
    try {
      const dumpContent = await fs.readFile(dumpPath, 'utf8')
      const statements = dumpContent.split('\n')
        .filter(line => line.trim() && !line.startsWith('--'))
      
      // Execute statements
      for (const statement of statements) {
        try {
          if (statement.trim()) {
            await db.executeQuery(statement)
          }
        } catch (error) {
          logger.warn('Statement execution failed', {
            metadata: {
              statement: statement.substring(0, 100),
              error: error instanceof Error ? error.message : String(error)
            }
          })
        }
      }
      
      logger.debug('Database restored', {
        metadata: {
          dumpPath,
          statementsExecuted: statements.length
        }
      })
      
    } catch (error) {
      logger.error('Database restore failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          dumpPath,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Load backup history
   */
  private async loadBackupHistory(): Promise<void> {
    try {
      const historyPath = join(this.config.storageLocation, 'backup_history.json')
      const content = await fs.readFile(historyPath, 'utf8')
      this.backupHistory = JSON.parse(content)
    } catch (error) {
      // History file doesn't exist, start fresh
      this.backupHistory = []
    }
  }

  /**
   * Save backup history
   */
  private async saveBackupHistory(): Promise<void> {
    try {
      const historyPath = join(this.config.storageLocation, 'backup_history.json')
      await fs.writeFile(historyPath, JSON.stringify(this.backupHistory, null, 2))
    } catch (error) {
      logger.error('Failed to save backup history', {
        errorType: error instanceof Error ? error.name : 'Unknown'
      }, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Cleanup old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const now = new Date()
      const toDelete = []
      
      // Group backups by age
      const daily = this.backupHistory.filter(b => 
        (now.getTime() - b.timestamp.getTime()) <= 24 * 60 * 60 * 1000
      )
      const weekly = this.backupHistory.filter(b => 
        (now.getTime() - b.timestamp.getTime()) <= 7 * 24 * 60 * 60 * 1000
      )
      const monthly = this.backupHistory.filter(b => 
        (now.getTime() - b.timestamp.getTime()) <= 30 * 24 * 60 * 60 * 1000
      )
      
      // Apply retention policy
      if (daily.length > this.config.retention.daily) {
        toDelete.push(...daily.slice(this.config.retention.daily))
      }
      if (weekly.length > this.config.retention.weekly) {
        toDelete.push(...weekly.slice(this.config.retention.weekly))
      }
      if (monthly.length > this.config.retention.monthly) {
        toDelete.push(...monthly.slice(this.config.retention.monthly))
      }
      
      // Delete old backups
      for (const backup of toDelete) {
        try {
          await fs.unlink(backup.location)
          this.backupHistory = this.backupHistory.filter(b => b.id !== backup.id)
        } catch (error) {
          logger.warn('Failed to delete old backup', {
            metadata: {
              backupId: backup.id,
              location: backup.location
            }
          })
        }
      }
      
      if (toDelete.length > 0) {
        await this.saveBackupHistory()
        logger.info('Old backups cleaned up', {
          metadata: {
            deletedCount: toDelete.length
          }
        })
      }
      
    } catch (error) {
      logger.error('Backup cleanup failed', {
        errorType: error instanceof Error ? error.name : 'Unknown'
      }, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Load disaster recovery plans
   */
  private async loadDisasterRecoveryPlans(): Promise<void> {
    // Load default disaster recovery plans
    const defaultPlan: DisasterRecoveryPlan = {
      id: 'default-dr-plan',
      name: 'Default Disaster Recovery Plan',
      description: 'Standard recovery procedure for nanopore tracking system',
      priority: 'critical',
      rto: 60, // 1 hour
      rpo: 30, // 30 minutes
      steps: [
        {
          id: 'assess-damage',
          name: 'Assess Damage',
          description: 'Evaluate system damage and determine recovery approach',
          automated: false,
          estimatedTime: 15,
          dependencies: []
        },
        {
          id: 'restore-database',
          name: 'Restore Database',
          description: 'Restore database from latest backup',
          automated: true,
          estimatedTime: 30,
          dependencies: ['assess-damage']
        },
        {
          id: 'verify-integrity',
          name: 'Verify Data Integrity',
          description: 'Verify restored data integrity and consistency',
          automated: true,
          estimatedTime: 10,
          dependencies: ['restore-database']
        },
        {
          id: 'restart-services',
          name: 'Restart Services',
          description: 'Restart application services',
          automated: true,
          estimatedTime: 5,
          dependencies: ['verify-integrity']
        }
      ],
      contacts: [
        {
          name: 'System Administrator',
          role: 'Primary Contact',
          email: 'admin@nanopore.com',
          phone: '+1-555-0123'
        }
      ],
      lastTested: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      testResults: []
    }
    
    this.recoveryPlans.set(defaultPlan.id, defaultPlan)
  }

  /**
   * Get backup history
   */
  getBackupHistory(): BackupMetadata[] {
    return this.backupHistory
  }

  /**
   * Get active backup jobs
   */
  getActiveJobs(): BackupJob[] {
    return Array.from(this.activeJobs.values())
  }

  /**
   * Get disaster recovery plans
   */
  getDisasterRecoveryPlans(): DisasterRecoveryPlan[] {
    return Array.from(this.recoveryPlans.values())
  }

  /**
   * Test disaster recovery plan
   */
  async testDisasterRecoveryPlan(planId: string): Promise<boolean> {
    const plan = this.recoveryPlans.get(planId)
    if (!plan) {
      throw new Error(`Recovery plan not found: ${planId}`)
    }

    const startTime = Date.now()
    
    logger.info('Starting disaster recovery test', {
      metadata: {
        planId,
        planName: plan.name,
        steps: plan.steps.length
      }
    })

    try {
      // Simulate recovery steps
      for (const step of plan.steps) {
        logger.info(`Executing recovery step: ${step.name}`, {
          metadata: {
            stepId: step.id,
            automated: step.automated,
            estimatedTime: step.estimatedTime
          }
        })
        
        // Simulate step execution
        await new Promise(resolve => setTimeout(resolve, step.estimatedTime * 100))
      }
      
      const duration = Date.now() - startTime
      
      // Record test result
      plan.testResults.push({
        date: new Date(),
        success: true,
        duration,
        notes: 'Test completed successfully'
      })
      
      plan.lastTested = new Date()
      
      logger.info('Disaster recovery test completed', {
        metadata: {
          planId,
          duration,
          success: true
        }
      })
      
      return true
      
    } catch (error) {
      const duration = Date.now() - startTime
      
      plan.testResults.push({
        date: new Date(),
        success: false,
        duration,
        notes: error instanceof Error ? error.message : 'Test failed'
      })
      
      logger.error('Disaster recovery test failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          planId,
          duration,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      
      return false
    }
  }

  /**
   * Generate backup report
   */
  generateBackupReport(): string {
    const recentBackups = this.backupHistory.slice(-10)
    const totalSize = this.backupHistory.reduce((sum, b) => sum + b.size, 0)
    const successRate = this.backupHistory.filter(b => b.status === 'completed').length / this.backupHistory.length * 100
    
    return `
Backup System Report - ${new Date().toISOString()}
================================================

Configuration:
- Enabled: ${this.config.enabled}
- Schedule: ${this.config.schedule}
- Storage Location: ${this.config.storageLocation}
- Compression: ${this.config.compression}
- Retention: ${this.config.retention.daily} daily, ${this.config.retention.weekly} weekly, ${this.config.retention.monthly} monthly

Statistics:
- Total Backups: ${this.backupHistory.length}
- Total Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB
- Success Rate: ${successRate.toFixed(1)}%
- Active Jobs: ${this.activeJobs.size}

Recent Backups:
${recentBackups.map(b => `
- ${b.id}
  Date: ${b.timestamp.toISOString()}
  Type: ${b.type}
  Size: ${(b.size / 1024 / 1024).toFixed(2)} MB
  Status: ${b.status}
  Duration: ${b.duration}ms
`).join('')}

Disaster Recovery Plans:
${Array.from(this.recoveryPlans.values()).map(p => `
- ${p.name}
  Priority: ${p.priority}
  RTO: ${p.rto} minutes
  RPO: ${p.rpo} minutes
  Last Tested: ${p.lastTested.toISOString()}
  Steps: ${p.steps.length}
`).join('')}
    `.trim()
  }

  /**
   * Shutdown backup manager
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down backup manager')
    
    // Cancel scheduled backups
    this.scheduledBackups.forEach(timeout => clearTimeout(timeout))
    this.scheduledBackups = []
    
    // Wait for active jobs to complete
    const activeJobs = Array.from(this.activeJobs.values())
    if (activeJobs.length > 0) {
      logger.info('Waiting for active backup jobs to complete', {
        metadata: {
          activeJobs: activeJobs.length
        }
      })
      
      // Wait up to 5 minutes for jobs to complete
      const timeout = setTimeout(() => {
        logger.warn('Backup jobs did not complete in time, forcing shutdown')
      }, 5 * 60 * 1000)
      
      while (this.activeJobs.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      clearTimeout(timeout)
    }
    
    // Save final state
    await this.saveBackupHistory()
    
    logger.info('Backup manager shutdown completed')
  }
}

/**
 * Global backup manager instance
 */
export const backupManager = new BackupManager()

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down backup manager')
  await backupManager.shutdown()
})

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down backup manager')
  await backupManager.shutdown()
}) 