import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { getComponentLogger } from '../logging/StructuredLogger'
import { applicationMetrics } from '../monitoring/MetricsCollector'
import { dbConfig } from '../config'

const logger = getComponentLogger('ServiceDatabases')

/**
 * Service-specific database schemas
 */

// Sample Service Database Schema
export interface SampleDatabase {
  nanopore_samples: {
    id: string
    sample_name: string
    project_id: string | null
    submitter_name: string
    submitter_email: string
    lab_name: string | null
    sample_type: string
    sample_buffer: string | null
    concentration: number | null
    volume: number | null
    total_amount: number | null
    flow_cell_type: string | null
    flow_cell_count: number
    status: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived'
    priority: 'low' | 'normal' | 'high' | 'urgent'
    assigned_to: string | null
    library_prep_by: string | null
    chart_field: string
    submitted_at: Date
    started_at: Date | null
    completed_at: Date | null
    created_at: Date
    updated_at: Date
    created_by: string
  }
  nanopore_sample_details: {
    id: string
    sample_id: string
    organism: string | null
    genome_size: string | null
    expected_read_length: string | null
    library_prep_kit: string | null
    barcoding_required: boolean
    barcode_kit: string | null
    run_time_hours: number | null
    basecalling_model: string | null
    special_instructions: string | null
    created_at: Date
    updated_at: Date
  }
  nanopore_processing_steps: {
    id: string
    sample_id: string
    step_name: string
    step_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
    assigned_to: string | null
    started_at: Date | null
    completed_at: Date | null
    estimated_duration_hours: number | null
    notes: string | null
    results_data: Record<string, any> | null
    created_at: Date
    updated_at: Date
  }
  nanopore_attachments: {
    id: string
    sample_id: string
    file_name: string
    file_type: string | null
    file_size_bytes: number | null
    file_path: string | null
    description: string | null
    uploaded_by: string | null
    uploaded_at: Date
    created_at: Date
  }
}

// AI Service Database Schema
export interface AIDatabase {
  ai_extraction_results: {
    id: string
    sample_id: string
    file_name: string
    extraction_method: 'llm' | 'pattern' | 'hybrid' | 'rag'
    extracted_data: Record<string, any>
    confidence_score: number
    processing_time_ms: number
    issues: string[]
    rag_insights: Record<string, any> | null
    created_at: Date
    updated_at: Date
  }
  ai_processing_jobs: {
    id: string
    job_type: 'pdf_extraction' | 'data_validation' | 'enhancement'
    status: 'pending' | 'processing' | 'completed' | 'failed'
    input_data: Record<string, any>
    output_data: Record<string, any> | null
    error_message: string | null
    started_at: Date | null
    completed_at: Date | null
    created_at: Date
    updated_at: Date
  }
  ai_model_performance: {
    id: string
    model_name: string
    task_type: string
    accuracy_score: number
    processing_time_ms: number
    sample_count: number
    timestamp: Date
    created_at: Date
  }
}

// Audit Service Database Schema
export interface AuditDatabase {
  audit_logs: {
    id: string
    event_type: string
    user_id: string | null
    resource_type: string
    resource_id: string
    action: string
    details: Record<string, any>
    ip_address: string | null
    user_agent: string | null
    timestamp: Date
    created_at: Date
  }
  compliance_reports: {
    id: string
    report_type: string
    period_start: Date
    period_end: Date
    generated_by: string
    data: Record<string, any>
    status: 'generating' | 'completed' | 'failed'
    created_at: Date
    updated_at: Date
  }
  retention_policies: {
    id: string
    resource_type: string
    retention_days: number
    archive_after_days: number | null
    delete_after_days: number | null
    is_active: boolean
    created_at: Date
    updated_at: Date
  }
}

// Backup Service Database Schema
export interface BackupDatabase {
  backup_jobs: {
    id: string
    job_type: 'full' | 'incremental' | 'differential'
    status: 'scheduled' | 'running' | 'completed' | 'failed'
    source_database: string
    backup_location: string
    file_size_bytes: number | null
    compression_enabled: boolean
    encryption_enabled: boolean
    checksum: string | null
    started_at: Date | null
    completed_at: Date | null
    error_message: string | null
    created_at: Date
    updated_at: Date
  }
  backup_schedules: {
    id: string
    name: string
    cron_expression: string
    backup_type: 'full' | 'incremental' | 'differential'
    retention_days: number
    is_active: boolean
    last_run: Date | null
    next_run: Date | null
    created_at: Date
    updated_at: Date
  }
  backup_metadata: {
    id: string
    backup_job_id: string
    table_name: string
    record_count: number
    file_path: string
    created_at: Date
  }
}

// Config Service Database Schema
export interface ConfigDatabase {
  application_configs: {
    id: string
    config_key: string
    config_value: string
    environment: 'development' | 'staging' | 'production' | 'test'
    is_encrypted: boolean
    is_sensitive: boolean
    description: string | null
    created_at: Date
    updated_at: Date
  }
  feature_flags: {
    id: string
    flag_name: string
    is_enabled: boolean
    environment: 'development' | 'staging' | 'production' | 'test'
    rollout_percentage: number
    conditions: Record<string, any> | null
    created_at: Date
    updated_at: Date
  }
  config_history: {
    id: string
    config_key: string
    old_value: string | null
    new_value: string
    changed_by: string
    change_reason: string | null
    timestamp: Date
    created_at: Date
  }
}

/**
 * Service-specific database connection managers
 */
