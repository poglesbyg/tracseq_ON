import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { initializeDatabase, checkDatabaseHealth, closeDatabase } from './database/connection.js'
import { logger, stream } from './utils/logger.js'
import fileRoutes from './routes/files.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.FILE_STORAGE_PORT || 3004

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))

// CORS configuration
app.use(cors({
  origin: process.env.FILE_STORAGE_CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

// Compression middleware
app.use(compression())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(limiter)

// File upload specific rate limiting
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: {
    success: false,
    error: 'Too many file uploads from this IP, please try again later.'
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: true,
})

// Logging middleware
app.use(morgan('combined', { stream }))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth()
    
    res.json({
      success: true,
      service: 'File Storage Service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbHealth ? 'connected' : 'disconnected',
      version: process.env.npm_package_version || '1.0.0'
    })
  } catch (error) {
    logger.error('Health check failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(503).json({
      success: false,
      service: 'File Storage Service',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Service discovery endpoint
app.get('/discovery', (req, res) => {
  res.json({
    service: 'file-storage',
    version: process.env.npm_package_version || '1.0.0',
    endpoints: {
      health: '/health',
      files: '/api/files',
      upload: '/api/files/upload',
      download: '/api/files/:fileId/download',
      search: '/api/files/search',
      stats: '/api/files/stats',
      capabilities: '/api/files/capabilities'
    },
    capabilities: {
      fileUpload: true,
      fileDownload: true,
      fileSearch: true,
      imageProcessing: true,
      pdfProcessing: true,
      metadataExtraction: true
    }
  })
})

// API routes
app.use('/api/files', uploadLimiter, fileRoutes)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  })
})

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  })

  // Handle multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'File too large',
      maxSize: process.env.FILE_STORAGE_MAX_SIZE || '100MB'
    })
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected file field'
    })
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.message
    })
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
  })
})

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully')
  await closeDatabase()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully')
  await closeDatabase()
  process.exit(0)
})

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason })
})

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack })
  process.exit(1)
})

// Start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase()
    
    // Start listening
    app.listen(PORT, () => {
      logger.info('File Storage Service started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        storagePath: process.env.FILE_STORAGE_PATH || './storage/files',
        maxFileSize: process.env.FILE_STORAGE_MAX_SIZE || '100MB'
      })
    })
  } catch (error) {
    logger.error('Failed to start File Storage Service', { error: error instanceof Error ? error.message : 'Unknown error' })
    process.exit(1)
  }
}

// Start the server
startServer()

export default app