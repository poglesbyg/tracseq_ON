interface ServiceInstance {
  id: string
  host: string
  port: number
  healthy: boolean
  lastHealthCheck: Date
  activeConnections: number
  averageResponseTime: number
  errorRate: number
  weight: number
}

interface LoadBalancerConfig {
  algorithm: 'round_robin' | 'least_connections' | 'weighted_round_robin' | 'ip_hash'
  healthCheckInterval: number
  healthCheckTimeout: number
  maxRetries: number
  retryDelay: number
  circuitBreakerThreshold: number
  circuitBreakerTimeout: number
}

interface HealthCheckResult {
  healthy: boolean
  responseTime: number
  error?: string
}

class LoadBalancer {
  private instances: Map<string, ServiceInstance> = new Map()
  private config: LoadBalancerConfig
  private currentIndex = 0
  private circuitBreakers: Map<string, { open: boolean; openedAt: Date; failures: number }> = new Map()
  private healthCheckInterval: NodeJS.Timeout | null = null

  constructor(config?: Partial<LoadBalancerConfig>) {
    this.config = {
      algorithm: 'round_robin',
      healthCheckInterval: 15000,
      healthCheckTimeout: 5000,
      maxRetries: 3,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      ...config
    }
  }

  registerInstance(instance: Omit<ServiceInstance, 'healthy' | 'lastHealthCheck' | 'activeConnections' | 'averageResponseTime' | 'errorRate'>): void {
    const fullInstance: ServiceInstance = {
      ...instance,
      healthy: true,
      lastHealthCheck: new Date(),
      activeConnections: 0,
      averageResponseTime: 0,
      errorRate: 0
    }

    this.instances.set(instance.id, fullInstance)
    this.circuitBreakers.set(instance.id, { open: false, openedAt: new Date(), failures: 0 })
    
    console.log(`Registered service instance: ${instance.id} at ${instance.host}:${instance.port}`)
  }

  unregisterInstance(instanceId: string): void {
    this.instances.delete(instanceId)
    this.circuitBreakers.delete(instanceId)
    console.log(`Unregistered service instance: ${instanceId}`)
  }

  getHealthyInstances(): ServiceInstance[] {
    return Array.from(this.instances.values()).filter(instance => {
      const circuitBreaker = this.circuitBreakers.get(instance.id)
      return instance.healthy && !(circuitBreaker?.open ?? false)
    })
  }

  selectInstance(clientIp?: string): ServiceInstance | null {
    const healthyInstances = this.getHealthyInstances()
    
    if (healthyInstances.length === 0) {
      return null
    }

    switch (this.config.algorithm) {
      case 'round_robin':
        return this.roundRobinSelection(healthyInstances)
      
      case 'least_connections':
        return this.leastConnectionsSelection(healthyInstances)
      
      case 'weighted_round_robin':
        return this.weightedRoundRobinSelection(healthyInstances)
      
      case 'ip_hash':
        return this.ipHashSelection(healthyInstances, clientIp)
      
      default:
        return this.roundRobinSelection(healthyInstances)
    }
  }

  private roundRobinSelection(instances: ServiceInstance[]): ServiceInstance {
    if (instances.length === 0) {
      throw new Error('No instances available for selection')
    }
    const instance = instances[this.currentIndex % instances.length]!
    this.currentIndex++
    return instance
  }

  private leastConnectionsSelection(instances: ServiceInstance[]): ServiceInstance {
    if (instances.length === 0) {
      throw new Error('No instances available for selection')
    }
    return instances.reduce((min, current) => 
      current.activeConnections < min.activeConnections ? current : min
    )
  }

  private weightedRoundRobinSelection(instances: ServiceInstance[]): ServiceInstance {
    if (instances.length === 0) {
      throw new Error('No instances available for selection')
    }
    const totalWeight = instances.reduce((sum, instance) => sum + instance.weight, 0)
    let random = Math.random() * totalWeight
    
    for (const instance of instances) {
      random -= instance.weight
      if (random <= 0) {
        return instance
      }
    }
    
    return instances[0]! // Fallback
  }

  private ipHashSelection(instances: ServiceInstance[], clientIp?: string): ServiceInstance {
    if (instances.length === 0) {
      throw new Error('No instances available for selection')
    }
    if (!clientIp) {
      return this.roundRobinSelection(instances)
    }
    
    // Simple hash function for IP
    const hash = clientIp.split('.').reduce((acc, octet) => acc + parseInt(octet), 0)
    return instances[hash % instances.length]!
  }

