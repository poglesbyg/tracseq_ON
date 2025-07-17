import { Request, Response, NextFunction } from 'express'
import { authService } from '../services/auth-service'
import type { AuthSession } from '../types'

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthSession
      sessionId?: string
    }
  }
}

// Middleware to authenticate JWT tokens
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required'
      })
      return
    }

    // Verify JWT token
    const decoded = authService.verifyJWT(token)
    if (!decoded) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      })
      return
    }

    // Get session from database
    const session = await authService.validateSession(decoded.userId)
    if (!session) {
      res.status(401).json({
        success: false,
        error: 'Session expired or invalid'
      })
      return
    }

    // Attach user and session info to request
    req.user = session
    req.sessionId = decoded.userId

    next()
  } catch (error) {
    console.error('Authentication middleware error:', error)
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    })
  }
}

// Middleware to require specific roles
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      })
      return
    }

    next()
  }
}

// Middleware to require admin role
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  return requireRole(['admin'])(req, res, next)
}

// Middleware to require staff or admin role
export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  return requireRole(['admin', 'staff'])(req, res, next)
}

// Optional authentication middleware (doesn't fail if no token)
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (token) {
      const decoded = authService.verifyJWT(token)
      if (decoded) {
        const session = await authService.validateSession(decoded.userId)
        if (session) {
          req.user = session
          req.sessionId = decoded.userId
        }
      }
    }

    next()
  } catch (error) {
    // Don't fail on optional auth errors, just continue
    console.warn('Optional authentication failed:', error)
    next()
  }
}

// Rate limiting middleware for login attempts
export function createRateLimitMiddleware(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
  const attempts = new Map<string, { count: number; resetTime: number }>()

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown'
    const now = Date.now()

    const attempt = attempts.get(key)
    if (attempt && now < attempt.resetTime) {
      if (attempt.count >= maxAttempts) {
        res.status(429).json({
          success: false,
          error: `Too many requests. Please try again in ${Math.ceil((attempt.resetTime - now) / 1000)} seconds.`
        })
        return
      }
      attempt.count++
    } else {
      attempts.set(key, {
        count: 1,
        resetTime: now + windowMs
      })
    }

    next()
  }
}

// CORS middleware for authentication service
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001']
  const origin = req.headers.origin

  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  res.header('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }

  next()
}

// Error handling middleware
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('Error in authentication service:', err)

  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.message
    })
    return
  }

  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    })
    return
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  })
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    const user = req.user ? `${req.user.email} (${req.user.role})` : 'anonymous'
    
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${user} - ${req.ip}`)
  })

  next()
}

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.header('X-Content-Type-Options', 'nosniff')
  res.header('X-Frame-Options', 'DENY')
  res.header('X-XSS-Protection', '1; mode=block')
  res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'")
  
  next()
}