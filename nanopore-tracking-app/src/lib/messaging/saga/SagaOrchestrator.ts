import { eventBus } from '../event-bus'
import { getComponentLogger } from '../../logging/StructuredLogger'
import type { BaseEvent } from '../event-bus'

const logger = getComponentLogger('SagaOrchestrator')

/**
 * Saga step status
 */
export enum SagaStepStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated'
}

/**
 * Saga transaction status
 */
export enum SagaTransactionStatus {
  STARTED = 'started',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated'
}

/**
 * Saga step definition
 */
export interface SagaStep {
  id: string
  name: string
  service: string
  action: string
  compensationAction?: string
  timeout?: number
  retryAttempts?: number
  dependencies?: string[]
  data?: Record<string, any>
}

/**
 * Saga step execution result
 */
export interface SagaStepResult {
  stepId: string
  status: SagaStepStatus
  result?: any
  error?: string
  executionTime: number
  retryCount: number
}

/**
 * Saga transaction definition
 */
export interface SagaTransaction {
  id: string
  name: string
  steps: SagaStep[]
  status: SagaTransactionStatus
  startedAt: Date
  completedAt?: Date
  failedAt?: Date
  compensatedAt?: Date
  correlationId?: string
  context: Record<string, any>
  stepResults: Map<string, SagaStepResult>
  currentStep?: string
  error?: string
}

/**
 * Saga event types
 */
export enum SagaEventType {
  SAGA_STARTED = 'saga.started',
  SAGA_STEP_STARTED = 'saga.step_started',
  SAGA_STEP_COMPLETED = 'saga.step_completed',
  SAGA_STEP_FAILED = 'saga.step_failed',
  SAGA_COMPLETED = 'saga.completed',
  SAGA_FAILED = 'saga.failed',
  SAGA_COMPENSATION_STARTED = 'saga.compensation_started',
  SAGA_COMPENSATION_COMPLETED = 'saga.compensation_completed',
  SAGA_COMPENSATION_FAILED = 'saga.compensation_failed'
}

/**
 * Saga event interface
 */
export interface SagaEvent extends BaseEvent {
  source: 'saga-orchestrator'
  data: {
    sagaId: string
    stepId?: string
    status: SagaTransactionStatus | SagaStepStatus
    result?: any
    error?: string
    context?: Record<string, any>
  }
}

/**
 * Saga orchestrator manages distributed transactions using the saga pattern
 */
export class SagaOrchestrator {
  private activeSagas: Map<string, SagaTransaction> = new Map()
  private sagaHistory: Map<string, SagaTransaction> = new Map()
  private stepHandlers: Map<string, (step: SagaStep, context: Record<string, any>) => Promise<any>> = new Map()
  private compensationHandlers: Map<string, (step: SagaStep, context: Record<string, any>) => Promise<void>> = new Map()

  constructor() {
    this.setupEventHandlers()
  }

  /**
   * Register a step handler
   */
  registerStepHandler(
    action: string,
    handler: (step: SagaStep, context: Record<string, any>) => Promise<any>
  ): void {
    this.stepHandlers.set(action, handler)
    
    logger.info('Registered saga step handler', {
      action: 'register_step_handler',
      metadata: { action }
    })
  }

  /**
   * Register a compensation handler
   */
  registerCompensationHandler(
    action: string,
    handler: (step: SagaStep, context: Record<string, any>) => Promise<void>
  ): void {
    this.compensationHandlers.set(action, handler)
    
    logger.info('Registered saga compensation handler', {
      action: 'register_compensation_handler',
      metadata: { action }
    })
  }

  /**
   * Start a new saga transaction
   */
  async startSaga(
    name: string,
    steps: SagaStep[],
    context: Record<string, any> = {},
    correlationId?: string
  ): Promise<string> {
    const sagaId = crypto.randomUUID()
    
    const saga: SagaTransaction = {
      id: sagaId,
      name,
      steps,
      status: SagaTransactionStatus.STARTED,
      startedAt: new Date(),
      context,
      stepResults: new Map(),
      ...(correlationId && { correlationId })
    }

    this.activeSagas.set(sagaId, saga)

    logger.info('Starting saga transaction', {
      action: 'start_saga',
      metadata: { sagaId, name, stepCount: steps.length, correlationId }
    })

    // Publish saga started event
    await this.publishSagaEvent(SagaEventType.SAGA_STARTED, saga)

    // Start executing steps
    await this.executeNextStep(sagaId)

    return sagaId
  }

