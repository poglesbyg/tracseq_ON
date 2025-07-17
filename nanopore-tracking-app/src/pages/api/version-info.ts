import type { APIRoute } from 'astro'
import { apiVersionManager, API_VERSIONS } from '../../lib/api/versioning/ApiVersionManager'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'
import { applicationMetrics } from '../../lib/monitoring/MetricsCollector'

const logger = getComponentLogger('VersionInfoAPI')

export const GET: APIRoute = async ({ request }) => {
  try {
    const startTime = Date.now()
    
    // Detect API version for this request
    const versionContext = apiVersionManager.detectVersion(request)
    
    // Get version statistics
    const versionStats = apiVersionManager.getVersionStats()
    
    // Get supported versions
    const supportedVersions = apiVersionManager.getSupportedVersions()
    
    const versionInfo = {
      api: {
        name: 'Nanopore Tracking API',
        description: 'API for managing nanopore sequencing sample tracking',
        currentVersion: versionContext.version,
        defaultVersion: API_VERSIONS.V2,
        supportedVersions,
        allVersions: Object.values(API_VERSIONS),
      },
      versioning: {
        strategy: 'header-first',
        detection: {
          methods: [
            'URL path (/api/v1/...)',
            'X-API-Version header', 
            'version query parameter',
            'Accept header (application/vnd.nanopore.v1+json)'
          ],
          priority: 'path > header > query > accept'
        },
        compatibility: {
          backwardCompatible: true,
          forwardCompatible: false,
          migrationSupported: true
        }
      },
      statistics: {
        totalRequests: versionStats.totalRequests,
        versionUsage: versionStats.usage,
        mostUsedVersion: versionStats.mostUsedVersion,
        deprecatedUsage: versionStats.deprecatedUsage,
        deprecatedPercentage: versionStats.totalRequests > 0 
          ? Math.round((versionStats.deprecatedUsage / versionStats.totalRequests) * 100 * 100) / 100
          : 0
      },
      versions: {
        [API_VERSIONS.V1]: {
          version: API_VERSIONS.V1,
          status: 'stable',
          releaseDate: '2024-01-01',
          description: 'Initial API version with basic sample tracking',
          features: [
            'Basic sample CRUD operations',
            'Simple status tracking',
            'Basic filtering and search'
          ],
          deprecated: false,
          supportedUntil: '2026-01-01'
        },
        [API_VERSIONS.V2]: {
          version: API_VERSIONS.V2,
          status: 'stable',
          releaseDate: '2024-06-01',
          description: 'Enhanced API with chart field support and improved metadata',
          features: [
            'Chart field integration',
            'Enhanced metadata support',
            'Improved error handling',
            'Better validation',
            'Backward compatibility with v1'
          ],
          deprecated: false,
          supportedUntil: '2027-01-01'
        },
        [API_VERSIONS.V3]: {
          version: API_VERSIONS.V3,
          status: 'development',
          releaseDate: '2025-01-01',
          description: 'Advanced API with performance metrics and workflow tracking',
          features: [
            'Performance metrics tracking',
            'Advanced workflow monitoring',
            'Real-time status updates',
            'Enhanced analytics',
            'Improved caching',
            'Full backward compatibility'
          ],
          deprecated: false,
          supportedUntil: '2028-01-01'
        }
      },
      migrations: {
        available: [
          {
            from: API_VERSIONS.V1,
            to: API_VERSIONS.V2,
            breaking: false,
            description: 'Adds chart_field support and enhanced metadata'
          },
          {
            from: API_VERSIONS.V2,
            to: API_VERSIONS.V3,
            breaking: false,
            description: 'Adds performance metrics and workflow tracking'
          },
          {
            from: API_VERSIONS.V1,
            to: API_VERSIONS.V3,
            breaking: false,
            description: 'Direct migration with all v2 and v3 enhancements'
          }
        ],
        automatic: true,
        strategy: 'runtime'
      },
      endpoints: {
        examples: [
          {
            description: 'Request v1 API via header',
            curl: `curl -H "X-API-Version: v1" "${new URL(request.url).origin}/api/trpc/nanopore.getAll"`
          },
          {
            description: 'Request v2 API via URL path',
            curl: `curl "${new URL(request.url).origin}/api/v2/nanopore"`
          },
          {
            description: 'Request v3 API via query parameter',
            curl: `curl "${new URL(request.url).origin}/api/nanopore?version=v3"`
          },
          {
            description: 'Request specific version via Accept header',
            curl: `curl -H "Accept: application/vnd.nanopore.v2+json" "${new URL(request.url).origin}/api/nanopore"`
          }
        ]
      },
      deprecation: {
        policy: 'Versions are supported for 2 years after release',
        warningPeriod: '6 months before deprecation',
        notifications: [
          'Deprecation warnings in response headers',
          'Documentation updates',
          'Email notifications to registered developers'
        ]
      },
      requestInfo: {
        detectedVersion: versionContext.version,
        userAgent: versionContext.userAgent,
        requestId: versionContext.requestId,
        timestamp: versionContext.timestamp.toISOString(),
        deprecationWarnings: versionContext.deprecationWarnings
      }
    }
    
    const duration = Date.now() - startTime
    
    // Log version info request
    logger.info('Version info requested', {
      metadata: {
        requestedVersion: versionContext.version,
        supportedVersions: supportedVersions.length,
        totalRequests: versionStats.totalRequests,
        userAgent: versionContext.userAgent
      }
    })
    
    // Record metrics
    applicationMetrics.recordHttpRequest('GET', '/api/version-info', 200, duration / 1000)
    
    return new Response(JSON.stringify(versionInfo, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': versionContext.version,
        'X-Request-ID': versionContext.requestId,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        // Add deprecation warnings if present
        ...(versionContext.deprecationWarnings.length > 0 && {
          'X-API-Deprecation-Warning': versionContext.deprecationWarnings.join('; ')
        })
      }
    })
    
  } catch (error) {
    logger.error('Version info request failed', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        url: request.url
      }
    }, error instanceof Error ? error : undefined)
    
    applicationMetrics.recordError('version_info_error', 'VersionInfoAPI')
    
    return new Response(JSON.stringify({
      error: 'Failed to retrieve version information',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
} 