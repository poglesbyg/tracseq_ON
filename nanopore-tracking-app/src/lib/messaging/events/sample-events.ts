import type { BaseEvent } from '../event-bus'

/**
 * Sample service event types
 */
export enum SampleEventType {
  SAMPLE_CREATED = 'sample.created',
  SAMPLE_UPDATED = 'sample.updated',
  SAMPLE_DELETED = 'sample.deleted',
  SAMPLE_ASSIGNED = 'sample.assigned',
  SAMPLE_STATUS_CHANGED = 'sample.status_changed',
  SAMPLE_PROCESSING_STARTED = 'sample.processing_started',
  SAMPLE_PROCESSING_COMPLETED = 'sample.processing_completed',
  SAMPLE_PROCESSING_FAILED = 'sample.processing_failed',
  SAMPLE_ATTACHMENT_ADDED = 'sample.attachment_added',
  SAMPLE_ATTACHMENT_REMOVED = 'sample.attachment_removed'
}

/**
 * Base sample event interface
 */
export interface SampleEvent extends BaseEvent {
  source: 'sample-service'
  data: {
    sampleId: string
    userId?: string
  }
}

/**
 * Sample created event
 */
export interface SampleCreatedEvent extends SampleEvent {
  type: SampleEventType.SAMPLE_CREATED
  data: {
    sampleId: string
    userId: string
    sampleName: string
    submitterName: string
    submitterEmail: string
    sampleType: string
    priority: 'low' | 'normal' | 'high' | 'urgent'
    projectId?: string
    labName?: string
  }
}

/**
 * Sample updated event
 */
export interface SampleUpdatedEvent extends SampleEvent {
  type: SampleEventType.SAMPLE_UPDATED
  data: {
    sampleId: string
    userId: string
    changes: Record<string, { oldValue: any; newValue: any }>
    updatedFields: string[]
  }
}

/**
 * Sample deleted event
 */
export interface SampleDeletedEvent extends SampleEvent {
  type: SampleEventType.SAMPLE_DELETED
  data: {
    sampleId: string
    userId: string
    sampleName: string
    deletedAt: Date
  }
}

/**
 * Sample assigned event
 */
export interface SampleAssignedEvent extends SampleEvent {
  type: SampleEventType.SAMPLE_ASSIGNED
  data: {
    sampleId: string
    userId: string
    assignedTo: string
    libraryPrepBy?: string
    previousAssignee?: string
  }
}

/**
 * Sample status changed event
 */
export interface SampleStatusChangedEvent extends SampleEvent {
  type: SampleEventType.SAMPLE_STATUS_CHANGED
  data: {
    sampleId: string
    userId: string
    oldStatus: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived'
    newStatus: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived'
    reason?: string
  }
}

/**
 * Sample processing started event
 */
export interface SampleProcessingStartedEvent extends SampleEvent {
  type: SampleEventType.SAMPLE_PROCESSING_STARTED
  data: {
    sampleId: string
    userId: string
    processingStep: string
    assignedTo?: string
    estimatedDuration?: number
  }
}

/**
 * Sample processing completed event
 */
export interface SampleProcessingCompletedEvent extends SampleEvent {
  type: SampleEventType.SAMPLE_PROCESSING_COMPLETED
  data: {
    sampleId: string
    userId: string
    processingStep: string
    completedBy?: string
    duration: number
    results?: Record<string, any>
  }
}

/**
 * Sample processing failed event
 */
export interface SampleProcessingFailedEvent extends SampleEvent {
  type: SampleEventType.SAMPLE_PROCESSING_FAILED
  data: {
    sampleId: string
    userId: string
    processingStep: string
    error: string
    retryCount: number
    maxRetries: number
  }
}

/**
 * Sample attachment added event
 */
export interface SampleAttachmentAddedEvent extends SampleEvent {
  type: SampleEventType.SAMPLE_ATTACHMENT_ADDED
  data: {
    sampleId: string
    userId: string
    attachmentId: string
    fileName: string
    fileSize: number
    fileType: string
  }
}

/**
 * Sample attachment removed event
 */
