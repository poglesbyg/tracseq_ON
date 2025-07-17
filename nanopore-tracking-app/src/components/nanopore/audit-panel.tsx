import React, { useState, useEffect } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { Progress } from '../ui/progress'
import type { UserSession } from '../../lib/auth/AdminAuth'

interface AuditLogEntry {
  id: string
  timestamp: Date
  eventType: string
  category: string
  severity: string
  userId: string | null
  username: string | null
  resource: string
  action: string
  details: Record<string, any>
  success: boolean
  errorMessage: string | null
  ipAddress: string | null
  userAgent: string | null
}

interface AuditStats {
  totalEvents: number
  eventsByType: Record<string, number>
  eventsByCategory: Record<string, number>
  successfulEvents: number
  failedEvents: number
  recentActivity: Array<{
    timestamp: Date
    eventType: string
    count: number
  }>
}

interface AuditData {
  logs: AuditLogEntry[]
  stats: AuditStats
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

interface AuditPanelProps {
  adminSession: UserSession | null
}

export function AuditPanel({ adminSession }: AuditPanelProps) {
  const [auditData, setAuditData] = useState<AuditData>({
    logs: [],
    stats: {
      totalEvents: 0,
      eventsByType: {},
      eventsByCategory: {},
      successfulEvents: 0,
      failedEvents: 0,
      recentActivity: []
    },
    loading: false,
    error: null,
    lastUpdated: null
  })

  const [selectedFilter, setSelectedFilter] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Fetch audit data with authentication
  const fetchAuditData = async () => {
    if (!adminSession) {
      setAuditData(prev => ({ ...prev, error: 'Admin session required' }))
      return
    }

    setAuditData(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const [logsResponse, statsResponse] = await Promise.all([
        fetch('/api/audit?action=logs&limit=50', {
          credentials: 'include' // Include cookies for session authentication
        }),
        fetch('/api/audit?action=stats', {
          credentials: 'include' // Include cookies for session authentication
        })
      ])

      if (!logsResponse.ok || !statsResponse.ok) {
        throw new Error(`HTTP error! status: ${logsResponse.status}`)
      }

      const logsData = await logsResponse.json()
      const statsData = await statsResponse.json()

      if (logsData.success && statsData.success) {
        setAuditData(prev => ({
          ...prev,
          logs: logsData.data.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp)
          })),
          stats: statsData.data,
          loading: false,
          lastUpdated: new Date()
        }))
      } else {
        throw new Error(logsData.error || statsData.error || 'Failed to fetch audit data')
      }
    } catch (error) {
      console.error('Error fetching audit data:', error)
      setAuditData(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch audit data' 
      }))
    }
  }

  // Cleanup audit logs
  const cleanupAuditLogs = async () => {
    if (!adminSession) return

    try {
      const response = await fetch('/api/audit?action=cleanup', {
        method: 'POST',
        credentials: 'include' // Include cookies for session authentication
      })

      const result = await response.json()
      if (result.success) {
        // Refresh data after cleanup
        fetchAuditData()
      }
    } catch (error) {
      console.error('Error cleaning up audit logs:', error)
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchAuditData, 10000) // Refresh every 10 seconds
      return () => clearInterval(interval)
    }
    // No cleanup needed when autoRefresh is false
    return undefined
  }, [autoRefresh, adminSession])

  // Initial load - only when admin session is available
  useEffect(() => {
    if (adminSession) {
      fetchAuditData()
    }
  }, [adminSession])

  // Filter logs based on selected filter
  const filteredLogs = auditData.logs.filter(log => {
    if (selectedFilter === 'all') return true
    if (selectedFilter === 'errors') return !log.success
    if (selectedFilter === 'critical') return log.severity === 'CRITICAL'
    if (selectedFilter === 'high') return log.severity === 'HIGH'
    return log.category === selectedFilter
  })

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-500'
      case 'HIGH': return 'bg-orange-500'
      case 'MEDIUM': return 'bg-yellow-500'
      case 'LOW': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  // Get category color
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'AUTHENTICATION': return 'bg-blue-500'
      case 'AUTHORIZATION': return 'bg-purple-500'
      case 'DATA_MODIFICATION': return 'bg-orange-500'
      case 'DATA_ACCESS': return 'bg-green-500'
      case 'SYSTEM_ADMINISTRATION': return 'bg-red-500'
      case 'SECURITY': return 'bg-red-600'
      default: return 'bg-gray-500'
    }
  }

  // Calculate success rate
  const successRate = auditData.stats.totalEvents > 0 
    ? Math.round((auditData.stats.successfulEvents / auditData.stats.totalEvents) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Audit Management</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchAuditData}
            disabled={auditData.loading}
          >
            {auditData.loading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-100' : ''}
          >
            {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
          </Button>
          <Button 
            variant="outline" 
            onClick={cleanupAuditLogs}
            disabled={!adminSession}
          >
            {auditData.loading ? 'Cleaning...' : 'Cleanup Old Logs'}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {auditData.error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-red-700">
            <strong>Error:</strong> {auditData.error}
          </div>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total Events</div>
          <div className="text-2xl font-bold">{auditData.stats.totalEvents}</div>
        </Card>
        
        <Card className="p-4">
          <div className="text-sm text-gray-600">Success Rate</div>
          <div className="text-2xl font-bold text-green-600">{successRate}%</div>
          <Progress value={successRate} className="mt-2" />
        </Card>
        
        <Card className="p-4">
          <div className="text-sm text-gray-600">Successful Events</div>
          <div className="text-2xl font-bold text-green-600">{auditData.stats.successfulEvents}</div>
        </Card>
        
        <Card className="p-4">
          <div className="text-sm text-gray-600">Failed Events</div>
          <div className="text-2xl font-bold text-red-600">{auditData.stats.failedEvents}</div>
        </Card>
      </div>

      {/* Event Type Distribution */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Event Type Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(auditData.stats.eventsByType).map(([type, count]) => (
            <div key={type} className="text-center p-2 bg-gray-50 rounded">
              <div className="text-sm font-medium">{type}</div>
              <div className="text-lg font-bold">{count}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Category Distribution */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Category Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(auditData.stats.eventsByCategory).map(([category, count]) => (
            <div key={category} className="text-center p-2 bg-gray-50 rounded">
              <div className="text-sm font-medium">{category}</div>
              <div className="text-lg font-bold">{count}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Filter Logs</h3>
        <div className="flex flex-wrap gap-2">
          {['all', 'errors', 'critical', 'high', 'AUTHENTICATION', 'DATA_MODIFICATION', 'SECURITY'].map(filter => (
            <Button
              key={filter}
              variant={selectedFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedFilter(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Button>
          ))}
        </div>
      </Card>

      {/* Audit Logs */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Recent Audit Logs</h3>
          <div className="text-sm text-gray-600">
            {auditData.lastUpdated && (
              <>Last updated: {auditData.lastUpdated.toLocaleTimeString()}</>
            )}
          </div>
        </div>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No audit logs found for the selected filter.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-2">
                    <Badge className={`${getSeverityColor(log.severity)} text-white`}>
                      {log.severity}
                    </Badge>
                    <Badge className={`${getCategoryColor(log.category)} text-white`}>
                      {log.category}
                    </Badge>
                    <Badge variant="outline">
                      {log.eventType}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {log.timestamp.toLocaleString()}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div><strong>Resource:</strong> {log.resource}</div>
                    <div><strong>Action:</strong> {log.action}</div>
                    <div><strong>User:</strong> {log.username || 'System'}</div>
                  </div>
                  <div>
                    <div><strong>Success:</strong> 
                      <span className={log.success ? 'text-green-600' : 'text-red-600'}>
                        {log.success ? ' ✓' : ' ✗'}
                      </span>
                    </div>
                    <div><strong>IP:</strong> {log.ipAddress || 'N/A'}</div>
                    {log.errorMessage && (
                      <div><strong>Error:</strong> <span className="text-red-600">{log.errorMessage}</span></div>
                    )}
                  </div>
                </div>
                
                {Object.keys(log.details).length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div className="text-sm">
                      <strong>Details:</strong>
                      <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
} 