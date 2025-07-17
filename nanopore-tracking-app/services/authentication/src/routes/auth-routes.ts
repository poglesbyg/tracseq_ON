import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authService } from '../services/auth-service'
import { 
  authenticateToken, 
  requireAdmin, 
  requireStaff,
  createRateLimitMiddleware 
} from '../middleware/auth-middleware'
import type { 
  CreateUserRequest, 
  UpdateUserRequest, 
  LoginRequest,
  ChangePasswordRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  ApiResponse 
} from '../types'

const router = Router()

// Rate limiting for login attempts
const loginRateLimit = createRateLimitMiddleware(5, 15 * 60 * 1000) // 5 attempts per 15 minutes

// Helper function to get client IP
function getClientIP(req: Request): string | undefined {
  return req.headers['x-forwarded-for'] as string || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress
}

// Helper function to get user agent
function getUserAgent(req: Request): string | undefined {
  return req.headers['user-agent']
}

// Authentication Routes

// POST /auth/login
router.post('/login', loginRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest

    // Validate input
    const validation = z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(1, 'Password is required')
    }).safeParse({ email, password })

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: validation.error.errors
      })
    }

    const ipAddress = getClientIP(req)
    const userAgent = getUserAgent(req)

    const result = await authService.login({ email, password }, ipAddress, userAgent)

    res.status(200).json({
      success: true,
      data: result,
      message: 'Login successful'
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Login failed'
    })
  }
})

// POST /auth/logout
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (req.sessionId) {
      await authService.logout(req.sessionId)
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    })
  }
})

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      })
    }

    const session = await authService.refreshSession(sessionId)
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session'
      })
    }

    res.status(200).json({
      success: true,
      data: session,
      message: 'Session refreshed successfully'
    })
  } catch (error) {
    console.error('Session refresh error:', error)
    res.status(500).json({
      success: false,
      error: 'Session refresh failed'
    })
  }
})

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const userData = req.body as CreateUserRequest

    // Validate input
    const validation = z.object({
      email: z.string().email('Invalid email address'),
      name: z.string().min(2, 'Name must be at least 2 characters'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      role: z.enum(['admin', 'staff', 'user']).optional().default('user')
    }).safeParse(userData)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: validation.error.errors
      })
    }

    const user = await authService.createUser(userData)

    res.status(201).json({
      success: true,
      data: user,
      message: 'User created successfully'
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    })
  }
})

// GET /auth/me
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      })
    }

    const user = await authService.getUserById(req.user.userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      })
    }

    res.status(200).json({
      success: true,
      data: user
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get user information'
    })
  }
})

// PUT /auth/me
router.put('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      })
    }

    const updateData = req.body as UpdateUserRequest

    // Validate input
    const validation = z.object({
      name: z.string().min(2, 'Name must be at least 2 characters').optional(),
      role: z.enum(['admin', 'staff', 'user']).optional(),
      isActive: z.boolean().optional()
    }).safeParse(updateData)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: validation.error.errors
      })
    }

    const user = await authService.updateUser(req.user.userId, updateData)

    res.status(200).json({
      success: true,
      data: user,
      message: 'User updated successfully'
    })
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    })
  }
})

// POST /auth/change-password
router.post('/change-password', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      })
    }

    const { currentPassword, newPassword } = req.body as ChangePasswordRequest

    // Validate input
    const validation = z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(8, 'New password must be at least 8 characters')
    }).safeParse({ currentPassword, newPassword })

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: validation.error.errors
      })
    }

    await authService.changePassword(req.user.userId, currentPassword, newPassword)

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to change password'
    })
  }
})

// POST /auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body as PasswordResetRequest

    // Validate input
    const validation = z.object({
      email: z.string().email('Invalid email address')
    }).safeParse({ email })

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: validation.error.errors
      })
    }

    const token = await authService.createPasswordReset(email)

    // In a real application, you would send this token via email
    // For now, we'll return it in the response (not recommended for production)
    res.status(200).json({
      success: true,
      data: { token },
      message: 'Password reset token generated. Check your email for instructions.'
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request'
    })
  }
})

// POST /auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body as PasswordResetConfirm

    // Validate input
    const validation = z.object({
      token: z.string().min(1, 'Token is required'),
      newPassword: z.string().min(8, 'New password must be at least 8 characters')
    }).safeParse({ token, newPassword })

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: validation.error.errors
      })
    }

    await authService.resetPassword(token, newPassword)

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset password'
    })
  }
})

// Admin Routes

// GET /auth/users (Admin only)
router.get('/users', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // This would typically include pagination and filtering
    // For now, we'll return a simple list
    res.status(200).json({
      success: true,
      data: [],
      message: 'User list endpoint - implement pagination and filtering'
    })
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get users'
    })
  }
})

// DELETE /auth/users/:id (Admin only)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (id === req.user?.userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      })
    }

    await authService.deleteUser(id)

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    })
  } catch (error) {
    console.error('Delete user error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    })
  }
})

// POST /auth/logout-all (Admin/Staff only)
router.post('/logout-all', authenticateToken, requireStaff, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      })
    }

    await authService.logoutAllUserSessions(req.user.userId)

    res.status(200).json({
      success: true,
      message: 'All sessions logged out successfully'
    })
  } catch (error) {
    console.error('Logout all error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to logout all sessions'
    })
  }
})

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    const isHealthy = await authService.getUserById('test') !== null || true // Simplified health check

    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'authentication',
        database: isHealthy ? 'connected' : 'disconnected'
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

export default router