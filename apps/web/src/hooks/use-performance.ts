import { useCallback, useEffect, useRef, useState } from 'react'

import { 
  performanceMonitor, 
  type PerformanceMetrics,
  memoizeAsync,
  debounce,
  throttle
} from '../utils/performance'

import { usePerformanceConfig } from './use-config'

export interface PerformanceState {
  metrics: Record<string, PerformanceMetrics>
  isMonitoring: boolean
  memoryUsage: number
  connectionType: string
}

export interface UsePerformanceOptions {
  enableMonitoring?: boolean
  memoryThreshold?: number // in MB
  alertOnSlowOperations?: boolean
  slowOperationThreshold?: number // in ms
}

export function usePerformance(options: UsePerformanceOptions = {}) {
  const {
    enableMonitoring = true,
    memoryThreshold = 100,
    alertOnSlowOperations = true,
    slowOperationThreshold = 1000,
  } = options
  
  const performanceConfig = usePerformanceConfig()
  const [state, setState] = useState<PerformanceState>({
    metrics: {},
    isMonitoring: enableMonitoring,
    memoryUsage: 0,
    connectionType: 'unknown',
  })
  
  const updateMetrics = useCallback(() => {
    if (!state.isMonitoring) {return}
    
    const metrics = performanceMonitor.getAllMetrics()
    const memoryUsage = getMemoryUsage()
    const connectionType = getConnectionType()
    
    setState(prev => ({
      ...prev,
      metrics,
      memoryUsage,
      connectionType,
    }))
    
    // Check for performance issues
    if (alertOnSlowOperations) {
      Object.entries(metrics).forEach(([label, metric]) => {
        if (metric.duration && metric.duration > slowOperationThreshold) {
          console.warn(`Slow operation detected: ${label} took ${metric.duration.toFixed(2)}ms`)
        }
      })
    }
    
    if (memoryUsage > memoryThreshold) {
      console.warn(`High memory usage detected: ${memoryUsage.toFixed(2)}MB`)
    }
  }, [state.isMonitoring, alertOnSlowOperations, slowOperationThreshold, memoryThreshold])
  
  // Debounced metrics update
  const debouncedUpdateMetrics = useCallback(
    debounce(updateMetrics, 1000),
    [updateMetrics]
  )
  
  // Start monitoring
  const startMonitoring = useCallback((label: string) => {
    if (!state.isMonitoring) {return}
    
    performanceMonitor.start(label)
    debouncedUpdateMetrics()
  }, [state.isMonitoring, debouncedUpdateMetrics])
  
  // End monitoring
  const endMonitoring = useCallback((label: string) => {
    if (!state.isMonitoring) {return}
    
    const metric = performanceMonitor.end(label)
    debouncedUpdateMetrics()
    
    return metric
  }, [state.isMonitoring, debouncedUpdateMetrics])
  
  // Toggle monitoring
  const toggleMonitoring = useCallback(() => {
    setState(prev => ({
      ...prev,
      isMonitoring: !prev.isMonitoring,
    }))
  }, [])
  
  // Clear metrics
  const clearMetrics = useCallback(() => {
    performanceMonitor.clear()
    setState(prev => ({
      ...prev,
      metrics: {},
    }))
  }, [])
  
  // Get specific metric
  const getMetric = useCallback((label: string) => {
    return performanceMonitor.getMetric(label)
  }, [])
  
  // Performance report
  const getPerformanceReport = useCallback(() => {
    const metrics = performanceMonitor.getAllMetrics()
    const totalOperations = Object.keys(metrics).length
    const completedOperations = Object.values(metrics).filter(m => m.duration).length
    const averageDuration = Object.values(metrics)
      .filter(m => m.duration)
      .reduce((sum, m) => sum + (m.duration || 0), 0) / completedOperations || 0
    
    const slowOperations = Object.entries(metrics)
      .filter(([, metric]) => metric.duration && metric.duration > slowOperationThreshold)
      .map(([label, metric]) => ({ label, duration: metric.duration }))
    
    return {
      totalOperations,
      completedOperations,
      averageDuration,
      slowOperations,
      memoryUsage: state.memoryUsage,
      connectionType: state.connectionType,
      cacheEnabled: performanceConfig.caching.enabled,
      pollingInterval: performanceConfig.polling.baseInterval,
    }
  }, [state.memoryUsage, state.connectionType, performanceConfig, slowOperationThreshold])
  
  // Set up automatic metrics updates
  useEffect(() => {
    if (!state.isMonitoring) {return}
    
    const interval = setInterval(updateMetrics, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [state.isMonitoring, updateMetrics])
  
  return {
    ...state,
    startMonitoring,
    endMonitoring,
    toggleMonitoring,
    clearMetrics,
    getMetric,
    getPerformanceReport,
  }
}

// Utility functions
function getMemoryUsage(): number {
  if (typeof window !== 'undefined' && 'memory' in performance) {
    return (performance as any).memory.usedJSHeapSize / (1024 * 1024) // Convert to MB
  }
  return 0
}

function getConnectionType(): string {
  if (typeof window !== 'undefined' && 'connection' in navigator) {
    return (navigator as any).connection?.effectiveType || 'unknown'
  }
  return 'unknown'
}

// Performance measurement hook
export function usePerformanceMeasurement(label: string, enabled = true) {
  const { startMonitoring, endMonitoring } = usePerformance()
  const labelRef = useRef(label)
  
  useEffect(() => {
    labelRef.current = label
  }, [label])
  
  const measure = useCallback(<T extends (...args: any[]) => any>(fn: T): T => {
    if (!enabled) {return fn}
    
    return ((...args: any[]) => {
      startMonitoring(labelRef.current)
      
      try {
        const result = fn(...args)
        
        // Handle async functions
        if (result instanceof Promise) {
          return result.finally(() => {
            endMonitoring(labelRef.current)
          })
        }
        
        endMonitoring(labelRef.current)
        return result
      } catch (error) {
        endMonitoring(labelRef.current)
        throw error
      }
    }) as T
  }, [enabled, startMonitoring, endMonitoring])
  
  return { measure }
}

// Memoization hook
export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList,
  ttl = 300000
): T {
  const memoizedCallback = useCallback(
    memoizeAsync(callback, undefined, ttl),
    deps
  )
  
  return memoizedCallback as T
}

// Debounced callback hook
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number,
  deps: React.DependencyList
): T {
  const debouncedCallback = useCallback(
    debounce(callback, delay),
    deps
  )
  
  return debouncedCallback as T
}

// Throttled callback hook
export function useThrottledCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number,
  deps: React.DependencyList
): T {
  const throttledCallback = useCallback(
    throttle(callback, delay),
    deps
  )
  
  return throttledCallback as T
} 