  async performHealthCheck(instance: ServiceInstance): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.healthCheckTimeout)
      
      const response = await fetch(`http://${instance.host}:${instance.port}/health`, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'User-Agent': 'LoadBalancer/1.0',
          'Accept': 'application/json'
        }
      })
      
      clearTimeout(timeoutId)
      
      const responseTime = Date.now() - startTime
      
      if (response.ok) {
        return { healthy: true, responseTime }
      } else {
        return { healthy: false, responseTime, error: `HTTP ${response.status}` }
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      return { 
        healthy: false, 
        responseTime, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  async runHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.instances.values()).map(async (instance) => {
      const result = await this.performHealthCheck(instance)
      
      // Update instance health
      instance.healthy = result.healthy
      instance.lastHealthCheck = new Date()
      instance.averageResponseTime = result.responseTime
      
             // Update circuit breaker
       const circuitBreaker = this.circuitBreakers.get(instance.id)
       if (!circuitBreaker) {
         console.error(`Circuit breaker not found for instance: ${instance.id}`)
         return
       }
       
       if (result.healthy) {
         circuitBreaker.failures = 0
         
         // Close circuit breaker if it was open
         if (circuitBreaker.open) {
           circuitBreaker.open = false
           console.log(`Circuit breaker closed for instance: ${instance.id}`)
         }
       } else {
         circuitBreaker.failures++
         
         // Open circuit breaker if threshold reached
         if (circuitBreaker.failures >= this.config.circuitBreakerThreshold && !circuitBreaker.open) {
           circuitBreaker.open = true
           circuitBreaker.openedAt = new Date()
           console.log(`Circuit breaker opened for instance: ${instance.id}`)
         }
       }
       
       // Check if circuit breaker should be half-open
       if (circuitBreaker.open && 
           Date.now() - circuitBreaker.openedAt.getTime() > this.config.circuitBreakerTimeout) {
         circuitBreaker.open = false
         circuitBreaker.failures = 0
         console.log(`Circuit breaker half-open for instance: ${instance.id}`)
       }
    })
    
    await Promise.all(healthCheckPromises)
  }

  startHealthChecks(): void {
    if (this.healthCheckInterval) {
      return
    }
    
    console.log('Starting health checks...')
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.runHealthChecks()
      } catch (error) {
        console.error('Health check error:', error)
      }
    }, this.config.healthCheckInterval)
  }

  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
      console.log('Health checks stopped')
    }
  }

  getInstanceMetrics(): Array<ServiceInstance & { circuitBreakerStatus: string }> {
    return Array.from(this.instances.values()).map(instance => {
      const circuitBreaker = this.circuitBreakers.get(instance.id)
      return {
        ...instance,
        circuitBreakerStatus: circuitBreaker?.open ? 'open' : 'closed'
      }
    })
  }

  getLoadBalancerStats(): {
    totalInstances: number
    healthyInstances: number
    unhealthyInstances: number
    averageResponseTime: number
    totalConnections: number
    algorithm: string
  } {
    const instances = Array.from(this.instances.values())
    const healthyInstances = this.getHealthyInstances()
    
    return {
      totalInstances: instances.length,
      healthyInstances: healthyInstances.length,
      unhealthyInstances: instances.length - healthyInstances.length,
      averageResponseTime: instances.reduce((sum, i) => sum + i.averageResponseTime, 0) / instances.length || 0,
      totalConnections: instances.reduce((sum, i) => sum + i.activeConnections, 0),
      algorithm: this.config.algorithm
    }
  }

  async forwardRequest(
    instance: ServiceInstance,
    path: string,
    method: string,
    headers: Record<string, string>,
    body?: any
  ): Promise<Response> {
    const startTime = Date.now()
    instance.activeConnections++
    
    try {
      const url = `http://${instance.host}:${instance.port}${path}`
      const fetchOptions: RequestInit = {
        method,
        headers
      }
      
      if (body) {
        fetchOptions.body = JSON.stringify(body)
      }
      
      const response = await fetch(url, fetchOptions)
      
      const responseTime = Date.now() - startTime
      instance.averageResponseTime = (instance.averageResponseTime + responseTime) / 2
      
      return response
    } catch (error) {
      instance.errorRate++
      throw error
    } finally {
      instance.activeConnections--
    }
  }

  async handleRequest(
    path: string,
    method: string,
    headers: Record<string, string>,
    body?: any,
    clientIp?: string
  ): Promise<Response> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      const instance = this.selectInstance(clientIp)
      
      if (!instance) {
        throw new Error('No healthy instances available')
      }
      
      try {
        return await this.forwardRequest(instance, path, method, headers, body)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt < this.config.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay))
        }
      }
    }
    
    throw lastError || new Error('All retry attempts failed')
  }
}

// Export singleton instance
export const loadBalancer = new LoadBalancer()

// Auto-register current instance if in production
if (process.env.NODE_ENV === 'production') {
  const currentHost = process.env.HOST || 'localhost'
  const currentPort = parseInt(process.env.PORT || '3001')
  
  loadBalancer.registerInstance({
    id: `${currentHost}:${currentPort}`,
    host: currentHost,
    port: currentPort,
    weight: 1
  })
}

export type { ServiceInstance, LoadBalancerConfig, HealthCheckResult } 