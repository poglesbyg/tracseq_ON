import { ConfigManager } from '../config/ConfigManager'
import { StructuredLogger } from '../logging/StructuredLogger'

// Service registration interface
interface ServiceRegistration {
  name: string
  version: string
  host: string
  port: number
  healthCheckUrl: string
  metadata: Record<string, any>
  lastHeartbeat: number
  status: 'healthy' | 'unhealthy' | 'unknown'
}

// Service endpoint interface
interface ServiceEndpoint {
  name: string
  url: string
  version: string
  status: string
  metadata: Record<string, any>
}

export class ServiceDiscovery {
  private static instance: ServiceDiscovery
  private config: ConfigManager
  private logger: StructuredLogger
  private services: Map<string, ServiceRegistration> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private readonly HEARTBEAT_INTERVAL = 30000 // 30 seconds
  private readonly SERVICE_TIMEOUT = 90000 // 90 seconds

  private constructor() {
    this.config = ConfigManager.getInstance()
    this.logger = new StructuredLogger('service-discovery')
    this.initializeDefaultServices()
    this.startHeartbeat()
  }

  static getInstance(): ServiceDiscovery {
    if (!ServiceDiscovery.instance) {
      ServiceDiscovery.instance = new ServiceDiscovery()
    }
    return ServiceDiscovery.instance
  }

  private initializeDefaultServices(): void {
    // Sample Management Service
    this.registerService({
      name: 'sample-management',
      version: '1.0.0',
      host: this.config.get('SAMPLE_SERVICE_HOST', 'localhost'),
      port: parseInt(this.config.get('SAMPLE_SERVICE_PORT', '3002')),
      healthCheckUrl: '/health',
      metadata: {
        description: 'Sample Management Service for nanopore tracking',
        endpoints: ['/api/samples', '/api/sample', '/api/nanopore'],
        database: 'sample_db'
      },
      lastHeartbeat: Date.now(),
      status: 'unknown'
    })

    // AI Processing Service
    this.registerService({
      name: 'ai-processing',
      version: '1.0.0',
      host: this.config.get('AI_SERVICE_HOST', 'localhost'),
      port: parseInt(this.config.get('AI_SERVICE_PORT', '3003')),
      healthCheckUrl: '/health',
      metadata: {
        description: 'AI Processing Service for PDF analysis and LLM integration',
        endpoints: ['/api/ai', '/api/process-pdf', '/api/extract'],
        dependencies: ['ollama', 'vector-db']
      },
      lastHeartbeat: Date.now(),
      status: 'unknown'
    })

    // Authentication Service
    this.registerService({
      name: 'authentication',
      version: '1.0.0',
      host: this.config.get('AUTH_SERVICE_HOST', 'localhost'),
      port: parseInt(this.config.get('AUTH_SERVICE_PORT', '3004')),
      healthCheckUrl: '/health',
      metadata: {
        description: 'Authentication Service for user management and access control',
        endpoints: ['/api/auth', '/api/admin', '/api/login'],
        authProvider: 'better-auth'
      },
      lastHeartbeat: Date.now(),
      status: 'unknown'
    })

    // File Storage Service
    this.registerService({
      name: 'file-storage',
      version: '1.0.0',
      host: this.config.get('FILE_SERVICE_HOST', 'localhost'),
      port: parseInt(this.config.get('FILE_SERVICE_PORT', '3005')),
      healthCheckUrl: '/health',
      metadata: {
        description: 'File Storage Service for document management',
        endpoints: ['/api/files', '/api/upload', '/api/storage'],
        storageType: 'local'
      },
      lastHeartbeat: Date.now(),
      status: 'unknown'
    })

    // Audit Service
    this.registerService({
      name: 'audit',
      version: '1.0.0',
      host: this.config.get('AUDIT_SERVICE_HOST', 'localhost'),
      port: parseInt(this.config.get('AUDIT_SERVICE_PORT', '3006')),
      healthCheckUrl: '/health',
      metadata: {
        description: 'Audit Service for logging and monitoring',
        endpoints: ['/api/audit', '/api/metrics', '/api/monitoring'],
        logLevel: 'info'
      },
      lastHeartbeat: Date.now(),
      status: 'unknown'
    })
  }

  /**
   * Register a new service
   */
  registerService(registration: ServiceRegistration): void {
    this.services.set(registration.name, {
      ...registration,
      lastHeartbeat: Date.now(),
      status: 'unknown'
    })

    this.logger.info('Service registered', {
      service: registration.name,
      version: registration.version,
      host: registration.host,
      port: registration.port
    })
  }

  /**
   * Deregister a service
   */
  deregisterService(serviceName: string): void {
    const service = this.services.get(serviceName)
    if (service) {
      this.services.delete(serviceName)
      this.logger.info('Service deregistered', { service: serviceName })
    }
  }

