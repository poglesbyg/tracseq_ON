import { eventBus } from '../../lib/messaging/event-bus'
import { SampleEventFactory, type AnySampleEvent } from '../../lib/messaging/events/sample-events'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'
import type { Sample, CreateSampleData, UpdateSampleData } from '../interfaces/ISampleService'

const logger = getComponentLogger('SampleEventPublisher')

/**
 * Sample event publisher handles publishing events for sample service operations
 */
export class SampleEventPublisher {
  /**
   * Publish sample created event
   */
  async publishSampleCreated(sample: Sample, userId: string, correlationId?: string): Promise<void> {
    logger.info('Publishing sample created event', {
      action: 'publish_sample_created',
      metadata: { sampleId: sample.id, userId, correlationId }
    })

    const eventData: any = {
      sampleId: sample.id,
      userId,
      sampleName: sample.sample_name,
      submitterName: sample.submitter_name,
      submitterEmail: sample.submitter_email,
      sampleType: sample.sample_type,
      priority: sample.priority as 'low' | 'normal' | 'high' | 'urgent'
    }
    
    if (sample.project_id) eventData.projectId = sample.project_id
    if (sample.lab_name) eventData.labName = sample.lab_name

    const event = SampleEventFactory.createSampleCreatedEvent(eventData, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish sample updated event
   */
  async publishSampleUpdated(
    sampleId: string, 
    userId: string, 
    changes: Record<string, { oldValue: any; newValue: any }>,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing sample updated event', {
      action: 'publish_sample_updated',
      metadata: { sampleId, userId, changeCount: Object.keys(changes).length, correlationId }
    })

    const event = SampleEventFactory.createSampleUpdatedEvent({
      sampleId,
      userId,
      changes,
      updatedFields: Object.keys(changes)
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish sample deleted event
   */
  async publishSampleDeleted(
    sampleId: string, 
    userId: string, 
    sampleName: string,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing sample deleted event', {
      action: 'publish_sample_deleted',
      metadata: { sampleId, userId, sampleName, correlationId }
    })

    const event = SampleEventFactory.createSampleDeletedEvent({
      sampleId,
      userId,
      sampleName,
      deletedAt: new Date()
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish sample assigned event
   */
  async publishSampleAssigned(
    sampleId: string,
    userId: string,
    assignedTo: string,
    libraryPrepBy?: string,
    previousAssignee?: string,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing sample assigned event', {
      action: 'publish_sample_assigned',
      metadata: { sampleId, userId, assignedTo, previousAssignee, correlationId }
    })

    const eventData: any = { sampleId, userId, assignedTo }
    if (libraryPrepBy) eventData.libraryPrepBy = libraryPrepBy
    if (previousAssignee) eventData.previousAssignee = previousAssignee

    const event = SampleEventFactory.createSampleAssignedEvent(eventData, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish sample status changed event
   */
  async publishSampleStatusChanged(
    sampleId: string,
    userId: string,
    oldStatus: string,
    newStatus: string,
    reason?: string,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing sample status changed event', {
      action: 'publish_status_changed',
      metadata: { sampleId, userId, oldStatus, newStatus, reason, correlationId }
    })

    const eventData: any = { sampleId, userId, oldStatus: oldStatus as any, newStatus: newStatus as any }
    if (reason) eventData.reason = reason

    const event = SampleEventFactory.createSampleStatusChangedEvent(eventData, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish sample processing started event
   */
  async publishSampleProcessingStarted(
    sampleId: string,
    userId: string,
    processingStep: string,
    assignedTo?: string,
    estimatedDuration?: number,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing sample processing started event', {
      action: 'publish_processing_started',
      metadata: { sampleId, userId, processingStep, assignedTo, correlationId }
    })

    const eventData: any = { sampleId, userId, processingStep }
    if (assignedTo) eventData.assignedTo = assignedTo
    if (estimatedDuration) eventData.estimatedDuration = estimatedDuration

    const event = SampleEventFactory.createSampleProcessingStartedEvent(eventData, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish sample processing completed event
   */
  async publishSampleProcessingCompleted(
    sampleId: string,
    userId: string,
    processingStep: string,
    completedBy: string,
    duration: number,
    results?: Record<string, any>,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing sample processing completed event', {
      action: 'publish_processing_completed',
      metadata: { sampleId, userId, processingStep, completedBy, duration, correlationId }
    })

    const eventData: any = { sampleId, userId, processingStep, completedBy, duration }
    if (results) eventData.results = results

    const event = SampleEventFactory.createSampleProcessingCompletedEvent(eventData, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish sample processing failed event
   */
  async publishSampleProcessingFailed(
    sampleId: string,
    userId: string,
    processingStep: string,
    error: string,
    retryCount: number,
    maxRetries: number,
    correlationId?: string
  ): Promise<void> {
    logger.error('Publishing sample processing failed event', {
      action: 'publish_processing_failed',
      metadata: { sampleId, userId, processingStep, error, retryCount, maxRetries, correlationId }
    })

    const event = SampleEventFactory.createSampleProcessingFailedEvent({
      sampleId,
      userId,
      processingStep,
      error,
      retryCount,
      maxRetries
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish sample attachment added event
   */
  async publishSampleAttachmentAdded(
    sampleId: string,
    userId: string,
    attachmentId: string,
    fileName: string,
    fileSize: number,
    fileType: string,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing sample attachment added event', {
      action: 'publish_attachment_added',
      metadata: { sampleId, userId, attachmentId, fileName, fileSize, correlationId }
    })

    const event = SampleEventFactory.createSampleAttachmentAddedEvent({
      sampleId,
      userId,
      attachmentId,
      fileName,
      fileSize,
      fileType
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Publish sample attachment removed event
   */
  async publishSampleAttachmentRemoved(
    sampleId: string,
    userId: string,
    attachmentId: string,
    fileName: string,
    correlationId?: string
  ): Promise<void> {
    logger.info('Publishing sample attachment removed event', {
      action: 'publish_attachment_removed',
      metadata: { sampleId, userId, attachmentId, fileName, correlationId }
    })

    const event = SampleEventFactory.createSampleAttachmentRemovedEvent({
      sampleId,
      userId,
      attachmentId,
      fileName
    }, correlationId)

    await this.publishEvent(event)
  }

  /**
   * Generic event publishing method
   */
  private async publishEvent(event: AnySampleEvent): Promise<void> {
    try {
      await eventBus.publish(event)
      
      logger.debug('Sample event published successfully', {
        action: 'event_published',
        metadata: { eventType: event.type, eventId: event.id }
      })
    } catch (error) {
      logger.error('Failed to publish sample event', {
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
export const sampleEventPublisher = new SampleEventPublisher() 