export class ServiceDatabaseManager {
  private connections: Map<string, Kysely<any>> = new Map()
  private pools: Map<string, Pool> = new Map()

  constructor() {
    this.initializeConnections()
  }

  private initializeConnections(): void {
    // Initialize connection pools for each service
    this.createServiceConnection('samples', this.getSamplesDatabaseConfig())
    this.createServiceConnection('ai', this.getAIDatabaseConfig())
    this.createServiceConnection('audit', this.getAuditDatabaseConfig())
    this.createServiceConnection('backup', this.getBackupDatabaseConfig())
    this.createServiceConnection('config', this.getConfigDatabaseConfig())
  }

  private createServiceConnection(serviceName: string, config: any): void {
    const pool = new Pool({
      connectionString: config.url,
      max: config.maxConnections || 10,
      min: 2,
      idleTimeoutMillis: config.idleTimeout || 30000,
      connectionTimeoutMillis: config.connectionTimeout || 10000,
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: `nanopore-${serviceName}-service`
    })

    const kysely = new Kysely({
      dialect: new PostgresDialect({ pool })
    })

    this.pools.set(serviceName, pool)
    this.connections.set(serviceName, kysely)

    // Setup monitoring
    pool.on('connect', () => {
      applicationMetrics.dbConnectionsActive.inc()
    })

    pool.on('remove', () => {
      applicationMetrics.dbConnectionsActive.dec()
    })

    pool.on('error', (err) => {
      logger.error(`Database pool error for ${serviceName}`, {
        service: serviceName,
        errorType: err.name,
        metadata: { errorMessage: err.message }
      })
    })

    logger.info(`Initialized database connection for ${serviceName} service`)
  }

  // Database configuration methods
  private getSamplesDatabaseConfig() {
    return {
      url: process.env.SAMPLES_DB_URL || dbConfig.url,
      maxConnections: 20,
      idleTimeout: 30000,
      connectionTimeout: 10000
    }
  }

  private getAIDatabaseConfig() {
    return {
      url: process.env.AI_DB_URL || dbConfig.url,
      maxConnections: 15,
      idleTimeout: 30000,
      connectionTimeout: 10000
    }
  }

  private getAuditDatabaseConfig() {
    return {
      url: process.env.AUDIT_DB_URL || dbConfig.url,
      maxConnections: 10,
      idleTimeout: 30000,
      connectionTimeout: 10000
    }
  }

  private getBackupDatabaseConfig() {
    return {
      url: process.env.BACKUP_DB_URL || dbConfig.url,
      maxConnections: 5,
      idleTimeout: 30000,
      connectionTimeout: 10000
    }
  }

  private getConfigDatabaseConfig() {
    return {
      url: process.env.CONFIG_DB_URL || dbConfig.url,
      maxConnections: 5,
      idleTimeout: 30000,
      connectionTimeout: 10000
    }
  }

  // Connection getters
  getSamplesDatabase(): Kysely<SampleDatabase> {
    const connection = this.connections.get('samples')
    if (!connection) {
      throw new Error('Samples database connection not initialized')
    }
    return connection
  }

  getAIDatabase(): Kysely<AIDatabase> {
    const connection = this.connections.get('ai')
    if (!connection) {
      throw new Error('AI database connection not initialized')
    }
    return connection
  }

  getAuditDatabase(): Kysely<AuditDatabase> {
    const connection = this.connections.get('audit')
    if (!connection) {
      throw new Error('Audit database connection not initialized')
    }
    return connection
  }

  getBackupDatabase(): Kysely<BackupDatabase> {
    const connection = this.connections.get('backup')
    if (!connection) {
      throw new Error('Backup database connection not initialized')
    }
    return connection
  }

  getConfigDatabase(): Kysely<ConfigDatabase> {
    const connection = this.connections.get('config')
    if (!connection) {
      throw new Error('Config database connection not initialized')
    }
    return connection
  }

  // Health check for all service databases
  async healthCheck(): Promise<{ [service: string]: boolean }> {
    const results: { [service: string]: boolean } = {}
    
    for (const [serviceName, connection] of this.connections) {
      try {
        await connection.selectFrom('information_schema.tables')
          .select('table_name')
          .limit(1)
          .execute()
        results[serviceName] = true
      } catch (error) {
        logger.error(`Health check failed for ${serviceName} database`, {
          service: serviceName,
          errorType: error instanceof Error ? error.name : 'UnknownError',
          metadata: { errorMessage: error instanceof Error ? error.message : 'Unknown error' }
        })
        results[serviceName] = false
      }
    }

    return results
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    logger.info('Shutting down service database connections')
    
    for (const [serviceName, pool] of this.pools) {
      try {
        await pool.end()
        logger.info(`Closed database connection for ${serviceName} service`)
      } catch (error) {
        logger.error(`Error closing ${serviceName} database connection`, {
          service: serviceName,
          errorType: error instanceof Error ? error.name : 'UnknownError',
          metadata: { errorMessage: error instanceof Error ? error.message : 'Unknown error' }
        })
      }
    }

    this.connections.clear()
    this.pools.clear()
  }
}

// Singleton instance
export const serviceDatabaseManager = new ServiceDatabaseManager()

// Export individual database connections for services
export const samplesDb = () => serviceDatabaseManager.getSamplesDatabase()
export const aiDb = () => serviceDatabaseManager.getAIDatabase()
export const auditDb = () => serviceDatabaseManager.getAuditDatabase()
export const backupDb = () => serviceDatabaseManager.getBackupDatabase()
export const configDb = () => serviceDatabaseManager.getConfigDatabase() 