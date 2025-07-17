import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { Database } from '../types/index.js'
import { logger } from '../utils/logger.js'

// Database connection configuration
const dbConfig = {
  host: process.env.AUDIT_DB_HOST || 'localhost',
  port: parseInt(process.env.AUDIT_DB_PORT || '5432'),
  database: process.env.AUDIT_DB_NAME || 'audit_db',
  user: process.env.AUDIT_DB_USER || 'postgres',
  password: process.env.AUDIT_DB_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
}

// Create PostgreSQL connection pool
const pool = new Pool(dbConfig)

// Handle pool events
pool.on('connect', (client) => {
  logger.info('New client connected to audit database')
})

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', { error: err.message })
})

pool.on('remove', (client) => {
  logger.info('Client removed from audit database pool')
})

// Create Kysely database instance
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
})

// Database health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.selectFrom('audit_events').select(db.fn.count('id').as('count')).executeTakeFirst()
    return true
  } catch (error) {
    logger.error('Database health check failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    return false
  }
}

// Graceful shutdown function
export async function closeDatabase(): Promise<void> {
  try {
    await db.destroy()
    await pool.end()
    logger.info('Database connections closed successfully')
  } catch (error) {
    logger.error('Error closing database connections', { error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

// Database initialization function
export async function initializeDatabase(): Promise<void> {
  try {
    // Test connection
    await checkDatabaseHealth()
    logger.info('Audit database initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize audit database', { error: error instanceof Error ? error.message : 'Unknown error' })
    throw error
  }
}

// Export database instance
export default db