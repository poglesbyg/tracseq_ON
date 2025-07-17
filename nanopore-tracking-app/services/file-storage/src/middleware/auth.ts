import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        role: string
      }
    }
  }
}

/**
 * Authentication middleware
 * Validates JWT token and extracts user information
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      // For file storage, we allow anonymous access to public files
      // but require authentication for private files
      req.user = undefined
      next()
      return
    }

    // In a real implementation, you would validate the JWT token here
    // For now, we'll simulate token validation
    try {
      // This would be replaced with actual JWT validation
      const user = await validateToken(token)
      req.user = user
      next()
    } catch (error) {
      logger.warn('Invalid token provided', { token: token.substring(0, 10) + '...' })
      req.user = undefined
      next()
    }
  } catch (error) {
    logger.error('Authentication middleware error', { error: error instanceof Error ? error.message : 'Unknown error' })
    req.user = undefined
    next()
  }
}

/**
 * Require authentication middleware
 * Ensures user is authenticated for protected routes
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }
  next()
}

/**
 * Require admin role middleware
 * Ensures user has admin privileges
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Admin privileges required'
    })
    return
  }

  next()
}

/**
 * Optional authentication middleware
 * Sets user if token is valid, but doesn't require it
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      req.user = undefined
      next()
      return
    }

    try {
      const user = await validateToken(token)
      req.user = user
    } catch (error) {
      req.user = undefined
    }

    next()
  } catch (error) {
    logger.error('Optional auth middleware error', { error: error instanceof Error ? error.message : 'Unknown error' })
    req.user = undefined
    next()
  }
}

/**
 * Rate limiting middleware for file uploads
 */
export const uploadRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  // In a real implementation, you would implement rate limiting here
  // For now, we'll just pass through
  next()
}

/**
 * File access validation middleware
 * Validates that user has access to the requested file
 */
export const validateFileAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const fileId = req.params.fileId || req.params.id
    if (!fileId) {
      next()
      return
    }

    // This would be implemented to check file access permissions
    // For now, we'll just pass through
    next()
  } catch (error) {
    logger.error('File access validation error', { error: error instanceof Error ? error.message : 'Unknown error' })
    next()
  }
}

/**
 * Mock token validation function
 * In a real implementation, this would validate JWT tokens
 */
async function validateToken(token: string): Promise<{ id: string; email: string; role: string }> {
  // This is a mock implementation
  // In a real application, you would:
  // 1. Verify the JWT signature
  // 2. Check token expiration
  // 3. Validate against a user database
  // 4. Return user information

  // For development purposes, we'll simulate a valid token
  if (token === 'mock-valid-token') {
    return {
      id: 'mock-user-id',
      email: 'user@example.com',
      role: 'user'
    }
  }

  // Simulate admin token
  if (token === 'mock-admin-token') {
    return {
      id: 'mock-admin-id',
      email: 'admin@example.com',
      role: 'admin'
    }
  }

  throw new Error('Invalid token')
}

/**
 * Extract user ID from request
 */
export const getUserId = (req: Request): string | undefined => {
  return req.user?.id
}

/**
 * Check if user is admin
 */
export const isAdmin = (req: Request): boolean => {
  return req.user?.role === 'admin'
}

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (req: Request): boolean => {
  return !!req.user
}

export default {
  authenticateToken,
  requireAuth,
  requireAdmin,
  optionalAuth,
  uploadRateLimit,
  validateFileAccess,
  getUserId,
  isAdmin,
  isAuthenticated
}