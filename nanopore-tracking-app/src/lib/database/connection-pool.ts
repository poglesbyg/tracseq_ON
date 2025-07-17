import { Pool, type PoolConfig } from 'pg'
import { Kysely, PostgresDialect } from 'kysely'
import type { DB } from '../db/types'

interface ConnectionPoolConfig {
  minConnections: number
  maxConnections: number
  idleTimeoutMillis: number
  acquireTimeoutMillis: number
  connectionTimeoutMillis: number
  statementTimeout: number
  queryTimeout: number
  allowExitOnIdle: boolean
}

interface PoolMetrics {
  totalConnections: number
  idleConnections: number
  waitingClients: number
  activeQueries: number
  averageQueryTime: number
  connectionErrors: number
  lastError?: string
}

class DatabaseConnectionPool {
  private pool: Pool | null = null
  private kysely: Kysely<DB> | null = null
  private config: ConnectionPoolConfig
  private metrics: PoolMetrics
  private queryTimes: number[] = []
  private isShuttingDown = false

  constructor() {
    this.config = this.getPoolConfig()
    this.metrics = {
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      activeQueries: 0,
      averageQueryTime: 0,
      connectionErrors: 0
    }
  }

  private getPoolConfig(): ConnectionPoolConfig {
    return {
      minConnections: parseInt(process.env.DB_POOL_MIN || '2'), // Reduced from 5 to 2
      maxConnections: parseInt(process.env.DB_POOL_MAX || '8'), // Reduced from 20 to 8
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '20000'), // Reduced from 30000 to 20000
      acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '10000'), // Reduced from 60000 to 10000
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'), // Reduced from 10000 to 5000
      statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
      allowExitOnIdle: true // Enable exit on idle for better memory management
    }
  }

  private createPoolConfig(): PoolConfig {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required')
    }

    return {
      connectionString: databaseUrl,
      min: this.config.minConnections,
      max: this.config.maxConnections,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      statement_timeout: this.config.statementTimeout,
      query_timeout: this.config.queryTimeout,
      allowExitOnIdle: this.config.allowExitOnIdle,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    }
  }

  async initialize(): Promise<void> {
    if (this.pool) {
      return
    }

    try {
      const poolConfig = this.createPoolConfig()
      this.pool = new Pool(poolConfig)

      // Set up event handlers
      this.pool.on('connect', (client) => {
        this.metrics.totalConnections++
        console.log(`Database connection established. Total: ${this.metrics.totalConnections}`)
      })

      this.pool.on('remove', (client) => {
        this.metrics.totalConnections--
        console.log(`Database connection removed. Total: ${this.metrics.totalConnections}`)
      })

      this.pool.on('error', (err, client) => {
        this.metrics.connectionErrors++
        this.metrics.lastError = err.message
        console.error('Database connection error:', err)
      })

      // Test connection
      const client = await this.pool.connect()
      await client.query('SELECT 1')
      client.release()

      // Create Kysely instance
      this.kysely = new Kysely<DB>({
        dialect: new PostgresDialect({
          pool: this.pool
        })
      })

      console.log('Database connection pool initialized successfully')
    } catch (error) {
      console.error('Failed to initialize database connection pool:', error)
      throw error
    }
  }

  getKysely(): Kysely<DB> {
    if (!this.kysely) {
      throw new Error('Database connection pool not initialized')
    }
    return this.kysely
  }

  async executeQuery<T>(queryFn: (db: Kysely<DB>) => Promise<T>): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('Database connection pool is shutting down')
    }

    const startTime = Date.now()
    this.metrics.activeQueries++

    try {
      const result = await queryFn(this.getKysely())
      
      // Track query performance
      const queryTime = Date.now() - startTime
      this.queryTimes.push(queryTime)
      
      // Keep only last 100 query times for rolling average
      if (this.queryTimes.length > 100) {
        this.queryTimes.shift()
      }
      
      this.metrics.averageQueryTime = this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length
      
      return result
    } finally {
      this.metrics.activeQueries--
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean
    metrics: PoolMetrics
    connectionTest: boolean
    responseTime: number
  }> {
    const startTime = Date.now()
    
    try {
      // Update pool metrics
      if (this.pool) {
        this.metrics.totalConnections = this.pool.totalCount
        this.metrics.idleConnections = this.pool.idleCount
        this.metrics.waitingClients = this.pool.waitingCount
      }

      // Test database connection
      const connectionTest = await this.executeQuery(async (db) => {
        const result = await db.selectFrom('nanopore_samples')
          .select('id')
          .limit(1)
          .execute()
        return true
      })

      const responseTime = Date.now() - startTime

      return {
        healthy: true,
        metrics: { ...this.metrics },
        connectionTest,
        responseTime
      }
    } catch (error) {
      return {
        healthy: false,
        metrics: { ...this.metrics },
        connectionTest: false,
        responseTime: Date.now() - startTime
      }
    }
  }

  async getPoolStatus(): Promise<{
    totalConnections: number
    idleConnections: number
    waitingClients: number
    activeQueries: number
    averageQueryTime: number
    connectionErrors: number
    lastError?: string
  }> {
    if (this.pool) {
      this.metrics.totalConnections = this.pool.totalCount
      this.metrics.idleConnections = this.pool.idleCount
      this.metrics.waitingClients = this.pool.waitingCount
    }

    return { ...this.metrics }
  }

  async optimizePool(): Promise<void> {
    if (!this.pool) {
      return
    }

    try {
      // Close idle connections if we have too many
      if (this.metrics.idleConnections > this.config.minConnections) {
        const excessConnections = this.metrics.idleConnections - this.config.minConnections
        console.log(`Closing ${excessConnections} excess idle connections`)
        
        // Force garbage collection on idle connections
        await this.pool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = \'idle\' AND query_start < NOW() - INTERVAL \'5 minutes\' LIMIT $1', [excessConnections])
      }

      // Reset query time tracking if it gets too large
      if (this.queryTimes.length > 1000) {
        this.queryTimes = this.queryTimes.slice(-100)
      }

      console.log('Database connection pool optimized')
    } catch (error) {
      console.error('Failed to optimize database connection pool:', error)
    }
  }

  async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true
    console.log('Initiating graceful shutdown of database connection pool...')

    try {
      // Wait for active queries to complete (up to 30 seconds)
      const maxWaitTime = 30000
      const startTime = Date.now()
      
      while (this.metrics.activeQueries > 0 && (Date.now() - startTime) < maxWaitTime) {
        console.log(`Waiting for ${this.metrics.activeQueries} active queries to complete...`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      if (this.metrics.activeQueries > 0) {
        console.warn(`Force closing pool with ${this.metrics.activeQueries} active queries`)
      }

      // Close Kysely instance
      if (this.kysely) {
        await this.kysely.destroy()
        this.kysely = null
      }

      // Close pool
      if (this.pool) {
        await this.pool.end()
        this.pool = null
      }

      console.log('Database connection pool shutdown completed')
    } catch (error) {
      console.error('Error during database connection pool shutdown:', error)
      throw error
    }
  }
}

// Export singleton instance
export const connectionPool = new DatabaseConnectionPool()

// Export convenience functions
export const initializeDatabase = () => connectionPool.initialize()
export const getDatabase = () => connectionPool.getKysely()
export const executeQuery = <T>(queryFn: (db: Kysely<DB>) => Promise<T>) => connectionPool.executeQuery(queryFn)
export const getDatabaseHealth = () => connectionPool.healthCheck()
export const getPoolStatus = () => connectionPool.getPoolStatus()
export const optimizePool = () => connectionPool.optimizePool()
export const shutdownDatabase = () => connectionPool.gracefulShutdown() 