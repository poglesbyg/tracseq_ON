import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { register, collectDefaultMetrics } from 'prom-client'
import winston from 'winston'

// Import database and services
import { initializeDatabase, getDatabase, checkDatabaseHealth, getDatabaseStats, setupDatabaseShutdown } from './database/connection'
import { SampleRepository } from './repositories/SampleRepository'
import { SampleService } from './services/SampleService'

// Import types
import { 
  SampleStatus, 
  SamplePriority, 
  SampleType, 
  FlowCellType,
  createSampleSchema,
  updateSampleSchema,
  sampleFiltersSchema
} from './types/sample'

// Load environment variables
dotenv.config()

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'sample-management' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})

// Initialize Express app
const app = express()
const PORT = process.env.PORT || 3002

// Prometheus metrics
collectDefaultMetrics({ register })

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })
  next()
})

// Initialize services
let sampleService: SampleService

async function initializeServices() {
  try {
    // Initialize database
    await initializeDatabase()
    
    // Initialize repository and service
    const database = getDatabase()
    const sampleRepository = new SampleRepository(database)
    sampleService = new SampleService(sampleRepository)
    
    logger.info('Services initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize services:', error)
    process.exit(1)
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth()
    
    const health = {
      status: dbHealth ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'sample-management',
      version: process.env.npm_package_version || '1.0.0',
      database: dbHealth ? 'connected' : 'disconnected'
    }

    res.status(dbHealth ? 200 : 503).json(health)
  } catch (error) {
    logger.error('Health check failed:', error)
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'sample-management',
      error: 'Health check failed'
    })
  }
})

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType)
    res.end(await register.metrics())
  } catch (error) {
    logger.error('Metrics endpoint failed:', error)
    res.status(500).json({ error: 'Failed to collect metrics' })
  }
})

// API Routes

// Get all samples
app.get('/api/samples', async (req, res) => {
  try {
    const filters = req.query
    const samples = await sampleService.getAllSamples(filters as any)
    res.json(samples)
  } catch (error) {
    logger.error('Failed to get samples:', error)
    res.status(500).json({ error: 'Failed to get samples' })
  }
})

// Search samples with pagination
app.get('/api/samples/search', async (req, res) => {
  try {
    const filters = req.query
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    
    const result = await sampleService.searchSamples(filters as any, page, limit)
    res.json(result)
  } catch (error) {
    logger.error('Failed to search samples:', error)
    res.status(500).json({ error: 'Failed to search samples' })
  }
})

// Get sample by ID
app.get('/api/samples/:id', async (req, res) => {
  try {
    const { id } = req.params
    const sample = await sampleService.getSampleById(id)
    
    if (!sample) {
      return res.status(404).json({ error: 'Sample not found' })
    }
    
    res.json(sample)
  } catch (error) {
    logger.error('Failed to get sample:', error)
    res.status(500).json({ error: 'Failed to get sample' })
  }
})

// Create new sample
app.post('/api/samples', async (req, res) => {
  try {
    const sample = await sampleService.createSample(req.body)
    res.status(201).json(sample)
  } catch (error) {
    logger.error('Failed to create sample:', error)
    
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to create sample' })
    }
  }
})

// Update sample
app.put('/api/samples/:id', async (req, res) => {
  try {
    const { id } = req.params
    const sample = await sampleService.updateSample(id, req.body)
    
    if (!sample) {
      return res.status(404).json({ error: 'Sample not found' })
    }
    
    res.json(sample)
  } catch (error) {
    logger.error('Failed to update sample:', error)
    
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to update sample' })
    }
  }
})

// Delete sample
app.delete('/api/samples/:id', async (req, res) => {
  try {
    const { id } = req.params
    const deleted = await sampleService.deleteSample(id)
    
    if (!deleted) {
      return res.status(404).json({ error: 'Sample not found' })
    }
    
    res.status(204).send()
  } catch (error) {
    logger.error('Failed to delete sample:', error)
    
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to delete sample' })
    }
  }
})

