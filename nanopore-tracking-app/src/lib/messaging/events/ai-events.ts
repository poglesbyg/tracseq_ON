import type { BaseEvent } from '../event-bus'

/**
 * AI service event types
 */
export enum AIEventType {
  PDF_PROCESSING_STARTED = 'ai.pdf_processing_started',
  PDF_PROCESSING_COMPLETED = 'ai.pdf_processing_completed',
  PDF_PROCESSING_FAILED = 'ai.pdf_processing_failed',
  EXTRACTION_RESULT_CREATED = 'ai.extraction_result_created',
  EXTRACTION_CONFIDENCE_LOW = 'ai.extraction_confidence_low',
  PROCESSING_JOB_CREATED = 'ai.processing_job_created',
  PROCESSING_JOB_STARTED = 'ai.processing_job_started',
  PROCESSING_JOB_COMPLETED = 'ai.processing_job_completed',
  PROCESSING_JOB_FAILED = 'ai.processing_job_failed',
  MODEL_PERFORMANCE_RECORDED = 'ai.model_performance_recorded',
  MODEL_PERFORMANCE_DEGRADED = 'ai.model_performance_degraded'
}

/**
 * Base AI event interface
 */
export interface AIEvent extends BaseEvent {
  source: 'ai-service'
  data: {
    userId?: string
  }
}

/**
 * PDF processing started event
 */
export interface PDFProcessingStartedEvent extends AIEvent {
  type: AIEventType.PDF_PROCESSING_STARTED
  data: {
    sampleId: string
    fileName: string
    fileSize: number
    processingMethod: 'llm' | 'pattern' | 'hybrid' | 'rag'
    userId?: string
  }
}

/**
 * PDF processing completed event
 */
export interface PDFProcessingCompletedEvent extends AIEvent {
  type: AIEventType.PDF_PROCESSING_COMPLETED
  data: {
    sampleId: string
    fileName: string
    extractionResultId: string
    processingMethod: 'llm' | 'pattern' | 'hybrid' | 'rag'
    confidenceScore: number
    processingTimeMs: number
    extractedFieldCount: number
    userId?: string
  }
}

/**
 * PDF processing failed event
 */
export interface PDFProcessingFailedEvent extends AIEvent {
  type: AIEventType.PDF_PROCESSING_FAILED
  data: {
    sampleId: string
    fileName: string
    error: string
    processingMethod: 'llm' | 'pattern' | 'hybrid' | 'rag'
    retryCount: number
    userId?: string
  }
}

/**
 * Extraction result created event
 */
export interface ExtractionResultCreatedEvent extends AIEvent {
  type: AIEventType.EXTRACTION_RESULT_CREATED
  data: {
    extractionResultId: string
    sampleId: string
    fileName: string
    extractionMethod: 'llm' | 'pattern' | 'hybrid' | 'rag'
    confidenceScore: number
    extractedData: Record<string, any>
    issues: string[]
    userId?: string
  }
}

/**
 * Extraction confidence low event
 */
export interface ExtractionConfidenceLowEvent extends AIEvent {
  type: AIEventType.EXTRACTION_CONFIDENCE_LOW
  data: {
    extractionResultId: string
    sampleId: string
    fileName: string
    confidenceScore: number
    threshold: number
    extractionMethod: 'llm' | 'pattern' | 'hybrid' | 'rag'
    issues: string[]
    userId?: string
  }
}

/**
 * Processing job created event
 */
export interface ProcessingJobCreatedEvent extends AIEvent {
  type: AIEventType.PROCESSING_JOB_CREATED
  data: {
    jobId: string
    jobType: 'pdf_extraction' | 'data_validation' | 'enhancement'
    inputData: Record<string, any>
    priority: 'low' | 'normal' | 'high'
    userId?: string
  }
}

/**
 * Processing job started event
 */
export interface ProcessingJobStartedEvent extends AIEvent {
  type: AIEventType.PROCESSING_JOB_STARTED
  data: {
    jobId: string
    jobType: 'pdf_extraction' | 'data_validation' | 'enhancement'
    startedAt: Date
    estimatedDuration?: number
    userId?: string
  }
}

/**
 * Processing job completed event
 */
export interface ProcessingJobCompletedEvent extends AIEvent {
  type: AIEventType.PROCESSING_JOB_COMPLETED
  data: {
    jobId: string
    jobType: 'pdf_extraction' | 'data_validation' | 'enhancement'
    completedAt: Date
    duration: number
    outputData: Record<string, any>
    success: boolean
    userId?: string
  }
}

/**
 * Processing job failed event
 */
export interface ProcessingJobFailedEvent extends AIEvent {
  type: AIEventType.PROCESSING_JOB_FAILED
  data: {
    jobId: string
    jobType: 'pdf_extraction' | 'data_validation' | 'enhancement'
    failedAt: Date
    error: string
    retryCount: number
    maxRetries: number
    userId?: string
  }
}

/**
 * Model performance recorded event
 */
