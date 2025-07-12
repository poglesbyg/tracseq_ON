import { lazy, type ComponentType } from 'react'

// Memoization utilities
export class MemoryCache<T> {
  private cache = new Map<string, { value: T; timestamp: number; ttl: number }>()
  private maxSize: number
  
  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }
  
  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) {return undefined}
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return undefined
    }
    
    return entry.value
  }
  
  set(key: string, value: T, ttl = 300000): void { // 5 minutes default
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    })
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  size(): number {
    return this.cache.size
  }
}

// Global cache instance
export const globalCache = new MemoryCache(200)

// Memoization decorator
export function memoize<Args extends unknown[], Return>(
  fn: (...args: Args) => Return,
  keyFn?: (...args: Args) => string,
  ttl = 300000
): (...args: Args) => Return {
  const cache = new Map<string, { value: Return; timestamp: number }>()
  
  return (...args: Args): Return => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args)
    const cached = cache.get(key)
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.value
    }
    
    const result = fn(...args)
    cache.set(key, { value: result, timestamp: Date.now() })
    
    return result
  }
}

// Async memoization
export function memoizeAsync<Args extends unknown[], Return>(
  fn: (...args: Args) => Promise<Return>,
  keyFn?: (...args: Args) => string,
  ttl = 300000
): (...args: Args) => Promise<Return> {
  const cache = new Map<string, { promise: Promise<Return>; timestamp: number }>()
  
  return (...args: Args): Promise<Return> => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args)
    const cached = cache.get(key)
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.promise
    }
    
    const promise = fn(...args)
    cache.set(key, { promise, timestamp: Date.now() })
    
    // Clean up failed promises
    promise.catch(() => cache.delete(key))
    
    return promise
  }
}

// Debounce utility
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
): (...args: Args) => void {
  let timeoutId: NodeJS.Timeout | null = null
  
  return (...args: Args) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}

// Throttle utility
export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
): (...args: Args) => void {
  let lastCall = 0
  
  return (...args: Args) => {
    const now = Date.now()
    
    if (now - lastCall >= delay) {
      lastCall = now
      fn(...args)
    }
  }
}

// Lazy loading utilities
export interface LazyComponentOptions {
  fallback?: ComponentType
  delay?: number
  retryCount?: number
}

export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyComponentOptions = {}
): ComponentType<any> {
  const { retryCount = 3, delay = 0 } = options
  
  const LazyComponent = lazy(async () => {
    let lastError: Error | null = null
    
    for (let i = 0; i < retryCount; i++) {
      try {
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        
        return await importFn()
      } catch (error) {
        lastError = error as Error
        
        if (i < retryCount - 1) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
        }
      }
    }
    
    throw new Error(lastError?.message || 'Component loading failed')
  })
  
  return LazyComponent
}

// Preload utilities
export function preloadComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): void {
  // Preload the component in the background
  importFn().catch(() => {
    // Silently fail - the component will be loaded when needed
  })
}

export function preloadRoute(route: string): void {
  // Preload route assets
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(() => {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = route
      document.head.appendChild(link)
    })
  }
}

// Performance monitoring
export interface PerformanceMetrics {
  startTime: number
  endTime?: number
  duration?: number
  memoryUsage?: number
}

export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetrics>()
  
  start(label: string): void {
    this.metrics.set(label, {
      startTime: performance.now(),
      memoryUsage: this.getMemoryUsage(),
    })
  }
  
  end(label: string): PerformanceMetrics | undefined {
    const metric = this.metrics.get(label)
    if (!metric) {return undefined}
    
    const endTime = performance.now()
    const updatedMetric = {
      ...metric,
      endTime,
      duration: endTime - metric.startTime,
    }
    
    this.metrics.set(label, updatedMetric)
    return updatedMetric
  }
  
  getMetric(label: string): PerformanceMetrics | undefined {
    return this.metrics.get(label)
  }
  
  getAllMetrics(): Record<string, PerformanceMetrics> {
    return Object.fromEntries(this.metrics)
  }
  
  clear(): void {
    this.metrics.clear()
  }
  
  private getMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }
}

// Global performance monitor
export const performanceMonitor = new PerformanceMonitor()

// Performance measurement decorator
export function measurePerformance(label?: string) {
  return function <T extends (...args: any[]) => any>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value
    if (!originalMethod) {return descriptor}
    
    const measurementLabel = label || `${target.constructor.name}.${propertyKey}`
    
    descriptor.value = function (this: any, ...args: any[]) {
      performanceMonitor.start(measurementLabel)
      
      try {
        const result = originalMethod.apply(this, args)
        
        // Handle async functions
        if (result instanceof Promise) {
          return result.finally(() => {
            performanceMonitor.end(measurementLabel)
          })
        }
        
        performanceMonitor.end(measurementLabel)
        return result
      } catch (error) {
        performanceMonitor.end(measurementLabel)
        throw error
      }
    } as T
    
    return descriptor
  }
}

// Bundle analysis utilities
export function getBundleInfo() {
  if (typeof window === 'undefined') {return null}
  
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    connectionType: (navigator as any).connection?.effectiveType || 'unknown',
    memory: (performance as any).memory ? {
      used: (performance as any).memory.usedJSHeapSize,
      total: (performance as any).memory.totalJSHeapSize,
      limit: (performance as any).memory.jsHeapSizeLimit,
    } : null,
  }
}

// Resource loading utilities
export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
          script.addEventListener('load', () => resolve())
      script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)))
    document.head.appendChild(script)
  })
}

export function loadStyle(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
          link.addEventListener('load', () => resolve())
      link.addEventListener('error', () => reject(new Error(`Failed to load stylesheet: ${href}`)))
    document.head.appendChild(link)
  })
}

// Image optimization utilities
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
          img.addEventListener('load', () => resolve())
      img.addEventListener('error', () => reject(new Error(`Failed to preload image: ${src}`)))
    img.src = src
  })
}

export function getOptimizedImageUrl(
  src: string,
  _options: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'avif' | 'jpeg' | 'png'
  } = {}
): string {
  // In a real implementation, this would integrate with an image optimization service
  // For now, return the original src
  return src
} 