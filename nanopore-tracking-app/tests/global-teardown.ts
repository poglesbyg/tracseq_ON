import { logger } from '../src/lib/logger'

async function globalTeardown() {
  logger.info('🧹 Starting global test teardown...')
  
  try {
    // Clean up test data
    logger.info('🗑️ Cleaning up test data...')
    await cleanupTestData()
    
    // Close database connections
    logger.info('🔌 Closing database connections...')
    const { db } = await import('../src/lib/database')
    await db.destroy()
    
    logger.info('✅ Global test teardown completed successfully')
    
  } catch (error) {
    logger.error('❌ Global test teardown failed', {}, error as Error)
    // Don't throw error in teardown to avoid masking test failures
  }
}

async function cleanupTestData() {
  const { db } = await import('../src/lib/database')
  
  try {
    // Delete test samples
    await db
      .deleteFrom('nanopore_samples')
      .where('created_by', 'like', 'test-%')
      .execute()
    
    // Delete test users
    await db
      .deleteFrom('users')
      .where('id', 'like', 'test-%')
      .execute()
    
    logger.info('✅ Test data cleaned up successfully')
    
  } catch (error) {
    logger.error('❌ Test data cleanup failed', {}, error as Error)
    throw error
  }
}

export default globalTeardown 