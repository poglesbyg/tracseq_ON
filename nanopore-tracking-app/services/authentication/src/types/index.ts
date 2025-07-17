import { z } from 'zod'

// User types
export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'staff' | 'user'
  isActive: boolean
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}

export interface CreateUserRequest {
  email: string
  name: string
  password: string
  role?: 'admin' | 'staff' | 'user'
}

export interface UpdateUserRequest {
  name?: string
  role?: 'admin' | 'staff' | 'user'
  isActive?: boolean
}

// Session types
export interface Session {
  id: string
  userId: string
  token: string
  expiresAt: Date
  createdAt: Date
  lastActivityAt: Date
  userAgent?: string
  ipAddress?: string
}

export interface AuthSession {
  userId: string
  email: string
  name: string
  role: string
  expiresAt: Date
}

// Authentication types
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  session: Session
  token: string
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface PasswordResetRequest {
  email: string
}

export interface PasswordResetConfirm {
  token: string
  newPassword: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Validation schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'staff', 'user']).optional().default('user')
})

export const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  role: z.enum(['admin', 'staff', 'user']).optional(),
  isActive: z.boolean().optional()
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
})

export const passwordResetSchema = z.object({
  email: z.string().email('Invalid email address')
})

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
})

// Database types
export interface Database {
  users: UsersTable
  sessions: SessionsTable
  password_resets: PasswordResetsTable
}

export interface UsersTable {
  id: string
  email: string
  name: string
  password_hash: string
  role: 'admin' | 'staff' | 'user'
  is_active: boolean
  email_verified: boolean
  created_at: Date
  updated_at: Date
  last_login_at?: Date
}

export interface SessionsTable {
  id: string
  user_id: string
  token: string
  expires_at: Date
  created_at: Date
  last_activity_at: Date
  user_agent?: string
  ip_address?: string
}

export interface PasswordResetsTable {
  id: string
  user_id: string
  token: string
  expires_at: Date
  created_at: Date
  used_at?: Date
}

// Service configuration
export interface AuthConfig {
  jwtSecret: string
  jwtExpiresIn: string
  refreshTokenExpiresIn: string
  passwordResetExpiresIn: string
  maxLoginAttempts: number
  lockoutDuration: number
  sessionTimeout: number
  corsOrigin: string
  databaseUrl: string
  port: number
  environment: string
}