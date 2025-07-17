import { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { 
  TestTube, 
  Mail, 
  Lock, 
  Loader2, 
  AlertCircle,
  User,
  Shield
} from 'lucide-react'
import { toast } from 'sonner'

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<boolean>
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('demo')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const success = await onLogin(email, password)
      if (!success) {
        setError('Invalid email or password')
        toast.error('Login failed. Please check your credentials.')
      }
    } catch (err) {
      setError('An error occurred during login')
      toast.error('Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword('demo')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <TestTube className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Nanopore Tracking</h1>
          </div>
          <p className="text-gray-600">Sign in to access the sample tracking system</p>
        </div>

        {/* Login Form */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center space-x-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Accounts */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-lg">Demo Accounts</CardTitle>
            <CardDescription className="text-center">
              Quick access for testing (password: demo)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Button
                variant="outline"
                onClick={() => handleDemoLogin('demo@example.com')}
                className="w-full justify-start"
              >
                <User className="h-4 w-4 mr-2" />
                <span className="flex-1 text-left">Demo User</span>
                <Badge variant="secondary">User</Badge>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleDemoLogin('staff@example.com')}
                className="w-full justify-start"
              >
                <TestTube className="h-4 w-4 mr-2" />
                <span className="flex-1 text-left">Staff Member</span>
                <Badge variant="secondary">Staff</Badge>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleDemoLogin('admin@example.com')}
                className="w-full justify-start"
              >
                <Shield className="h-4 w-4 mr-2" />
                <span className="flex-1 text-left">Administrator</span>
                <Badge variant="secondary">Admin</Badge>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>© 2024 Nanopore Tracking System</p>
          <p className="mt-1">
            For support, contact{' '}
            <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
              support@example.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
} 