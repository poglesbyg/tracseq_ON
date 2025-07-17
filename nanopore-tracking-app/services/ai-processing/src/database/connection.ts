import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { AIProcessingDatabase } from './schema'
import { migrateAIProcessingDatabase } from './schema'

// Database connection configuration
interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl?: boolean
  maxConnections?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

// Get database configuration from environment variables
function getDatabaseConfig(): DatabaseConfig {
  const databaseUrl = process.env.DATABASE_URL
  
  if (databaseUrl) {
    // Parse DATABASE_URL format: postgresql://user:password@host:port/database
    const url = new URL(databaseUrl)
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1), // Remove leading slash
      user: url.username,
      password: url.password,
      ssl: url.protocol === 'postgresql+ssl:',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000')
    }
  }

  // Fallback to individual environment variables
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ai_processing_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000')
  }
}

// Create database connection
function createDatabaseConnection(): Kysely<AIProcessingDatabase> {
  const config = getDatabaseConfig()

  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: config.maxConnections,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis
  })

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err)
    process.exit(-1)
  })

  return new Kysely<AIProcessingDatabase>({
    dialect: new PostgresDialect({
      pool
    })
  })
}

// Database instance
let db: Kysely<AIProcessingDatabase> | null = null

// Get database instance (singleton)
export function getDatabase(): Kysely<AIProcessingDatabase> {
  if (!db) {
    db = createDatabaseConnection()
  }
  return db
}

// Initialize database with migrations
export async function initializeDatabase(): Promise<void> {
  try {
    const database = getDatabase()
    
    console.log('Running database migrations...')
    await migrateAIProcessingDatabase(database)
    console.log('Database migrations completed successfully')
    
    // Test connection
    await database.selectFrom('processing_templates').select('name').limit(1).execute()
    console.log('Database connection test successful')
    
  } catch (error) {
    console.error('Database initialization failed:', error)
    throw error
  }
}

// Close database connection
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy()
    db = null
    console.log('Database connection closed')
  }
}

// Health check for database
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const database = getDatabase()
    await database.selectFrom('processing_templates').select('name').limit(1).execute()
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

// Get database statistics
export async function getDatabaseStats(): Promise<{
  totalJobs: number
  jobsByStatus: Record<string, number>
  jobsByType: Record<string, number>
  recentJobs: number
  totalExtractedData: number
  totalEmbeddings: number
}> {
  try {
    const database = getDatabase()
    
    // Get total jobs count
    const totalJobsResult = await database
      .selectFrom('processing_jobs')
      .select(database.fn.count('id').as('count'))
      .executeTakeFirst()
    
    const totalJobs = Number(totalJobsResult?.count || 0)
    
    // Get jobs by status
    const jobsByStatusResult = await database
      .selectFrom('processing_jobs')
      .select(['status', database.fn.count('id').as('count')])
      .groupBy('status')
      .execute()
    
    const jobsByStatus: Record<string, number> = {}
    for (const row of jobsByStatusResult) {
      jobsByStatus[row.status] = Number(row.count)
    }
    
    // Get jobs by type
    const jobsByTypeResult = await database
      .selectFrom('processing_jobs')
      .select(['processing_type', database.fn.count('id').as('count')])
      .groupBy('processing_type')
      .execute()
    
    const jobsByType: Record<string, number> = {}
    for (const row of jobsByTypeResult) {
      jobsByType[row.processing_type] = Number(row.count)
    }
    
    // Get recent jobs (last 7 days)
    const recentJobsResult = await database
      .selectFrom('processing_jobs')
      .select(database.fn.count('id').as('count'))
      .where('created_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .executeTakeFirst()
    
    const recentJobs = Number(recentJobsResult?.count || 0)
    
    // Get total extracted data count
    const totalExtractedDataResult = await database
      .selectFrom('extracted_data')
      .select(database.fn.count('id').as('count'))
      .executeTakeFirst()
    
    const totalExtractedData = Number(totalExtractedDataResult?.count || 0)
    
    // Get total embeddings count
    const totalEmbeddingsResult = await database
      .selectFrom('vector_embeddings')
      .select(database.fn.count('id').as('count'))
      .executeTakeFirst()
    
    const totalEmbeddings = Number(totalEmbeddingsResult?.count || 0)
    
    return {
      totalJobs,
      jobsByStatus,
      jobsByType,
      recentJobs,
      totalExtractedData,
      totalEmbeddings
    }
    
  } catch (error) {
    console.error('Failed to get database stats:', error)
    return {
      totalJobs: 0,
      jobsByStatus: {},
      jobsByType: {},
      recentJobs: 0,
      totalExtractedData: 0,
      totalEmbeddings: 0
    }
  }
}

// Graceful shutdown handler
export function setupDatabaseShutdown(): void {
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, closing database connection...')
    await closeDatabase()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, closing database connection...')
    await closeDatabase()
    process.exit(0)
  })
}