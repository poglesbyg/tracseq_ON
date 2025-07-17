import { useState, useEffect, createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { authService, type User } from '../../lib/auth-client'
import LoginForm from './login-form'
import { toast } from 'sonner'

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthWrapperProps {
  children: ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    // Mark as hydrated once we're on the client
    setIsHydrated(true)
    
    const checkSession = async () => {
      const storedSessionId = localStorage.getItem('nanopore_session')
      if (storedSessionId) {
        const result = await authService.validateSession(storedSessionId)
        if (result) {
          setUser(result.user)
        } else {
          localStorage.removeItem('nanopore_session')
        }
      }
      setIsLoading(false)
    }

    checkSession()
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const result = await authService.login(email, password)
      if (result) {
        setUser(result.user)
        localStorage.setItem('nanopore_session', result.session.id)
        toast.success(`Welcome back, ${result.user.name}!`)
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = async () => {
    await authService.logout()
    localStorage.removeItem('nanopore_session')
    setUser(null)
    toast.success('Logged out successfully')
  }

  const contextValue: AuthContextType = {
    user,
    login,
    logout,
    isLoading
  }

  // During SSR or initial hydration, always show loading
  if (!isHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {user ? children : <LoginForm onLogin={login} />}
    </AuthContext.Provider>
  )
} 