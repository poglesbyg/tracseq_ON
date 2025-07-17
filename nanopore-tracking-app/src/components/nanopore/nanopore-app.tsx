import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Toaster } from '../ui/sonner'
import AuthWrapper from '../auth/auth-wrapper'
import NanoporeDashboard from './nanopore-dashboard'
import { TRPCProvider } from '../providers/trpc-provider'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Nanopore App Error:', error, errorInfo)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-6 space-y-4">
            <h2 className="text-2xl font-bold text-destructive">Application Error</h2>
            <p className="text-muted-foreground">
              We're sorry, but something went wrong. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Error details
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function NanoporeApp() {
  return (
    <ErrorBoundary>
      <TRPCProvider>
        <AuthWrapper>
          <div className="max-w-7xl mx-auto px-4 py-8">
            <NanoporeDashboard />
            <Toaster />
          </div>
        </AuthWrapper>
      </TRPCProvider>
    </ErrorBoundary>
  )
}
