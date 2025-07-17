import { getComponentLogger } from '../logging/StructuredLogger'
import { applicationMetrics } from '../monitoring/MetricsCollector'

const logger = getComponentLogger('AdminAuth')

/**
 * User role types
 */
export type UserRole = 'admin' | 'user' | 'viewer'

/**
 * Admin permission types
 */
export type AdminPermission = 
  | 'memory_optimization'
  | 'backup_management'
  | 'system_monitoring'
  | 'user_management'
  | 'audit_logs'
  | 'disaster_recovery'
  | 'performance_tuning'
  | 'security_settings'

/**
 * User session information
 */
export interface UserSession {
  id: string
  username: string
  role: UserRole
  permissions: AdminPermission[]
  loginTime: Date
  lastActivity: Date
  ipAddress: string
  userAgent: string
  expiresAt: Date
}

/**
 * Admin authentication configuration
 */
export interface AdminAuthConfig {
  sessionTimeout: number // in minutes
  maxLoginAttempts: number
  lockoutDuration: number // in minutes
  requireMFA: boolean
  allowedIPs?: string[]
  adminUsers: Array<{
    username: string
    passwordHash: string
    role: UserRole
    permissions: AdminPermission[]
  }>
}

/**
 * Login attempt tracking
 */
interface LoginAttempt {
  username: string
  ipAddress: string
  timestamp: Date
  success: boolean
  userAgent: string
}

/**
 * Admin authentication and authorization system
 */
export class AdminAuth {
  private config: AdminAuthConfig
  private activeSessions: Map<string, UserSession> = new Map()
  private loginAttempts: LoginAttempt[] = []
  private lockedAccounts: Map<string, Date> = new Map()
  private sessionCleanupInterval: NodeJS.Timeout

