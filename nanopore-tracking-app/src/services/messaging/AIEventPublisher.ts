import { eventBus } from '../../lib/messaging/event-bus'
import { AIEventFactory, type AnyAIEvent } from '../../lib/messaging/events/ai-events'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'

const logger = getComponentLogger('AIEventPublisher')

/**
 * AI event publisher handles publishing events for AI service operations
 */
export class AIEventPublisher {
  /**
   * Publish PDF processing started event
   */
  async publishPDFProcessingStarted(
    sampleId: string,
    fileName: string,
    fileSize: number,
    processingMethod: 'llm' | 'pattern' | 'hybrid' | 'rag',
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing PDF processing started event', {
      action: 'publish_pdf_processing_started',
      metadata: { sampleId, fileName, fileSize, processingMethod, userId, correlationId }
    })

    const event = AIEventFactory.createPDFProcessingStartedEvent({
      sampleId,
      fileName,
      fileSize,
      processingMethod,
      userId
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish PDF processing completed event
   */
  async publishPDFProcessingCompleted(
    sampleId: string,
    fileName: string,
    extractionResultId: string,
    processingMethod: 'llm' | 'pattern' | 'hybrid' | 'rag',
    confidenceScore: number,
    processingTimeMs: number,
    extractedFieldCount: number,
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing PDF processing completed event', {
      action: 'publish_pdf_processing_completed',
      metadata: { 
        sampleId, 
        fileName, 
        extractionResultId, 
        processingMethod, 
        confidenceScore, 
        processingTimeMs, 
        extractedFieldCount,
        userId,
        correlationId 
      }
    })

    const event = AIEventFactory.createPDFProcessingCompletedEvent({
      sampleId,
      fileName,
      extractionResultId,
      processingMethod,
      confidenceScore,
      processingTimeMs,
      extractedFieldCount,
      userId
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish PDF processing failed event
   */
  async publishPDFProcessingFailed(
    sampleId: string,
    fileName: string,
    error: string,
    processingMethod: 'llm' | 'pattern' | 'hybrid' | 'rag',
    retryCount: number,
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    logger.error('Publishing PDF processing failed event', {
      action: 'publish_pdf_processing_failed',
      metadata: { sampleId, fileName, error, processingMethod, retryCount, userId, correlationId }
    })

    const event = AIEventFactory.createPDFProcessingFailedEvent({
      sampleId,
      fileName,
      error,
      processingMethod,
      retryCount,
      userId
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish extraction result created event
   */
  async publishExtractionResultCreated(
    extractionResultId: string,
    sampleId: string,
    fileName: string,
    extractionMethod: 'llm' | 'pattern' | 'hybrid' | 'rag',
    confidenceScore: number,
    extractedData: Record<string, any>,
    issues: string[],
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing extraction result created event', {
      action: 'publish_extraction_result_created',
      metadata: { 
        extractionResultId, 
        sampleId, 
        fileName, 
        extractionMethod, 
        confidenceScore, 
        issueCount: issues.length,
        userId,
        correlationId 
      }
    })

    const event = AIEventFactory.createExtractionResultCreatedEvent({
      extractionResultId,
      sampleId,
      fileName,
      extractionMethod,
      confidenceScore,
      extractedData,
      issues,
      userId
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish extraction confidence low event
   */
  async publishExtractionConfidenceLow(
    extractionResultId: string,
    sampleId: string,
    fileName: string,
    confidenceScore: number,
    threshold: number,
    extractionMethod: 'llm' | 'pattern' | 'hybrid' | 'rag',
    issues: string[],
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    logger.warn('Publishing extraction confidence low event', {
      action: 'publish_extraction_confidence_low',
      metadata: { 
        extractionResultId, 
        sampleId, 
        fileName, 
        confidenceScore, 
        threshold, 
        extractionMethod, 
        issueCount: issues.length,
        userId,
        correlationId 
      }
    })

    const event = AIEventFactory.createExtractionConfidenceLowEvent({
      extractionResultId,
      sampleId,
      fileName,
      confidenceScore,
      threshold,
      extractionMethod,
      issues,
      userId
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish processing job created event
   */
  async publishProcessingJobCreated(
    jobId: string,
    jobType: 'pdf_extraction' | 'data_validation' | 'enhancement',
    inputData: Record<string, any>,
    priority: 'low' | 'normal' | 'high',
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing processing job created event', {
      action: 'publish_processing_job_created',
      metadata: { jobId, jobType, priority, userId, correlationId }
    })

    const event = AIEventFactory.createProcessingJobCreatedEvent({
      jobId,
      jobType,
      inputData,
      priority,
      userId
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish processing job started event
   */
  async publishProcessingJobStarted(
    jobId: string,
    jobType: 'pdf_extraction' | 'data_validation' | 'enhancement',
    startedAt: Date,
    estimatedDuration?: number,
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing processing job started event', {
      action: 'publish_processing_job_started',
      metadata: { jobId, jobType, startedAt, estimatedDuration, userId, correlationId }
    })

    const eventData: any = { jobId, jobType, startedAt, userId }
    if (estimatedDuration) eventData.estimatedDuration = estimatedDuration

    const event = AIEventFactory.createProcessingJobStartedEvent(eventData, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish processing job completed event
   */
  async publishProcessingJobCompleted(
    jobId: string,
    jobType: 'pdf_extraction' | 'data_validation' | 'enhancement',
    completedAt: Date,
    duration: number,
    outputData: Record<string, any>,
    success: boolean,
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing processing job completed event', {
      action: 'publish_processing_job_completed',
      metadata: { jobId, jobType, completedAt, duration, success, userId, correlationId }
    })

    const event = AIEventFactory.createProcessingJobCompletedEvent({
      jobId,
      jobType,
      completedAt,
      duration,
      outputData,
      success,
      userId
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish processing job failed event
   */
  async publishProcessingJobFailed(
    jobId: string,
    jobType: 'pdf_extraction' | 'data_validation' | 'enhancement',
    failedAt: Date,
    error: string,
    retryCount: number,
    maxRetries: number,
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    logger.error('Publishing processing job failed event', {
      action: 'publish_processing_job_failed',
      metadata: { jobId, jobType, failedAt, error, retryCount, maxRetries, userId, correlationId }
    })

    const event = AIEventFactory.createProcessingJobFailedEvent({
      jobId,
      jobType,
      failedAt,
      error,
      retryCount,
      maxRetries,
      userId
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish model performance recorded event
   */
  async publishModelPerformanceRecorded(
    modelName: string,
    taskType: string,
    accuracyScore: number,
    processingTimeMs: number,
    sampleCount: number,
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing model performance recorded event', {
      action: 'publish_model_performance_recorded',
      metadata: { modelName, taskType, accuracyScore, processingTimeMs, sampleCount, userId, correlationId }
    })

    const event = AIEventFactory.createModelPerformanceRecordedEvent({
      modelName,
      taskType,
      accuracyScore,
      processingTimeMs,
      sampleCount,
      userId
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish model performance degraded event
   */
  async publishModelPerformanceDegraded(
    modelName: string,
    taskType: string,
    currentAccuracy: number,
    previousAccuracy: number,
    threshold: number,
    degradationPercentage: number,
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    logger.warn('Publishing model performance degraded event', {
      action: 'publish_model_performance_degraded',
      metadata: { 
        modelName, 
        taskType, 
        currentAccuracy, 
        previousAccuracy, 
        threshold, 
        degradationPercentage,
        userId,
        correlationId 
      }
    })

    const event = AIEventFactory.createModelPerformanceDegradedEvent({
      modelName,
      taskType,
      currentAccuracy,
      previousAccuracy,
      threshold,
      degradationPercentage,
      userId
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Generic event publishing method
   */
  private async publishEvent(event: AnyAIEvent): Promise<void> {
    try {
      await eventBus.publish(event)
      
      logger.debug('AI event published successfully', {
        action: 'event_published',
        metadata: { eventType: event.type, eventId: event.id }
      })
    } catch (error) {
      logger.error('Failed to publish AI event', {
        action: 'publish_failed',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        metadata: { 
          eventType: event.type,
          eventId: event.id,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      throw error
    }
  }
}

// Export singleton instance
export const aiEventPublisher = new AIEventPublisher() 