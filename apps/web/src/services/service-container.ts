import { CrisprRepository } from '../repositories/crispr-repository'

import { AIService } from './ai-service'
import { CrisprService } from './crispr-service'
import { ValidationService } from './validation-service'

/**
 * Service container for dependency injection
 * Manages service instances and their dependencies
 */
export class ServiceContainer {
  private static instance: ServiceContainer
  private services = new Map<string, any>()

  private constructor() {
    this.initializeServices()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer()
    }
    return ServiceContainer.instance
  }

  /**
   * Initialize all services with their dependencies
   */
  private initializeServices(): void {
    // Create repository instances
    const crisprRepository = new CrisprRepository()

    // Create service instances
    const validationService = new ValidationService()
    const aiService = new AIService()
    const crisprService = new CrisprService(
      crisprRepository,
      aiService,
      validationService,
    )

    // Register services
    this.services.set('crisprRepository', crisprRepository)
    this.services.set('validationService', validationService)
    this.services.set('aiService', aiService)
    this.services.set('crisprService', crisprService)
  }

  /**
   * Get service instance by name
   */
  getService<T>(serviceName: string): T {
    const service = this.services.get(serviceName)
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`)
    }
    return service as T
  }

  /**
   * Get CRISPR service
   */
  getCrisprService(): CrisprService {
    return this.getService<CrisprService>('crisprService')
  }

  /**
   * Get AI service
   */
  getAIService(): AIService {
    return this.getService<AIService>('aiService')
  }

  /**
   * Get validation service
   */
  getValidationService(): ValidationService {
    return this.getService<ValidationService>('validationService')
  }

  /**
   * Get CRISPR repository
   */
  getCrisprRepository(): CrisprRepository {
    return this.getService<CrisprRepository>('crisprRepository')
  }

  /**
   * Register a new service
   */
  registerService<T>(name: string, service: T): void {
    this.services.set(name, service)
  }

  /**
   * Check if service is registered
   */
  hasService(serviceName: string): boolean {
    return this.services.has(serviceName)
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys())
  }

  /**
   * Clear all services (for testing)
   */
  clearServices(): void {
    this.services.clear()
  }

  /**
   * Reinitialize services
   */
  reinitialize(): void {
    this.clearServices()
    this.initializeServices()
  }
}

// Export singleton instance
export const serviceContainer = ServiceContainer.getInstance()

// Export convenient service getters
export const getCrisprService = () => serviceContainer.getCrisprService()
export const getAIService = () => serviceContainer.getAIService()
export function getValidationService() {
  return serviceContainer.getValidationService()
}
export const getCrisprRepository = () => serviceContainer.getCrisprRepository()
