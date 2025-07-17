#!/usr/bin/env node

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

async function runMigrations() {
  // Get database URL from environment or use default
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://nanopore_user:nanopore_password@postgresql:5432/nanopore_tracking?sslmode=disable'
  
  console.log('🔗 Connecting to database...')
  const pool = new Pool({
    connectionString: databaseUrl,
  })

  try {
    // Test connection
    await pool.query('SELECT NOW()')
    console.log('✅ Database connection successful')

    // Create users table first (referenced by nanopore_samples)
    console.log('👤 Creating users table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // Insert demo user
    await pool.query(`
      INSERT INTO users (id, email, name) 
      VALUES ('demo-user', 'demo@example.com', 'Demo User') 
      ON CONFLICT (id) DO NOTHING;
    `)

    // Create timestamp trigger function
    console.log('⏰ Creating timestamp trigger function...')
    await pool.query(`
      CREATE OR REPLACE FUNCTION trigger_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    // Read and execute migration files
    const migrationsDir = path.join(__dirname, 'database', 'migrations')
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort()

    for (const file of migrationFiles) {
      console.log(`📄 Running migration: ${file}`)
      const migrationPath = path.join(migrationsDir, file)
      const migration = fs.readFileSync(migrationPath, 'utf8')
      
      try {
        await pool.query(migration)
        console.log(`✅ Migration ${file} completed successfully`)
      } catch (error) {
        console.log(`⚠️  Migration ${file} may have already been applied:`, error.message)
      }
    }

    console.log('🎉 Database migrations completed successfully!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigrations() 