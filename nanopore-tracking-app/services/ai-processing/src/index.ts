import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import multer from 'multer'
import { config } from 'dotenv'
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client'
import winston from 'winston'

// Load environment variables
config()

// Import services and repositories
import { getDatabase, initializeDatabase, setupDatabaseShutdown } from './database/connection'
import { ProcessingJobRepository } from './repositories/ProcessingJobRepository'
import { AIProcessingService } from './services/AIProcessingService'
import { 
  ProcessingStatus, 
  ProcessingType,
  processingJobSchema,
  aiExtractionRequestSchema,
  vectorSearchRequestSchema,
  formValidationRequestSchema,
  ragRequestSchema
} from './types/processing'

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-processing-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})

// Initialize Prometheus metrics
collectDefaultMetrics()

const processingJobsTotal = new Counter({
  name: 'ai_processing_jobs_total',
  help: 'Total number of processing jobs',
  labelNames: ['status', 'type']
})

const processingJobDuration = new Histogram({
  name: 'ai_processing_job_duration_seconds',
  help: 'Duration of processing jobs in seconds',
  labelNames: ['type']
})

const activeProcessingJobs = new Gauge({
  name: 'ai_processing_active_jobs',
  help: 'Number of currently active processing jobs'
})

const processingErrors = new Counter({
  name: 'ai_processing_errors_total',
  help: 'Total number of processing errors',
  labelNames: ['type']
})

// Initialize Express app
const app = express()
const PORT = process.env.PORT || 3003

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are allowed'))
    }
  }
})

// Initialize services
const db = getDatabase()
const jobRepository = new ProcessingJobRepository(db)
const aiProcessingService = new AIProcessingService(
  process.env.OLLAMA_URL || 'http://localhost:11434',
  process.env.QDRANT_URL || 'http://localhost:6333'
)

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })
  next()
})

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await aiProcessingService.checkHealth()
    const dbHealth = await db.selectFrom('processing_templates').select('name').limit(1).execute()
    
    const status = health.status === 'healthy' && dbHealth.length > 0 ? 200 : 503
    
    res.status(status).json({
      status: health.status,
      timestamp: new Date().toISOString(),
      service: 'ai-processing-service',
      version: process.env.npm_package_version || '1.0.0',
      services: health.services,
      database: dbHealth.length > 0 ? 'healthy' : 'unhealthy',
      details: health.details
    })
  } catch (error) {
    logger.error('Health check failed:', error)
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'ai-processing-service',
      error: error instanceof Error ? error.message : 'Unknown error'
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
    res.status(500).json({ error: 'Failed to generate metrics' })
  }
})

// API Routes

