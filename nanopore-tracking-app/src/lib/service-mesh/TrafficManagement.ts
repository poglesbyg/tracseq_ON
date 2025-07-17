import { getComponentLogger } from '../logging/StructuredLogger'
import { ServiceMeshProxy, type ServiceEndpoint } from './ServiceMesh'

const logger = getComponentLogger('TrafficManagement')

/**
 * Traffic routing rule
 */
export interface TrafficRule {
  id: string
  name: string
  priority: number
  enabled: boolean
  conditions: RouteCondition[]
  destinations: RouteDestination[]
  timeout?: number
  retries?: number
  faultInjection?: FaultInjection
}

/**
 * Route condition for traffic matching
 */
export interface RouteCondition {
  type: 'header' | 'path' | 'method' | 'query' | 'source_service'
  field: string
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex'
  value: string
}

/**
 * Route destination with weight
 */
export interface RouteDestination {
  service: string
  version?: string
  weight: number
  subset?: string
}

/**
 * Fault injection configuration
 */
export interface FaultInjection {
  delay?: {
    percentage: number
    fixedDelay: number
  }
  abort?: {
    percentage: number
    httpStatus: number
  }
}

/**
 * Canary deployment configuration
 */
export interface CanaryDeployment {
  id: string
  serviceName: string
  stableVersion: string
  canaryVersion: string
  trafficSplit: {
    stable: number
    canary: number
  }
  successCriteria: {
    errorRate: number
    responseTime: number
    duration: number
  }
  rollbackCriteria: {
    errorRate: number
    responseTime: number
  }
  autoPromote: boolean
  autoRollback: boolean
}

/**
 * Load balancing policy
 */
export interface LoadBalancingPolicy {
  algorithm: 'round_robin' | 'least_connections' | 'random' | 'weighted' | 'ip_hash'
  consistentHash?: {
    httpHeader?: string
    httpCookie?: string
    useSourceIp?: boolean
  }
  outlierDetection?: {
    consecutiveErrors: number
    interval: number
    baseEjectionTime: number
    maxEjectionPercent: number
  }
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean
  requestsPerSecond: number
  burstSize: number
  keyExtractor: 'source_ip' | 'source_service' | 'user_id' | 'api_key'
  customKey?: string
}

/**
 * Traffic management system
 */
export class TrafficManager {
  private serviceMesh: ServiceMeshProxy
  private trafficRules: Map<string, TrafficRule> = new Map()
  private canaryDeployments: Map<string, CanaryDeployment> = new Map()
  private loadBalancingPolicies: Map<string, LoadBalancingPolicy> = new Map()
  private rateLimiters: Map<string, RateLimitConfig> = new Map()
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map()

  constructor(serviceMesh: ServiceMeshProxy) {
    this.serviceMesh = serviceMesh
    this.initializeTrafficManagement()
  }

  /**
   * Initialize traffic management
   */
  private initializeTrafficManagement(): void {
    logger.info('Initializing traffic management', {
      action: 'initialize_traffic_management'
    })

    // Set up default traffic rules
    this.setupDefaultTrafficRules()
    
    // Start periodic cleanup
    this.startPeriodicCleanup()
  }

