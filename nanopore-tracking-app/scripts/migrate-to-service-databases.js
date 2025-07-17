#!/usr/bin/env node

/**
 * Database Separation Migration Script
 * 
 * This script helps migrate from a monolithic database to service-specific databases
 * for the nanopore tracking application microservices architecture.
 */

const { Pool } = require('pg')
const fs = require('fs').promises
const path = require('path')

// Configuration
const config = {
  // Source database (current monolithic database)
  source: {
    connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/nanopore_tracking',
    ssl: process.env.NODE_ENV === 'production'
  },
  
  // Target service databases
  targets: {
    samples: {
      connectionString: process.env.SAMPLES_DB_URL || process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/nanopore_samples',
      ssl: process.env.NODE_ENV === 'production'
    },
    ai: {
      connectionString: process.env.AI_DB_URL || process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/nanopore_ai',
      ssl: process.env.NODE_ENV === 'production'
    },
    audit: {
      connectionString: process.env.AUDIT_DB_URL || process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/nanopore_audit',
      ssl: process.env.NODE_ENV === 'production'
    },
    backup: {
      connectionString: process.env.BACKUP_DB_URL || process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/nanopore_backup',
      ssl: process.env.NODE_ENV === 'production'
    },
    config: {
      connectionString: process.env.CONFIG_DB_URL || process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/nanopore_config',
      ssl: process.env.NODE_ENV === 'production'
    }
  }
}

// Database connection pools
const pools = {}

/**
 * Initialize database connections
 */
async function initializeConnections() {
  console.log('🔗 Initializing database connections...')
  
  // Source database
  pools.source = new Pool(config.source)
  
  // Target databases
  for (const [serviceName, serviceConfig] of Object.entries(config.targets)) {
    pools[serviceName] = new Pool(serviceConfig)
  }
  
  console.log('✅ Database connections initialized')
}

/**
 * Test database connections
 */
async function testConnections() {
  console.log('🧪 Testing database connections...')
  
  for (const [poolName, pool] of Object.entries(pools)) {
    try {
      await pool.query('SELECT 1')
      console.log(`✅ ${poolName} database connection successful`)
    } catch (error) {
      console.error(`❌ ${poolName} database connection failed:`, error.message)
      throw error
    }
  }
}

/**
 * Create service databases if they don't exist
 */
async function createServiceDatabases() {
  console.log('🗃️ Creating service databases...')
  
  // Note: This assumes you have permission to create databases
  // In production, databases should be created by the DBA
  
  const serviceNames = Object.keys(config.targets)
  
  for (const serviceName of serviceNames) {
    const dbName = `nanopore_${serviceName}`
    
    try {
      await pools.source.query(`CREATE DATABASE ${dbName}`)
      console.log(`✅ Created database: ${dbName}`)
    } catch (error) {
      if (error.code === '42P04') {
        console.log(`ℹ️ Database ${dbName} already exists`)
      } else {
        console.error(`❌ Failed to create database ${dbName}:`, error.message)
        throw error
      }
    }
  }
}

/**
 * Run service database migrations
 */
async function runServiceMigrations() {
  console.log('🔄 Running service database migrations...')
  
  const migrationFiles = {
    ai: 'database/service-migrations/001_create_ai_database.sql',
    audit: 'database/service-migrations/002_create_audit_database.sql',
    backup: 'database/service-migrations/003_create_backup_database.sql',
    config: 'database/service-migrations/004_create_config_database.sql'
  }
  
  for (const [serviceName, migrationFile] of Object.entries(migrationFiles)) {
    console.log(`📝 Running migration for ${serviceName} service...`)
    
    try {
      const migrationSQL = await fs.readFile(path.join(__dirname, '..', migrationFile), 'utf8')
      await pools[serviceName].query(migrationSQL)
      console.log(`✅ Migration completed for ${serviceName} service`)
    } catch (error) {
      console.error(`❌ Migration failed for ${serviceName} service:`, error.message)
      throw error
    }
  }
  
  // For samples service, we'll copy the existing schema
  console.log('📝 Setting up samples database schema...')
  await copyExistingSchema('samples')
}

/**
 * Copy existing schema to samples database
 */