  /**
   * Execute the next step in the saga
   */
  private async executeNextStep(sagaId: string): Promise<void> {
    const saga = this.activeSagas.get(sagaId)
    if (!saga) {
      logger.error('Saga not found', {
        action: 'execute_next_step',
        metadata: { sagaId }
      })
      return
    }

    // Find next step to execute
    const nextStep = this.findNextStep(saga)
    if (!nextStep) {
      // All steps completed
      await this.completeSaga(sagaId)
      return
    }

    saga.currentStep = nextStep.id
    saga.status = SagaTransactionStatus.EXECUTING

    logger.info('Executing saga step', {
      action: 'execute_step',
      metadata: { sagaId, stepId: nextStep.id, stepName: nextStep.name, service: nextStep.service }
    })

    // Publish step started event
    await this.publishSagaEvent(SagaEventType.SAGA_STEP_STARTED, saga, nextStep.id)

    try {
      const startTime = Date.now()
      
      // Execute step
      const handler = this.stepHandlers.get(nextStep.action)
      if (!handler) {
        throw new Error(`No handler registered for action: ${nextStep.action}`)
      }

      const result = await this.executeStepWithTimeout(handler, nextStep, saga.context)
      const executionTime = Date.now() - startTime

      // Record step result
      const stepResult: SagaStepResult = {
        stepId: nextStep.id,
        status: SagaStepStatus.COMPLETED,
        result,
        executionTime,
        retryCount: 0
      }

      saga.stepResults.set(nextStep.id, stepResult)

      // Update context with step result
      saga.context[`${nextStep.id}_result`] = result

      logger.info('Saga step completed', {
        action: 'step_completed',
        metadata: { sagaId, stepId: nextStep.id, executionTime }
      })

      // Publish step completed event
      await this.publishSagaEvent(SagaEventType.SAGA_STEP_COMPLETED, saga, nextStep.id)

      // Execute next step
      await this.executeNextStep(sagaId)

    } catch (error) {
      await this.handleStepFailure(sagaId, nextStep, error)
    }
  }

