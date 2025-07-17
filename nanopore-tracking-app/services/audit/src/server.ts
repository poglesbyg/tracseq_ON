import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { initializeDatabase, closeDatabase } from './database/connection.js'
import { logger, stream } from './utils/logger.js'
import auditRoutes from './routes/index.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.AUDIT_SERVICE_PORT || 3006

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
  crossOriginEmbedderPolicy: false,
}))

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(limiter)

// Compression middleware
app.use(compression())

// Request logging
app.use(morgan('combined', { stream }))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Request ID middleware
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substr(2, 9)
  next()
})

// Request timing middleware
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.id
    })
  })
  next()
})

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    const dbHealthy = await initializeDatabase()
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'audit-service',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: dbHealthy ? 'connected' : 'disconnected'
      }
    })
  } catch (error) {
    logger.error('Health check failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'audit-service',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
  }
})

// Service discovery endpoint
app.get('/discovery', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'audit-service',
      version: process.env.npm_package_version || '1.0.0',
      endpoints: {
        health: '/health',
        events: '/api/events',
        logs: '/api/logs',
        activities: '/api/activities',
        stats: '/api/stats',
        metrics: '/api/metrics',
        reports: '/api/reports',
        alerts: '/api/alerts',
        cleanup: '/api/cleanup',
        bulk: '/api/bulk'
      },
      capabilities: [
        'audit_event_logging',
        'audit_log_management',
        'user_activity_tracking',
        'statistics_and_metrics',
        'report_generation',
        'real_time_alerting',
        'data_retention_management',
        'bulk_operations'
      ]
    }
  })
})

// API routes
app.use('/api', auditRoutes)

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Audit Service',
      description: 'Comprehensive audit logging, event tracking, and monitoring microservice',
      version: process.env.npm_package_version || '1.0.0',
      documentation: '/discovery',
      health: '/health'
    }
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    data: {
      requestedUrl: req.originalUrl,
      method: req.method,
      availableEndpoints: [
        'GET /health',
        'GET /discovery',
        'POST /api/events',
        'GET /api/events',
        'POST /api/logs',
        'GET /api/logs',
        'POST /api/activities',
        'GET /api/activities',
        'GET /api/stats',
        'GET /api/metrics',
        'POST /api/reports',
        'GET /api/reports/:reportId/generate',
        'POST /api/alerts',
        'POST /api/cleanup',
        'POST /api/bulk'
      ]
    }
  })
})

// Global error handler
app.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    requestId: req.id
  })

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(isDevelopment && { details: error.message, stack: error.stack })
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
  logger.error('Unhandled Rejection at:', {
    promise,
    reason,
    stack: reason instanceof Error ? reason.stack : undefined
  })
})

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  })
  process.exit(1)
})

// Start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase()
    
    // Start listening
    app.listen(PORT, () => {
      logger.info(`Audit Service started successfully`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      })
    })
  } catch (error) {
    logger.error('Failed to start Audit Service', { error: error instanceof Error ? error.message : 'Unknown error' })
    process.exit(1)
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
}

export default app