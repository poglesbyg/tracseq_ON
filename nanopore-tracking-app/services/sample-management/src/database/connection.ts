import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { SampleManagementDatabase } from './schema'
import { migrateSampleManagementDatabase } from './schema'

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
    database: process.env.DB_NAME || 'sample_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000')
  }
}

// Create database connection
function createDatabaseConnection(): Kysely<SampleManagementDatabase> {
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

  return new Kysely<SampleManagementDatabase>({
    dialect: new PostgresDialect({
      pool
    })
  })
}

// Database instance
let db: Kysely<SampleManagementDatabase> | null = null

// Get database instance (singleton)
export function getDatabase(): Kysely<SampleManagementDatabase> {
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
    await migrateSampleManagementDatabase(database)
    console.log('Database migrations completed successfully')
    
    // Test connection
    await database.selectFrom('chart_fields').select('chart_field').limit(1).execute()
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
    await database.selectFrom('chart_fields').select('chart_field').limit(1).execute()
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

// Get database statistics
export async function getDatabaseStats(): Promise<{
  totalSamples: number
  samplesByStatus: Record<string, number>
  samplesByPriority: Record<string, number>
  recentSamples: number
}> {
  try {
    const database = getDatabase()
    
    // Get total samples count
    const totalSamplesResult = await database
      .selectFrom('samples')
      .select(database.fn.count('id').as('count'))
      .executeTakeFirst()
    
    const totalSamples = Number(totalSamplesResult?.count || 0)
    
    // Get samples by status
    const samplesByStatusResult = await database
      .selectFrom('samples')
      .select(['status', database.fn.count('id').as('count')])
      .groupBy('status')
      .execute()
    
    const samplesByStatus: Record<string, number> = {}
    for (const row of samplesByStatusResult) {
      samplesByStatus[row.status] = Number(row.count)
    }
    
    // Get samples by priority
    const samplesByPriorityResult = await database
      .selectFrom('samples')
      .select(['priority', database.fn.count('id').as('count')])
      .groupBy('priority')
      .execute()
    
    const samplesByPriority: Record<string, number> = {}
    for (const row of samplesByPriorityResult) {
      samplesByPriority[row.priority] = Number(row.count)
    }
    
    // Get recent samples (last 7 days)
    const recentSamplesResult = await database
      .selectFrom('samples')
      .select(database.fn.count('id').as('count'))
      .where('created_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .executeTakeFirst()
    
    const recentSamples = Number(recentSamplesResult?.count || 0)
    
    return {
      totalSamples,
      samplesByStatus,
      samplesByPriority,
      recentSamples
    }
    
  } catch (error) {
    console.error('Failed to get database stats:', error)
    return {
      totalSamples: 0,
      samplesByStatus: {},
      samplesByPriority: {},
      recentSamples: 0
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