// Process PDF file
app.post('/api/process/pdf', upload.single('file'), async (req, res) => {
  const startTime = Date.now()
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // Validate request
    const validation = processingJobSchema.safeParse({
      fileName: req.file.originalname,
      filePath: req.file.path || 'memory',
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      processingType: req.body.processingType || ProcessingType.PDF_EXTRACTION,
      sampleId: req.body.sampleId,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined
    })

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request data', details: validation.error })
    }

    // Create processing job
    const job = await jobRepository.createJob({
      sampleId: req.body.sampleId,
      fileName: req.file.originalname,
      filePath: req.file.path || 'memory',
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      processingType: req.body.processingType || ProcessingType.PDF_EXTRACTION,
      status: ProcessingStatus.PENDING,
      progress: 0,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined
    })

    // Update job status to processing
    await jobRepository.updateJobStatus(job.id, ProcessingStatus.PROCESSING, 10)
    activeProcessingJobs.inc()

    // Process the PDF
    const result = await aiProcessingService.processPDF({
      file: req.file,
      sampleId: req.body.sampleId,
      processingType: req.body.processingType || ProcessingType.PDF_EXTRACTION,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined
    })

    // Update job with result
    await jobRepository.updateJobResult(job.id, result)
    activeProcessingJobs.dec()

    const duration = (Date.now() - startTime) / 1000
    processingJobDuration.observe({ type: job.processingType }, duration)
    processingJobsTotal.inc({ status: ProcessingStatus.COMPLETED, type: job.processingType })

    logger.info('PDF processing completed', {
      jobId: job.id,
      fileName: req.file.originalname,
      duration,
      confidence: result.confidence
    })

    res.json({
      jobId: job.id,
      status: 'completed',
      result,
      processingTime: duration
    })

  } catch (error) {
    const duration = (Date.now() - startTime) / 1000
    processingJobDuration.observe({ type: req.body.processingType || 'unknown' }, duration)
    processingErrors.inc({ type: 'pdf_processing' })
    activeProcessingJobs.dec()

    logger.error('PDF processing failed:', error)
    res.status(500).json({ 
      error: 'PDF processing failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
})

// Extract data from text using AI
app.post('/api/extract/text', async (req, res) => {
  try {
    const validation = aiExtractionRequestSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request data', details: validation.error })
    }

    const result = await aiProcessingService.extractDataFromText(req.body)
    
    processingJobsTotal.inc({ status: 'completed', type: ProcessingType.AI_EXTRACTION })

    res.json(result)
  } catch (error) {
    processingErrors.inc({ type: 'ai_extraction' })
    logger.error('AI extraction failed:', error)
    res.status(500).json({ 
      error: 'AI extraction failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
})

// Search similar documents
app.post('/api/search/similar', async (req, res) => {
  try {
    const validation = vectorSearchRequestSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request data', details: validation.error })
    }

    const results = await aiProcessingService.searchSimilarDocuments(
      req.body.query,
      req.body.limit,
      req.body.threshold
    )

    res.json({ results })
  } catch (error) {
    processingErrors.inc({ type: 'vector_search' })
    logger.error('Vector search failed:', error)
    res.status(500).json({ 
      error: 'Vector search failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
})

// Validate form data
app.post('/api/validate/form', async (req, res) => {
  try {
    const validation = formValidationRequestSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request data', details: validation.error })
    }

    const result = await aiProcessingService.validateFormData(req.body)
    res.json(result)
  } catch (error) {
    processingErrors.inc({ type: 'form_validation' })
    logger.error('Form validation failed:', error)
    res.status(500).json({ 
      error: 'Form validation failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
})

// Answer questions using RAG
app.post('/api/rag/answer', async (req, res) => {
  try {
    const validation = ragRequestSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request data', details: validation.error })
    }

    const result = await aiProcessingService.answerQuestion(req.body)
    res.json(result)
  } catch (error) {
    processingErrors.inc({ type: 'rag_question' })
    logger.error('RAG question answering failed:', error)
    res.status(500).json({ 
      error: 'RAG question answering failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
})

// Job management endpoints

// Get job by ID
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await jobRepository.getJobById(req.params.id)
    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }
    res.json(job)
  } catch (error) {
    logger.error('Failed to get job:', error)
    res.status(500).json({ error: 'Failed to get job' })
  }
})

// Get jobs by sample ID
app.get('/api/jobs/sample/:sampleId', async (req, res) => {
  try {
    const jobs = await jobRepository.getJobsBySampleId(req.params.sampleId)
    res.json({ jobs })
  } catch (error) {
    logger.error('Failed to get jobs by sample ID:', error)
    res.status(500).json({ error: 'Failed to get jobs' })
  }
})

// Get all jobs with pagination
app.get('/api/jobs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0
    const status = req.query.status as ProcessingStatus
    const type = req.query.type as ProcessingType

    let jobs: any[] = []

    if (status) {
      jobs = await jobRepository.getJobsByStatus(status)
    } else if (type) {
      jobs = await jobRepository.getJobsByType(type)
    } else {
      jobs = await jobRepository.getAllJobs(limit, offset)
    }

    res.json({ jobs })
  } catch (error) {
    logger.error('Failed to get jobs:', error)
    res.status(500).json({ error: 'Failed to get jobs' })
  }
})

// Get job statistics
app.get('/api/jobs/stats', async (req, res) => {
  try {
    const stats = await jobRepository.getJobStatistics()
    res.json(stats)
  } catch (error) {
    logger.error('Failed to get job statistics:', error)
    res.status(500).json({ error: 'Failed to get job statistics' })
  }
})

// Get service statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await aiProcessingService.getStatistics()
    res.json(stats)
  } catch (error) {
    logger.error('Failed to get service statistics:', error)
    res.status(500).json({ error: 'Failed to get service statistics' })
  }
})

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error)
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' })
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files' })
    }
  }

  res.status(500).json({ error: 'Internal server error' })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// Start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase()
    logger.info('Database initialized successfully')

    // Initialize AI Processing Service
    await aiProcessingService.initialize()
    logger.info('AI Processing Service initialized successfully')

    // Setup graceful shutdown
    setupDatabaseShutdown()

    // Start server
    app.listen(PORT, () => {
      logger.info(`AI Processing Service started on port ${PORT}`)
      logger.info(`Health check available at http://localhost:${PORT}/health`)
      logger.info(`Metrics available at http://localhost:${PORT}/metrics`)
    })

  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

startServer()