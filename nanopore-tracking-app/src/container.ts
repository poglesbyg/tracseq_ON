import { db } from './lib/database'
import { SampleService } from './services/implementations/SampleService'
import { PostgreSQLSampleRepository } from './repositories/PostgreSQLSampleRepository'
import { AuditLogger } from './services/implementations/AuditLogger'
import { EventEmitter } from './services/implementations/EventEmitter'

import type { ISampleService } from './services/interfaces/ISampleService'
import type { ISampleRepository } from './services/interfaces/ISampleRepository'
import type { IAuditLogger } from './services/interfaces/IAuditLogger'
import type { IEventEmitter } from './services/interfaces/IEventEmitter'

/**
 * Service container for dependency injection
 */
export class ServiceContainer {
  private static instance: ServiceContainer
  private services: Map<string, any> = new Map()

  private constructor() {}

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer()
    }
    return ServiceContainer.instance
  }

  /**
   * Register a service with the container
   */
  register<T>(key: string, factory: () => T): void {
    this.services.set(key, factory)
  }

  /**
   * Get a service from the container
   */
  get<T>(key: string): T {
    const factory = this.services.get(key)
    if (!factory) {
      throw new Error(`Service ${key} not found`)
    }
    return factory()
  }

  /**
   * Initialize all services
   */
  initialize(): void {
    // Register repositories
    this.register<ISampleRepository>('sampleRepository', () => 
      new PostgreSQLSampleRepository(db)
    )

    // Register infrastructure services
    this.register<IAuditLogger>('auditLogger', () => 
      new AuditLogger()
    )

    this.register<IEventEmitter>('eventEmitter', () => 
      new EventEmitter()
    )

    // Register business services
    this.register<ISampleService>('sampleService', () => 
      new SampleService(
        this.get<ISampleRepository>('sampleRepository'),
        this.get<IAuditLogger>('auditLogger'),
        this.get<IEventEmitter>('eventEmitter')
      )
    )
  }
}

// Create and initialize the container
const container = ServiceContainer.getInstance()
container.initialize()

// Export convenience functions
export const getSampleService = (): ISampleService => container.get<ISampleService>('sampleService')
export const getSampleRepository = (): ISampleRepository => container.get<ISampleRepository>('sampleRepository')
export const getAuditLogger = (): IAuditLogger => container.get<IAuditLogger>('auditLogger')
export const getEventEmitter = (): IEventEmitter => container.get<IEventEmitter>('eventEmitter')

export default container 