import { Kysely, PostgresDialect } from 'kysely'
import { Pool, type PoolClient } from 'pg'
import { dbConfig } from './config'
import { getComponentLogger } from './logging/StructuredLogger'
import { applicationMetrics } from './monitoring/MetricsCollector'

const logger = getComponentLogger('Database')

// Database types (should match your schema)
export interface Database {
  users: {
    id: string
    email: string
    name: string
    created_at: Date
    updated_at: Date
  }
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

/**
 * Enhanced database connection pool with monitoring and retry logic
 */
class DatabaseManager {
  private pool: Pool
  private kysely: Kysely<Database>
  private healthCheckInterval: NodeJS.Timeout | null = null
  private isShuttingDown = false
  private connectionStats = {
    totalConnections: 0,
    totalErrors: 0,
    totalQueries: 0,
    slowQueries: 0,
    healthChecksPassed: 0,
    healthChecksFailed: 0,
    lastHealthCheck: null as Date | null
  }

  constructor() {
    this.pool = new Pool({
      connectionString: dbConfig.url,
      max: dbConfig.maxConnections || 20,
      min: 5,
      idleTimeoutMillis: dbConfig.idleTimeout || 30000,
      connectionTimeoutMillis: dbConfig.connectionTimeout || 10000,
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: 'nanopore-tracking-app'
    })

    this.setupPoolEventHandlers()
    this.createKyselyInstance()
    this.startHealthMonitoring()
  }

  /**
   * Setup connection pool event handlers
   */
  private setupPoolEventHandlers(): void {
    this.pool.on('connect', (client: PoolClient) => {
      this.connectionStats.totalConnections++
      applicationMetrics.dbConnectionsActive.inc()
      
      logger.debug('Database connection established', {
        metadata: {
          totalConnections: this.connectionStats.totalConnections,
          activeConnections: this.pool.totalCount
        }
      })
    })

    this.pool.on('acquire', (client: PoolClient) => {
      // Connection acquired from pool
    })

    this.pool.on('release', (client: PoolClient) => {
      // Connection released back to pool
    })

    this.pool.on('remove', (client: PoolClient) => {
      this.connectionStats.totalConnections--
      applicationMetrics.dbConnectionsActive.dec()
      
      logger.debug('Database connection removed', {
        metadata: {
          totalConnections: this.connectionStats.totalConnections,
          reason: 'connection_removed'
        }
      })
    })

    this.pool.on('error', (err: Error, client: PoolClient) => {
      this.connectionStats.totalErrors++
      
      logger.error('Database pool error', {
        errorType: err.name,
        metadata: {
          totalErrors: this.connectionStats.totalErrors,
          errorMessage: err.message
        }
      }, err)
      
      applicationMetrics.recordError('database_pool_error', 'DatabaseManager')
    })
  }

  /**
   * Create Kysely instance with enhanced logging
   */
  private createKyselyInstance(): void {
    const dialect = new PostgresDialect({
      pool: this.pool
    })

    this.kysely = new Kysely<Database>({
      dialect,
      log: (event) => {
        const duration = event.queryDurationMillis || 0
        
        if (event.level === 'query') {
          this.connectionStats.totalQueries++
          
          if (duration > 1000) {
            this.connectionStats.slowQueries++
            
            logger.warn('Slow database query detected', {
              duration,
              metadata: {
                sql: event.query.sql,
                parameters: event.query.parameters,
                slowQueryThreshold: 1000
              }
            })
          }
          
          // Record metrics
          const operation = this.extractOperation(event.query.sql)
          const table = this.extractTable(event.query.sql)
          applicationMetrics.recordDatabaseQuery(operation, table, duration / 1000)
        }
        
        if (event.level === 'error') {
          this.connectionStats.totalErrors++
          
          logger.error('Database query error', {
            errorType: 'query_error',
            metadata: {
              sql: event.query.sql,
              parameters: event.query.parameters,
              error: event.error
            }
          })
          
          applicationMetrics.recordError('database_query_error', 'DatabaseManager')
        }
      }
    })
  }

  /**
   * Extract operation type from SQL query
   */
  private extractOperation(sql: string): string {
    const match = sql.trim().match(/^(\w+)/i)
    return match ? match[1].toLowerCase() : 'unknown'
  }