  /**
   * Add traffic rule
   */
  addTrafficRule(rule: TrafficRule): void {
    // Validate rule
    if (!this.validateTrafficRule(rule)) {
      throw new Error(`Invalid traffic rule: ${rule.name}`)
    }

    this.trafficRules.set(rule.id, rule)
    
    logger.info('Traffic rule added', {
      action: 'add_traffic_rule',
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        priority: rule.priority,
        enabled: rule.enabled
      }
    })
  }

  /**
   * Remove traffic rule
   */
  removeTrafficRule(ruleId: string): boolean {
    const removed = this.trafficRules.delete(ruleId)
    
    if (removed) {
      logger.info('Traffic rule removed', {
        action: 'remove_traffic_rule',
        metadata: { ruleId }
      })
    }
    
    return removed
  }

  /**
   * Route request based on traffic rules
   */
  async routeRequest(
    method: string,
    path: string,
    headers: Record<string, string>,
    sourceService: string,
    targetService: string
  ): Promise<{ endpoint: ServiceEndpoint; rule?: TrafficRule }> {
    // Get applicable rules sorted by priority
    const applicableRules = this.getApplicableRules(method, path, headers, sourceService, targetService)
    
    // Apply rate limiting
    await this.applyRateLimit(sourceService, targetService, headers)
    
    // Find matching rule
    for (const rule of applicableRules) {
      if (this.evaluateRuleConditions(rule, method, path, headers, sourceService)) {
        // Apply fault injection if configured
        await this.applyFaultInjection(rule.faultInjection)
        
        // Select destination based on rule
        const destination = this.selectDestination(rule.destinations)
        const endpoint = this.serviceMesh.selectEndpoint(destination.service)
        
        if (endpoint) {
          logger.debug('Request routed by traffic rule', {
            action: 'route_request',
            metadata: {
              ruleId: rule.id,
              ruleName: rule.name,
              targetService: destination.service,
              endpointId: endpoint.id
            }
          })
          
          return { endpoint, rule }
        }
      }
    }
    
    // Fallback to default routing
    const endpoint = this.serviceMesh.selectEndpoint(targetService)
    if (!endpoint) {
      throw new Error(`No healthy endpoints available for service: ${targetService}`)
    }
    
    return { endpoint }
  }

  /**
   * Create canary deployment
   */
  createCanaryDeployment(canary: CanaryDeployment): void {
    this.canaryDeployments.set(canary.id, canary)
    
    // Create traffic rule for canary
    const canaryRule: TrafficRule = {
      id: `canary-${canary.id}`,
      name: `Canary deployment for ${canary.serviceName}`,
      priority: 100,
      enabled: true,
      conditions: [
        {
          type: 'header',
          field: 'x-canary-user',
          operator: 'equals',
          value: 'true'
        }
      ],
      destinations: [
        {
          service: canary.serviceName,
          version: canary.stableVersion,
          weight: canary.trafficSplit.stable
        },
        {
          service: canary.serviceName,
          version: canary.canaryVersion,
          weight: canary.trafficSplit.canary
        }
      ]
    }
    
    this.addTrafficRule(canaryRule)
    
    logger.info('Canary deployment created', {
      action: 'create_canary_deployment',
      metadata: {
        canaryId: canary.id,
        serviceName: canary.serviceName,
        stableVersion: canary.stableVersion,
        canaryVersion: canary.canaryVersion,
        trafficSplit: canary.trafficSplit
      }
    })
  }

  /**
   * Update canary traffic split
   */
  updateCanaryTrafficSplit(canaryId: string, trafficSplit: { stable: number; canary: number }): void {
    const canary = this.canaryDeployments.get(canaryId)
    if (!canary) {
      throw new Error(`Canary deployment not found: ${canaryId}`)
    }
    
    canary.trafficSplit = trafficSplit
    
         // Update traffic rule
     const ruleId = `canary-${canaryId}`
     const rule = this.trafficRules.get(ruleId)
     if (rule && rule.destinations.length >= 2) {
       rule.destinations[0]!.weight = trafficSplit.stable
       rule.destinations[1]!.weight = trafficSplit.canary
     }
    
    logger.info('Canary traffic split updated', {
      action: 'update_canary_traffic_split',
      metadata: {
        canaryId,
        trafficSplit
      }
    })
  }

  /**
   * Promote canary deployment
   */
  promoteCanaryDeployment(canaryId: string): void {
    const canary = this.canaryDeployments.get(canaryId)
    if (!canary) {
      throw new Error(`Canary deployment not found: ${canaryId}`)
    }
    
    // Update traffic split to 100% canary
    this.updateCanaryTrafficSplit(canaryId, { stable: 0, canary: 100 })
    
    logger.info('Canary deployment promoted', {
      action: 'promote_canary_deployment',
      metadata: {
        canaryId,
        serviceName: canary.serviceName,
        promotedVersion: canary.canaryVersion
      }
    })
  }

  /**
   * Rollback canary deployment
   */
  rollbackCanaryDeployment(canaryId: string): void {
    const canary = this.canaryDeployments.get(canaryId)
    if (!canary) {
      throw new Error(`Canary deployment not found: ${canaryId}`)
    }
    
    // Update traffic split to 100% stable
    this.updateCanaryTrafficSplit(canaryId, { stable: 100, canary: 0 })
    
    logger.warn('Canary deployment rolled back', {
      action: 'rollback_canary_deployment',
      metadata: {
        canaryId,
        serviceName: canary.serviceName,
        rolledBackVersion: canary.canaryVersion
      }
    })
  }

  /**
   * Configure load balancing policy
   */
  configureLoadBalancing(serviceName: string, policy: LoadBalancingPolicy): void {
    this.loadBalancingPolicies.set(serviceName, policy)
    
    logger.info('Load balancing policy configured', {
      action: 'configure_load_balancing',
      metadata: {
        serviceName,
        algorithm: policy.algorithm
      }
    })
  }

  /**
   * Configure rate limiting
   */
  configureRateLimit(serviceName: string, config: RateLimitConfig): void {
    this.rateLimiters.set(serviceName, config)
    
    logger.info('Rate limiting configured', {
      action: 'configure_rate_limit',
      metadata: {
        serviceName,
        requestsPerSecond: config.requestsPerSecond,
        burstSize: config.burstSize
      }
    })
  }

  /**
   * Get applicable traffic rules
   */
  private getApplicableRules(
    method: string,
    path: string,
    headers: Record<string, string>,
    sourceService: string,
    targetService: string
  ): TrafficRule[] {
    const rules = Array.from(this.trafficRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority)
    
    return rules
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateRuleConditions(
    rule: TrafficRule,
    method: string,
    path: string,
    headers: Record<string, string>,
    sourceService: string
  ): boolean {
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, method, path, headers, sourceService)) {
        return false
      }
    }
    return true
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(
    condition: RouteCondition,
    method: string,
    path: string,
    headers: Record<string, string>,
    sourceService: string
  ): boolean {
    let value: string
    
    switch (condition.type) {
      case 'method':
        value = method
        break
      case 'path':
        value = path
        break
      case 'header':
        value = headers[condition.field] || ''
        break
             case 'query':
         // Extract query parameter (simplified)
         const queryMatch = path.match(new RegExp(`[?&]${condition.field}=([^&]*)`))
         value = queryMatch ? queryMatch[1]! : ''
         break
      case 'source_service':
        value = sourceService
        break
      default:
        return false
    }
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value
      case 'contains':
        return value.includes(condition.value)
      case 'starts_with':
        return value.startsWith(condition.value)
      case 'ends_with':
        return value.endsWith(condition.value)
      case 'regex':
        return new RegExp(condition.value).test(value)
      default:
        return false
    }
  }

  /**
   * Select destination based on weights
   */
  private selectDestination(destinations: RouteDestination[]): RouteDestination {
    const totalWeight = destinations.reduce((sum, dest) => sum + dest.weight, 0)
    let random = Math.random() * totalWeight
    
    for (const destination of destinations) {
      random -= destination.weight
      if (random <= 0) {
        return destination
      }
    }
    
         return destinations[0]!
  }

  /**
   * Apply fault injection
   */
  private async applyFaultInjection(faultInjection?: FaultInjection): Promise<void> {
    if (!faultInjection) return
    
    // Apply delay
    if (faultInjection.delay && Math.random() * 100 < faultInjection.delay.percentage) {
      await new Promise(resolve => setTimeout(resolve, faultInjection.delay!.fixedDelay))
      
      logger.debug('Fault injection delay applied', {
        action: 'fault_injection_delay',
        metadata: { delay: faultInjection.delay.fixedDelay }
      })
    }
    
    // Apply abort
    if (faultInjection.abort && Math.random() * 100 < faultInjection.abort.percentage) {
      logger.debug('Fault injection abort applied', {
        action: 'fault_injection_abort',
        metadata: { httpStatus: faultInjection.abort.httpStatus }
      })
      
      throw new Error(`Fault injection abort: ${faultInjection.abort.httpStatus}`)
    }
  }

  /**
   * Apply rate limiting
   */
  private async applyRateLimit(
    sourceService: string,
    targetService: string,
    headers: Record<string, string>
  ): Promise<void> {
    const rateLimitConfig = this.rateLimiters.get(targetService)
    if (!rateLimitConfig || !rateLimitConfig.enabled) {
      return
    }
    
    const key = this.getRateLimitKey(rateLimitConfig, sourceService, headers)
    const now = Date.now()
    const windowStart = Math.floor(now / 1000) * 1000
    
    let counter = this.rateLimitCounters.get(key)
    if (!counter || counter.resetTime < windowStart) {
      counter = { count: 0, resetTime: windowStart + 1000 }
      this.rateLimitCounters.set(key, counter)
    }
    
    if (counter.count >= rateLimitConfig.requestsPerSecond) {
      logger.warn('Rate limit exceeded', {
        action: 'rate_limit_exceeded',
        metadata: {
          key,
          count: counter.count,
          limit: rateLimitConfig.requestsPerSecond
        }
      })
      
      throw new Error('Rate limit exceeded')
    }
    
    counter.count++
  }

  /**
   * Get rate limit key
   */
  private getRateLimitKey(
    config: RateLimitConfig,
    sourceService: string,
    headers: Record<string, string>
  ): string {
    switch (config.keyExtractor) {
      case 'source_service':
        return `service:${sourceService}`
      case 'source_ip':
        return `ip:${headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown'}`
      case 'user_id':
        return `user:${headers['x-user-id'] || 'anonymous'}`
      case 'api_key':
        return `api:${headers['x-api-key'] || 'no-key'}`
      default:
        return config.customKey || 'default'
    }
  }

  /**
   * Validate traffic rule
   */
  private validateTrafficRule(rule: TrafficRule): boolean {
    if (!rule.id || !rule.name) {
      return false
    }
    
    if (rule.conditions.length === 0) {
      return false
    }
    
    if (rule.destinations.length === 0) {
      return false
    }
    
    const totalWeight = rule.destinations.reduce((sum, dest) => sum + dest.weight, 0)
    if (totalWeight <= 0) {
      return false
    }
    
    return true
  }

  /**
   * Setup default traffic rules
   */
  private setupDefaultTrafficRules(): void {
    // Health check bypass rule
    const healthCheckRule: TrafficRule = {
      id: 'health-check-bypass',
      name: 'Health Check Bypass',
      priority: 1000,
      enabled: true,
      conditions: [
        {
          type: 'path',
          field: 'path',
          operator: 'equals',
          value: '/health'
        }
      ],
      destinations: [
        {
          service: 'any',
          weight: 100
        }
      ]
    }
    
    this.addTrafficRule(healthCheckRule)
    
    // Metrics bypass rule
    const metricsRule: TrafficRule = {
      id: 'metrics-bypass',
      name: 'Metrics Bypass',
      priority: 999,
      enabled: true,
      conditions: [
        {
          type: 'path',
          field: 'path',
          operator: 'equals',
          value: '/metrics'
        }
      ],
      destinations: [
        {
          service: 'any',
          weight: 100
        }
      ]
    }
    
    this.addTrafficRule(metricsRule)
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupRateLimitCounters()
    }, 60000) // Every minute
  }

  /**
   * Cleanup expired rate limit counters
   */
  private cleanupRateLimitCounters(): void {
    const now = Date.now()
    
    for (const [key, counter] of this.rateLimitCounters.entries()) {
      if (counter.resetTime < now) {
        this.rateLimitCounters.delete(key)
      }
    }
  }

  /**
   * Get traffic management statistics
   */
  getStatistics(): {
    trafficRules: number
    canaryDeployments: number
    rateLimiters: number
    activeRateLimitCounters: number
  } {
    return {
      trafficRules: this.trafficRules.size,
      canaryDeployments: this.canaryDeployments.size,
      rateLimiters: this.rateLimiters.size,
      activeRateLimitCounters: this.rateLimitCounters.size
    }
  }

  /**
   * Get all traffic rules
   */
  getTrafficRules(): TrafficRule[] {
    return Array.from(this.trafficRules.values())
  }

  /**
   * Get all canary deployments
   */
  getCanaryDeployments(): CanaryDeployment[] {
    return Array.from(this.canaryDeployments.values())
  }
}

/**
 * Default traffic management configurations
 */
export const defaultTrafficConfigs = {
  production: {
    rateLimiting: {
      enabled: true,
      requestsPerSecond: 1000,
      burstSize: 100,
      keyExtractor: 'source_service' as const
    },
    faultInjection: {
      enabled: false
    },
    canaryDeployment: {
      autoPromote: false,
      autoRollback: true,
      successCriteria: {
        errorRate: 0.01,
        responseTime: 500,
        duration: 300000 // 5 minutes
      }
    }
  },
  
  development: {
    rateLimiting: {
      enabled: false,
      requestsPerSecond: 100,
      burstSize: 10,
      keyExtractor: 'source_ip' as const
    },
    faultInjection: {
      enabled: true
    },
    canaryDeployment: {
      autoPromote: true,
      autoRollback: true,
      successCriteria: {
        errorRate: 0.05,
        responseTime: 1000,
        duration: 60000 // 1 minute
      }
    }
  }
} 