import { db } from './database'

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'staff' | 'user'
  created_at: Date
  updated_at: Date
}

export interface AuthSession {
  userId: string
  email: string
  name: string
  role: string
  expiresAt: Date
}

// Simple in-memory session store (replace with Redis in production)
const sessions = new Map<string, AuthSession>()

export class AuthService {
  async createUser(userData: {
    email: string
    name: string
    role?: 'admin' | 'staff' | 'user'
  }): Promise<User> {
    const user = await db
      .insertInto('users')
      .values({
        id: crypto.randomUUID(),
        email: userData.email,
        name: userData.name,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return {
      ...user,
      role: userData.role || 'user'
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst()

    if (!user) return null

    return {
      ...user,
      role: 'user' // Default role since we don't have roles table yet
    }
  }

  async getUserById(id: string): Promise<User | null> {
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    if (!user) return null

    return {
      ...user,
      role: 'user'
    }
  }

  // Simple session-based authentication (replace with JWT in production)
  async createSession(user: User): Promise<string> {
    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    sessions.set(sessionId, {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      expiresAt
    })

    return sessionId
  }

  async validateSession(sessionId: string): Promise<AuthSession | null> {
    const session = sessions.get(sessionId)
    
    if (!session) return null
    
    if (session.expiresAt < new Date()) {
      sessions.delete(sessionId)
      return null
    }

    return session
  }

  async destroySession(sessionId: string): Promise<void> {
    sessions.delete(sessionId)
  }

  // Simple login (in production, use proper password hashing)
  async login(email: string, password: string = 'demo'): Promise<{ user: User; sessionId: string } | null> {
    // For demo purposes, allow any email with password 'demo'
    let user = await this.getUserByEmail(email)
    
    if (!user) {
      // Auto-create user for demo
      user = await this.createUser({
        email,
        name: email.split('@')[0],
        role: 'user'
      })
    }

    if (password !== 'demo') {
      return null
    }

    const sessionId = await this.createSession(user)
    return { user, sessionId }
  }

  async logout(sessionId: string): Promise<void> {
    await this.destroySession(sessionId)
  }
}

export const authService = new AuthService()

// Middleware for tRPC context
export async function createAuthContext(request: Request) {
  const sessionId = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                   getCookieValue(request.headers.get('Cookie') || '', 'session')

  if (!sessionId) {
    return { user: null, session: null }
  }

  const session = await authService.validateSession(sessionId)
  if (!session) {
    return { user: null, session: null }
  }

  const user = await authService.getUserById(session.userId)
  return { user, session }
}

// Helper function to parse cookies
function getCookieValue(cookieString: string, name: string): string | null {
  const match = cookieString.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

// Demo users for development
export const DEMO_USERS = [
  {
    id: 'demo-user',
    email: 'demo@example.com',
    name: 'Demo User',
    role: 'user' as const
  },
  {
    id: 'admin-user',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin' as const
  },
  {
    id: 'staff-user',
    email: 'staff@example.com',
    name: 'Staff User',
    role: 'staff' as const
  }
] 