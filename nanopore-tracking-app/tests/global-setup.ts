import { chromium, FullConfig } from '@playwright/test'
import { execSync } from 'child_process'
import { logger } from '../src/lib/logger'

async function globalSetup(config: FullConfig) {
  logger.info('🧪 Starting global test setup...')
  
  try {
    // Set test environment variables
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/nanopore_test_db'
    process.env.LOG_LEVEL = 'error' // Reduce logging during tests
    
    // Setup test database
    logger.info('📊 Setting up test database...')
    try {
      execSync('npm run db:setup', { 
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
      })
      logger.info('✅ Test database setup completed')
    } catch (error) {
      logger.error('❌ Test database setup failed', {}, error as Error)
      throw error
    }
    
    // Create test data
    logger.info('📝 Creating test data...')
    await createTestData()
    
    // Verify application is running
    logger.info('🔍 Verifying application startup...')
    const browser = await chromium.launch()
    const page = await browser.newPage()
    
    try {
      await page.goto(config.projects[0].use.baseURL || 'http://localhost:3001')
      await page.waitForLoadState('networkidle')
      logger.info('✅ Application is accessible')
    } catch (error) {
      logger.error('❌ Application startup verification failed', {}, error as Error)
      throw error
    } finally {
      await browser.close()
    }
    
    logger.info('🎉 Global test setup completed successfully')
    
  } catch (error) {
    logger.error('💥 Global test setup failed', {}, error as Error)
    throw error
  }
}

async function createTestData() {
  // Import database connection
  const { db } = await import('../src/lib/database')
  
  try {
    // Create test users
    const testUsers = [
      {
        id: 'test-user-1',
        email: 'test.user@example.com',
        name: 'Test User',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'test-admin-1',
        email: 'test.admin@example.com',
        name: 'Test Admin',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'test-staff-1',
        email: 'test.staff@example.com',
        name: 'Test Staff',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]
    
    for (const user of testUsers) {
      await db
        .insertInto('users')
        .values(user)
        .onConflict((oc) => oc.column('id').doNothing())
        .execute()
    }
    
    // Create test samples
    const testSamples = [
      {
        id: 'test-sample-1',
        sample_name: 'TEST-SAMPLE-001',
        project_id: 'TEST-PROJECT-001',
        submitter_name: 'Test Submitter',
        submitter_email: 'submitter@test.com',
        lab_name: 'Test Lab',
        sample_type: 'Genomic DNA',
        status: 'submitted' as const,
        priority: 'normal' as const,
        concentration: 125.5,
        volume: 50,
        flow_cell_type: 'R10.4.1',
        flow_cell_count: 1,
        chart_field: 'HTSF-001',
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'test-user-1'
      },
      {
        id: 'test-sample-2',
        sample_name: 'TEST-SAMPLE-002',
        project_id: 'TEST-PROJECT-002',
        submitter_name: 'Test Submitter 2',
        submitter_email: 'submitter2@test.com',
        lab_name: 'Test Lab 2',
        sample_type: 'Total RNA',
        status: 'prep' as const,
        priority: 'high' as const,
        concentration: 89.2,
        volume: 30,
        flow_cell_type: 'R9.4.1',
        flow_cell_count: 1,
        chart_field: 'NANO-002',
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'test-user-1'
      }
    ]
    
    for (const sample of testSamples) {
      await db
        .insertInto('nanopore_samples')
        .values(sample)
        .onConflict((oc) => oc.column('id').doNothing())
        .execute()
    }
    
    logger.info('✅ Test data created successfully')
    
  } catch (error) {
    logger.error('❌ Test data creation failed', {}, error as Error)
    throw error
  }
}

export default globalSetup 