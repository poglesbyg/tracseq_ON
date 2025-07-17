import React, { useState, useEffect } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { Separator } from '../ui/separator'
import { toast } from 'sonner'

interface MemoryStats {
  timestamp: string
  memory: {
    heapUsed: string
    heapTotal: string
    external: string
    rss: string
    arrayBuffers: string
    heapUsedPercent: string
    trend: 'increasing' | 'decreasing' | 'stable'
    gcRuns: number
    gcDuration: string
  }
  resources: {
    activeTimers: number
    activeIntervals: number
    activeListeners: number
    activeStreams: number
    activeConnections: number
  }
  cache: {
    hitRate: string
    totalOperations: number
    currentSize: number
    maxSize: number
    hits: number
    misses: number
  }
}

interface MemoryOptimizationPanelProps {
  className?: string
}

export function MemoryOptimizationPanel({ className }: MemoryOptimizationPanelProps) {
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastOptimization, setLastOptimization] = useState<Date | null>(null)

  // Fetch memory statistics
  const fetchMemoryStats = async () => {
    try {
      const response = await fetch('/api/memory-optimize')
      if (!response.ok) {
        throw new Error('Failed to fetch memory stats')
      }
      const data = await response.json()
      setMemoryStats(data)
    } catch (error) {
      console.error('Error fetching memory stats:', error)
      toast.error('Failed to fetch memory statistics')
    }
  }

  // Perform memory optimization
  const performOptimization = async (action: 'optimize' | 'gc' | 'clear-cache') => {
    setIsOptimizing(true)
    try {
      const response = await fetch(`/api/memory-optimize?action=${action}`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('Optimization failed')
      }
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message)
        setLastOptimization(new Date())
        
        // Refresh stats after optimization
        setTimeout(() => {
          fetchMemoryStats()
        }, 1000)
      } else {
        toast.warning(result.message)
      }
    } catch (error) {
      console.error('Error during optimization:', error)
      toast.error('Memory optimization failed')
    } finally {
      setIsOptimizing(false)
    }
  }

  // View memory report
  const viewMemoryReport = async () => {
    try {
      const response = await fetch('/api/memory-optimize?format=report')
      if (!response.ok) {
        throw new Error('Failed to fetch memory report')
      }
      
      const report = await response.text()
      
      // Create a new window/tab with the report
      const newWindow = window.open('', '_blank')
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>Memory Report - ${new Date().toISOString()}</title>
              <style>
                body { font-family: 'Courier New', monospace; padding: 20px; white-space: pre-wrap; }
                .header { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>Memory Report</h1>
                <p>Generated: ${new Date().toISOString()}</p>
              </div>
              ${report}
            </body>
          </html>
        `)
        newWindow.document.close()
      }
    } catch (error) {
      console.error('Error fetching memory report:', error)
      toast.error('Failed to generate memory report')
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchMemoryStats, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
    // No cleanup needed when autoRefresh is false
    return undefined
  }, [autoRefresh])

  // Initial load
  useEffect(() => {
    fetchMemoryStats()
  }, [])

  if (!memoryStats) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading memory statistics...</p>
          </div>
        </div>
      </Card>
    )
  }

  const heapPercent = parseFloat(memoryStats.memory.heapUsedPercent)
  const cacheHitRate = parseFloat(memoryStats.cache.hitRate)

  const getMemoryStatusBadge = (percent: number) => {
    if (percent > 90) return <Badge variant="destructive">Critical</Badge>
    if (percent > 80) return <Badge variant="secondary">High</Badge>
    if (percent > 70) return <Badge variant="outline">Moderate</Badge>
    return <Badge variant="default">Healthy</Badge>
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <span className="text-red-500">📈</span>
      case 'decreasing':
        return <span className="text-green-500">📉</span>
      default:
        return <span className="text-blue-500">📊</span>
    }
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Memory Optimization</h3>
            <p className="text-sm text-gray-600">
              Last updated: {new Date(memoryStats.timestamp).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? '🔄 Auto' : '⏸️ Manual'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMemoryStats}
              disabled={false} // isLoading is removed
            >
              🔄 Refresh
            </Button>
          </div>
        </div>

        {/* Memory Usage Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Memory Usage</h4>
            <div className="flex items-center space-x-2">
              {getMemoryStatusBadge(heapPercent)}
              {getTrendIcon(memoryStats.memory.trend)}
              <span className="text-sm text-gray-600">{memoryStats.memory.trend}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            {/* Heap Usage */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Heap Usage</span>
                <span className="font-mono">
                  {memoryStats.memory.heapUsed} / {memoryStats.memory.heapTotal} ({memoryStats.memory.heapUsedPercent}%)
                </span>
              </div>
              <Progress 
                value={heapPercent} 
                className="h-2"
                style={{ 
                  backgroundColor: '#f3f4f6',
                }}
              />
            </div>

            {/* RSS Memory */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>RSS Memory</span>
                <span className="font-mono">{memoryStats.memory.rss}</span>
              </div>
            </div>

            {/* External Memory */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>External Memory</span>
                <span className="font-mono">{memoryStats.memory.external}</span>
              </div>
            </div>

            {/* Array Buffers */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Array Buffers</span>
                <span className="font-mono">{memoryStats.memory.arrayBuffers}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Resource Usage */}
        <div className="space-y-4">
          <h4 className="font-medium">Resource Usage</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span>Active Timers:</span>
              <span className="font-mono">{memoryStats.resources.activeTimers}</span>
            </div>
            <div className="flex justify-between">
              <span>Active Intervals:</span>
              <span className="font-mono">{memoryStats.resources.activeIntervals}</span>
            </div>
            <div className="flex justify-between">
              <span>Event Listeners:</span>
              <span className="font-mono">{memoryStats.resources.activeListeners}</span>
            </div>
            <div className="flex justify-between">
              <span>Active Streams:</span>
              <span className="font-mono">{memoryStats.resources.activeStreams}</span>
            </div>
            <div className="flex justify-between">
              <span>Connections:</span>
              <span className="font-mono">{memoryStats.resources.activeConnections}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Cache Statistics */}
        <div className="space-y-4">
          <h4 className="font-medium">Cache Performance</h4>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Hit Rate</span>
                <span className="font-mono">{memoryStats.cache.hitRate}%</span>
              </div>
              <Progress 
                value={cacheHitRate} 
                className="h-2"
                style={{ 
                  backgroundColor: '#f3f4f6',
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span>Total Operations:</span>
                <span className="font-mono">{memoryStats.cache.totalOperations}</span>
              </div>
              <div className="flex justify-between">
                <span>Cache Size:</span>
                <span className="font-mono">{memoryStats.cache.currentSize}/{memoryStats.cache.maxSize}</span>
              </div>
              <div className="flex justify-between">
                <span>Hits:</span>
                <span className="font-mono text-green-600">{memoryStats.cache.hits}</span>
              </div>
              <div className="flex justify-between">
                <span>Misses:</span>
                <span className="font-mono text-red-600">{memoryStats.cache.misses}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Garbage Collection */}
        <div className="space-y-4">
          <h4 className="font-medium">Garbage Collection</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span>Total Runs:</span>
              <span className="font-mono">{memoryStats.memory.gcRuns}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Duration:</span>
              <span className="font-mono">{memoryStats.memory.gcDuration}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Optimization Actions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Optimization Actions</h4>
            {lastOptimization && (
              <p className="text-xs text-gray-600">
                Last optimized: {lastOptimization.toLocaleTimeString()}
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => performOptimization('optimize')}
              disabled={isOptimizing}
              className="w-full"
            >
              {isOptimizing ? '🔄 Optimizing...' : '🚀 Full Optimization'}
            </Button>
            
            <Button
              onClick={() => performOptimization('gc')}
              disabled={isOptimizing}
              variant="outline"
              className="w-full"
            >
              {isOptimizing ? '🔄 Running GC...' : '🗑️ Force GC'}
            </Button>
            
            <Button
              onClick={() => performOptimization('clear-cache')}
              disabled={isOptimizing}
              variant="outline"
              className="w-full"
            >
              {isOptimizing ? '🔄 Clearing...' : '🧹 Clear Cache'}
            </Button>
            
            <Button
              onClick={viewMemoryReport}
              variant="outline"
              className="w-full"
            >
              📊 View Report
            </Button>
          </div>
        </div>

        {/* Warning for high memory usage */}
        {heapPercent > 90 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <span className="text-red-600">⚠️</span>
              <div>
                <p className="text-sm font-medium text-red-800">Critical Memory Usage</p>
                <p className="text-xs text-red-600">
                  Memory usage is critically high. Consider running optimization or restarting the application.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
} 