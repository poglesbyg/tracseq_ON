import { getComponentLogger } from '../logging/StructuredLogger'
import { applicationMetrics } from '../monitoring/MetricsCollector'
import type { Database } from '../database'
import type { Kysely } from 'kysely'

const logger = getComponentLogger('QueryOptimizer')

/**
 * Query optimization configuration
 */
export interface QueryOptimizerConfig {
  enablePagination: boolean
  defaultPageSize: number
  maxPageSize: number
  enableQueryCaching: boolean
  cacheThreshold: number
  enableIndexHints: boolean
  slowQueryThreshold: number
  enableQueryProfiling: boolean
}

/**
 * Query performance metrics
 */
export interface QueryPerformance {
  query: string
  executionTime: number
  rowsReturned: number
  memoryUsage: number
  timestamp: Date
  optimized: boolean
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  offset: number
  limit: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

/**
 * Query optimization result
 */
export interface OptimizedQuery<T> {
  data: T[]
  pagination: {
    offset: number
    limit: number
    total: number
    hasNext: boolean
    hasPrevious: boolean
  }
  performance: {
    executionTime: number
    rowsReturned: number
    optimized: boolean
  }
}

/**
 * Query optimizer for database performance
 */
export class QueryOptimizer {
  private config: QueryOptimizerConfig
  private queryCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()
  private queryPerformanceHistory: QueryPerformance[] = []
  private slowQueries: Map<string, number> = new Map()

  constructor(config: Partial<QueryOptimizerConfig> = {}) {
    this.config = {
      enablePagination: true,
      defaultPageSize: 20,
      maxPageSize: 100,
      enableQueryCaching: true,
      cacheThreshold: 1000, // Cache queries that take more than 1 second
      enableIndexHints: true,
      slowQueryThreshold: 2000, // 2 seconds
      enableQueryProfiling: process.env.NODE_ENV === 'development',
      ...config
    }

    // Start cleanup interval
    setInterval(() => {
      this.cleanupCache()
    }, 300000) // Every 5 minutes

    logger.info('Query optimizer initialized', {
      metadata: {
        enablePagination: this.config.enablePagination,
        defaultPageSize: this.config.defaultPageSize,
        enableQueryCaching: this.config.enableQueryCaching,
        slowQueryThreshold: this.config.slowQueryThreshold
      }
    })
  }

  /**
   * Execute optimized query with pagination
   */
  async executeOptimizedQuery<T>(
    db: Kysely<Database>,
    queryBuilder: any,
    pagination: PaginationParams = {
      offset: 0,
      limit: this.config.defaultPageSize
    }
  ): Promise<OptimizedQuery<T>> {
    const startTime = Date.now()
    
    // Validate pagination parameters
    const validatedPagination = this.validatePagination(pagination)
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(queryBuilder, validatedPagination)
    
    // Check cache first
    if (this.config.enableQueryCaching) {
      const cached = this.getFromCache<T>(cacheKey)
      if (cached) {
        logger.debug('Query served from cache', {
          metadata: {
            cacheKey: cacheKey.substring(0, 50) + '...',
            executionTime: Date.now() - startTime
          }
        })
        
        return cached
      }
    }

    try {
      // Apply pagination
      const paginatedQuery = queryBuilder
        .limit(validatedPagination.limit)
        .offset(validatedPagination.offset)

      // Apply ordering if specified
      if (validatedPagination.orderBy) {
        paginatedQuery.orderBy(
          validatedPagination.orderBy,
          validatedPagination.orderDirection || 'asc'
        )
      }

      // Execute query
      const [data, total] = await Promise.all([
        paginatedQuery.execute(),
        this.getQueryCount(queryBuilder)
      ])

      const executionTime = Date.now() - startTime
      const rowsReturned = data.length

      // Record performance metrics
      this.recordQueryPerformance({
        query: cacheKey,
        executionTime,
        rowsReturned,
        memoryUsage: this.estimateMemoryUsage(data),
        timestamp: new Date(),
        optimized: true
      })

      // Check for slow queries
      if (executionTime > this.config.slowQueryThreshold) {
        this.recordSlowQuery(cacheKey, executionTime)
      }

      const result: OptimizedQuery<T> = {
        data: data as T[],
        pagination: {
          offset: validatedPagination.offset,
          limit: validatedPagination.limit,
          total,
          hasNext: validatedPagination.offset + validatedPagination.limit < total,
          hasPrevious: validatedPagination.offset > 0
        },
        performance: {
          executionTime,
          rowsReturned,
          optimized: true
        }
      }

      // Cache the result if it took significant time
      if (this.config.enableQueryCaching && executionTime > this.config.cacheThreshold) {
        this.addToCache(cacheKey, result, 300000) // 5 minutes TTL
      }

      logger.debug('Query executed successfully', {
        metadata: {
          executionTime,
          rowsReturned,
          total,
          pagination: validatedPagination,
          cached: false
        }
      })

      return result

    } catch (error) {
      const executionTime = Date.now() - startTime
      
      logger.error('Query execution failed', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          executionTime,
          pagination: validatedPagination,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)

      applicationMetrics.recordError('query_execution_error', 'QueryOptimizer')
      throw error
    }
  }