  constructor(config: Partial<AdminAuthConfig> = {}) {
    this.config = {
      sessionTimeout: 60, // 1 hour
      maxLoginAttempts: 5,
      lockoutDuration: 30, // 30 minutes
      requireMFA: false,
      adminUsers: [
        {
          username: 'admin',
          passwordHash: this.hashPassword('admin123'), // Default admin - change in production
          role: 'admin',
          permissions: [
            'memory_optimization',
            'backup_management',
            'system_monitoring',
            'user_management',
            'audit_logs',
            'disaster_recovery',
            'performance_tuning',
            'security_settings'
          ]
        },
        {
          username: 'operator',
          passwordHash: this.hashPassword('operator123'),
          role: 'user',
          permissions: [
            'memory_optimization',
            'system_monitoring',
            'backup_management'
          ]
        }
      ],
      ...config
    }

    // Setup session cleanup
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions()
    }, 5 * 60 * 1000) // Every 5 minutes

    logger.info('Admin authentication system initialized', {
      metadata: {
        sessionTimeout: this.config.sessionTimeout,
        maxLoginAttempts: this.config.maxLoginAttempts,
        adminUsers: this.config.adminUsers.length,
        requireMFA: this.config.requireMFA
      }
    })
  }

  /**
   * Authenticate user login
   */
  async login(
    username: string, 
    password: string, 
    ipAddress: string, 
    userAgent: string
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const startTime = Date.now()
    
    logger.info('Admin login attempt', {
      metadata: {
        username,
        ipAddress,
        userAgent: userAgent.substring(0, 100)
      }
    })

    try {
      // Check if account is locked
      const lockUntil = this.lockedAccounts.get(username)
      if (lockUntil && lockUntil > new Date()) {
        const remainingTime = Math.ceil((lockUntil.getTime() - Date.now()) / 1000 / 60)
        
        logger.warn('Login attempt on locked account', {
          metadata: {
            username,
            ipAddress,
            remainingLockTime: remainingTime
          }
        })
        
        return {
          success: false,
          error: `Account locked. Try again in ${remainingTime} minutes.`
        }
      }

      // Check IP whitelist if configured
      if (this.config.allowedIPs && !this.config.allowedIPs.includes(ipAddress)) {
        logger.warn('Login attempt from unauthorized IP', {
          metadata: {
            username,
            ipAddress,
            allowedIPs: this.config.allowedIPs
          }
        })
        
        return {
          success: false,
          error: 'Access denied from this IP address'
        }
      }

      // Find user
      const user = this.config.adminUsers.find(u => u.username === username)
      if (!user) {
        this.recordLoginAttempt(username, ipAddress, userAgent, false)
        
        logger.warn('Login attempt with invalid username', {
          metadata: {
            username,
            ipAddress
          }
        })
        
        return {
          success: false,
          error: 'Invalid username or password'
        }
      }

      // Verify password
      const passwordValid = this.verifyPassword(password, user.passwordHash)
      if (!passwordValid) {
        this.recordLoginAttempt(username, ipAddress, userAgent, false)
        this.checkForAccountLockout(username)
        
        logger.warn('Login attempt with invalid password', {
          metadata: {
            username,
            ipAddress
          }
        })
        
        return {
          success: false,
          error: 'Invalid username or password'
        }
      }

      // Create session
      const sessionId = this.generateSessionId()
      const session: UserSession = {
        id: sessionId,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        loginTime: new Date(),
        lastActivity: new Date(),
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + this.config.sessionTimeout * 60 * 1000)
      }

      this.activeSessions.set(sessionId, session)
      this.recordLoginAttempt(username, ipAddress, userAgent, true)
      
      // Clear any lockout
      this.lockedAccounts.delete(username)

      logger.info('Admin login successful', {
        metadata: {
          username,
          sessionId,
          role: user.role,
          permissions: user.permissions.length,
          duration: Date.now() - startTime
        }
      })

      return {
        success: true,
        sessionId
      }

    } catch (error) {
      logger.error('Admin login error', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          username,
          ipAddress,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)

      applicationMetrics.recordError('admin_login_error', 'AdminAuth')

      return {
        success: false,
        error: 'Login failed due to system error'
      }
    }
  }

  /**
   * Logout user session
   */
  async logout(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (session) {
      this.activeSessions.delete(sessionId)
      
      logger.info('Admin logout', {
        metadata: {
          username: session.username,
          sessionId,
          sessionDuration: Date.now() - session.loginTime.getTime()
        }
      })
    }
  }

  /**
   * Validate session and check permissions
   */
  async validateSession(sessionId: string): Promise<UserSession | null> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      return null
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      this.activeSessions.delete(sessionId)
      
      logger.info('Session expired', {
        metadata: {
          username: session.username,
          sessionId
        }
      })
      
      return null
    }

    // Update last activity
    session.lastActivity = new Date()
    
    return session
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(session: UserSession, permission: AdminPermission): boolean {
    return session.permissions.includes(permission)
  }

  /**
   * Check if user has admin role
   */
  isAdmin(session: UserSession): boolean {
    return session.role === 'admin'
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): UserSession[] {
    return Array.from(this.activeSessions.values())
  }

  /**
   * Get recent login attempts
   */
  getLoginAttempts(limit: number = 50): LoginAttempt[] {
    return this.loginAttempts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * Simple password hashing (use proper hashing in production)
   */
  private hashPassword(password: string): string {
    // This is a simple hash - use bcrypt or similar in production
    return Buffer.from(password + 'salt').toString('base64')
  }

  /**
   * Verify password against hash
   */
  private verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash
  }

  /**
   * Record login attempt
   */
  private recordLoginAttempt(
    username: string, 
    ipAddress: string, 
    userAgent: string, 
    success: boolean
  ): void {
    const attempt: LoginAttempt = {
      username,
      ipAddress,
      timestamp: new Date(),
      success,
      userAgent
    }

    this.loginAttempts.push(attempt)
    
    // Keep only last 1000 attempts
    if (this.loginAttempts.length > 1000) {
      this.loginAttempts = this.loginAttempts.slice(-1000)
    }
  }

  /**
   * Check for account lockout
   */
  private checkForAccountLockout(username: string): void {
    const recentAttempts = this.loginAttempts
      .filter(a => 
        a.username === username && 
        !a.success &&
        a.timestamp > new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
      )

    if (recentAttempts.length >= this.config.maxLoginAttempts) {
      const lockUntil = new Date(Date.now() + this.config.lockoutDuration * 60 * 1000)
      this.lockedAccounts.set(username, lockUntil)
      
      logger.warn('Account locked due to too many failed attempts', {
        metadata: {
          username,
          failedAttempts: recentAttempts.length,
          lockUntil: lockUntil.toISOString()
        }
      })
    }
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date()
    let cleanedCount = 0

    for (const [sessionId, session] of this.activeSessions) {
      if (session.expiresAt < now) {
        this.activeSessions.delete(sessionId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired sessions', {
        metadata: {
          cleanedCount,
          activeSessions: this.activeSessions.size
        }
      })
    }
  }

  /**
   * Get security stats
   */
  getSecurityStats(): {
    activeSessions: number
    totalLoginAttempts: number
    successfulLogins: number
    failedLogins: number
    lockedAccounts: number
  } {
    const successfulLogins = this.loginAttempts.filter(a => a.success).length
    const failedLogins = this.loginAttempts.filter(a => !a.success).length

    return {
      activeSessions: this.activeSessions.size,
      totalLoginAttempts: this.loginAttempts.length,
      successfulLogins,
      failedLogins,
      lockedAccounts: this.lockedAccounts.size
    }
  }

  /**
   * Shutdown admin auth system
   */
  shutdown(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval)
    }
    
    logger.info('Admin authentication system shutdown', {
      metadata: {
        activeSessions: this.activeSessions.size
      }
    })
  }
}

/**
 * Global admin auth instance
 */
export const adminAuth = new AdminAuth()

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down admin auth')
  adminAuth.shutdown()
})

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down admin auth')
  adminAuth.shutdown()
}) 