  /**
   * Update service heartbeat
   */
  updateHeartbeat(serviceName: string): void {
    const service = this.services.get(serviceName)
    if (service) {
      service.lastHeartbeat = Date.now()
      service.status = 'healthy'
    }
  }

  /**
   * Get service endpoint
   */
  getServiceEndpoint(serviceName: string): ServiceEndpoint | null {
    const service = this.services.get(serviceName)
    if (!service) {
      return null
    }

    return {
      name: service.name,
      url: `http://${service.host}:${service.port}`,
      version: service.version,
      status: service.status,
      metadata: service.metadata
    }
  }

  /**
   * Get all service endpoints
   */
  getAllServiceEndpoints(): ServiceEndpoint[] {
    return Array.from(this.services.values()).map(service => ({
      name: service.name,
      url: `http://${service.host}:${service.port}`,
      version: service.version,
      status: service.status,
      metadata: service.metadata
    }))
  }

  /**
   * Get healthy service endpoints
   */
  getHealthyServiceEndpoints(): ServiceEndpoint[] {
    return this.getAllServiceEndpoints().filter(service => service.status === 'healthy')
  }

  /**
   * Find service by endpoint pattern
   */
  findServiceByEndpoint(endpoint: string): ServiceEndpoint | null {
    for (const service of this.services.values()) {
      const endpoints = service.metadata.endpoints || []
      if (endpoints.some(ep => endpoint.startsWith(ep))) {
        return this.getServiceEndpoint(service.name)
      }
    }
    return null
  }

  /**
   * Check if service is healthy
   */
  async checkServiceHealth(serviceName: string): Promise<boolean> {
    const service = this.services.get(serviceName)
    if (!service) {
      return false
    }

    try {
      const response = await fetch(`http://${service.host}:${service.port}${service.healthCheckUrl}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      })

      const isHealthy = response.ok
      service.status = isHealthy ? 'healthy' : 'unhealthy'
      
      if (isHealthy) {
        this.updateHeartbeat(serviceName)
      }

      return isHealthy
    } catch (error) {
      service.status = 'unhealthy'
      this.logger.warn('Service health check failed', {
        service: serviceName,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  /**
   * Check all services health
   */
  async checkAllServicesHealth(): Promise<Record<string, boolean>> {
    const healthStatus: Record<string, boolean> = {}

    for (const [serviceName] of this.services) {
      healthStatus[serviceName] = await this.checkServiceHealth(serviceName)
    }

    return healthStatus
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat()
    }, this.HEARTBEAT_INTERVAL)
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Perform heartbeat check
   */
  private async performHeartbeat(): Promise<void> {
    const now = Date.now()

    for (const [serviceName, service] of this.services) {
      // Check if service is stale
      if (now - service.lastHeartbeat > this.SERVICE_TIMEOUT) {
        service.status = 'unhealthy'
        this.logger.warn('Service heartbeat timeout', {
          service: serviceName,
          lastHeartbeat: new Date(service.lastHeartbeat).toISOString()
        })
      }

      // Perform health check for unhealthy services
      if (service.status !== 'healthy') {
        await this.checkServiceHealth(serviceName)
      }
    }
  }

  /**
   * Get service discovery metrics
   */
  getMetrics(): Record<string, any> {
    const now = Date.now()
    const metrics: Record<string, any> = {
      totalServices: this.services.size,
      healthyServices: 0,
      unhealthyServices: 0,
      unknownServices: 0,
      services: {}
    }

    for (const [serviceName, service] of this.services) {
      const age = now - service.lastHeartbeat
      
      metrics.services[serviceName] = {
        status: service.status,
        version: service.version,
        age: Math.round(age / 1000), // Age in seconds
        host: service.host,
        port: service.port,
        metadata: service.metadata
      }

      switch (service.status) {
        case 'healthy':
          metrics.healthyServices++
          break
        case 'unhealthy':
          metrics.unhealthyServices++
          break
        case 'unknown':
          metrics.unknownServices++
          break
      }
    }

    return metrics
  }

  /**
   * Get service dependencies
   */
  getServiceDependencies(serviceName: string): string[] {
    const service = this.services.get(serviceName)
    if (!service) {
      return []
    }

    return service.metadata.dependencies || []
  }

  /**
   * Check if all dependencies are healthy
   */
  async checkDependenciesHealth(serviceName: string): Promise<Record<string, boolean>> {
    const dependencies = this.getServiceDependencies(serviceName)
    const healthStatus: Record<string, boolean> = {}

    for (const dependency of dependencies) {
      healthStatus[dependency] = await this.checkServiceHealth(dependency)
    }

    return healthStatus
  }
}