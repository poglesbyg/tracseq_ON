import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import type { Database } from '../types'

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'auth_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
}

// Create PostgreSQL connection pool
const pool = new Pool(dbConfig)

// Create Kysely database instance
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
})

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.selectFrom('users').select('id').limit(1).execute()
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

// Graceful shutdown function
export async function closeDatabase(): Promise<void> {
  try {
    await db.destroy()
    await pool.end()
    console.log('Database connections closed')
  } catch (error) {
    console.error('Error closing database connections:', error)
  }
}

// Cleanup functions for maintenance
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await db.selectFrom('sessions')
      .select('id')
      .where('expires_at', '<', new Date())
      .execute()
    
    if (result.length > 0) {
      await db.deleteFrom('sessions')
        .where('expires_at', '<', new Date())
        .execute()
    }
    
    return result.length
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error)
    return 0
  }
}

export async function cleanupExpiredPasswordResets(): Promise<number> {
  try {
    const result = await db.selectFrom('password_resets')
      .select('id')
      .where('expires_at', '<', new Date())
      .execute()
    
    if (result.length > 0) {
      await db.deleteFrom('password_resets')
        .where('expires_at', '<', new Date())
        .execute()
    }
    
    return result.length
  } catch (error) {
    console.error('Error cleaning up expired password resets:', error)
    return 0
  }
}

export async function cleanupOldLoginAttempts(): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    
    const result = await db.selectFrom('login_attempts')
      .select('id')
      .where('attempted_at', '<', cutoffDate)
      .execute()
    
    if (result.length > 0) {
      await db.deleteFrom('login_attempts')
        .where('attempted_at', '<', cutoffDate)
        .execute()
    }
    
    return result.length
  } catch (error) {
    console.error('Error cleaning up old login attempts:', error)
    return 0
  }
}

export async function cleanupOldAuditLogs(): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
    
    const result = await db.selectFrom('user_audit_log')
      .select('id')
      .where('created_at', '<', cutoffDate)
      .execute()
    
    if (result.length > 0) {
      await db.deleteFrom('user_audit_log')
        .where('created_at', '<', cutoffDate)
        .execute()
    }
    
    return result.length
  } catch (error) {
    console.error('Error cleaning up old audit logs:', error)
    return 0
  }
}

// Database initialization function
export async function initializeDatabase(): Promise<void> {
  try {
    // Test the connection
    await checkDatabaseHealth()
    console.log('Database connection established successfully')
    
    // Run initial cleanup
    const expiredSessions = await cleanupExpiredSessions()
    const expiredResets = await cleanupExpiredPasswordResets()
    const oldAttempts = await cleanupOldLoginAttempts()
    const oldLogs = await cleanupOldAuditLogs()
    
    console.log(`Database cleanup completed: ${expiredSessions} expired sessions, ${expiredResets} expired resets, ${oldAttempts} old attempts, ${oldLogs} old logs`)
  } catch (error) {
    console.error('Database initialization failed:', error)
    throw error
  }
}

// Export the database instance as default
export default db