export interface ModelPerformanceRecordedEvent extends AIEvent {
  type: AIEventType.MODEL_PERFORMANCE_RECORDED
  data: {
    modelName: string
    taskType: string
    accuracyScore: number
    processingTimeMs: number
    sampleCount: number
    userId?: string
  }
}

/**
 * Model performance degraded event
 */
export interface ModelPerformanceDegradedEvent extends AIEvent {
  type: AIEventType.MODEL_PERFORMANCE_DEGRADED
  data: {
    modelName: string
    taskType: string
    currentAccuracy: number
    previousAccuracy: number
    threshold: number
    degradationPercentage: number
    userId?: string
  }
}

/**
 * Union type for all AI events
 */
export type AnyAIEvent = 
  | PDFProcessingStartedEvent
  | PDFProcessingCompletedEvent
  | PDFProcessingFailedEvent
  | ExtractionResultCreatedEvent
  | ExtractionConfidenceLowEvent
  | ProcessingJobCreatedEvent
  | ProcessingJobStartedEvent
  | ProcessingJobCompletedEvent
  | ProcessingJobFailedEvent
  | ModelPerformanceRecordedEvent
  | ModelPerformanceDegradedEvent

/**
 * Event factory for creating AI events
 */
export class AIEventFactory {
  private static createBaseEvent(type: AIEventType, correlationId?: string): Omit<AIEvent, 'data'> {
    return {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date(),
      version: '1.0',
      source: 'ai-service',
      ...(correlationId && { correlationId })
    }
  }

  static createPDFProcessingStartedEvent(data: PDFProcessingStartedEvent['data'], correlationId?: string): PDFProcessingStartedEvent {
    return {
      ...this.createBaseEvent(AIEventType.PDF_PROCESSING_STARTED, correlationId),
      data
    } as PDFProcessingStartedEvent
  }

  static createPDFProcessingCompletedEvent(data: PDFProcessingCompletedEvent['data'], correlationId?: string): PDFProcessingCompletedEvent {
    return {
      ...this.createBaseEvent(AIEventType.PDF_PROCESSING_COMPLETED, correlationId),
      data
    } as PDFProcessingCompletedEvent
  }

  static createPDFProcessingFailedEvent(data: PDFProcessingFailedEvent['data'], correlationId?: string): PDFProcessingFailedEvent {
    return {
      ...this.createBaseEvent(AIEventType.PDF_PROCESSING_FAILED, correlationId),
      data
    } as PDFProcessingFailedEvent
  }

  static createExtractionResultCreatedEvent(data: ExtractionResultCreatedEvent['data'], correlationId?: string): ExtractionResultCreatedEvent {
    return {
      ...this.createBaseEvent(AIEventType.EXTRACTION_RESULT_CREATED, correlationId),
      data
    } as ExtractionResultCreatedEvent
  }

  static createExtractionConfidenceLowEvent(data: ExtractionConfidenceLowEvent['data'], correlationId?: string): ExtractionConfidenceLowEvent {
    return {
      ...this.createBaseEvent(AIEventType.EXTRACTION_CONFIDENCE_LOW, correlationId),
      data
    } as ExtractionConfidenceLowEvent
  }

  static createProcessingJobCreatedEvent(data: ProcessingJobCreatedEvent['data'], correlationId?: string): ProcessingJobCreatedEvent {
    return {
      ...this.createBaseEvent(AIEventType.PROCESSING_JOB_CREATED, correlationId),
      data
    } as ProcessingJobCreatedEvent
  }

  static createProcessingJobStartedEvent(data: ProcessingJobStartedEvent['data'], correlationId?: string): ProcessingJobStartedEvent {
    return {
      ...this.createBaseEvent(AIEventType.PROCESSING_JOB_STARTED, correlationId),
      data
    } as ProcessingJobStartedEvent
  }

  static createProcessingJobCompletedEvent(data: ProcessingJobCompletedEvent['data'], correlationId?: string): ProcessingJobCompletedEvent {
    return {
      ...this.createBaseEvent(AIEventType.PROCESSING_JOB_COMPLETED, correlationId),
      data
    } as ProcessingJobCompletedEvent
  }

  static createProcessingJobFailedEvent(data: ProcessingJobFailedEvent['data'], correlationId?: string): ProcessingJobFailedEvent {
    return {
      ...this.createBaseEvent(AIEventType.PROCESSING_JOB_FAILED, correlationId),
      data
    } as ProcessingJobFailedEvent
  }

  static createModelPerformanceRecordedEvent(data: ModelPerformanceRecordedEvent['data'], correlationId?: string): ModelPerformanceRecordedEvent {
    return {
      ...this.createBaseEvent(AIEventType.MODEL_PERFORMANCE_RECORDED, correlationId),
      data
    } as ModelPerformanceRecordedEvent
  }

  static createModelPerformanceDegradedEvent(data: ModelPerformanceDegradedEvent['data'], correlationId?: string): ModelPerformanceDegradedEvent {
    return {
      ...this.createBaseEvent(AIEventType.MODEL_PERFORMANCE_DEGRADED, correlationId),
      data
    } as ModelPerformanceDegradedEvent
  }
} 