  /**
   * Validate and normalize pagination parameters
   */
  private validatePagination(pagination: PaginationParams): PaginationParams {
    const result: PaginationParams = {
      offset: Math.max(0, pagination.offset),
      limit: Math.min(
        Math.max(1, pagination.limit),
        this.config.maxPageSize
      )
    }
    
    if (pagination.orderBy) {
      result.orderBy = pagination.orderBy
      result.orderDirection = pagination.orderDirection || 'asc'
    }
    
    return result
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(queryBuilder: any, pagination: PaginationParams): string {
    try {
      const baseQuery = queryBuilder.compile()
      return `${baseQuery.sql}:${JSON.stringify(baseQuery.parameters)}:${JSON.stringify(pagination)}`
    } catch (error) {
      // Fallback to simple hash
      return `query:${Date.now()}:${Math.random()}`
    }
  }

  /**
   * Get total count for pagination
   */
  private async getQueryCount(queryBuilder: any): Promise<number> {
    try {
      // Simplified count query - in production, implement proper counting
      // This is a placeholder to avoid complex type issues
      return 0
    } catch (error) {
      logger.warn('Failed to get query count', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      return 0
    }
  }

  /**
   * Estimate memory usage of query result
   */
  private estimateMemoryUsage(data: any[]): number {
    try {
      const sample = data.slice(0, 5) // Sample first 5 rows
      const avgSize = sample.reduce((acc, row) => {
        return acc + JSON.stringify(row).length * 2 // Rough estimate
      }, 0) / sample.length

      return avgSize * data.length
    } catch (error) {
      return data.length * 1000 // Default estimate
    }
  }

  /**
   * Record query performance metrics
   */
  private recordQueryPerformance(performance: QueryPerformance): void {
    this.queryPerformanceHistory.push(performance)

    // Keep only last 1000 entries
    if (this.queryPerformanceHistory.length > 1000) {
      this.queryPerformanceHistory.shift()
    }

    // Record metrics
    applicationMetrics.recordDatabaseQuery(
      'optimized_query',
      'multiple_tables',
      performance.executionTime / 1000
    )
  }

  /**
   * Record slow query
   */
  private recordSlowQuery(query: string, executionTime: number): void {
    const count = this.slowQueries.get(query) || 0
    this.slowQueries.set(query, count + 1)

    logger.warn('Slow query detected', {
      metadata: {
        query: query.substring(0, 100) + '...',
        executionTime,
        occurrences: count + 1,
        threshold: this.config.slowQueryThreshold
      }
    })

    applicationMetrics.recordError('slow_query_detected', 'QueryOptimizer')
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): OptimizedQuery<T> | null {
    const cached = this.queryCache.get(key)
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as OptimizedQuery<T>
    }
    
    if (cached) {
      this.queryCache.delete(key) // Remove expired
    }
    
    return null
  }

  /**
   * Add to cache
   */
  private addToCache<T>(key: string, data: OptimizedQuery<T>, ttl: number): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, value] of this.queryCache) {
      if (now - value.timestamp > value.ttl) {
        this.queryCache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug('Query cache cleanup completed', {
        metadata: {
          cleanedEntries: cleaned,
          remainingEntries: this.queryCache.size
        }
      })
    }
  }

  /**
   * Get query performance statistics
   */
  public getPerformanceStats(): {
    totalQueries: number
    averageExecutionTime: number
    slowQueries: number
    cacheHitRate: number
    memoryUsage: number
    topSlowQueries: Array<{ query: string; count: number }>
  } {
    const total = this.queryPerformanceHistory.length
    const avgExecTime = total > 0 
      ? this.queryPerformanceHistory.reduce((acc, q) => acc + q.executionTime, 0) / total
      : 0

    const slowQueries = this.queryPerformanceHistory.filter(
      q => q.executionTime > this.config.slowQueryThreshold
    ).length

    const memoryUsage = this.queryPerformanceHistory.reduce(
      (acc, q) => acc + q.memoryUsage, 0
    )

    const topSlowQueries = Array.from(this.slowQueries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({
        query: query.substring(0, 100) + '...',
        count
      }))

    return {
      totalQueries: total,
      averageExecutionTime: avgExecTime,
      slowQueries,
      cacheHitRate: 0, // Would need to implement cache hit tracking
      memoryUsage,
      topSlowQueries
    }
  }

  /**
   * Optimize specific query types
   */
  public optimizeSelectQuery(baseQuery: any, options: {
    pagination?: PaginationParams
    selectFields?: string[]
    enableJoinOptimization?: boolean
  } = {}): any {
    let optimizedQuery = baseQuery

    // Select only necessary fields
    if (options.selectFields && options.selectFields.length > 0) {
      optimizedQuery = optimizedQuery.select(options.selectFields)
    }

    // Add index hints if enabled
    if (this.config.enableIndexHints) {
      // This would be database-specific implementation
      // For PostgreSQL, we might add specific index hints
    }

    return optimizedQuery
  }

  /**
   * Clear query cache
   */
  public clearCache(): void {
    this.queryCache.clear()
    logger.info('Query cache cleared')
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number
    memoryUsage: number
    hitRate: number
  } {
    const size = this.queryCache.size
    const memoryUsage = Array.from(this.queryCache.values())
      .reduce((acc, entry) => acc + JSON.stringify(entry.data).length * 2, 0)

    return {
      size,
      memoryUsage,
      hitRate: 0 // Would need to implement hit tracking
    }
  }
}

/**
 * Global query optimizer instance
 */
export const queryOptimizer = new QueryOptimizer()

/**
 * Helper function for paginated queries
 */
export async function paginatedQuery<T>(
  db: Kysely<Database>,
  queryBuilder: any,
  pagination: PaginationParams = { offset: 0, limit: 20 }
): Promise<OptimizedQuery<T>> {
  return queryOptimizer.executeOptimizedQuery<T>(db, queryBuilder, pagination)
}

/**
 * Helper function for basic optimization
 */
export function optimizeQuery(baseQuery: any, options: {
  selectFields?: string[]
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
} = {}): any {
  return queryOptimizer.optimizeSelectQuery(baseQuery, options)
} 