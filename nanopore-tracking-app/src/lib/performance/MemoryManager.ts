import { getComponentLogger } from '../logging/StructuredLogger'
import { applicationMetrics } from '../monitoring/MetricsCollector'

const logger = getComponentLogger('MemoryManager')

/**
 * Memory statistics interface
 */
export interface MemoryStats {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
  arrayBuffers: number
  heapUsedPercent: number
  trend: 'increasing' | 'decreasing' | 'stable'
  gcRuns: number
  gcDuration: number
  memoryLeaks: MemoryLeak[]
}

/**
 * Memory leak detection result
 */
export interface MemoryLeak {
  type: 'heap_growth' | 'external_growth' | 'listener_leak' | 'timer_leak' | 'object_retention'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  value: number
  threshold: number
  timestamp: Date
  source?: string
}

/**
 * Memory optimization configuration
 */
export interface MemoryConfig {
  maxHeapPercent: number
  maxRSSMB: number
  gcThreshold: number
  monitoringInterval: number
  leakDetectionInterval: number
  enableAutoGC: boolean
  enableMemoryProfiling: boolean
  cleanupInterval: number
}

/**
 * Default memory configuration optimized for production
 */
const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  maxHeapPercent: 75, // Reduced from 85 to 75
  maxRSSMB: 180, // Reduced from 200 to 180
  gcThreshold: 70, // Reduced from 80 to 70
  monitoringInterval: 5000, // Reduced from 10000 to 5000 for more frequent monitoring
  leakDetectionInterval: 30000, // Reduced from 60000 to 30000
  enableAutoGC: true,
  enableMemoryProfiling: false, // Disabled in production for memory savings
  cleanupInterval: 15000, // Reduced from 30000 to 15000 for more frequent cleanup
}

/**
 * Resource cleanup tracker
 */
interface ResourceTracker {
  timers: Set<NodeJS.Timeout>
  intervals: Set<NodeJS.Timeout>
  listeners: Map<string, number>
  streams: Set<any>
  connections: Set<any>
  largeObjects: WeakSet<object>
}

/**
 * Memory usage history for trend analysis
 */
interface MemorySnapshot {
  timestamp: Date
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
}

/**
 * Comprehensive memory manager with leak detection and optimization
 */
export class MemoryManager {
  private config: MemoryConfig
  private resourceTracker: ResourceTracker
  private memoryHistory: MemorySnapshot[] = []
  private monitoringInterval: NodeJS.Timeout | null = null
  private leakDetectionInterval: NodeJS.Timeout | null = null
  private cleanupInterval: NodeJS.Timeout | null = null
  private gcStats = { runs: 0, totalDuration: 0 }
  private isShuttingDown = false

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = {
      maxHeapPercent: 85,
      maxRSSMB: 200,
      gcThreshold: 80,
      monitoringInterval: 10000, // 10 seconds
      leakDetectionInterval: 60000, // 1 minute
      enableAutoGC: true,
      enableMemoryProfiling: process.env.NODE_ENV === 'development',
      cleanupInterval: 300000, // 5 minutes
      ...config
    }

    this.resourceTracker = {
      timers: new Set(),
      intervals: new Set(),
      listeners: new Map(),
      streams: new Set(),
      connections: new Set(),
      largeObjects: new WeakSet()
    }