  /**
   * Extract table name from SQL query
   */
  private extractTable(sql: string): string {
    const selectMatch = sql.match(/from\s+["`']?(\w+)["`']?/i)
    const insertMatch = sql.match(/insert\s+into\s+["`']?(\w+)["`']?/i)
    const updateMatch = sql.match(/update\s+["`']?(\w+)["`']?/i)
    const deleteMatch = sql.match(/delete\s+from\s+["`']?(\w+)["`']?/i)
    
    const match = selectMatch || insertMatch || updateMatch || deleteMatch
    return match ? match[1] : 'unknown'
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck()
    }, 30000) // Check every 30 seconds
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = Date.now()
      
      // Test basic connectivity and query capability
      await this.pool.query('SELECT 1 as health_check')
      
      const responseTime = Date.now() - startTime
      this.connectionStats.healthChecksPassed++
      this.connectionStats.lastHealthCheck = new Date()
      
      logger.debug('Database health check passed', {
        responseTime,
        metadata: {
          totalHealthChecks: this.connectionStats.healthChecksPassed + this.connectionStats.healthChecksFailed,
          connectionCount: this.pool.totalCount
        }
      })
      
    } catch (error) {
      this.connectionStats.healthChecksFailed++
      
      logger.error('Database health check failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          connectionCount: this.pool.totalCount,
          totalHealthChecks: this.connectionStats.healthChecksPassed + this.connectionStats.healthChecksFailed
        }
      }, error instanceof Error ? error : undefined)
      
      applicationMetrics.recordError('database_health_check_error', 'DatabaseManager')
    }
  }

  /**
   * Execute query with retry logic
   */
  public async executeWithRetry<T>(
    queryFn: (kysely: Kysely<Database>) => Promise<T>,
    operation: string = 'query',
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null
    let delay = 1000
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await queryFn(this.kysely)
        
        if (attempt > 1) {
          logger.info('Database operation succeeded after retry', {
            operation,
            attempt,
            metadata: {
              totalAttempts: attempt
            }
          })
        }
        
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown database error')
        
        if (attempt === maxRetries) {
          logger.error('Database operation failed after all retries', {
            operation,
            attempt,
            errorType: lastError.name,
            metadata: {
              maxAttempts: maxRetries,
              errorMessage: lastError.message
            }
          }, lastError)
          
          applicationMetrics.recordError('database_operation_failed', 'DatabaseManager')
          break
        }
        
        logger.warn('Database operation failed, retrying', {
          operation,
          attempt,
          delay,
          errorType: lastError.name,
          metadata: {
            maxAttempts: maxRetries
          }
        })
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= 2
      }
    }
    
    throw lastError || new Error('Database operation failed after retries')
  }

  /**
   * Get database instance
   */
  public getDatabase(): Kysely<Database> {
    return this.kysely
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return {
      ...this.connectionStats,
      activeConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
      maxConnections: this.pool.options.max || 20
    }
  }

  /**
   * Test database connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.executeWithRetry(async (db) => {
        await db.selectFrom('nanopore_samples').select('id').limit(1).execute()
      }, 'connection_test', 1)
      return true
    } catch (error) {
      logger.error('Database connection test failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      return false
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }
    
    this.isShuttingDown = true
    
    logger.info('Shutting down database connection manager')
    
    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    
    // Close all connections
    try {
      await this.pool.end()
      logger.info('Database connection pool closed successfully')
    } catch (error) {
      logger.error('Error closing database connection pool', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
    }
  }
}

// Create global database manager instance
const databaseManager = new DatabaseManager()

// Export the database instance
export const db = databaseManager.getDatabase()

// Export helper functions
export async function executeWithRetry<T>(
  queryFn: (kysely: Kysely<Database>) => Promise<T>,
  operation?: string
): Promise<T> {
  return databaseManager.executeWithRetry(queryFn, operation)
}

export function getDatabaseStats() {
  return databaseManager.getStats()
}

export async function testDatabaseConnection(): Promise<boolean> {
  return databaseManager.testConnection()
}

export async function shutdownDatabase(): Promise<void> {
  await databaseManager.shutdown()
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down database connections')
  await shutdownDatabase()
})

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down database connections')
  await shutdownDatabase()
}) 