// Client-safe auth service - no database imports

export interface User {
  id: string
  email: string
  name?: string
  role: 'admin' | 'staff' | 'user'
}

export interface Session {
  id: string
  userId: string
  expiresAt: Date
}

class AuthServiceClient {
  async getCurrentUser(): Promise<User | null> {
    // In a real app, this would fetch from an API endpoint
    // For now, return a mock user
    return {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'staff'
    }
  }

  async login(email: string, password: string): Promise<{ user: User; session: Session }> {
    // Mock login - in real app, this would call an API
    if (email === 'demo@example.com' && password === 'demo') {
      const user: User = {
        id: 'demo-user',
        email: 'demo@example.com',
        name: 'Demo User',
        role: 'staff'
      }
      const session: Session = {
        id: 'demo-session',
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
      return { user, session }
    }
    throw new Error('Invalid credentials')
  }

  async logout(): Promise<void> {
    // In real app, this would clear the session
    console.log('Logging out...')
  }

  async validateSession(sessionId: string): Promise<{ user: User; session: Session } | null> {
    // Mock validation
    if (sessionId === 'demo-session') {
      return {
        user: {
          id: 'demo-user',
          email: 'demo@example.com',
          name: 'Demo User',
          role: 'staff'
        },
        session: {
          id: 'demo-session',
          userId: 'demo-user',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      }
    }
    return null
  }
}

export const authService = new AuthServiceClient() 