export interface SampleAttachmentRemovedEvent extends SampleEvent {
  type: SampleEventType.SAMPLE_ATTACHMENT_REMOVED
  data: {
    sampleId: string
    userId: string
    attachmentId: string
    fileName: string
  }
}

/**
 * Union type for all sample events
 */
export type AnySampleEvent = 
  | SampleCreatedEvent
  | SampleUpdatedEvent
  | SampleDeletedEvent
  | SampleAssignedEvent
  | SampleStatusChangedEvent
  | SampleProcessingStartedEvent
  | SampleProcessingCompletedEvent
  | SampleProcessingFailedEvent
  | SampleAttachmentAddedEvent
  | SampleAttachmentRemovedEvent

/**
 * Event factory for creating sample events
 */
export class SampleEventFactory {
  private static createBaseEvent(type: SampleEventType, correlationId?: string): Omit<SampleEvent, 'data'> {
    return {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date(),
      version: '1.0',
      source: 'sample-service',
      ...(correlationId && { correlationId })
    }
  }

  static createSampleCreatedEvent(data: SampleCreatedEvent['data'], correlationId?: string): SampleCreatedEvent {
    return {
      ...this.createBaseEvent(SampleEventType.SAMPLE_CREATED, correlationId),
      data
    } as SampleCreatedEvent
  }

  static createSampleUpdatedEvent(data: SampleUpdatedEvent['data'], correlationId?: string): SampleUpdatedEvent {
    return {
      ...this.createBaseEvent(SampleEventType.SAMPLE_UPDATED, correlationId),
      data
    } as SampleUpdatedEvent
  }

  static createSampleDeletedEvent(data: SampleDeletedEvent['data'], correlationId?: string): SampleDeletedEvent {
    return {
      ...this.createBaseEvent(SampleEventType.SAMPLE_DELETED, correlationId),
      data
    } as SampleDeletedEvent
  }

  static createSampleAssignedEvent(data: SampleAssignedEvent['data'], correlationId?: string): SampleAssignedEvent {
    return {
      ...this.createBaseEvent(SampleEventType.SAMPLE_ASSIGNED, correlationId),
      data
    } as SampleAssignedEvent
  }

  static createSampleStatusChangedEvent(data: SampleStatusChangedEvent['data'], correlationId?: string): SampleStatusChangedEvent {
    return {
      ...this.createBaseEvent(SampleEventType.SAMPLE_STATUS_CHANGED, correlationId),
      data
    } as SampleStatusChangedEvent
  }

  static createSampleProcessingStartedEvent(data: SampleProcessingStartedEvent['data'], correlationId?: string): SampleProcessingStartedEvent {
    return {
      ...this.createBaseEvent(SampleEventType.SAMPLE_PROCESSING_STARTED, correlationId),
      data
    } as SampleProcessingStartedEvent
  }

  static createSampleProcessingCompletedEvent(data: SampleProcessingCompletedEvent['data'], correlationId?: string): SampleProcessingCompletedEvent {
    return {
      ...this.createBaseEvent(SampleEventType.SAMPLE_PROCESSING_COMPLETED, correlationId),
      data
    } as SampleProcessingCompletedEvent
  }

  static createSampleProcessingFailedEvent(data: SampleProcessingFailedEvent['data'], correlationId?: string): SampleProcessingFailedEvent {
    return {
      ...this.createBaseEvent(SampleEventType.SAMPLE_PROCESSING_FAILED, correlationId),
      data
    } as SampleProcessingFailedEvent
  }

  static createSampleAttachmentAddedEvent(data: SampleAttachmentAddedEvent['data'], correlationId?: string): SampleAttachmentAddedEvent {
    return {
      ...this.createBaseEvent(SampleEventType.SAMPLE_ATTACHMENT_ADDED, correlationId),
      data
    } as SampleAttachmentAddedEvent
  }

  static createSampleAttachmentRemovedEvent(data: SampleAttachmentRemovedEvent['data'], correlationId?: string): SampleAttachmentRemovedEvent {
    return {
      ...this.createBaseEvent(SampleEventType.SAMPLE_ATTACHMENT_REMOVED, correlationId),
      data
    } as SampleAttachmentRemovedEvent
  }
} 