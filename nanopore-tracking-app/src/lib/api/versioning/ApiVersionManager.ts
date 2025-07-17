import { getComponentLogger } from '../../logging/StructuredLogger'
import { applicationMetrics } from '../../monitoring/MetricsCollector'

const logger = getComponentLogger('ApiVersionManager')

/**
 * Supported API versions
 */
export const API_VERSIONS = {
  V1: 'v1',
  V2: 'v2',
  V3: 'v3'
} as const

export type ApiVersion = typeof API_VERSIONS[keyof typeof API_VERSIONS]

/**
 * Version compatibility matrix
 */
export const VERSION_COMPATIBILITY = {
  [API_VERSIONS.V1]: {
    deprecated: false,
    supportedUntil: new Date('2026-01-01'),
    backwardCompatible: [],
    forwardCompatible: [API_VERSIONS.V2]
  },
  [API_VERSIONS.V2]: {
    deprecated: false,
    supportedUntil: new Date('2027-01-01'),
    backwardCompatible: [API_VERSIONS.V1],
    forwardCompatible: [API_VERSIONS.V3]
  },
  [API_VERSIONS.V3]: {
    deprecated: false,
    supportedUntil: new Date('2028-01-01'),
    backwardCompatible: [API_VERSIONS.V1, API_VERSIONS.V2],
    forwardCompatible: []
  }
} as const

/**
 * API request context with version information
 */
export interface ApiRequestContext {
  version: ApiVersion
  userAgent: string
  clientId?: string
  requestId: string
  timestamp: Date
  deprecationWarnings: string[]
}

/**
 * Version migration configuration
 */
export interface VersionMigration {
  from: ApiVersion
  to: ApiVersion
  transform: (data: any) => any
  reverseTransform?: (data: any) => any
  breaking: boolean
  description: string
}

/**
 * API response wrapper with version metadata
 */
export interface VersionedApiResponse<T> {
  data: T
  meta: {
    version: ApiVersion
    requestId: string
    timestamp: string
    deprecationWarnings?: string[]
    migrationInfo?: {
      originalVersion: ApiVersion
      transformedFrom: ApiVersion
      breaking: boolean
    }
  }
}

/**
 * Version detection configuration
 */
export interface VersionDetectionConfig {
  headerName: string
  queryParamName: string
  acceptHeaderPrefix: string
  defaultVersion: ApiVersion
  strictMode: boolean
}

/**
 * API version manager for handling multiple API versions
 */
export class ApiVersionManager {
  private migrations: Map<string, VersionMigration> = new Map()
  private versionUsageStats: Map<ApiVersion, number> = new Map()
  private config: VersionDetectionConfig

  constructor(config: Partial<VersionDetectionConfig> = {}) {
    this.config = {
      headerName: 'X-API-Version',
      queryParamName: 'version',
      acceptHeaderPrefix: 'application/vnd.nanopore.v',
      defaultVersion: API_VERSIONS.V2,
      strictMode: false,
      ...config
    }

    // Initialize version stats
    Object.values(API_VERSIONS).forEach(version => {
      this.versionUsageStats.set(version, 0)
    })

    // Register default migrations
    this.registerDefaultMigrations()

    logger.info('API version manager initialized', {
      metadata: {
        defaultVersion: this.config.defaultVersion,
        supportedVersions: Object.values(API_VERSIONS),
        strictMode: this.config.strictMode
      }
    })
  }

  /**
   * Detect API version from request
   */
  detectVersion(request: Request): ApiRequestContext {
    const url = new URL(request.url)
    const userAgent = request.headers.get('User-Agent') || 'Unknown'
    const requestId = this.generateRequestId()
    
    let version = this.config.defaultVersion
    const deprecationWarnings: string[] = []

    // 1. Check URL path version (highest priority)
    const pathVersion = this.extractVersionFromPath(url.pathname)
    if (pathVersion) {
      version = pathVersion
    }
    
    // 2. Check version header
    else {
      const headerVersion = request.headers.get(this.config.headerName)
      if (headerVersion && this.isValidVersion(headerVersion)) {
        version = headerVersion as ApiVersion
      }
      
      // 3. Check query parameter
      else {
        const queryVersion = url.searchParams.get(this.config.queryParamName)
        if (queryVersion && this.isValidVersion(queryVersion)) {
          version = queryVersion as ApiVersion
        }
        
        // 4. Check Accept header
        else {
          const acceptHeader = request.headers.get('Accept')
          if (acceptHeader) {
            const acceptVersion = this.extractVersionFromAcceptHeader(acceptHeader)
            if (acceptVersion) {
              version = acceptVersion
            }
          }
        }
      }
    }

    // Check for deprecation warnings
    if (this.isVersionDeprecated(version)) {
      const supportedUntil = VERSION_COMPATIBILITY[version].supportedUntil
      deprecationWarnings.push(
        `API version ${version} is deprecated and will be removed on ${supportedUntil.toISOString().split('T')[0]}`
      )
    }

    // Record version usage
    this.recordVersionUsage(version)

    const context: ApiRequestContext = {
      version,
      userAgent,
      requestId,
      timestamp: new Date(),
      deprecationWarnings
    }

    logger.debug('API version detected', {
      metadata: {
        version,
        userAgent,
        requestId,
        hasDeprecationWarnings: deprecationWarnings.length > 0
      }
    })

    return context
  }

