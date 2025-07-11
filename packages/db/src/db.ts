import Database from 'better-sqlite3'
import { CamelCasePlugin, Kysely, PostgresDialect, SqliteDialect } from 'kysely'
import { NeonDialect } from 'kysely-neon'
import { Pool } from 'pg'
import ws from 'ws'

import type { DB } from './types'

function setupNeonDb(connectionString: string): Kysely<DB> {
  console.log('[db] setting up neon db')

  return new Kysely<DB>({
    dialect: new NeonDialect({
      connectionString,
      webSocketConstructor: ws,
    }),
    log: ['error'],
    plugins: [new CamelCasePlugin()],
  })
}

function setupPostgresDb(connectionString: string): Kysely<DB> {
  console.log('[db] setting up postgres db')

  const pool = new Pool({
    connectionString,
  })

  // Prevent the server crashing when the pool has an error.
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err)
  })

  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool,
    }),
    log: ['error'],
    plugins: [new CamelCasePlugin()],
  })
}

function setupSqliteDb(databasePath: string): Kysely<DB> {
  console.log('[db] setting up sqlite db at:', databasePath)

  const database = new Database(databasePath)

  // Enable WAL mode for better performance
  database.pragma('journal_mode = WAL')

  return new Kysely<DB>({
    dialect: new SqliteDialect({
      database,
    }),
    log: ['error'],
    plugins: [new CamelCasePlugin()],
  })
}

export function setupDb(connectionString: string): Kysely<DB> {
  if (!connectionString) {
    throw new Error('connectionString cannot be empty')
  }

  // Check for SQLite (file path or :memory:)
  if (
    connectionString.startsWith('sqlite:') ||
    connectionString.endsWith('.db') ||
    connectionString.endsWith('.sqlite') ||
    connectionString === ':memory:'
  ) {
    const dbPath = connectionString.startsWith('sqlite:')
      ? connectionString.replace('sqlite:', '')
      : connectionString
    return setupSqliteDb(dbPath)
  }

  // Check for Neon database
  const isNeonDb = connectionString.includes('.neon.tech/')
  return isNeonDb
    ? setupNeonDb(connectionString)
    : setupPostgresDb(connectionString)
}
