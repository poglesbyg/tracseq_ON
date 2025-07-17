import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import dotenv from 'dotenv'
import { initializeDatabase, closeDatabase } from './database/connection'
import authRoutes from './routes/auth-routes'
import { 
  corsMiddleware, 
  errorHandler, 
  requestLogger, 
  securityHeaders 
} from './middleware/auth-middleware'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3004
const NODE_ENV = process.env.NODE_ENV || 'development'

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1)

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
app.use(corsMiddleware)

// Request parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Compression
app.use(compression())

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'))
} else {
  app.use(morgan('combined'))
}

// Custom request logging
app.use(requestLogger)

// Security headers
app.use(securityHeaders)

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const isHealthy = true // Simplified health check
    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'authentication',
        version: process.env.npm_package_version || '1.0.0',
        environment: NODE_ENV
      }
    })
  } catch (error) {
    console.error('Health check error:', error)
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'authentication',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
  }
})

// Service discovery endpoint
app.get('/discovery', (req, res) => {
  res.status(200).json({
    service: 'authentication',
    version: process.env.npm_package_version || '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/auth/*',
      discovery: '/discovery'
    },
    capabilities: [
      'user_management',
      'session_management',
      'jwt_authentication',
      'password_reset',
      'rate_limiting',
      'audit_logging'
    ]
  })
})

// API routes
app.use('/auth', authRoutes)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  })
})

// Error handling middleware
app.use(errorHandler)

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  await closeDatabase()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  await closeDatabase()
  process.exit(0)
})

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

// Start server
async function startServer() {
  try {
    // Initialize database
    console.log('Initializing database connection...')
    await initializeDatabase()
    console.log('Database connection established')

    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Authentication Service started on port ${PORT}`)
      console.log(`📊 Environment: ${NODE_ENV}`)
      console.log(`🔗 Health check: http://localhost:${PORT}/health`)
      console.log(`📋 Service discovery: http://localhost:${PORT}/discovery`)
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/auth`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server
startServer()

export default app