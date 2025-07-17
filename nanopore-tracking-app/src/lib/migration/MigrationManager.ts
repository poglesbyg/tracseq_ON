import { getComponentLogger } from '../logging/StructuredLogger'
import { auditLogger } from '../audit/AuditLogger'
import { db } from '../database'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { sql } from 'kysely'

const logger = getComponentLogger('MigrationManager')

/**
 * Migration direction
 */
export type MigrationDirection = 'up' | 'down'

/**
 * Migration status
 */
export type MigrationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back'

/**
 * Migration definition
 */
export interface Migration {
  id: string
  version: string
  name: string
  description: string
  filename: string
  checksum: string
  dependencies: string[]
  up: string // SQL or function for applying migration
  down: string // SQL or function for rolling back migration
  tags: string[]
  createdAt: Date
  author: string
  estimatedDuration: number // in milliseconds
  requiresDowntime: boolean
  backupRequired: boolean
}

/**
 * Migration execution result
 */
export interface MigrationResult {
  success: boolean
  migrationId: string
  version: string
  direction: MigrationDirection
  duration: number
  appliedAt: Date
  error?: string
  rollbackRequired: boolean
  affectedRows: number
  warnings: string[]
}

/**
 * Migration execution plan
 */
export interface MigrationPlan {
  migrations: Migration[]
  direction: MigrationDirection
  targetVersion: string
  estimatedDuration: number
  requiresDowntime: boolean
  backupRequired: boolean
  warnings: string[]
}

/**
 * Migration configuration
 */
export interface MigrationConfig {
  migrationsDirectory: string
  tableName: string
  lockTimeout: number
  validateChecksums: boolean
  autoBackup: boolean
  backupDirectory: string
  dryRun: boolean
  parallelExecution: boolean
  maxRetries: number
  retryDelay: number
}

/**
 * Migration execution context
 */
export interface MigrationContext {
  migration: Migration
  direction: MigrationDirection
  dryRun: boolean
  userId?: string | undefined
  username?: string | undefined
  startTime: Date
  lockAcquired: boolean
  backupCreated: boolean
}

/**
 * Migration manager
 */
export class MigrationManager {
  private config: MigrationConfig
  private isLocked: boolean = false
  private lockExpiry: Date | null = null
  private currentContext: MigrationContext | null = null

  constructor(config: Partial<MigrationConfig> = {}) {
    this.config = {
      migrationsDirectory: './migrations',
      tableName: 'schema_migrations',
      lockTimeout: 300000, // 5 minutes
      validateChecksums: true,
      autoBackup: true,
      backupDirectory: './migration-backups',
      dryRun: false,
      parallelExecution: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    }

    this.initializeMigrationSystem()
  }