// Assign sample
app.post('/api/samples/:id/assign', async (req, res) => {
  try {
    const { id } = req.params
    const { assignedTo, libraryPrepBy } = req.body
    
    const sample = await sampleService.assignSample(id, assignedTo, libraryPrepBy)
    
    if (!sample) {
      return res.status(404).json({ error: 'Sample not found' })
    }
    
    res.json(sample)
  } catch (error) {
    logger.error('Failed to assign sample:', error)
    
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to assign sample' })
    }
  }
})

// Update sample status
app.post('/api/samples/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    
    const sample = await sampleService.updateSampleStatus(id, status)
    
    if (!sample) {
      return res.status(404).json({ error: 'Sample not found' })
    }
    
    res.json(sample)
  } catch (error) {
    logger.error('Failed to update sample status:', error)
    
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to update sample status' })
    }
  }
})

// Get workflow history
app.get('/api/samples/:id/history', async (req, res) => {
  try {
    const { id } = req.params
    const history = await sampleService.getWorkflowHistory(id)
    res.json(history)
  } catch (error) {
    logger.error('Failed to get workflow history:', error)
    
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to get workflow history' })
    }
  }
})

// Get samples by status
app.get('/api/samples/status/:status', async (req, res) => {
  try {
    const { status } = req.params
    const samples = await sampleService.getSamplesByStatus(status as SampleStatus)
    res.json(samples)
  } catch (error) {
    logger.error('Failed to get samples by status:', error)
    res.status(500).json({ error: 'Failed to get samples by status' })
  }
})

// Get samples by priority
app.get('/api/samples/priority/:priority', async (req, res) => {
  try {
    const { priority } = req.params
    const samples = await sampleService.getSamplesByPriority(priority as SamplePriority)
    res.json(samples)
  } catch (error) {
    logger.error('Failed to get samples by priority:', error)
    res.status(500).json({ error: 'Failed to get samples by priority' })
  }
})

// Get samples by assignee
app.get('/api/samples/assignee/:assignee', async (req, res) => {
  try {
    const { assignee } = req.params
    const samples = await sampleService.getSamplesByAssignee(assignee)
    res.json(samples)
  } catch (error) {
    logger.error('Failed to get samples by assignee:', error)
    
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to get samples by assignee' })
    }
  }
})

// Get chart fields
app.get('/api/chart-fields', async (req, res) => {
  try {
    const chartFields = await sampleService.getActiveChartFields()
    res.json(chartFields)
  } catch (error) {
    logger.error('Failed to get chart fields:', error)
    res.status(500).json({ error: 'Failed to get chart fields' })
  }
})

// Validate chart field
app.post('/api/chart-fields/validate', async (req, res) => {
  try {
    const { chartField } = req.body
    const isValid = await sampleService.validateChartField(chartField)
    res.json({ isValid })
  } catch (error) {
    logger.error('Failed to validate chart field:', error)
    res.status(500).json({ error: 'Failed to validate chart field' })
  }
})

// Get statistics
app.get('/api/statistics', async (req, res) => {
  try {
    const stats = await sampleService.getSampleStatistics()
    res.json(stats)
  } catch (error) {
    logger.error('Failed to get statistics:', error)
    res.status(500).json({ error: 'Failed to get statistics' })
  }
})

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error)
  res.status(500).json({ error: 'Internal server error' })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// Start server
async function startServer() {
  try {
    await initializeServices()
    
    app.listen(PORT, () => {
      logger.info(`Sample Management Service started on port ${PORT}`)
      logger.info(`Health check: http://localhost:${PORT}/health`)
      logger.info(`Metrics: http://localhost:${PORT}/metrics`)
    })
    
    // Setup graceful shutdown
    setupDatabaseShutdown()
    
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the server
startServer()