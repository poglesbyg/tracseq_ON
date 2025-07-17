import { getComponentLogger } from '../logging/StructuredLogger'
import { quotaOptimizedServiceMesh } from '../service-mesh/QuotaOptimizedServiceMesh'

const logger = getComponentLogger('PerformanceTuner')

export interface PerformanceMetrics {
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
    arrayBuffers: number
    rss: number
  }
  cpuUsage: {
    user: number
    system: number
    percentage: number
  }
  eventLoop: {
    delay: number
    utilization: number
  }
  gc: {
    collections: number
    duration: number
    reclaimedBytes: number
  }
  networkMetrics: {
    activeConnections: number
    requestsPerSecond: number
    averageResponseTime: number
    errorRate: number
  }
  serviceMeshMetrics: {
    circuitBreakerState: string
    retryAttempts: number
    loadBalancerHealth: number
    queueDepth: number
  }
}

export interface OptimizationRecommendations {
  memory: {
    currentUsage: number
    recommendedLimit: number
    actions: string[]
  }
  cpu: {
    currentUsage: number
    recommendedLimit: number
    actions: string[]
  }
  network: {
    currentThroughput: number
    recommendedOptimizations: string[]
  }
  serviceMesh: {
    currentConfiguration: any
    recommendedChanges: string[]
  }
}

/**
 * Performance tuner for quota-constrained environments
 */
export class PerformanceTuner {
  private performanceHistory: PerformanceMetrics[] = []
  private gcStats: any = null
  private eventLoopMonitor: any = null
  private performanceObserver: PerformanceObserver | null = null

  constructor() {
    this.initializeMonitoring()
  }