    this.initializeMemoryMonitoring()
    this.setupProcessHandlers()
  }

  /**
   * Initialize memory monitoring
   */
  private initializeMemoryMonitoring(): void {
    // Start memory monitoring
    if (this.config.monitoringInterval > 0) {
      this.monitoringInterval = setInterval(() => {
        this.collectMemoryStats()
      }, this.config.monitoringInterval)
    }

    // Start leak detection
    if (this.config.leakDetectionInterval > 0) {
      this.leakDetectionInterval = setInterval(() => {
        this.detectMemoryLeaks()
      }, this.config.leakDetectionInterval)
    }

    // Start cleanup
    if (this.config.cleanupInterval > 0) {
      this.cleanupInterval = setInterval(() => {
        this.performCleanup()
      }, this.config.cleanupInterval)
    }

    logger.info('Memory monitoring initialized', {
      metadata: {
        maxHeapPercent: this.config.maxHeapPercent,
        maxRSSMB: this.config.maxRSSMB,
        autoGC: this.config.enableAutoGC,
        monitoringInterval: this.config.monitoringInterval
      }
    })
  }

  /**
   * Setup process-level handlers
   */
  private setupProcessHandlers(): void {
    // Override global timer functions to track resources
    this.wrapTimerFunctions()
    
    // Monitor process events
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        logger.warn('Memory leak detected: MaxListenersExceededWarning', {
          metadata: {
            warningName: warning.name,
            message: warning.message,
            emitter: warning.stack
          }
        })
      }
    })

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception - potential memory leak', {
        errorType: error.name,
        metadata: {
          errorMessage: error.message,
          stack: error.stack
        }
      })
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection - potential memory leak', {
        metadata: {
          reason: reason instanceof Error ? reason.message : String(reason),
          promise: promise.toString()
        }
      })
    })
  }

  /**
   * Wrap timer functions to track resource usage
   */
  private wrapTimerFunctions(): void {
    // Note: Timer wrapping is complex due to TypeScript overloads
    // For production, consider using a process monitoring library instead
    // This is a simplified implementation for tracking purposes
  }

  /**
   * Collect current memory statistics
   */
  private collectMemoryStats(): void {
    const memUsage = process.memoryUsage()
    const snapshot: MemorySnapshot = {
      timestamp: new Date(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    }

    this.memoryHistory.push(snapshot)

    // Keep only last 100 snapshots
    if (this.memoryHistory.length > 100) {
      this.memoryHistory.shift()
    }

    // Update metrics
    applicationMetrics.memoryUsage.set(memUsage.heapUsed)

    // Check for memory pressure
    const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100
    const rssMB = memUsage.rss / 1024 / 1024

    if (heapPercent > this.config.maxHeapPercent) {
      logger.warn('High memory usage detected', {
        metadata: {
          heapUsedPercent: heapPercent,
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          rssMB: Math.round(rssMB),
          threshold: this.config.maxHeapPercent
        }
      })

      // Trigger garbage collection if enabled
      if (this.config.enableAutoGC && heapPercent > this.config.gcThreshold) {
        this.forceGarbageCollection()
      }
    }

    if (rssMB > this.config.maxRSSMB) {
      logger.warn('High RSS memory usage detected', {
        metadata: {
          rssMB: Math.round(rssMB),
          threshold: this.config.maxRSSMB,
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024)
        }
      })
    }
  }

  /**
   * Detect memory leaks
   */
  private detectMemoryLeaks(): void {
    const leaks: MemoryLeak[] = []

    // Check for heap growth trend
    if (this.memoryHistory.length >= 10) {
      const recent = this.memoryHistory.slice(-10)
      const trend = this.calculateMemoryTrend(recent)
      
      if (trend === 'increasing' && recent.length >= 2) {
        const last = recent[recent.length - 1]
        const first = recent[0]
        if (last && first) {
          const growth = last.heapUsed - first.heapUsed
          const growthMB = growth / 1024 / 1024
          
          if (growthMB > 10) { // More than 10MB growth
            leaks.push({
              type: 'heap_growth',
              severity: growthMB > 50 ? 'critical' : growthMB > 20 ? 'high' : 'medium',
              description: `Heap memory growing consistently: ${growthMB.toFixed(1)}MB increase`,
              value: growthMB,
              threshold: 10,
              timestamp: new Date()
            })
          }
        }
      }
    }

    // Check for excessive timers
    if (this.resourceTracker.timers.size > 100) {
      leaks.push({
        type: 'timer_leak',
        severity: this.resourceTracker.timers.size > 500 ? 'critical' : 'high',
        description: `Excessive active timers: ${this.resourceTracker.timers.size}`,
        value: this.resourceTracker.timers.size,
        threshold: 100,
        timestamp: new Date()
      })
    }

    // Check for excessive intervals
    if (this.resourceTracker.intervals.size > 50) {
      leaks.push({
        type: 'timer_leak',
        severity: this.resourceTracker.intervals.size > 200 ? 'critical' : 'high',
        description: `Excessive active intervals: ${this.resourceTracker.intervals.size}`,
        value: this.resourceTracker.intervals.size,
        threshold: 50,
        timestamp: new Date()
      })
    }

    // Check for event listener leaks
    for (const [eventName, count] of this.resourceTracker.listeners) {
      if (count > 10) {
        leaks.push({
          type: 'listener_leak',
          severity: count > 50 ? 'critical' : count > 20 ? 'high' : 'medium',
          description: `Excessive event listeners for '${eventName}': ${count}`,
          value: count,
          threshold: 10,
          timestamp: new Date(),
          source: eventName
        })
      }
    }

    // Log detected leaks
    if (leaks.length > 0) {
      logger.warn('Memory leaks detected', {
        metadata: {
          leakCount: leaks.length,
          criticalLeaks: leaks.filter(l => l.severity === 'critical').length,
          highLeaks: leaks.filter(l => l.severity === 'high').length,
          leaks: leaks.map(l => ({
            type: l.type,
            severity: l.severity,
            description: l.description,
            value: l.value
          }))
        }
      })

      // Record metrics
      applicationMetrics.recordError('memory_leak_detected', 'MemoryManager')
    }
  }

  /**
   * Calculate memory trend from snapshots
   */
  private calculateMemoryTrend(snapshots: MemorySnapshot[]): 'increasing' | 'decreasing' | 'stable' {
    if (snapshots.length < 2) return 'stable'

    const first = snapshots[0]
    const last = snapshots[snapshots.length - 1]
    
    if (!first || !last) return 'stable'
    
    const growthPercent = ((last.heapUsed - first.heapUsed) / first.heapUsed) * 100

    if (growthPercent > 5) return 'increasing'
    if (growthPercent < -5) return 'decreasing'
    return 'stable'
  }

  /**
   * Force garbage collection
   */
  private forceGarbageCollection(): void {
    if (global.gc) {
      const start = Date.now()
      global.gc()
      const duration = Date.now() - start
      
      this.gcStats.runs++
      this.gcStats.totalDuration += duration

      logger.info('Garbage collection forced', {
        metadata: {
          duration,
          totalRuns: this.gcStats.runs,
          averageDuration: Math.round(this.gcStats.totalDuration / this.gcStats.runs)
        }
      })
    } else {
      logger.warn('Garbage collection not available', {
        metadata: {
          message: 'Run with --expose-gc flag to enable manual GC'
        }
      })
    }
  }

  /**
   * Perform cleanup of resources
   */
  private performCleanup(): void {
    let cleanedResources = 0

    // Clean up timer and interval tracking
    // Note: Direct cleanup of timers is complex, using size-based cleanup
    if (this.resourceTracker.timers.size > 1000) {
      this.resourceTracker.timers.clear()
      cleanedResources += 1000
    }

    if (this.resourceTracker.intervals.size > 500) {
      this.resourceTracker.intervals.clear()
      cleanedResources += 500
    }

    // Clean up old memory snapshots
    if (this.memoryHistory.length > 50) {
      const removed = this.memoryHistory.length - 50
      this.memoryHistory.splice(0, removed)
      cleanedResources += removed
    }

    if (cleanedResources > 0) {
      logger.debug('Resource cleanup completed', {
        metadata: {
          cleanedResources,
          activeTimers: this.resourceTracker.timers.size,
          activeIntervals: this.resourceTracker.intervals.size
        }
      })
    }
  }

  /**
   * Get comprehensive memory statistics
   */
  public getMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage()
    const trend = this.memoryHistory.length >= 5 
      ? this.calculateMemoryTrend(this.memoryHistory.slice(-5))
      : 'stable'

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
      heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      trend,
      gcRuns: this.gcStats.runs,
      gcDuration: this.gcStats.totalDuration,
      memoryLeaks: []
    }
  }

  /**
   * Get resource usage statistics
   */
  public getResourceStats(): {
    activeTimers: number
    activeIntervals: number
    activeListeners: number
    activeStreams: number
    activeConnections: number
  } {
    return {
      activeTimers: this.resourceTracker.timers.size,
      activeIntervals: this.resourceTracker.intervals.size,
      activeListeners: Array.from(this.resourceTracker.listeners.values()).reduce((a, b) => a + b, 0),
      activeStreams: this.resourceTracker.streams.size,
      activeConnections: this.resourceTracker.connections.size
    }
  }

  /**
   * Generate memory report
   */
  public generateMemoryReport(): string {
    const stats = this.getMemoryStats()
    const resources = this.getResourceStats()
    
    return `
Memory Report (${new Date().toISOString()})
==========================================

Memory Usage:
- Heap Used: ${Math.round(stats.heapUsed / 1024 / 1024)}MB (${stats.heapUsedPercent.toFixed(1)}%)
- Heap Total: ${Math.round(stats.heapTotal / 1024 / 1024)}MB
- External: ${Math.round(stats.external / 1024 / 1024)}MB
- RSS: ${Math.round(stats.rss / 1024 / 1024)}MB
- Array Buffers: ${Math.round(stats.arrayBuffers / 1024 / 1024)}MB
- Trend: ${stats.trend}

Resource Usage:
- Active Timers: ${resources.activeTimers}
- Active Intervals: ${resources.activeIntervals}
- Active Listeners: ${resources.activeListeners}
- Active Streams: ${resources.activeStreams}
- Active Connections: ${resources.activeConnections}

Garbage Collection:
- Total Runs: ${stats.gcRuns}
- Total Duration: ${stats.gcDuration}ms
- Average Duration: ${stats.gcRuns > 0 ? Math.round(stats.gcDuration / stats.gcRuns) : 0}ms

Memory History (last 10 snapshots):
${this.memoryHistory.slice(-10).map(s => 
  `${s.timestamp.toISOString()}: ${Math.round(s.heapUsed / 1024 / 1024)}MB heap, ${Math.round(s.rss / 1024 / 1024)}MB RSS`
).join('\n')}
    `.trim()
  }

  /**
   * Optimize memory usage
   */
  public async optimizeMemory(): Promise<void> {
    logger.info('Starting memory optimization')

    // Force garbage collection
    this.forceGarbageCollection()

    // Perform cleanup
    this.performCleanup()

    // Clear caches if available
    if (global.gc) {
      global.gc()
    }

    logger.info('Memory optimization completed')
  }

  /**
   * Register a large object for tracking
   */
  public trackLargeObject(obj: object): void {
    this.resourceTracker.largeObjects.add(obj)
  }

  /**
   * Track event listener
   */
  public trackEventListener(eventName: string): void {
    const current = this.resourceTracker.listeners.get(eventName) || 0
    this.resourceTracker.listeners.set(eventName, current + 1)
  }

  /**
   * Untrack event listener
   */
  public untrackEventListener(eventName: string): void {
    const current = this.resourceTracker.listeners.get(eventName) || 0
    if (current > 0) {
      this.resourceTracker.listeners.set(eventName, current - 1)
    }
  }

  /**
   * Shutdown memory manager
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return
    this.isShuttingDown = true

    logger.info('Shutting down memory manager')

    // Clear intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    if (this.leakDetectionInterval) {
      clearInterval(this.leakDetectionInterval)
      this.leakDetectionInterval = null
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    // Final cleanup
    await this.performCleanup()

    logger.info('Memory manager shutdown completed')
  }
}

/**
 * Global memory manager instance
 */
export const memoryManager = new MemoryManager()

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down memory manager')
  await memoryManager.shutdown()
})

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down memory manager')
  await memoryManager.shutdown()
}) 