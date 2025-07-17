import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../database/connection'
import type { 
  User, 
  Session, 
  CreateUserRequest, 
  UpdateUserRequest, 
  LoginRequest, 
  LoginResponse,
  AuthSession 
} from '../types'

export class AuthService {
  private readonly jwtSecret: string
  private readonly jwtExpiresIn: string
  private readonly refreshTokenExpiresIn: string
  private readonly passwordResetExpiresIn: string
  private readonly maxLoginAttempts: number
  private readonly lockoutDuration: number

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m'
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
    this.passwordResetExpiresIn = process.env.PASSWORD_RESET_EXPIRES_IN || '1h'
    this.maxLoginAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5')
    this.lockoutDuration = parseInt(process.env.LOCKOUT_DURATION || '15') // minutes
  }

  // User Management
  async createUser(userData: CreateUserRequest): Promise<User> {
    const { email, name, password, role = 'user' } = userData

    // Check if user already exists
    const existingUser = await this.getUserByEmail(email)
    if (existingUser) {
      throw new Error('User with this email already exists')
    }

    // Hash password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Create user
    const user = await db
      .insertInto('users')
      .values({
        id: uuidv4(),
        email: email.toLowerCase(),
        name,
        password_hash: passwordHash,
        role,
        is_active: true,
        email_verified: false,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.mapDbUserToUser(user)
  }

  async getUserById(id: string): Promise<User | null> {
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .where('is_active', '=', true)
      .executeTakeFirst()

    return user ? this.mapDbUserToUser(user) : null
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email.toLowerCase())
      .where('is_active', '=', true)
      .executeTakeFirst()

    return user ? this.mapDbUserToUser(user) : null
  }

  async updateUser(id: string, updateData: UpdateUserRequest): Promise<User> {
    const updateFields: any = {
      updated_at: new Date()
    }

    if (updateData.name !== undefined) updateFields.name = updateData.name
    if (updateData.role !== undefined) updateFields.role = updateData.role
    if (updateData.isActive !== undefined) updateFields.is_active = updateData.isActive

    const user = await db
      .updateTable('users')
      .set(updateFields)
      .where('id', '=', id)
      .where('is_active', '=', true)
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.mapDbUserToUser(user)
  }

  async deleteUser(id: string): Promise<void> {
    await db
      .updateTable('users')
      .set({ is_active: false, updated_at: new Date() })
      .where('id', '=', id)
      .execute()
  }

  // Authentication
  async login(loginData: LoginRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { email, password } = loginData

    // Check for rate limiting
    await this.checkRateLimit(email, ipAddress)

    // Get user
    const user = await this.getUserByEmail(email)
    if (!user) {
      await this.recordLoginAttempt(email, ipAddress, false)
      throw new Error('Invalid credentials')
    }

    // Verify password
    const dbUser = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', user.id)
      .executeTakeFirstOrThrow()

    const isPasswordValid = await bcrypt.compare(password, dbUser.password_hash)
    if (!isPasswordValid) {
      await this.recordLoginAttempt(email, ipAddress, false)
      throw new Error('Invalid credentials')
    }

    // Update last login
    await db
      .updateTable('users')
      .set({ last_login_at: new Date(), updated_at: new Date() })
      .where('id', '=', user.id)
      .execute()

    // Create session
    const session = await this.createSession(user.id, ipAddress, userAgent)

    // Record successful login
    await this.recordLoginAttempt(email, ipAddress, true)
    await this.logUserAction(user.id, 'login', { ipAddress, userAgent })

    return {
      user: { ...user, lastLoginAt: new Date() },
      session,
      token: session.token
    }
  }

  async logout(sessionId: string): Promise<void> {
    await db
      .deleteFrom('sessions')
      .where('id', '=', sessionId)
      .execute()
  }

  async logoutAllUserSessions(userId: string): Promise<void> {
    await db
      .deleteFrom('sessions')
      .where('user_id', '=', userId)
      .execute()
  }

  // Session Management
  async createSession(userId: string, ipAddress?: string, userAgent?: string): Promise<Session> {
    const token = this.generateJWT(userId)
    const expiresAt = new Date(Date.now() + this.getTokenExpiryMs(this.refreshTokenExpiresIn))

    const session = await db
      .insertInto('sessions')
      .values({
        id: uuidv4(),
        user_id: userId,
        token,
        expires_at: expiresAt,
        user_agent: userAgent,
        ip_address: ipAddress,
        created_at: new Date(),
        last_activity_at: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.mapDbSessionToSession(session)
  }

  async validateSession(sessionId: string): Promise<AuthSession | null> {
    const session = await db
      .selectFrom('sessions')
      .innerJoin('users', 'users.id', 'sessions.user_id')
      .select([
        'sessions.id',
        'sessions.user_id',
        'sessions.expires_at',
        'users.email',
        'users.name',
        'users.role'
      ])
      .where('sessions.id', '=', sessionId)
      .where('sessions.expires_at', '>', new Date())
      .where('users.is_active', '=', true)
      .executeTakeFirst()

    if (!session) {
      return null
    }

    // Update last activity
    await db
      .updateTable('sessions')
      .set({ last_activity_at: new Date() })
      .where('id', '=', sessionId)
      .execute()

    return {
      userId: session.user_id,
      email: session.email,
      name: session.name,
      role: session.role,
      expiresAt: session.expires_at
    }
  }

  async refreshSession(sessionId: string): Promise<Session | null> {
    const session = await db
      .selectFrom('sessions')
      .where('id', '=', sessionId)
      .where('expires_at', '>', new Date())
      .executeTakeFirst()

    if (!session) {
      return null
    }

    // Generate new token
    const newToken = this.generateJWT(session.user_id)
    const newExpiresAt = new Date(Date.now() + this.getTokenExpiryMs(this.refreshTokenExpiresIn))

    const updatedSession = await db
      .updateTable('sessions')
      .set({
        token: newToken,
        expires_at: newExpiresAt,
        last_activity_at: new Date()
      })
      .where('id', '=', sessionId)
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.mapDbSessionToSession(updatedSession)
  }

  // Password Management
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .executeTakeFirstOrThrow()

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect')
    }

    const saltRounds = 12
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds)

    await db
      .updateTable('users')
      .set({
        password_hash: newPasswordHash,
        updated_at: new Date()
      })
      .where('id', '=', userId)
      .execute()

    // Log password change
    await this.logUserAction(userId, 'password_change', {})
  }

  async createPasswordReset(email: string): Promise<string> {
    const user = await this.getUserByEmail(email)
    if (!user) {
      // Don't reveal if user exists or not
      return 'reset-token-placeholder'
    }

    const token = uuidv4()
    const expiresAt = new Date(Date.now() + this.getTokenExpiryMs(this.passwordResetExpiresIn))

    await db
      .insertInto('password_resets')
      .values({
        id: uuidv4(),
        user_id: user.id,
        token,
        expires_at: expiresAt,
        created_at: new Date()
      })
      .execute()

    return token
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetRecord = await db
      .selectFrom('password_resets')
      .where('token', '=', token)
      .where('expires_at', '>', new Date())
      .where('used_at', 'is', null)
      .executeTakeFirst()

    if (!resetRecord) {
      throw new Error('Invalid or expired reset token')
    }

    const saltRounds = 12
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds)

    // Update password
    await db
      .updateTable('users')
      .set({
        password_hash: newPasswordHash,
        updated_at: new Date()
      })
      .where('id', '=', resetRecord.user_id)
      .execute()

    // Mark reset token as used
    await db
      .updateTable('password_resets')
      .set({ used_at: new Date() })
      .where('id', '=', resetRecord.id)
      .execute()

    // Log password reset
    await this.logUserAction(resetRecord.user_id, 'password_reset', {})
  }

  // JWT Operations
  generateJWT(userId: string): string {
    return jwt.sign(
      { 
        userId, 
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.getTokenExpirySeconds(this.jwtExpiresIn)
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    )
  }

  verifyJWT(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any
      return { userId: decoded.userId }
    } catch (error) {
      return null
    }
  }

  // Rate Limiting
  private async checkRateLimit(email: string, ipAddress?: string): Promise<void> {
    const cutoffTime = new Date(Date.now() - this.lockoutDuration * 60 * 1000)
    
    const recentAttempts = await db
      .selectFrom('login_attempts')
      .select('success')
      .where('email', '=', email)
      .where('attempted_at', '>', cutoffTime)
      .execute()

    const failedAttempts = recentAttempts.filter(attempt => !attempt.success).length

    if (failedAttempts >= this.maxLoginAttempts) {
      throw new Error(`Account temporarily locked. Please try again in ${this.lockoutDuration} minutes.`)
    }
  }

  private async recordLoginAttempt(email: string, ipAddress?: string, success: boolean): Promise<void> {
    await db
      .insertInto('login_attempts')
      .values({
        id: uuidv4(),
        email: email.toLowerCase(),
        ip_address: ipAddress,
        success,
        attempted_at: new Date()
      })
      .execute()
  }

  // Audit Logging
  private async logUserAction(userId: string, action: string, details: any): Promise<void> {
    await db
      .insertInto('user_audit_log')
      .values({
        id: uuidv4(),
        user_id: userId,
        action,
        details: JSON.stringify(details),
        created_at: new Date()
      })
      .execute()
  }

  // Utility Methods
  private mapDbUserToUser(dbUser: any): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      isActive: dbUser.is_active,
      emailVerified: dbUser.email_verified,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      lastLoginAt: dbUser.last_login_at
    }
  }

  private mapDbSessionToSession(dbSession: any): Session {
    return {
      id: dbSession.id,
      userId: dbSession.user_id,
      token: dbSession.token,
      expiresAt: dbSession.expires_at,
      createdAt: dbSession.created_at,
      lastActivityAt: dbSession.last_activity_at,
      userAgent: dbSession.user_agent,
      ipAddress: dbSession.ip_address
    }
  }

  private getTokenExpiryMs(expiryString: string): number {
    const unit = expiryString.slice(-1)
    const value = parseInt(expiryString.slice(0, -1))
    
    switch (unit) {
      case 's': return value * 1000
      case 'm': return value * 60 * 1000
      case 'h': return value * 60 * 60 * 1000
      case 'd': return value * 24 * 60 * 60 * 1000
      default: return 15 * 60 * 1000 // 15 minutes default
    }
  }

  private getTokenExpirySeconds(expiryString: string): number {
    return Math.floor(this.getTokenExpiryMs(expiryString) / 1000)
  }
}

export const authService = new AuthService()