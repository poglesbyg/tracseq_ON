import React, { useState, useEffect } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import type { UserSession } from '../../lib/auth/AdminAuth'

interface AdminLoginProps {
  onLogin: (session: UserSession) => void
  onLogout: () => void
  session: UserSession | null
}

export function AdminLogin({ onLogin, onLogout, session }: AdminLoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showLoginForm, setShowLoginForm] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password
        })
      })

      const result = await response.json()

      if (result.success) {
        // Store session in localStorage
        localStorage.setItem('adminSessionId', result.sessionId)
        
        // Also set the admin_session cookie for API authentication
        document.cookie = `admin_session=${result.sessionId}; path=/; samesite=strict; max-age=86400${location.protocol === 'https:' ? '; secure' : ''}`
        
        // Get session details
        const sessionResponse = await fetch('/api/admin/session', {
          headers: {
            'Authorization': `Bearer ${result.sessionId}`
          }
        })
        
        const sessionData = await sessionResponse.json()
        if (sessionData.success) {
          onLogin(sessionData.session)
          setShowLoginForm(false)
          setUsername('')
          setPassword('')
        }
      } else {
        setError(result.error || 'Login failed')
      }
    } catch (error) {
      setError('Connection error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    const sessionId = localStorage.getItem('adminSessionId')
    if (sessionId) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionId}`
          }
        })
      } catch (error) {
        // Ignore logout errors
      }
      localStorage.removeItem('adminSessionId')
      // Clear the admin_session cookie
      document.cookie = 'admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
    onLogout()
  }

  // Check for existing session on component mount
  useEffect(() => {
    const sessionId = localStorage.getItem('adminSessionId')
    if (sessionId && !session) {
      fetch('/api/admin/session', {
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      })
      .then(response => response.json())
      .then(result => {
        if (result.success) {
          // Set the admin_session cookie for API authentication
          document.cookie = `admin_session=${sessionId}; path=/; samesite=strict; max-age=86400${location.protocol === 'https:' ? '; secure' : ''}`
          onLogin(result.session)
        } else {
          localStorage.removeItem('adminSessionId')
          // Clear the admin_session cookie
          document.cookie = 'admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        }
      })
      .catch(() => {
        localStorage.removeItem('adminSessionId')
        // Clear the admin_session cookie
        document.cookie = 'admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      })
    }
  }, [session, onLogin])

  const formatSessionTime = (date: Date) => {
    return new Date(date).toLocaleTimeString()
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500'
      case 'user': return 'bg-blue-500'
      case 'viewer': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  if (session) {
    return (
      <Card className="p-4 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-gray-700">Admin Session Active</span>
            </div>
            <Badge variant="secondary" className={`${getRoleColor(session.role)} text-white`}>
              {session.role.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{session.username}</span>
              <span className="mx-2">•</span>
              <span>Since {formatSessionTime(session.loginTime)}</span>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Logout
            </Button>
          </div>
        </div>
        
        {/* Session details */}
        <div className="mt-3 pt-3 border-t border-blue-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">IP Address:</span>
              <span className="ml-2 font-mono">{session.ipAddress}</span>
            </div>
            <div>
              <span className="text-gray-500">Permissions:</span>
              <span className="ml-2">{session.permissions.length} granted</span>
            </div>
            <div>
              <span className="text-gray-500">Last Activity:</span>
              <span className="ml-2">{formatSessionTime(session.lastActivity)}</span>
            </div>
            <div>
              <span className="text-gray-500">Expires:</span>
              <span className="ml-2">{formatSessionTime(session.expiresAt)}</span>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 mb-6 bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-gray-400 rounded-full" />
          <span className="text-sm font-medium text-gray-700">Admin Access Required</span>
          <Badge variant="outline" className="text-xs">
            Authentication Required
          </Badge>
        </div>
        <Button
          onClick={() => setShowLoginForm(!showLoginForm)}
          variant="outline"
          size="sm"
          className="text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          {showLoginForm ? 'Cancel' : 'Admin Login'}
        </Button>
      </div>

      {showLoginForm && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full"
                />
              </div>
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">!</span>
                  </div>
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Default: admin/admin123 or operator/operator123
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </Card>
  )
}

export default AdminLogin 