import { db } from './database'

export async function runMigrations() {
  try {
    console.log('🔗 Starting database migrations...')

    // Drop existing table if it exists to ensure clean migration
    console.log('🗑️  Dropping existing nanopore_samples table...')
    await db.executeQuery({
      sql: `DROP TABLE IF EXISTS nanopore_samples CASCADE;`,
      parameters: []
    })

    // Create users table first (referenced by nanopore_samples)
    console.log('👤 Creating users table...')
    await db.executeQuery({
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
      parameters: []
    })

    // Insert demo user
    await db.executeQuery({
      sql: `
        INSERT INTO users (id, email, name) 
        VALUES ('550e8400-e29b-41d4-a716-446655440000', 'demo@example.com', 'Demo User') 
        ON CONFLICT (email) DO NOTHING;
      `,
      parameters: []
    })

    // Create timestamp trigger function
    console.log('⏰ Creating timestamp trigger function...')
    await db.executeQuery({
      sql: `
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `,
      parameters: []
    })

    // Create nanopore_samples table
    console.log('📄 Creating nanopore_samples table...')
    await db.executeQuery({
      sql: `
        CREATE TABLE IF NOT EXISTS nanopore_samples (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sample_name VARCHAR(255) NOT NULL,
          project_id VARCHAR(100),
          submitter_name VARCHAR(255) NOT NULL,
          submitter_email VARCHAR(255) NOT NULL,
          lab_name VARCHAR(255),
          sample_type VARCHAR(50) NOT NULL,
          sample_buffer VARCHAR(100),
          concentration DECIMAL(10,3),
          volume DECIMAL(10,2),
          total_amount DECIMAL(10,3),
          flow_cell_type VARCHAR(50),
          flow_cell_count INTEGER DEFAULT 1,
          status VARCHAR(20) DEFAULT 'submitted',
          priority VARCHAR(10) DEFAULT 'normal',
          assigned_to VARCHAR(255),
          library_prep_by VARCHAR(255),
          submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          
          CONSTRAINT valid_status CHECK (status IN ('submitted', 'prep', 'sequencing', 'analysis', 'completed', 'archived')),
          CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
          CONSTRAINT valid_concentration CHECK (concentration IS NULL OR concentration > 0),
          CONSTRAINT valid_volume CHECK (volume IS NULL OR volume > 0)
        );
      `,
      parameters: []
    })

    // Add chart_field column if it doesn't exist
    console.log('📄 Adding chart_field column...')
    try {
      await db.executeQuery({
        sql: `ALTER TABLE nanopore_samples ADD COLUMN chart_field VARCHAR(255) NOT NULL DEFAULT '';`,
        parameters: []
      })
    } catch (error) {
      console.log('⚠️  chart_field column may already exist:', error.message)
    }

    // Create indexes
    console.log('📄 Creating indexes...')
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_nanopore_samples_status ON nanopore_samples(status);',
      'CREATE INDEX IF NOT EXISTS idx_nanopore_samples_priority ON nanopore_samples(priority);',
      'CREATE INDEX IF NOT EXISTS idx_nanopore_samples_submitter ON nanopore_samples(submitter_email);',
      'CREATE INDEX IF NOT EXISTS idx_nanopore_samples_created_at ON nanopore_samples(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_nanopore_samples_chart_field ON nanopore_samples(chart_field);'
    ]

    for (const indexSql of indexes) {
      try {
        await db.executeQuery({
          sql: indexSql,
          parameters: []
        })
      } catch (error) {
        console.log(`⚠️  Index may already exist:`, error.message)
      }
    }

    // Create trigger
    console.log('📄 Creating triggers...')
    await db.executeQuery({
      sql: `
        DROP TRIGGER IF EXISTS set_timestamp ON nanopore_samples;
        CREATE TRIGGER set_timestamp BEFORE UPDATE ON nanopore_samples FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
      `,
      parameters: []
    })

    console.log('🎉 Database migrations completed successfully!')
    return { success: true, message: 'Migrations completed successfully' }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    return { success: false, message: error.message }
  }
} 