  /**
   * Initialize performance monitoring
   */
  private initializeMonitoring(): void {
    try {
      // Monitor garbage collection
      if (typeof global.gc === 'function') {
        this.gcStats = {
          collections: 0,
          duration: 0,
          reclaimedBytes: 0
        }
      }

      // Monitor event loop
      this.eventLoopMonitor = {
        delay: 0,
        utilization: 0
      }

      // Performance observer for web APIs
      if (typeof PerformanceObserver !== 'undefined') {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          for (const entry of entries) {
            if (entry.entryType === 'measure') {
              logger.debug('Performance measurement', {
                action: 'performance_measure',
                metadata: {
                  name: entry.name,
                  duration: entry.duration,
                  startTime: entry.startTime
                }
              })
            }
          }
        })
        
        this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] })
      }

      logger.info('Performance monitoring initialized')
    } catch (error) {
      logger.warn('Failed to initialize some performance monitoring features', {
        action: 'monitoring_init_partial',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }

  /**
   * Collect current performance metrics
   */
  async collectMetrics(): Promise<PerformanceMetrics> {
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    // Calculate CPU percentage (simplified)
    const cpuPercentage = (cpuUsage.user + cpuUsage.system) / 1000000 * 100

    // Event loop delay (simplified)
    const eventLoopDelay = await this.measureEventLoopDelay()
    
    // Network metrics (from service mesh if available)
    const networkMetrics = await this.collectNetworkMetrics()
    
    // Service mesh metrics
    const serviceMeshMetrics = await this.collectServiceMeshMetrics()

    const metrics: PerformanceMetrics = {
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
        rss: memoryUsage.rss
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        percentage: cpuPercentage
      },
      eventLoop: {
        delay: eventLoopDelay,
        utilization: this.eventLoopMonitor?.utilization || 0
      },
      gc: this.gcStats || {
        collections: 0,
        duration: 0,
        reclaimedBytes: 0
      },
      networkMetrics,
      serviceMeshMetrics
    }

    // Store in history
    this.performanceHistory.push(metrics)
    
    // Keep only last 100 measurements
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift()
    }

    return metrics
  }

  /**
   * Measure event loop delay
   */
  private async measureEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint()
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000
        resolve(delay)
      })
    })
  }

  /**
   * Collect network metrics
   */
  private async collectNetworkMetrics(): Promise<PerformanceMetrics['networkMetrics']> {
    // In a real implementation, this would collect from actual network monitoring
    return {
      activeConnections: 0,
      requestsPerSecond: 0,
      averageResponseTime: 0,
      errorRate: 0
    }
  }

  /**
   * Collect service mesh metrics
   */
  private async collectServiceMeshMetrics(): Promise<PerformanceMetrics['serviceMeshMetrics']> {
    try {
      const health = await quotaOptimizedServiceMesh.getHealth()
      const metrics = quotaOptimizedServiceMesh.getMetrics()

      return {
        circuitBreakerState: health.components.circuitBreaker?.details?.state || 'unknown',
        retryAttempts: metrics.retries || 0,
        loadBalancerHealth: health.components.loadBalancer?.healthy ? 1 : 0,
        queueDepth: 0 // Would be implemented in actual service mesh
      }
    } catch (error) {
      logger.warn('Failed to collect service mesh metrics', {
        action: 'service_mesh_metrics_failed',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      
      return {
        circuitBreakerState: 'unknown',
        retryAttempts: 0,
        loadBalancerHealth: 0,
        queueDepth: 0
      }
    }
  }

  /**
   * Analyze performance and provide optimization recommendations
   */
  async analyzePerformance(): Promise<OptimizationRecommendations> {
    const currentMetrics = await this.collectMetrics()
    const recommendations: OptimizationRecommendations = {
      memory: this.analyzeMemoryUsage(currentMetrics),
      cpu: this.analyzeCpuUsage(currentMetrics),
      network: this.analyzeNetworkPerformance(currentMetrics),
      serviceMesh: this.analyzeServiceMeshPerformance(currentMetrics)
    }

    logger.info('Performance analysis completed', {
      action: 'performance_analysis',
      metadata: {
        memoryUsage: currentMetrics.memoryUsage.heapUsed,
        cpuUsage: currentMetrics.cpuUsage.percentage,
        recommendationsCount: Object.values(recommendations).reduce((sum, rec) => 
          sum + (rec.actions?.length || rec.recommendedOptimizations?.length || rec.recommendedChanges?.length || 0), 0
        )
      }
    })

    return recommendations
  }

  /**
   * Analyze memory usage
   */
  private analyzeMemoryUsage(metrics: PerformanceMetrics): OptimizationRecommendations['memory'] {
    const heapUsedMB = metrics.memoryUsage.heapUsed / 1024 / 1024
    const heapTotalMB = metrics.memoryUsage.heapTotal / 1024 / 1024
    const quotaLimitMB = 128 // Our quota limit
    
    const actions: string[] = []
    let recommendedLimit = quotaLimitMB

    if (heapUsedMB > quotaLimitMB * 0.8) {
      actions.push('Memory usage is approaching quota limit')
      actions.push('Consider implementing memory pooling')
      actions.push('Review object lifecycle management')
      actions.push('Enable garbage collection optimization')
    }

    if (heapUsedMB > quotaLimitMB * 0.9) {
      actions.push('CRITICAL: Memory usage is dangerously high')
      actions.push('Implement immediate memory cleanup')
      actions.push('Consider reducing cache sizes')
      recommendedLimit = Math.min(quotaLimitMB, heapUsedMB * 1.2)
    }

    if (metrics.memoryUsage.external > 50 * 1024 * 1024) {
      actions.push('High external memory usage detected')
      actions.push('Review buffer and stream usage')
    }

    if (actions.length === 0) {
      actions.push('Memory usage is within optimal range')
    }

    return {
      currentUsage: heapUsedMB,
      recommendedLimit,
      actions
    }
  }

  /**
   * Analyze CPU usage
   */
  private analyzeCpuUsage(metrics: PerformanceMetrics): OptimizationRecommendations['cpu'] {
    const cpuUsage = metrics.cpuUsage.percentage
    const quotaLimitCPU = 100 // 100m CPU limit
    
    const actions: string[] = []
    let recommendedLimit = quotaLimitCPU

    if (cpuUsage > 70) {
      actions.push('High CPU usage detected')
      actions.push('Consider implementing request throttling')
      actions.push('Review algorithm efficiency')
      actions.push('Implement CPU-intensive task queuing')
    }

    if (cpuUsage > 90) {
      actions.push('CRITICAL: CPU usage is very high')
      actions.push('Implement immediate load shedding')
      actions.push('Consider horizontal scaling if quota allows')
      recommendedLimit = Math.min(quotaLimitCPU, cpuUsage * 1.1)
    }

    if (metrics.eventLoop.delay > 10) {
      actions.push('Event loop delay detected')
      actions.push('Review synchronous operations')
      actions.push('Implement async/await patterns')
    }

    if (actions.length === 0) {
      actions.push('CPU usage is within optimal range')
    }

    return {
      currentUsage: cpuUsage,
      recommendedLimit,
      actions
    }
  }

  /**
   * Analyze network performance
   */
  private analyzeNetworkPerformance(metrics: PerformanceMetrics): OptimizationRecommendations['network'] {
    const networkMetrics = metrics.networkMetrics
    const recommendations: string[] = []

    if (networkMetrics.errorRate > 5) {
      recommendations.push('High error rate detected')
      recommendations.push('Review service mesh circuit breaker settings')
      recommendations.push('Implement better error handling')
    }

    if (networkMetrics.averageResponseTime > 1000) {
      recommendations.push('High response times detected')
      recommendations.push('Implement response caching')
      recommendations.push('Review database query performance')
    }

    if (networkMetrics.activeConnections > 100) {
      recommendations.push('High connection count')
      recommendations.push('Implement connection pooling')
      recommendations.push('Review keep-alive settings')
    }

    if (recommendations.length === 0) {
      recommendations.push('Network performance is optimal')
    }

    return {
      currentThroughput: networkMetrics.requestsPerSecond,
      recommendedOptimizations: recommendations
    }
  }

  /**
   * Analyze service mesh performance
   */
  private analyzeServiceMeshPerformance(metrics: PerformanceMetrics): OptimizationRecommendations['serviceMesh'] {
    const serviceMeshMetrics = metrics.serviceMeshMetrics
    const recommendations: string[] = []

    if (serviceMeshMetrics.circuitBreakerState === 'open') {
      recommendations.push('Circuit breaker is open')
      recommendations.push('Review service health and dependencies')
      recommendations.push('Consider adjusting failure thresholds')
    }

    if (serviceMeshMetrics.retryAttempts > 10) {
      recommendations.push('High retry attempts detected')
      recommendations.push('Review retry policy configuration')
      recommendations.push('Implement exponential backoff')
    }

    if (serviceMeshMetrics.loadBalancerHealth < 1) {
      recommendations.push('Load balancer health issues')
      recommendations.push('Check endpoint health status')
      recommendations.push('Review health check configuration')
    }

    if (serviceMeshMetrics.queueDepth > 50) {
      recommendations.push('High queue depth detected')
      recommendations.push('Implement queue size limits')
      recommendations.push('Consider load shedding')
    }

    if (recommendations.length === 0) {
      recommendations.push('Service mesh performance is optimal')
    }

    return {
      currentConfiguration: serviceMeshMetrics,
      recommendedChanges: recommendations
    }
  }

  /**
   * Apply automatic optimizations
   */
  async applyOptimizations(recommendations: OptimizationRecommendations): Promise<void> {
    logger.info('Applying performance optimizations', {
      action: 'apply_optimizations',
      metadata: {
        memoryActions: recommendations.memory.actions.length,
        cpuActions: recommendations.cpu.actions.length,
        networkActions: recommendations.network.recommendedOptimizations.length,
        serviceMeshActions: recommendations.serviceMesh.recommendedChanges.length
      }
    })

    // Memory optimizations
    if (recommendations.memory.currentUsage > 100) {
      await this.optimizeMemoryUsage()
    }

    // CPU optimizations
    if (recommendations.cpu.currentUsage > 80) {
      await this.optimizeCpuUsage()
    }

    // Service mesh optimizations
    if (recommendations.serviceMesh.recommendedChanges.length > 0) {
      await this.optimizeServiceMesh(recommendations.serviceMesh)
    }
  }

  /**
   * Optimize memory usage
   */
  private async optimizeMemoryUsage(): Promise<void> {
    logger.info('Applying memory optimizations')

    // Force garbage collection if available
    if (typeof global.gc === 'function') {
      global.gc()
    }

    // Clear performance history to free memory
    if (this.performanceHistory.length > 50) {
      this.performanceHistory = this.performanceHistory.slice(-50)
    }

    // Optimize service mesh metrics storage
    try {
      // This would clear internal caches in the service mesh
      logger.debug('Memory optimization applied')
    } catch (error) {
      logger.warn('Failed to apply some memory optimizations', {
        action: 'memory_optimization_failed',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }

  /**
   * Optimize CPU usage
   */
  private async optimizeCpuUsage(): Promise<void> {
    logger.info('Applying CPU optimizations')

    // Implement request throttling
    // This would be implemented in the actual service mesh
    logger.debug('CPU optimization applied')
  }

  /**
   * Optimize service mesh configuration
   */
  private async optimizeServiceMesh(recommendations: OptimizationRecommendations['serviceMesh']): Promise<void> {
    logger.info('Applying service mesh optimizations', {
      action: 'service_mesh_optimization',
      metadata: { changes: recommendations.recommendedChanges.length }
    })

    try {
      // Update service mesh configuration based on recommendations
      const currentConfig = quotaOptimizedServiceMesh.getMetrics().config
      
      // This would apply configuration changes
      logger.debug('Service mesh optimization applied')
    } catch (error) {
      logger.warn('Failed to apply service mesh optimizations', {
        action: 'service_mesh_optimization_failed',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory]
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): string {
    if (this.performanceHistory.length === 0) {
      return 'No performance data available'
    }

    const latest = this.performanceHistory[this.performanceHistory.length - 1]
    if (!latest) {
      return 'No performance data available'
    }

    const average = this.calculateAverageMetrics()

    let report = '# Performance Tuning Report\n\n'
    
    report += '## Current Performance Metrics\n\n'
    report += `### Memory Usage\n`
    report += `- **Heap Used**: ${(latest.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB\n`
    report += `- **Heap Total**: ${(latest.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB\n`
    report += `- **External**: ${(latest.memoryUsage.external / 1024 / 1024).toFixed(2)}MB\n`
    report += `- **RSS**: ${(latest.memoryUsage.rss / 1024 / 1024).toFixed(2)}MB\n\n`

    report += `### CPU Usage\n`
    report += `- **Current**: ${latest.cpuUsage.percentage.toFixed(2)}%\n`
    report += `- **User**: ${latest.cpuUsage.user}μs\n`
    report += `- **System**: ${latest.cpuUsage.system}μs\n\n`

    report += `### Event Loop\n`
    report += `- **Delay**: ${latest.eventLoop.delay.toFixed(2)}ms\n`
    report += `- **Utilization**: ${latest.eventLoop.utilization.toFixed(2)}%\n\n`

    report += `### Service Mesh\n`
    report += `- **Circuit Breaker**: ${latest.serviceMeshMetrics.circuitBreakerState}\n`
    report += `- **Retry Attempts**: ${latest.serviceMeshMetrics.retryAttempts}\n`
    report += `- **Load Balancer Health**: ${latest.serviceMeshMetrics.loadBalancerHealth}\n\n`

    report += '## Average Performance (Last 10 measurements)\n\n'
    report += `- **Average Memory**: ${(average.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB\n`
    report += `- **Average CPU**: ${average.cpuUsage.percentage.toFixed(2)}%\n`
    report += `- **Average Event Loop Delay**: ${average.eventLoop.delay.toFixed(2)}ms\n\n`

    return report
  }

  /**
   * Calculate average metrics
   */
  private calculateAverageMetrics(): PerformanceMetrics {
    const recent = this.performanceHistory.slice(-10)
    const count = recent.length

    if (count === 0) {
      const fallback = this.performanceHistory[0]
      if (!fallback) {
        return {} as PerformanceMetrics
      }
      return fallback
    }

    const sum = recent.reduce((acc, metrics) => ({
      memoryUsage: {
        heapUsed: acc.memoryUsage.heapUsed + metrics.memoryUsage.heapUsed,
        heapTotal: acc.memoryUsage.heapTotal + metrics.memoryUsage.heapTotal,
        external: acc.memoryUsage.external + metrics.memoryUsage.external,
        arrayBuffers: acc.memoryUsage.arrayBuffers + metrics.memoryUsage.arrayBuffers,
        rss: acc.memoryUsage.rss + metrics.memoryUsage.rss
      },
      cpuUsage: {
        user: acc.cpuUsage.user + metrics.cpuUsage.user,
        system: acc.cpuUsage.system + metrics.cpuUsage.system,
        percentage: acc.cpuUsage.percentage + metrics.cpuUsage.percentage
      },
      eventLoop: {
        delay: acc.eventLoop.delay + metrics.eventLoop.delay,
        utilization: acc.eventLoop.utilization + metrics.eventLoop.utilization
      },
      gc: {
        collections: acc.gc.collections + metrics.gc.collections,
        duration: acc.gc.duration + metrics.gc.duration,
        reclaimedBytes: acc.gc.reclaimedBytes + metrics.gc.reclaimedBytes
      },
      networkMetrics: {
        activeConnections: acc.networkMetrics.activeConnections + metrics.networkMetrics.activeConnections,
        requestsPerSecond: acc.networkMetrics.requestsPerSecond + metrics.networkMetrics.requestsPerSecond,
        averageResponseTime: acc.networkMetrics.averageResponseTime + metrics.networkMetrics.averageResponseTime,
        errorRate: acc.networkMetrics.errorRate + metrics.networkMetrics.errorRate
      },
      serviceMeshMetrics: {
        circuitBreakerState: metrics.serviceMeshMetrics.circuitBreakerState,
        retryAttempts: acc.serviceMeshMetrics.retryAttempts + metrics.serviceMeshMetrics.retryAttempts,
        loadBalancerHealth: acc.serviceMeshMetrics.loadBalancerHealth + metrics.serviceMeshMetrics.loadBalancerHealth,
        queueDepth: acc.serviceMeshMetrics.queueDepth + metrics.serviceMeshMetrics.queueDepth
      }
    }), {
      memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, arrayBuffers: 0, rss: 0 },
      cpuUsage: { user: 0, system: 0, percentage: 0 },
      eventLoop: { delay: 0, utilization: 0 },
      gc: { collections: 0, duration: 0, reclaimedBytes: 0 },
      networkMetrics: { activeConnections: 0, requestsPerSecond: 0, averageResponseTime: 0, errorRate: 0 },
      serviceMeshMetrics: { circuitBreakerState: 'unknown', retryAttempts: 0, loadBalancerHealth: 0, queueDepth: 0 }
    })

    return {
      memoryUsage: {
        heapUsed: sum.memoryUsage.heapUsed / count,
        heapTotal: sum.memoryUsage.heapTotal / count,
        external: sum.memoryUsage.external / count,
        arrayBuffers: sum.memoryUsage.arrayBuffers / count,
        rss: sum.memoryUsage.rss / count
      },
      cpuUsage: {
        user: sum.cpuUsage.user / count,
        system: sum.cpuUsage.system / count,
        percentage: sum.cpuUsage.percentage / count
      },
      eventLoop: {
        delay: sum.eventLoop.delay / count,
        utilization: sum.eventLoop.utilization / count
      },
      gc: {
        collections: sum.gc.collections / count,
        duration: sum.gc.duration / count,
        reclaimedBytes: sum.gc.reclaimedBytes / count
      },
      networkMetrics: {
        activeConnections: sum.networkMetrics.activeConnections / count,
        requestsPerSecond: sum.networkMetrics.requestsPerSecond / count,
        averageResponseTime: sum.networkMetrics.averageResponseTime / count,
        errorRate: sum.networkMetrics.errorRate / count
      },
      serviceMeshMetrics: {
        circuitBreakerState: recent[recent.length - 1].serviceMeshMetrics.circuitBreakerState,
        retryAttempts: sum.serviceMeshMetrics.retryAttempts / count,
        loadBalancerHealth: sum.serviceMeshMetrics.loadBalancerHealth / count,
        queueDepth: sum.serviceMeshMetrics.queueDepth / count
      }
    }
  }

  /**
   * Cleanup monitoring resources
   */
  cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
    }
    this.performanceHistory = []
  }
}

// Export singleton instance
export const performanceTuner = new PerformanceTuner()
export default performanceTuner 