  /**
   * Transform data between API versions
   */
  transformData(data: any, fromVersion: ApiVersion, toVersion: ApiVersion): any {
    if (fromVersion === toVersion) {
      return data
    }

    const migrationKey = `${fromVersion}->${toVersion}`
    const migration = this.migrations.get(migrationKey)

    if (migration) {
      logger.debug('Applying version migration', {
        metadata: {
          from: fromVersion,
          to: toVersion,
          breaking: migration.breaking,
          description: migration.description
        }
      })

      try {
        return migration.transform(data)
      } catch (error) {
        logger.error('Version migration failed', {
          errorType: error instanceof Error ? error.name : 'Unknown',
          metadata: {
            from: fromVersion,
            to: toVersion,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        }, error instanceof Error ? error : undefined)

        applicationMetrics.recordError('version_migration_error', 'ApiVersionManager')
        throw new Error(`Failed to migrate from ${fromVersion} to ${toVersion}`)
      }
    }

    // If no direct migration, try to find a path
    const migrationPath = this.findMigrationPath(fromVersion, toVersion)
    if (migrationPath.length > 0) {
      return this.applyMigrationPath(data, migrationPath)
    }

    // If strict mode and no migration found, throw error
    if (this.config.strictMode) {
      throw new Error(`No migration path found from ${fromVersion} to ${toVersion}`)
    }

    // In non-strict mode, return data as-is with warning
    logger.warn('No migration path found, returning data as-is', {
      metadata: {
        from: fromVersion,
        to: toVersion,
        strictMode: this.config.strictMode
      }
    })

    return data
  }

  /**
   * Create versioned API response
   */
  createVersionedResponse<T>(
    data: T,
    context: ApiRequestContext,
    originalVersion?: ApiVersion
  ): VersionedApiResponse<T> {
    const response: VersionedApiResponse<T> = {
      data,
      meta: {
        version: context.version,
        requestId: context.requestId,
        timestamp: context.timestamp.toISOString()
      }
    }

    // Add deprecation warnings if present
    if (context.deprecationWarnings.length > 0) {
      response.meta.deprecationWarnings = context.deprecationWarnings
    }

    // Add migration info if data was transformed
    if (originalVersion && originalVersion !== context.version) {
      response.meta.migrationInfo = {
        originalVersion,
        transformedFrom: originalVersion,
        breaking: this.isMigrationBreaking(originalVersion, context.version)
      }
    }

    return response
  }

  /**
   * Register a new version migration
   */
  registerMigration(migration: VersionMigration): void {
    const key = `${migration.from}->${migration.to}`
    this.migrations.set(key, migration)

    logger.info('Version migration registered', {
      metadata: {
        from: migration.from,
        to: migration.to,
        breaking: migration.breaking,
        description: migration.description
      }
    })
  }

  /**
   * Get version usage statistics
   */
  getVersionStats(): {
    usage: Record<ApiVersion, number>
    totalRequests: number
    deprecatedUsage: number
    mostUsedVersion: ApiVersion
  } {
    const usage = Object.fromEntries(this.versionUsageStats) as Record<ApiVersion, number>
    const totalRequests = Array.from(this.versionUsageStats.values()).reduce((sum, count) => sum + count, 0)
    
    const deprecatedUsage = Object.entries(usage)
      .filter(([version]) => this.isVersionDeprecated(version as ApiVersion))
      .reduce((sum, [, count]) => sum + count, 0)

    const mostUsedVersion = Object.entries(usage)
      .reduce((max, [version, count]) => {
        return count > max.count ? { version: version as ApiVersion, count } : max
      }, { version: API_VERSIONS.V1 as ApiVersion, count: 0 }).version

    return {
      usage,
      totalRequests,
      deprecatedUsage,
      mostUsedVersion
    }
  }

  /**
   * Check if version is supported
   */
  isVersionSupported(version: string): boolean {
    return this.isValidVersion(version) && !this.isVersionExpired(version as ApiVersion)
  }

  /**
   * Get supported versions
   */
  getSupportedVersions(): ApiVersion[] {
    return Object.values(API_VERSIONS).filter(version => 
      !this.isVersionExpired(version)
    )
  }

  /**
   * Private helper methods
   */
  private extractVersionFromPath(pathname: string): ApiVersion | null {
    const match = pathname.match(/^\/api\/(v\d+)\//)
    return match && match[1] && this.isValidVersion(match[1]) ? match[1] as ApiVersion : null
  }

  private extractVersionFromAcceptHeader(acceptHeader: string): ApiVersion | null {
    const match = acceptHeader.match(new RegExp(`${this.config.acceptHeaderPrefix}(\\d+)`))
    if (match && match[1]) {
      const version = `v${match[1]}`
      return this.isValidVersion(version) ? version as ApiVersion : null
    }
    return null
  }

  private isValidVersion(version: string): boolean {
    return Object.values(API_VERSIONS).includes(version as ApiVersion)
  }

  private isVersionDeprecated(version: ApiVersion): boolean {
    return VERSION_COMPATIBILITY[version].deprecated
  }

  private isVersionExpired(version: ApiVersion): boolean {
    const supportedUntil = VERSION_COMPATIBILITY[version].supportedUntil
    return new Date() > supportedUntil
  }

  private isMigrationBreaking(fromVersion: ApiVersion, toVersion: ApiVersion): boolean {
    const migrationKey = `${fromVersion}->${toVersion}`
    const migration = this.migrations.get(migrationKey)
    return migration?.breaking || false
  }

  private recordVersionUsage(version: ApiVersion): void {
    const current = this.versionUsageStats.get(version) || 0
    this.versionUsageStats.set(version, current + 1)
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  private findMigrationPath(fromVersion: ApiVersion, toVersion: ApiVersion): VersionMigration[] {
    // Simple implementation - in production, use a graph algorithm
    const directKey = `${fromVersion}->${toVersion}`
    const directMigration = this.migrations.get(directKey)
    
    if (directMigration) {
      return [directMigration]
    }

    // For now, return empty array - implement breadth-first search for complex paths
    return []
  }

  private applyMigrationPath(data: any, path: VersionMigration[]): any {
    return path.reduce((currentData, migration) => {
      return migration.transform(currentData)
    }, data)
  }

  private registerDefaultMigrations(): void {
    // V1 -> V2 migration
    this.registerMigration({
      from: API_VERSIONS.V1,
      to: API_VERSIONS.V2,
      breaking: false,
      description: 'Add chart_field support and enhanced metadata',
      transform: (data: any) => {
        if (Array.isArray(data)) {
          return data.map(item => ({
            ...item,
            chart_field: item.chart_field || null,
            metadata: {
              version: API_VERSIONS.V2,
              migrated: true,
              ...item.metadata
            }
          }))
        }
        return {
          ...data,
          chart_field: data.chart_field || null,
          metadata: {
            version: API_VERSIONS.V2,
            migrated: true,
            ...data.metadata
          }
        }
      }
    })

    // V2 -> V3 migration
    this.registerMigration({
      from: API_VERSIONS.V2,
      to: API_VERSIONS.V3,
      breaking: false,
      description: 'Add performance metrics and enhanced workflow tracking',
      transform: (data: any) => {
        if (Array.isArray(data)) {
          return data.map(item => ({
            ...item,
            performance_metrics: {
              processing_time: null,
              quality_score: null,
              resource_usage: null
            },
            workflow_tracking: {
              current_step: item.status || 'submitted',
              step_history: [],
              estimated_completion: null
            },
            metadata: {
              ...item.metadata,
              version: API_VERSIONS.V3,
              migrated: true
            }
          }))
        }
        return {
          ...data,
          performance_metrics: {
            processing_time: null,
            quality_score: null,
            resource_usage: null
          },
          workflow_tracking: {
            current_step: data.status || 'submitted',
            step_history: [],
            estimated_completion: null
          },
          metadata: {
            ...data.metadata,
            version: API_VERSIONS.V3,
            migrated: true
          }
        }
      }
    })

    // V1 -> V3 migration (direct path)
    this.registerMigration({
      from: API_VERSIONS.V1,
      to: API_VERSIONS.V3,
      breaking: false,
      description: 'Direct migration from V1 to V3 with all enhancements',
      transform: (data: any) => {
        // First apply V1->V2 transformation
        const v2Data = this.migrations.get(`${API_VERSIONS.V1}->${API_VERSIONS.V2}`)?.transform(data)
        // Then apply V2->V3 transformation
        return this.migrations.get(`${API_VERSIONS.V2}->${API_VERSIONS.V3}`)?.transform(v2Data)
      }
    })
  }
}

/**
 * Global API version manager instance
 */
export const apiVersionManager = new ApiVersionManager()

/**
 * Middleware function for API version detection
 */
export function detectApiVersion(request: Request): ApiRequestContext {
  return apiVersionManager.detectVersion(request)
}

/**
 * Helper function to create versioned response
 */
export function createVersionedResponse<T>(
  data: T,
  context: ApiRequestContext,
  originalVersion?: ApiVersion
): VersionedApiResponse<T> {
  return apiVersionManager.createVersionedResponse(data, context, originalVersion)
}

/**
 * Transform data for specific API version
 */
export function transformForVersion<T>(
  data: T,
  fromVersion: ApiVersion,
  toVersion: ApiVersion
): T {
  return apiVersionManager.transformData(data, fromVersion, toVersion)
} 