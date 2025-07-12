import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Component, type ReactNode, type ErrorInfo } from 'react'

import { DomainError, CrisprError, ValidationError, AIError, RepositoryError } from '../errors/domain-errors'

import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log error for debugging
    console.error('Error Boundary caught an error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  override render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Render domain-specific error UI
      return this.renderErrorUI()
    }

    return this.props.children
  }

  private renderErrorUI() {
    const { error } = this.state

    if (error instanceof DomainError) {
      return this.renderDomainError(error)
    }

    return this.renderGenericError()
  }

  private renderDomainError(error: DomainError) {
    const errorConfig = this.getErrorConfig(error)

    return (
      <div className="min-h-[400px] flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10 w-fit">
              <errorConfig.icon className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">{errorConfig.title}</CardTitle>
            <CardDescription className="text-base">
              {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorConfig.suggestions && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Suggestions:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {errorConfig.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error.context && Object.keys(error.context).length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground">
                  Technical Details
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                  {JSON.stringify(error.context, null, 2)}
                </pre>
              </details>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={this.handleRetry} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button variant="outline" onClick={this.handleGoHome}>
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  private renderGenericError() {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10 w-fit">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Something went wrong</CardTitle>
            <CardDescription className="text-base">
              An unexpected error occurred. Please try again or contact support if the problem persists.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {this.state.error && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground">
                  Error Details
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={this.handleRetry} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button variant="outline" onClick={this.handleGoHome}>
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  private getErrorConfig(error: DomainError) {
    if (error instanceof CrisprError) {
      return {
        icon: AlertTriangle,
        title: 'CRISPR Design Error',
        suggestions: [
          'Check your DNA sequence for validity',
          'Verify design parameters are within acceptable ranges',
          'Try a different target region if available',
          'Contact support if the error persists',
        ],
      }
    }

    if (error instanceof ValidationError) {
      return {
        icon: AlertTriangle,
        title: 'Validation Error',
        suggestions: [
          'Review the input requirements',
          'Check for invalid characters in DNA sequences',
          'Ensure all required fields are filled',
          'Verify parameter values are within valid ranges',
        ],
      }
    }

    if (error instanceof AIError) {
      return {
        icon: AlertTriangle,
        title: 'AI Service Error',
        suggestions: [
          'Check if Ollama is running locally',
          'Verify AI service connectivity',
          'Try again in a few moments',
          'Use manual analysis if AI is unavailable',
        ],
      }
    }

    if (error instanceof RepositoryError) {
      return {
        icon: AlertTriangle,
        title: 'Data Access Error',
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Contact support if the issue persists',
          'Your work may not have been saved',
        ],
      }
    }

    return {
      icon: AlertTriangle,
      title: 'Application Error',
      suggestions: [
        'Try refreshing the page',
        'Check your internet connection',
        'Contact support if the problem continues',
      ],
    }
  }
}

// Hook for using error boundary in functional components
export function useErrorHandler() {
  return (error: Error) => {
    // In a real application, you might want to report errors to a service
    console.error('Error caught by error handler:', error)
    
    // Re-throw to trigger error boundary
    throw error
  }
} 