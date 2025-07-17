import { getComponentLogger } from '../logging/StructuredLogger'
import { applicationMetrics } from '../monitoring/MetricsCollector'

const logger = getComponentLogger('CacheManager')

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  ttl: number
  maxSize: number
  cleanupInterval: number
  enableMetrics: boolean
  namespace: string
}

/**
 * Default cache configuration optimized for memory usage
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttl: 300000, // 5 minutes (reduced from default)
  maxSize: 500, // Reduced from 1000 to 500
  cleanupInterval: 60000, // 1 minute cleanup
  enableMetrics: true,
  namespace: 'nanopore'
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  errors: number
  hitRate: number
  totalOperations: number
  currentSize: number
  maxSize: number
  evictions: number
  lastResetTime: Date
}

/**
 * Cache entry metadata
 */
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  version: string
  size: number
  accessCount: number
  lastAccessed: number
}

/**
 * Cache operation result
 */
export interface CacheResult<T> {
  success: boolean
  data?: T
  error?: Error
  fromCache: boolean
  duration: number
}

/**
 * In-memory cache manager with LRU eviction and TTL support
 */
export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private config: CacheConfig
  private stats!: CacheStats
  private cleanupInterval: NodeJS.Timeout | null = null
  private accessOrder: string[] = []

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ttl: 3600, // 1 hour default
      maxSize: 1000, // Max 1000 entries
      cleanupInterval: 300000, // 5 minutes
      enableMetrics: true,
      namespace: 'nanopore',
      ...config
    }

    this.initializeStats()
    this.startCleanupInterval()
  }

  /**
   * Initialize cache statistics
   */
  private initializeStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      totalOperations: 0,
      currentSize: 0,
      maxSize: this.config.maxSize,
      evictions: 0,
      lastResetTime: new Date()
    }
  }

  /**
   * Start cleanup interval to remove expired entries
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        keysToDelete.push(key)
      }
    }

    if (keysToDelete.length > 0) {
      keysToDelete.forEach(key => {
        this.cache.delete(key)
        this.removeFromAccessOrder(key)
      })

      this.stats.currentSize = this.cache.size

      logger.debug('Cache cleanup completed', {
        metadata: {
          expiredKeys: keysToDelete.length,
          currentSize: this.stats.currentSize
        }
      })
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(operation: 'hit' | 'miss' | 'set' | 'delete' | 'error'): void {
    if (operation === 'hit') {
      this.stats.hits++
    } else if (operation === 'miss') {
      this.stats.misses++
    } else if (operation === 'set') {
      this.stats.sets++
    } else if (operation === 'delete') {
      this.stats.deletes++
    } else if (operation === 'error') {
      this.stats.errors++
    }

    this.stats.totalOperations++
    this.stats.hitRate = this.stats.totalOperations > 0 ? (this.stats.hits / this.stats.totalOperations) * 100 : 0
    this.stats.currentSize = this.cache.size
  }

  /**
   * Estimate size of a value in bytes
   */
  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2 // Rough estimate: each character = 2 bytes
    } catch {
      return 1000 // Default size estimate
    }
  }

  /**
   * Update access order for LRU eviction
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key)
    this.accessOrder.push(key)
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
  }

  /**
   * Evict least recently used entries if cache is full
   */
  private evictIfNeeded(): void {
    while (this.cache.size >= this.config.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift()
      if (oldestKey && this.cache.has(oldestKey)) {
        this.cache.delete(oldestKey)
        this.stats.evictions++
        
        logger.debug('Cache entry evicted', {
          metadata: { key: oldestKey }
        })
      }
    }
  }

  /**
   * Generate cache key with namespace
   */
  private generateKey(key: string, namespace?: string): string {
    const ns = namespace || this.config.namespace
    return `${ns}:${key}`
  }

  /**
   * Get value from cache
   */
  public async get<T>(key: string, namespace?: string): Promise<CacheResult<T>> {
    const startTime = Date.now()
    const fullKey = this.generateKey(key, namespace)
    
    try {
      const entry = this.cache.get(fullKey)
      
      if (!entry) {
        this.updateStats('miss')
        
        logger.debug('Cache miss', {
          metadata: { key: fullKey }
        })
        
        return {
          success: false,
          fromCache: false,
          duration: Date.now() - startTime
        }
      }

      // Check if entry has expired
      const now = Date.now()
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.cache.delete(fullKey)
        this.removeFromAccessOrder(fullKey)
        this.updateStats('miss')
        
        logger.debug('Cache entry expired', {
          metadata: { 
            key: fullKey,
            age: now - entry.timestamp,
            ttl: entry.ttl * 1000
          }
        })
        
        return {
          success: false,
          fromCache: false,
          duration: Date.now() - startTime
        }
      }

      // Update access tracking
      entry.accessCount++
      entry.lastAccessed = now
      this.updateAccessOrder(fullKey)
      
      this.updateStats('hit')
      
      logger.debug('Cache hit', {
        metadata: { 
          key: fullKey,
          age: now - entry.timestamp,
          accessCount: entry.accessCount
        }
      })
      
      return {
        success: true,
        data: entry.data,
        fromCache: true,
        duration: Date.now() - startTime
      }

    } catch (error) {
      this.updateStats('error')
      
      logger.error('Cache get operation failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          key: fullKey,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      
      if (this.config.enableMetrics) {
        applicationMetrics.recordError('cache_get_error', 'CacheManager')
      }
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Cache get failed'),
        fromCache: false,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Set value in cache
   */
  public async set<T>(key: string, value: T, ttl?: number, namespace?: string): Promise<CacheResult<T>> {
    const startTime = Date.now()
    const fullKey = this.generateKey(key, namespace)
    const cacheTtl = ttl || this.config.ttl
    
    try {
      // Evict if needed before adding new entry
      this.evictIfNeeded()

      // Create cache entry
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl: cacheTtl,
        version: '1.0',
        size: this.estimateSize(value),
        accessCount: 0,
        lastAccessed: Date.now()
      }

      // Set the entry
      this.cache.set(fullKey, entry)
      this.updateAccessOrder(fullKey)
      this.updateStats('set')
      
      logger.debug('Cache set', {
        metadata: { 
          key: fullKey,
          ttl: cacheTtl,
          size: entry.size
        }
      })
      
      return {
        success: true,
        data: value,
        fromCache: false,
        duration: Date.now() - startTime
      }

    } catch (error) {
      this.updateStats('error')
      
      logger.error('Cache set operation failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          key: fullKey,
          ttl: cacheTtl,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      
      if (this.config.enableMetrics) {
        applicationMetrics.recordError('cache_set_error', 'CacheManager')
      }
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Cache set failed'),
        fromCache: false,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Delete value from cache
   */
  public async delete(key: string, namespace?: string): Promise<CacheResult<void>> {
    const startTime = Date.now()
    const fullKey = this.generateKey(key, namespace)
    
    try {
      const existed = this.cache.delete(fullKey)
      this.removeFromAccessOrder(fullKey)
      this.updateStats('delete')
      
      logger.debug('Cache delete', {
        metadata: { 
          key: fullKey,
          existed
        }
      })
      
      return {
        success: true,
        fromCache: false,
        duration: Date.now() - startTime
      }

    } catch (error) {
      this.updateStats('error')
      
      logger.error('Cache delete operation failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          key: fullKey,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      
      if (this.config.enableMetrics) {
        applicationMetrics.recordError('cache_delete_error', 'CacheManager')
      }
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Cache delete failed'),
        fromCache: false,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Clear all cache entries with optional pattern
   */
  public async clear(pattern?: string): Promise<CacheResult<void>> {
    const startTime = Date.now()
    
    try {
      let keysDeleted = 0
      
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        const keysToDelete: string[] = []
        
        for (const key of this.cache.keys()) {
          if (regex.test(key)) {
            keysToDelete.push(key)
          }
        }
        
        keysToDelete.forEach(key => {
          this.cache.delete(key)
          this.removeFromAccessOrder(key)
        })
        
        keysDeleted = keysToDelete.length
      } else {
        keysDeleted = this.cache.size
        this.cache.clear()
        this.accessOrder = []
      }
      
      this.stats.currentSize = this.cache.size
      
      logger.info('Cache cleared', {
        metadata: { 
          pattern: pattern || '*',
          keysDeleted
        }
      })
      
      return {
        success: true,
        fromCache: false,
        duration: Date.now() - startTime
      }

    } catch (error) {
      this.updateStats('error')
      
      logger.error('Cache clear operation failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          pattern: pattern || '*',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      
      if (this.config.enableMetrics) {
        applicationMetrics.recordError('cache_clear_error', 'CacheManager')
      }
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Cache clear failed'),
        fromCache: false,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Check if cache is healthy
   */
  public async isHealthy(): Promise<boolean> {
    try {
      // Test basic operations
      const testKey = '__health_check__'
      const testValue = { test: true, timestamp: Date.now() }
      
      const setResult = await this.set(testKey, testValue, 10)
      if (!setResult.success) {
        return false
      }
      
      const getResult = await this.get(testKey)
      if (!getResult.success) {
        return false
      }
      
      const deleteResult = await this.delete(testKey)
      if (!deleteResult.success) {
        return false
      }
      
      return true
      
    } catch (error) {
      logger.error('Cache health check failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      return false
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Reset cache statistics
   */
  public resetStats(): void {
    this.initializeStats()
    logger.info('Cache statistics reset')
  }

  /**
   * Get cache information
   */
  public getInfo(): any {
    return {
      type: 'in-memory',
      config: {
        ttl: this.config.ttl,
        maxSize: this.config.maxSize,
        namespace: this.config.namespace,
        cleanupInterval: this.config.cleanupInterval
      },
      stats: this.getStats(),
      memoryUsage: {
        currentEntries: this.cache.size,
        accessOrderSize: this.accessOrder.length
      }
    }
  }

  /**
   * Shutdown cache manager
   */
  public async shutdown(): Promise<void> {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval)
        this.cleanupInterval = null
      }
      
      this.cache.clear()
      this.accessOrder = []
      
      logger.info('Cache manager shutdown completed')
    } catch (error) {
      logger.error('Error during cache shutdown', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
    }
  }
}

/**
 * Cache wrapper for easy memoization
 */
export class CacheWrapper {
  constructor(private cache: CacheManager) {}

  /**
   * Memoize function results
   */
  public memoize<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: {
      keyGenerator: (...args: Parameters<T>) => string
      ttl?: number
      namespace?: string
    }
  ): T {
    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const cacheKey = options.keyGenerator(...args)
      
      // Try to get from cache
      const cached = await this.cache.get<ReturnType<T>>(cacheKey, options.namespace)
      if (cached.success && cached.data !== undefined) {
        return cached.data
      }
      
      // Execute function and cache result
      const result = await fn(...args)
      await this.cache.set(cacheKey, result, options.ttl, options.namespace)
      
      return result
    }) as T
  }
}

/**
 * Global cache manager instance
 */
export const cacheManager = new CacheManager()
export const cacheWrapper = new CacheWrapper(cacheManager)

/**
 * Helper function to handle cache operations gracefully
 */
export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: {
    ttl?: number
    namespace?: string
    fallbackOnError?: boolean
  } = {}
): Promise<T> {
  const { ttl, namespace, fallbackOnError = true } = options
  
  try {
    // Try to get from cache
    const cached = await cacheManager.get<T>(key, namespace)
    if (cached.success && cached.data !== undefined) {
      return cached.data
    }
    
    // Fetch data
    const data = await fetchFn()
    
    // Cache the result (don't await to avoid blocking)
    cacheManager.set(key, data, ttl, namespace).catch(error => {
      logger.warn('Failed to cache data', {
        metadata: { key, namespace },
        errorType: error instanceof Error ? error.name : 'Unknown'
      })
    })
    
    return data
  } catch (error) {
          logger.error('Error in withCache', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: { key, namespace }
      })
    
    if (fallbackOnError) {
      return await fetchFn()
    }
    
    throw error
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down cache manager')
  await cacheManager.shutdown()
})

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down cache manager')
  await cacheManager.shutdown()
}) 