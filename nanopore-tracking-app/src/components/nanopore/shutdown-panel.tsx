import React, { useState, useEffect } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import type { UserSession } from '../../lib/auth/AdminAuth'

interface ShutdownHook {
  name: string
  priority: number
  timeout: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime?: Date
  endTime?: Date
  error?: string
}

interface ShutdownStatus {
  isShuttingDown: boolean
  progress: number
  currentPhase: string
  hooks: ShutdownHook[]
  startTime?: Date
  estimatedTimeRemaining?: number
}

interface ShutdownData {
  status: ShutdownStatus
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

interface ShutdownPanelProps {
  adminSession: UserSession | null
}

export function ShutdownPanel({ adminSession }: ShutdownPanelProps) {
  const [shutdownData, setShutdownData] = useState<ShutdownData>({
    status: {
      isShuttingDown: false,
      progress: 0,
      currentPhase: 'idle',
      hooks: []
    },
    loading: false,
    error: null,
    lastUpdated: null
  })

  const [showConfirmation, setShowConfirmation] = useState(false)

  // Fetch shutdown data with authentication
  const fetchShutdownData = async () => {
    if (!adminSession) {
      setShutdownData(prev => ({ ...prev, error: 'Admin session required' }))
      return
    }

    setShutdownData(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const [statusResponse, hooksResponse] = await Promise.all([
        fetch('/api/shutdown?action=status', {
          credentials: 'include' // Include cookies for session authentication
        }),
        fetch('/api/shutdown?action=hooks', {
          credentials: 'include' // Include cookies for session authentication
        })
      ])

      if (!statusResponse.ok || !hooksResponse.ok) {
        throw new Error(`HTTP error! status: ${statusResponse.status}`)
      }

      const statusData = await statusResponse.json()
      const hooksData = await hooksResponse.json()

      if (statusData.success && hooksData.success) {
        setShutdownData(prev => ({
          ...prev,
          status: {
            ...statusData.data,
            hooks: hooksData.data
          },
          loading: false,
          lastUpdated: new Date()
        }))
      } else {
        throw new Error(statusData.error || hooksData.error || 'Failed to fetch shutdown data')
      }
    } catch (error) {
      console.error('Error fetching shutdown data:', error)
      setShutdownData(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch shutdown data' 
      }))
    }
  }

  // Test shutdown hooks
  const testShutdownHooks = async () => {
    if (!adminSession) return

    try {
      const response = await fetch('/api/shutdown?action=test', {
        method: 'POST',
        credentials: 'include' // Include cookies for session authentication
      })

      const result = await response.json()
      if (result.success) {
        // Refresh data after test
        fetchShutdownData()
      }
    } catch (error) {
      console.error('Error testing shutdown hooks:', error)
    }
  }

  // Initiate graceful shutdown
  const initiateShutdown = async () => {
    if (!adminSession) return

    try {
      const response = await fetch('/api/shutdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'graceful_shutdown',
          confirm: true
        })
      })

      const result = await response.json()
      if (result.success) {
        // Start monitoring shutdown progress
        setShowConfirmation(false)
        // Auto-refresh during shutdown
        const interval = setInterval(fetchShutdownData, 1000)
        setTimeout(() => clearInterval(interval), 120000) // Stop after 2 minutes
      }
    } catch (error) {
      console.error('Error initiating shutdown:', error)
    }
  }

  // Auto-refresh during shutdown
  useEffect(() => {
    if (shutdownData.status.isShuttingDown) {
      const interval = setInterval(fetchShutdownData, 2000) // Refresh every 2 seconds
      return () => clearInterval(interval)
    }
  }, [shutdownData.status.isShuttingDown, adminSession])

  // Initial load - only when admin session is available
  useEffect(() => {
    if (adminSession) {
      fetchShutdownData()
      // Set up periodic refresh
      const interval = setInterval(fetchShutdownData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [adminSession])

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'bg-green-500'
      case 'shutting_down': return 'bg-yellow-500'
      case 'completed': return 'bg-blue-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  // Get hook priority color
  const getPriorityColor = (priority: number) => {
    if (priority < 20) return 'bg-red-500'
    if (priority < 50) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  // Format elapsed time
  const formatElapsedTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Graceful Shutdown Management</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchShutdownData}
            disabled={shutdownData.loading}
          >
            {shutdownData.loading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button 
            variant="outline" 
            onClick={testShutdownHooks}
            disabled={shutdownData.status.isShuttingDown}
          >
            {shutdownData.loading ? 'Testing...' : 'Test Hooks'}
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setShowConfirmation(true)}
            disabled={shutdownData.status.isShuttingDown}
          >
            Initiate Shutdown
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {shutdownData.error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-red-700">
            <strong>Error:</strong> {shutdownData.error}
          </div>
        </Card>
      )}

      {/* Shutdown Status */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Shutdown Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600">Current Status</div>
            <Badge className={`${getStatusColor(shutdownData.status.currentPhase)} text-white`}>
              {shutdownData.status.currentPhase.toUpperCase()}
            </Badge>
          </div>
          <div>
            <div className="text-sm text-gray-600">Shutdown in Progress</div>
            <Badge variant={shutdownData.status.isShuttingDown ? 'destructive' : 'secondary'}>
              {shutdownData.status.isShuttingDown ? 'YES' : 'NO'}
            </Badge>
          </div>
          <div>
            <div className="text-sm text-gray-600">Registered Hooks</div>
            <div className="text-xl font-bold">{shutdownData.status.hooks.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Elapsed Time</div>
            <div className="text-xl font-bold">
              {shutdownData.status.startTime ? formatElapsedTime(
                shutdownData.status.isShuttingDown 
                  ? Date.now() - shutdownData.status.startTime.getTime()
                  : shutdownData.status.progress === 100 
                    ? Date.now() - shutdownData.status.startTime.getTime()
                    : 0
              ) : 'N/A'}
            </div>
          </div>
        </div>
        
        {shutdownData.status.isShuttingDown && (
          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-2">Shutdown Progress</div>
            <Progress 
              value={shutdownData.status.progress} 
              className="h-2"
            />
            <div className="text-xs text-gray-500 mt-1">
              Estimated completion: {shutdownData.status.estimatedTimeRemaining ? formatElapsedTime(shutdownData.status.estimatedTimeRemaining) : 'N/A'}
            </div>
          </div>
        )}
      </Card>

      {/* Shutdown Hooks */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Shutdown Hooks</h3>
        <div className="space-y-3">
          {shutdownData.status.hooks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No shutdown hooks registered.
            </div>
          ) : (
            shutdownData.status.hooks.map((hook, index) => (
              <div key={hook.name} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-mono text-gray-500">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{hook.name}</div>
                    <div className="text-sm text-gray-600">
                      Priority: {hook.priority} | Timeout: {hook.timeout}ms
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`${getPriorityColor(hook.priority)} text-white`}>
                    P{hook.priority}
                  </Badge>
                  <Badge variant={hook.status === 'failed' ? 'destructive' : 'secondary'}>
                    {hook.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <Card className="p-6 bg-red-50 border-red-200">
          <h3 className="text-lg font-semibold mb-3 text-red-800">
            ⚠️ Confirm Graceful Shutdown
          </h3>
          <div className="space-y-4 text-sm">
            <div className="text-red-700">
              <strong>WARNING:</strong> This action will shut down the server after completing all cleanup procedures.
            </div>
            <div className="text-gray-700">
              <strong>What will happen:</strong>
              <ul className="list-disc ml-5 mt-2">
                <li>All active connections will be gracefully closed</li>
                <li>Database connections will be properly terminated</li>
                <li>Audit logs will be flushed and saved</li>
                <li>Configuration changes will be saved</li>
                <li>The server process will exit cleanly</li>
              </ul>
            </div>
            <div className="text-gray-700">
              <strong>Estimated shutdown time:</strong> 30-60 seconds
            </div>
            <div className="text-red-700">
              <strong>To confirm, type exactly:</strong> <code className="bg-gray-200 px-2 py-1 rounded">I_UNDERSTAND_THIS_WILL_SHUTDOWN_THE_SERVER</code>
            </div>
            <input
              type="text"
              placeholder="Type confirmation text here..."
              value="I_UNDERSTAND_THIS_WILL_SHUTDOWN_THE_SERVER"
              onChange={(_e) => {}}
              className="font-mono"
              disabled
            />
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={initiateShutdown}
                disabled={!adminSession}
              >
                Confirm Shutdown
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowConfirmation(false)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Help Information */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Shutdown Process Information</h3>
        <div className="space-y-2 text-sm">
          <div><strong>Graceful Shutdown:</strong> Ensures all resources are properly cleaned up before terminating</div>
          <div><strong>Hook Priority:</strong> Lower numbers execute first (e.g., priority 10 runs before priority 20)</div>
          <div><strong>Required Hooks:</strong> If a required hook fails, the shutdown process will be aborted</div>
          <div><strong>Timeout Handling:</strong> Each hook has a maximum execution time to prevent hanging</div>
          <div><strong>Signal Handling:</strong> The system automatically handles SIGTERM and SIGINT signals</div>
        </div>
      </Card>

      {/* Last Updated */}
      {shutdownData.lastUpdated && (
        <div className="text-sm text-gray-600 text-center">
          Last updated: {shutdownData.lastUpdated.toLocaleString()}
        </div>
      )}
    </div>
  )
} 