  /**
   * Execute step with timeout
   */
  private async executeStepWithTimeout(
    handler: (step: SagaStep, context: Record<string, any>) => Promise<any>,
    step: SagaStep,
    context: Record<string, any>
  ): Promise<any> {
    const timeout = step.timeout || 30000 // Default 30 seconds

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Step ${step.id} timed out after ${timeout}ms`))
      }, timeout)

      handler(step, context)
        .then(result => {
          clearTimeout(timeoutId)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  /**
   * Handle step failure
   */
  private async handleStepFailure(sagaId: string, step: SagaStep, error: any): Promise<void> {
    const saga = this.activeSagas.get(sagaId)
    if (!saga) return

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Saga step failed', {
      action: 'step_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
      metadata: { sagaId, stepId: step.id, errorMessage }
    })

    // Record step failure
    const stepResult: SagaStepResult = {
      stepId: step.id,
      status: SagaStepStatus.FAILED,
      error: errorMessage,
      executionTime: 0,
      retryCount: 0
    }

    saga.stepResults.set(step.id, stepResult)

    // Publish step failed event
    await this.publishSagaEvent(SagaEventType.SAGA_STEP_FAILED, saga, step.id)

    // Check if we should retry
    const retryAttempts = step.retryAttempts || 0
    if (stepResult.retryCount < retryAttempts) {
      stepResult.retryCount++
      
      logger.info('Retrying saga step', {
        action: 'retry_step',
        metadata: { sagaId, stepId: step.id, retryCount: stepResult.retryCount }
      })

      // Retry after delay
      setTimeout(() => {
        this.executeNextStep(sagaId)
      }, 1000 * stepResult.retryCount) // Exponential backoff
      
      return
    }

    // Start compensation
    await this.startCompensation(sagaId, errorMessage)
  }

  /**
   * Start compensation process
   */
  private async startCompensation(sagaId: string, error: string): Promise<void> {
    const saga = this.activeSagas.get(sagaId)
    if (!saga) return

    saga.status = SagaTransactionStatus.COMPENSATING
    saga.error = error
    saga.failedAt = new Date()

    logger.info('Starting saga compensation', {
      action: 'start_compensation',
      metadata: { sagaId, error }
    })

    // Publish compensation started event
    await this.publishSagaEvent(SagaEventType.SAGA_COMPENSATION_STARTED, saga)

    // Compensate completed steps in reverse order
    const completedSteps = saga.steps.filter(step => 
      saga.stepResults.get(step.id)?.status === SagaStepStatus.COMPLETED
    ).reverse()

    for (const step of completedSteps) {
      await this.compensateStep(sagaId, step)
    }

    await this.completeSagaCompensation(sagaId)
  }

  /**
   * Compensate a step
   */
  private async compensateStep(sagaId: string, step: SagaStep): Promise<void> {
    const saga = this.activeSagas.get(sagaId)
    if (!saga || !step.compensationAction) return

    logger.info('Compensating saga step', {
      action: 'compensate_step',
      metadata: { sagaId, stepId: step.id, compensationAction: step.compensationAction }
    })

    try {
      const handler = this.compensationHandlers.get(step.compensationAction)
      if (!handler) {
        logger.warn('No compensation handler found', {
          action: 'compensation_handler_missing',
          metadata: { sagaId, stepId: step.id, compensationAction: step.compensationAction }
        })
        return
      }

      await handler(step, saga.context)

      // Update step result
      const stepResult = saga.stepResults.get(step.id)
      if (stepResult) {
        stepResult.status = SagaStepStatus.COMPENSATED
      }

      logger.info('Saga step compensated', {
        action: 'step_compensated',
        metadata: { sagaId, stepId: step.id }
      })

    } catch (error) {
      logger.error('Saga step compensation failed', {
        action: 'compensation_failed',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        metadata: { 
          sagaId, 
          stepId: step.id, 
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      })

      // Continue with other compensations even if one fails
    }
  }

  /**
   * Complete saga compensation
   */
  private async completeSagaCompensation(sagaId: string): Promise<void> {
    const saga = this.activeSagas.get(sagaId)
    if (!saga) return

    saga.status = SagaTransactionStatus.COMPENSATED
    saga.compensatedAt = new Date()

    logger.info('Saga compensation completed', {
      action: 'compensation_completed',
      metadata: { sagaId }
    })

    // Publish compensation completed event
    await this.publishSagaEvent(SagaEventType.SAGA_COMPENSATION_COMPLETED, saga)

    // Move to history
    this.sagaHistory.set(sagaId, saga)
    this.activeSagas.delete(sagaId)
  }

  /**
   * Complete saga
   */
  private async completeSaga(sagaId: string): Promise<void> {
    const saga = this.activeSagas.get(sagaId)
    if (!saga) return

    saga.status = SagaTransactionStatus.COMPLETED
    saga.completedAt = new Date()

    logger.info('Saga completed successfully', {
      action: 'saga_completed',
      metadata: { sagaId, duration: saga.completedAt.getTime() - saga.startedAt.getTime() }
    })

    // Publish saga completed event
    await this.publishSagaEvent(SagaEventType.SAGA_COMPLETED, saga)

    // Move to history
    this.sagaHistory.set(sagaId, saga)
    this.activeSagas.delete(sagaId)
  }

  /**
   * Find next step to execute
   */
  private findNextStep(saga: SagaTransaction): SagaStep | undefined {
    return saga.steps.find(step => {
      const stepResult = saga.stepResults.get(step.id)
      
      // Skip if already completed or failed
      if (stepResult?.status === SagaStepStatus.COMPLETED || 
          stepResult?.status === SagaStepStatus.FAILED) {
        return false
      }

      // Check dependencies
      if (step.dependencies) {
        return step.dependencies.every(depId => {
          const depResult = saga.stepResults.get(depId)
          return depResult?.status === SagaStepStatus.COMPLETED
        })
      }

      return true
    })
  }

  /**
   * Publish saga event
   */
  private async publishSagaEvent(
    eventType: SagaEventType,
    saga: SagaTransaction,
    stepId?: string
  ): Promise<void> {
    const eventData: any = {
      sagaId: saga.id,
      status: saga.status,
      context: saga.context
    }
    
    if (stepId) eventData.stepId = stepId

    const event: SagaEvent = {
      id: crypto.randomUUID(),
      type: eventType,
      timestamp: new Date(),
      version: '1.0',
      source: 'saga-orchestrator',
      data: eventData,
      ...(saga.correlationId && { correlationId: saga.correlationId })
    }

    await eventBus.publish(event)
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Listen for external events that might affect sagas
    eventBus.on('*', (event: BaseEvent) => {
      // Handle external events that might trigger saga state changes
      // This is where you'd implement event-driven saga coordination
    })
  }

  /**
   * Get saga status
   */
  getSagaStatus(sagaId: string): SagaTransaction | undefined {
    return this.activeSagas.get(sagaId) || this.sagaHistory.get(sagaId)
  }

  /**
   * Get active sagas
   */
  getActiveSagas(): SagaTransaction[] {
    return Array.from(this.activeSagas.values())
  }

  /**
   * Get saga history
   */
  getSagaHistory(): SagaTransaction[] {
    return Array.from(this.sagaHistory.values())
  }

  /**
   * Cancel saga
   */
  async cancelSaga(sagaId: string, reason: string): Promise<void> {
    const saga = this.activeSagas.get(sagaId)
    if (!saga) return

    logger.info('Canceling saga', {
      action: 'cancel_saga',
      metadata: { sagaId, reason }
    })

    await this.startCompensation(sagaId, `Saga canceled: ${reason}`)
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean
    activeSagas: number
    completedSagas: number
    issues: string[]
  }> {
    const issues: string[] = []
    const activeSagas = this.activeSagas.size
    const completedSagas = this.sagaHistory.size

    // Check for stuck sagas
    const stuckSagas = Array.from(this.activeSagas.values()).filter(saga => {
      const age = Date.now() - saga.startedAt.getTime()
      return age > 300000 // 5 minutes
    })

    if (stuckSagas.length > 0) {
      issues.push(`${stuckSagas.length} sagas appear to be stuck`)
    }

    // Check for excessive active sagas
    if (activeSagas > 100) {
      issues.push('High number of active sagas')
    }

    return {
      healthy: issues.length === 0,
      activeSagas,
      completedSagas,
      issues
    }
  }
}

// Export singleton instance
export const sagaOrchestrator = new SagaOrchestrator() 