  /**
   * Initialize migration system
   */
  private async initializeMigrationSystem(): Promise<void> {
    try {
      // Create migration table
      await this.createMigrationTable()
      
      // Create backup directory
      await fs.mkdir(this.config.backupDirectory, { recursive: true })
      
      // Clean up expired locks
      await this.cleanupExpiredLocks()
      
      logger.info('Migration system initialized', {
        metadata: {
          migrationsDirectory: this.config.migrationsDirectory,
          tableName: this.config.tableName,
          autoBackup: this.config.autoBackup,
          validateChecksums: this.config.validateChecksums
        }
      })
    } catch (error) {
      logger.error('Failed to initialize migration system', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Create migration tracking table
   */
  private async createMigrationTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.config.tableName} (
        id VARCHAR(255) PRIMARY KEY,
        version VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        filename VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        direction VARCHAR(10) NOT NULL DEFAULT 'up',
        applied_at TIMESTAMP,
        rolled_back_at TIMESTAMP,
        duration INTEGER,
        error_message TEXT,
        applied_by VARCHAR(255),
        rollback_reason TEXT,
        affected_rows INTEGER DEFAULT 0,
        warnings TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_version ON ${this.config.tableName}(version);
      CREATE INDEX IF NOT EXISTS idx_migrations_status ON ${this.config.tableName}(status);
      CREATE INDEX IF NOT EXISTS idx_migrations_applied_at ON ${this.config.tableName}(applied_at);
      
      CREATE TABLE IF NOT EXISTS migration_locks (
        id VARCHAR(255) PRIMARY KEY,
        acquired_at TIMESTAMP NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        acquired_by VARCHAR(255),
        operation VARCHAR(50) NOT NULL
      );
    `
    
    await sql`${sql.raw(createTableSQL)}`.execute(db as any)
  }

  /**
   * Load migrations from directory
   */
  async loadMigrations(): Promise<Migration[]> {
    try {
      const migrationsDir = this.config.migrationsDirectory
      const files = await fs.readdir(migrationsDir)
      
      const migrationFiles = files
        .filter(file => file.endsWith('.sql') || file.endsWith('.js') || file.endsWith('.ts'))
        .sort()
      
      const migrations: Migration[] = []
      
      for (const file of migrationFiles) {
        const migration = await this.loadMigrationFile(join(migrationsDir, file))
        if (migration) {
          migrations.push(migration)
        }
      }
      
      return migrations
    } catch (error) {
      logger.error('Failed to load migrations', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          migrationsDirectory: this.config.migrationsDirectory,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Load individual migration file
   */
  private async loadMigrationFile(filePath: string): Promise<Migration | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const filename = filePath.split('/').pop() || ''
      
      // Parse migration metadata from comments
      const metadata = this.parseMigrationMetadata(content, filename)
      
      // Split up and down migrations
      const { up, down } = this.splitMigrationContent(content)
      
      // Calculate checksum
      const checksum = this.calculateChecksum(content)
      
      const migration: Migration = {
        id: metadata.id,
        version: metadata.version,
        name: metadata.name,
        description: metadata.description,
        filename,
        checksum,
        dependencies: metadata.dependencies || [],
        up,
        down,
        tags: metadata.tags || [],
        createdAt: new Date(),
        author: metadata.author || 'unknown',
        estimatedDuration: metadata.estimatedDuration || 5000,
        requiresDowntime: metadata.requiresDowntime || false,
        backupRequired: metadata.backupRequired || false
      }
      
      return migration
    } catch (error) {
      logger.error('Failed to load migration file', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          filePath,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      return null
    }
  }

  /**
   * Parse migration metadata from comments
   */
  private parseMigrationMetadata(content: string, filename: string): any {
    const lines = content.split('\n')
    const metadata: any = {}
    
    // Extract version from filename (e.g., 001_create_users.sql)
    const versionMatch = filename.match(/^(\d+)_(.+)\.(sql|js|ts)$/)
    if (versionMatch && versionMatch[1] && versionMatch[2]) {
      metadata.version = versionMatch[1]
      metadata.name = versionMatch[2].replace(/_/g, ' ')
      metadata.id = `${metadata.version}_${versionMatch[2]}`
    }
    
    // Parse metadata from comments
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('--') || trimmed.startsWith('/*')) {
        const metaMatch = trimmed.match(/[@#](\w+):\s*(.+)/)
        if (metaMatch && metaMatch[1] && metaMatch[2]) {
          const key = metaMatch[1]
          const value = metaMatch[2]
          
          switch (key) {
            case 'description':
              metadata.description = value
              break
            case 'author':
              metadata.author = value
              break
            case 'dependencies':
              metadata.dependencies = value.split(',').map(d => d.trim())
              break
            case 'tags':
              metadata.tags = value.split(',').map(t => t.trim())
              break
            case 'estimatedDuration':
              metadata.estimatedDuration = parseInt(value, 10)
              break
            case 'requiresDowntime':
              metadata.requiresDowntime = value.toLowerCase() === 'true'
              break
            case 'backupRequired':
              metadata.backupRequired = value.toLowerCase() === 'true'
              break
          }
        }
      }
    }
    
    return metadata
  }

  /**
   * Split migration content into up and down parts
   */
  private splitMigrationContent(content: string): { up: string; down: string } {
    const upMatch = content.match(/-- \+goose Up([\s\S]*?)-- \+goose Down/i)
    const downMatch = content.match(/-- \+goose Down([\s\S]*?)$/i)
    
    if (upMatch && downMatch && upMatch[1] && downMatch[1]) {
      return {
        up: upMatch[1].trim(),
        down: downMatch[1].trim()
      }
    }
    
    // If no explicit up/down sections, treat entire content as up
    return {
      up: content,
      down: ''
    }
  }

  /**
   * Calculate migration checksum
   */
  private calculateChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  /**
   * Get applied migrations
   */
  async getAppliedMigrations(): Promise<Migration[]> {
    try {
      const result = await (db as any).selectFrom(this.config.tableName)
        .selectAll()
        .where('status', '=', 'completed')
        .orderBy('version', 'asc')
        .execute()
      
      return result.map((row: any) => this.mapRowToMigration(row))
    } catch (error) {
      logger.error('Failed to get applied migrations', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    try {
      const allMigrations = await this.loadMigrations()
      const appliedMigrations = await this.getAppliedMigrations()
      
      const appliedVersions = new Set(appliedMigrations.map(m => m.version))
      
      return allMigrations.filter(m => !appliedVersions.has(m.version))
    } catch (error) {
      logger.error('Failed to get pending migrations', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Create migration plan
   */
  async createMigrationPlan(targetVersion?: string, direction: MigrationDirection = 'up'): Promise<MigrationPlan> {
    try {
      const allMigrations = await this.loadMigrations()
      const appliedMigrations = await this.getAppliedMigrations()
      
      let migrations: Migration[] = []
      let estimatedDuration = 0
      let requiresDowntime = false
      let backupRequired = false
      const warnings: string[] = []
      
      if (direction === 'up') {
        const appliedVersions = new Set(appliedMigrations.map(m => m.version))
        migrations = allMigrations.filter(m => !appliedVersions.has(m.version))
        
        if (targetVersion) {
          migrations = migrations.filter(m => m.version <= targetVersion)
        }
      } else {
        // For rollback, get migrations to roll back in reverse order
        migrations = appliedMigrations.reverse()
        
        if (targetVersion) {
          migrations = migrations.filter(m => m.version > targetVersion)
        }
      }
      
      // Validate dependencies
      this.validateDependencies(migrations, direction)
      
      // Calculate totals
      for (const migration of migrations) {
        estimatedDuration += migration.estimatedDuration
        if (migration.requiresDowntime) requiresDowntime = true
        if (migration.backupRequired) backupRequired = true
      }
      
      // Add warnings
      if (requiresDowntime) {
        warnings.push('Some migrations require downtime')
      }
      if (backupRequired) {
        warnings.push('Database backup is required')
      }
      if (direction === 'down') {
        warnings.push('Rollback operations may result in data loss')
      }
      
      const finalTargetVersion = targetVersion || (migrations.length > 0 ? migrations[migrations.length - 1]?.version || '' : '')
      
      return {
        migrations,
        direction,
        targetVersion: finalTargetVersion,
        estimatedDuration,
        requiresDowntime,
        backupRequired,
        warnings
      }
    } catch (error) {
      logger.error('Failed to create migration plan', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          targetVersion,
          direction,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Validate migration dependencies
   */
  private validateDependencies(migrations: Migration[], direction: MigrationDirection): void {
    const migrationMap = new Map(migrations.map(m => [m.version, m]))
    const appliedVersions = new Set<string>()
    
    for (const migration of migrations) {
      for (const dependency of migration.dependencies) {
        if (direction === 'up') {
          if (!appliedVersions.has(dependency) && !migrationMap.has(dependency)) {
            throw new Error(`Migration ${migration.version} depends on ${dependency} which is not available`)
          }
        }
      }
      
      if (direction === 'up') {
        appliedVersions.add(migration.version)
      }
    }
  }

  /**
   * Execute migration plan
   */
  async executePlan(plan: MigrationPlan, options: {
    dryRun?: boolean
    userId?: string
    username?: string
    force?: boolean
  } = {}): Promise<MigrationResult[]> {
    const results: MigrationResult[] = []
    
    try {
      // Acquire lock
      await this.acquireLock('migration_execution', options.userId)
      
      // Create backup if required
      if (plan.backupRequired && this.config.autoBackup && !options.dryRun) {
        await this.createBackup()
      }
      
      // Execute migrations
      for (const migration of plan.migrations) {
        const result = await this.executeMigration(migration, plan.direction, {
          dryRun: options.dryRun || false,
          ...(options.userId && { userId: options.userId }),
          ...(options.username && { username: options.username })
        })
        
        results.push(result)
        
        // Stop on failure unless force is specified
        if (!result.success && !options.force) {
          break
        }
      }
      
      // Log execution summary
      await auditLogger.logAdminAction(
        'migration_plan_executed',
        {
          direction: plan.direction,
          targetVersion: plan.targetVersion,
          migrationsCount: plan.migrations.length,
          successCount: results.filter(r => r.success).length,
          failureCount: results.filter(r => !r.success).length,
          dryRun: options.dryRun || false
        },
        options.userId,
        options.username
      )
      
      return results
    } catch (error) {
      logger.error('Failed to execute migration plan', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          direction: plan.direction,
          targetVersion: plan.targetVersion,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    } finally {
      // Release lock
      await this.releaseLock()
    }
  }

  /**
   * Execute single migration
   */
  async executeMigration(migration: Migration, direction: MigrationDirection, options: {
    dryRun: boolean
    userId?: string
    username?: string
  }): Promise<MigrationResult> {
    const startTime = Date.now()
    
    try {
      logger.info(`Executing migration ${migration.version} (${direction})`, {
        metadata: {
          migrationId: migration.id,
          version: migration.version,
          direction,
          dryRun: options.dryRun
        }
      })
      
      const context: MigrationContext = {
        migration,
        direction,
        dryRun: options.dryRun,
        userId: options.userId,
        username: options.username,
        startTime: new Date(),
        lockAcquired: true,
        backupCreated: false
      }
      
      this.currentContext = context
      
      // Update migration status
      if (!options.dryRun) {
        await this.updateMigrationStatus(migration.id, 'running', direction, options.userId)
      }
      
      // Execute migration SQL
      const migrationSQL = direction === 'up' ? migration.up : migration.down
      let affectedRows = 0
      const warnings: string[] = []
      
      if (migrationSQL && !options.dryRun) {
        const result = await sql`${sql.raw(migrationSQL)}`.execute(db as any)
        // Handle different result types from Kysely
        if (Array.isArray(result)) {
          affectedRows = result.length
        } else if (result && typeof result === 'object' && 'numAffectedRows' in result) {
          affectedRows = Number(result.numAffectedRows) || 0
        }
      }
      
      const duration = Date.now() - startTime
      
      // Update migration status to completed
      if (!options.dryRun) {
        await this.updateMigrationStatus(migration.id, 'completed', direction, options.userId, duration, affectedRows, warnings)
      }
      
      const result: MigrationResult = {
        success: true,
        migrationId: migration.id,
        version: migration.version,
        direction,
        duration,
        appliedAt: new Date(),
        rollbackRequired: false,
        affectedRows,
        warnings
      }
      
      logger.info(`Migration ${migration.version} completed successfully`, {
        metadata: {
          migrationId: migration.id,
          direction,
          duration,
          affectedRows,
          dryRun: options.dryRun
        }
      })
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Update migration status to failed
      if (!options.dryRun) {
        await this.updateMigrationStatus(migration.id, 'failed', direction, options.userId, duration, 0, [], errorMessage)
      }
      
      logger.error(`Migration ${migration.version} failed`, {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          migrationId: migration.id,
          direction,
          duration,
          errorMessage,
          dryRun: options.dryRun
        }
      }, error instanceof Error ? error : undefined)
      
      return {
        success: false,
        migrationId: migration.id,
        version: migration.version,
        direction,
        duration,
        appliedAt: new Date(),
        error: errorMessage,
        rollbackRequired: direction === 'up',
        affectedRows: 0,
        warnings: []
      }
    } finally {
      this.currentContext = null
    }
  }

  /**
   * Update migration status in database
   */
  private async updateMigrationStatus(
    migrationId: string,
    status: MigrationStatus,
    direction: MigrationDirection,
    userId?: string,
    duration?: number,
    affectedRows?: number,
    warnings?: string[],
    errorMessage?: string
  ): Promise<void> {
    const updateSQL = `
      INSERT INTO ${this.config.tableName} (
        id, version, name, description, filename, checksum, status, direction,
        applied_at, duration, applied_by, affected_rows, warnings, error_message
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (id) DO UPDATE SET
        status = $7,
        direction = $8,
        applied_at = $9,
        duration = $10,
        applied_by = $11,
        affected_rows = $12,
        warnings = $13,
        error_message = $14
    `
    
    const migration = this.currentContext?.migration
    if (!migration) return
    
    await sql`${sql.raw(updateSQL)}`.execute(db as any)
  }

  /**
   * Acquire migration lock
   */
  private async acquireLock(operation: string, userId?: string): Promise<void> {
    const lockId = `migration_${operation}_${Date.now()}`
    const expiresAt = new Date(Date.now() + this.config.lockTimeout)
    
    try {
      await sql`
        INSERT INTO migration_locks (id, acquired_at, expires_at, acquired_by, operation)
        VALUES (${lockId}, ${new Date()}, ${expiresAt}, ${userId || 'system'}, ${operation})
      `.execute(db as any)
      
      this.isLocked = true
      this.lockExpiry = expiresAt
      
      logger.info('Migration lock acquired', {
        metadata: {
          lockId,
          operation,
          userId,
          expiresAt: expiresAt.toISOString()
        }
      })
    } catch (error) {
      throw new Error('Failed to acquire migration lock. Another migration may be in progress.')
    }
  }

  /**
   * Release migration lock
   */
  private async releaseLock(): Promise<void> {
    if (!this.isLocked) return
    
    try {
      await sql`DELETE FROM migration_locks WHERE expires_at < NOW()`.execute(db as any)
      this.isLocked = false
      this.lockExpiry = null
      
      logger.info('Migration lock released')
    } catch (error) {
      logger.error('Failed to release migration lock', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Clean up expired locks
   */
  private async cleanupExpiredLocks(): Promise<void> {
    try {
      await sql`DELETE FROM migration_locks WHERE expires_at < NOW()`.execute(db as any)
    } catch (error) {
      logger.error('Failed to cleanup expired locks', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Create database backup
   */
  private async createBackup(): Promise<string> {
    const backupPath = join(this.config.backupDirectory, `backup_${Date.now()}.sql`)
    
    try {
      // This is a simplified backup - in production you'd use pg_dump or similar
      logger.info('Creating database backup', {
        metadata: { backupPath }
      })
      
      // Placeholder for actual backup logic
      await fs.writeFile(backupPath, `-- Database backup created at ${new Date().toISOString()}\n`)
      
      return backupPath
    } catch (error) {
      logger.error('Failed to create database backup', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          backupPath,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Map database row to migration
   */
  private mapRowToMigration(row: any): Migration {
    return {
      id: row.id,
      version: row.version,
      name: row.name,
      description: row.description,
      filename: row.filename,
      checksum: row.checksum,
      dependencies: [],
      up: '',
      down: '',
      tags: [],
      createdAt: new Date(row.created_at),
      author: row.applied_by || 'unknown',
      estimatedDuration: row.duration || 0,
      requiresDowntime: false,
      backupRequired: false
    }
  }

  /**
   * Get migration history
   */
  async getMigrationHistory(): Promise<any[]> {
    try {
      const result = await (db as any).selectFrom(this.config.tableName)
        .selectAll()
        .orderBy('applied_at', 'desc')
        .execute()
      
      return result
    } catch (error) {
      logger.error('Failed to get migration history', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Get migration statistics
   */
  async getMigrationStats(): Promise<{
    totalMigrations: number
    appliedMigrations: number
    pendingMigrations: number
    failedMigrations: number
    lastMigration: string | null
    systemLocked: boolean
  }> {
    try {
      const [applied, pending, history] = await Promise.all([
        this.getAppliedMigrations(),
        this.getPendingMigrations(),
        this.getMigrationHistory()
      ])
      
      const failed = history.filter(h => h.status === 'failed')
      const lastMigration = history.length > 0 ? history[0].version : null
      
      return {
        totalMigrations: applied.length + pending.length,
        appliedMigrations: applied.length,
        pendingMigrations: pending.length,
        failedMigrations: failed.length,
        lastMigration,
        systemLocked: this.isLocked
      }
    } catch (error) {
      logger.error('Failed to get migration stats', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Validate migration integrity
   */
  async validateMigrations(): Promise<{
    valid: boolean
    issues: string[]
  }> {
    const issues: string[] = []
    
    try {
      if (this.config.validateChecksums) {
        const appliedMigrations = await this.getAppliedMigrations()
        const fileMigrations = await this.loadMigrations()
        
        for (const applied of appliedMigrations) {
          const file = fileMigrations.find(f => f.id === applied.id)
          if (!file) {
            issues.push(`Applied migration ${applied.version} not found in files`)
          } else if (file.checksum !== applied.checksum) {
            issues.push(`Checksum mismatch for migration ${applied.version}`)
          }
        }
      }
      
      return {
        valid: issues.length === 0,
        issues
      }
    } catch (error) {
      logger.error('Failed to validate migrations', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      
      return {
        valid: false,
        issues: ['Validation failed: ' + (error instanceof Error ? error.message : 'Unknown error')]
      }
    }
  }
}

/**
 * Global migration manager instance
 */
export const migrationManager = new MigrationManager() 