async function copyExistingSchema(serviceName) {
  const tablesToCopy = [
    'nanopore_samples',
    'nanopore_sample_details',
    'nanopore_processing_steps',
    'nanopore_attachments'
  ]
  
  for (const tableName of tablesToCopy) {
    try {
      // Get table schema
      const schemaResult = await pools.source.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName])
      
      if (schemaResult.rows.length === 0) {
        console.log(`⚠️ Table ${tableName} not found in source database`)
        continue
      }
      
      // Create table in target database
      let createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (`
      
      const columns = schemaResult.rows.map(row => {
        let columnDef = `${row.column_name} ${row.data_type}`
        if (row.is_nullable === 'NO') {
          columnDef += ' NOT NULL'
        }
        if (row.column_default) {
          columnDef += ` DEFAULT ${row.column_default}`
        }
        return columnDef
      })
      
      createTableSQL += columns.join(', ')
      createTableSQL += ');'
      
      await pools[serviceName].query(createTableSQL)
      console.log(`✅ Created table ${tableName} in ${serviceName} database`)
      
    } catch (error) {
      console.error(`❌ Failed to copy table ${tableName}:`, error.message)
      throw error
    }
  }
}

/**
 * Migrate data from monolithic database to service databases
 */
async function migrateData() {
  console.log('📦 Migrating data to service databases...')
  
  // Migrate samples data
  await migrateSamplesData()
  
  // Note: AI, audit, backup, and config data will be generated fresh
  // as the old monolithic database likely doesn't have service-specific data
  
  console.log('✅ Data migration completed')
}

/**
 * Migrate samples data
 */
async function migrateSamplesData() {
  console.log('🔄 Migrating samples data...')
  
  const tablesToMigrate = [
    'nanopore_samples',
    'nanopore_sample_details',
    'nanopore_processing_steps',
    'nanopore_attachments'
  ]
  
  for (const tableName of tablesToMigrate) {
    try {
      // Get data from source
      const sourceData = await pools.source.query(`SELECT * FROM ${tableName}`)
      
      if (sourceData.rows.length === 0) {
        console.log(`ℹ️ No data found in ${tableName}`)
        continue
      }
      
      // Insert data into target
      const columns = Object.keys(sourceData.rows[0])
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
      const insertSQL = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (id) DO NOTHING
      `
      
      let insertedCount = 0
      for (const row of sourceData.rows) {
        const values = columns.map(col => row[col])
        
        try {
          await pools.samples.query(insertSQL, values)
          insertedCount++
        } catch (error) {
          console.warn(`⚠️ Failed to insert row in ${tableName}:`, error.message)
        }
      }
      
      console.log(`✅ Migrated ${insertedCount}/${sourceData.rows.length} rows from ${tableName}`)
      
    } catch (error) {
      console.error(`❌ Failed to migrate ${tableName}:`, error.message)
      throw error
    }
  }
}

/**
 * Create initial configuration data
 */
async function createInitialConfigData() {
  console.log('⚙️ Creating initial configuration data...')
  
  // This will be handled by the config database migration
  // which includes default configurations and feature flags
  
  console.log('✅ Initial configuration data created')
}

/**
 * Verify migration results
 */
async function verifyMigration() {
  console.log('🔍 Verifying migration results...')
  
  // Check samples data
  const samplesCount = await pools.samples.query('SELECT COUNT(*) FROM nanopore_samples')
  console.log(`📊 Samples database: ${samplesCount.rows[0].count} samples`)
  
  // Check AI database
  const aiTablesResult = await pools.ai.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `)
  console.log(`📊 AI database: ${aiTablesResult.rows.length} tables created`)
  
  // Check audit database
  const auditTablesResult = await pools.audit.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `)
  console.log(`📊 Audit database: ${auditTablesResult.rows.length} tables created`)
  
  // Check backup database
  const backupTablesResult = await pools.backup.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `)
  console.log(`📊 Backup database: ${backupTablesResult.rows.length} tables created`)
  
  // Check config database
  const configCount = await pools.config.query('SELECT COUNT(*) FROM application_configs')
  console.log(`📊 Config database: ${configCount.rows[0].count} configurations`)
  
  console.log('✅ Migration verification completed')
}

/**
 * Cleanup and close connections
 */
async function cleanup() {
  console.log('🧹 Cleaning up connections...')
  
  for (const [poolName, pool] of Object.entries(pools)) {
    try {
      await pool.end()
      console.log(`✅ Closed ${poolName} database connection`)
    } catch (error) {
      console.error(`❌ Failed to close ${poolName} connection:`, error.message)
    }
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting database separation migration...')
  console.log('=' .repeat(50))
  
  try {
    await initializeConnections()
    await testConnections()
    await createServiceDatabases()
    await runServiceMigrations()
    await migrateData()
    await createInitialConfigData()
    await verifyMigration()
    
    console.log('=' .repeat(50))
    console.log('🎉 Database separation migration completed successfully!')
    console.log('')
    console.log('Next steps:')
    console.log('1. Update your environment variables to use service-specific database URLs')
    console.log('2. Update your application services to use the new repositories')
    console.log('3. Test the application thoroughly')
    console.log('4. Consider setting up database monitoring for each service')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await cleanup()
  }
}

// Handle script execution
if (require.main === module) {
  main()
}

module.exports = {
  main,
  initializeConnections,
  testConnections,
  createServiceDatabases,
  runServiceMigrations,
  migrateData,
  verifyMigration,
  cleanup
} 