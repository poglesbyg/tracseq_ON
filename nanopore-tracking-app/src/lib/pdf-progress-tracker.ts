/**
 * PDF Processing Progress Tracker
 * Provides detailed progress feedback for multi-step PDF extraction processes
 */

export enum ProcessingStep {
  INITIALIZING = 'initializing',
  VALIDATING_FILE = 'validating_file',
  LOADING_PARSER = 'loading_parser',
  EXTRACTING_TEXT = 'extracting_text',
  EXTRACTING_METADATA = 'extracting_metadata',
  PATTERN_MATCHING = 'pattern_matching',
  LLM_PROCESSING = 'llm_processing',
  RAG_ENHANCEMENT = 'rag_enhancement',
  VALIDATING_DATA = 'validating_data',
  FINALIZING = 'finalizing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface ProgressUpdate {
  step: ProcessingStep
  progress: number // 0-100
  message: string
  details?: string
  timestamp: Date
  duration?: number // milliseconds since start
  estimatedTimeRemaining?: number // milliseconds
}

export interface ProcessingMetrics {
  totalSteps: number
  currentStep: number
  overallProgress: number
  elapsedTime: number
  estimatedTotalTime: number
  averageStepTime: number
  stepsCompleted: ProcessingStep[]
  currentStepProgress: number
}

export type ProgressCallback = (update: ProgressUpdate) => void

export class PdfProgressTracker {
  private startTime: Date | null = null
  private currentStep: ProcessingStep = ProcessingStep.INITIALIZING
  private stepStartTime: Date | null = null
  private stepDurations: Map<ProcessingStep, number> = new Map()
  private callbacks: ProgressCallback[] = []
  private isCompleted = false
  private hasError = false
  private totalSteps = 0
  private currentStepIndex = 0

  // Default step configurations with expected durations (in milliseconds)
  private stepConfigs: Record<ProcessingStep, { 
    name: string
    description: string
    estimatedDuration: number
    weight: number // relative importance for progress calculation
  }> = {
    [ProcessingStep.INITIALIZING]: {
      name: 'Initializing',
      description: 'Setting up PDF processing environment',
      estimatedDuration: 500,
      weight: 1
    },
    [ProcessingStep.VALIDATING_FILE]: {
      name: 'Validating File',
      description: 'Checking file type, size, and format',
      estimatedDuration: 300,
      weight: 1
    },
    [ProcessingStep.LOADING_PARSER]: {
      name: 'Loading Parser',
      description: 'Initializing PDF parsing modules',
      estimatedDuration: 1000,
      weight: 2
    },
    [ProcessingStep.EXTRACTING_TEXT]: {
      name: 'Extracting Text',
      description: 'Reading text content from PDF pages',
      estimatedDuration: 3000,
      weight: 3
    },
    [ProcessingStep.EXTRACTING_METADATA]: {
      name: 'Extracting Metadata',
      description: 'Reading PDF document information',
      estimatedDuration: 500,
      weight: 1
    },
    [ProcessingStep.PATTERN_MATCHING]: {
      name: 'Pattern Matching',
      description: 'Identifying form fields using regex patterns',
      estimatedDuration: 2000,
      weight: 2
    },
    [ProcessingStep.LLM_PROCESSING]: {
      name: 'AI Processing',
      description: 'Analyzing content with AI models',
      estimatedDuration: 5000,
      weight: 3
    },
    [ProcessingStep.RAG_ENHANCEMENT]: {
      name: 'RAG Enhancement',
      description: 'Enhancing extraction with knowledge base',
      estimatedDuration: 2000,
      weight: 2
    },
    [ProcessingStep.VALIDATING_DATA]: {
      name: 'Validating Data',
      description: 'Checking extracted data quality',
      estimatedDuration: 1000,
      weight: 1
    },
    [ProcessingStep.FINALIZING]: {
      name: 'Finalizing',
      description: 'Preparing results and cleaning up',
      estimatedDuration: 500,
      weight: 1
    },
    [ProcessingStep.COMPLETED]: {
      name: 'Completed',
      description: 'Processing completed successfully',
      estimatedDuration: 0,
      weight: 0
    },
    [ProcessingStep.ERROR]: {
      name: 'Error',
      description: 'Processing encountered an error',
      estimatedDuration: 0,
      weight: 0
    }
  }

  constructor(steps: ProcessingStep[] = []) {
    this.setSteps(steps)
  }

  /**
   * Set the processing steps for this session
   */
  setSteps(steps: ProcessingStep[]): void {
    this.totalSteps = steps.length
    this.currentStepIndex = 0
    this.isCompleted = false
    this.hasError = false
  }

  /**
   * Start progress tracking
   */
  start(): void {
    this.startTime = new Date()
    this.stepStartTime = new Date()
    this.currentStep = ProcessingStep.INITIALIZING
    this.currentStepIndex = 0
    this.isCompleted = false
    this.hasError = false
    this.stepDurations.clear()
    
    this.emitUpdate({
      step: ProcessingStep.INITIALIZING,
      progress: 0,
      message: 'Starting PDF processing...',
      details: 'Initializing processing pipeline'
    })
  }

  /**
   * Update current step progress
   */
  updateStep(step: ProcessingStep, progress: number = 0, message?: string, details?: string): void {
    if (this.isCompleted || this.hasError) {
      return
    }

    // If moving to a new step, record the duration of the previous step
    if (step !== this.currentStep) {
      this.completeCurrentStep()
      this.currentStep = step
      this.stepStartTime = new Date()
      this.currentStepIndex++
    }

    const config = this.stepConfigs[step]
    const finalMessage = message || config.name
    const finalDetails = details || config.description

    this.emitUpdate({
      step,
      progress: Math.min(100, Math.max(0, progress)),
      message: finalMessage,
      details: finalDetails
    })
  }

  /**
   * Complete current step and move to next
   */
  private completeCurrentStep(): void {
    if (this.stepStartTime) {
      const duration = Date.now() - this.stepStartTime.getTime()
      this.stepDurations.set(this.currentStep, duration)
    }
  }

  /**
   * Mark processing as completed
   */
  complete(message: string = 'PDF processing completed successfully'): void {
    this.completeCurrentStep()
    this.isCompleted = true
    this.currentStep = ProcessingStep.COMPLETED
    
    this.emitUpdate({
      step: ProcessingStep.COMPLETED,
      progress: 100,
      message,
      details: 'All processing steps completed'
    })
  }

  /**
   * Mark processing as failed
   */
  error(message: string, details?: string): void {
    this.completeCurrentStep()
    this.hasError = true
    this.currentStep = ProcessingStep.ERROR
    
    this.emitUpdate({
      step: ProcessingStep.ERROR,
      progress: 0,
      message,
      details: details || 'Processing encountered an error'
    })
  }

  /**
   * Emit progress update to all callbacks
   */
  private emitUpdate(update: Partial<ProgressUpdate>): void {
    const now = new Date()
    const duration = this.startTime ? now.getTime() - this.startTime.getTime() : 0
    
    const fullUpdate: ProgressUpdate = {
      step: this.currentStep,
      progress: 0,
      message: '',
      timestamp: now,
      duration,
      estimatedTimeRemaining: this.calculateEstimatedTimeRemaining(),
      ...update
    }

    this.callbacks.forEach(callback => {
      try {
        callback(fullUpdate)
      } catch (error) {
        console.error('Progress callback error:', error)
      }
    })
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateEstimatedTimeRemaining(): number {
    if (!this.startTime || this.isCompleted || this.hasError) {
      return 0
    }

    const elapsedTime = Date.now() - this.startTime.getTime()
    const completedSteps = this.stepDurations.size
    
    if (completedSteps === 0) {
      // Use default estimates
      const remainingSteps = this.totalSteps - this.currentStepIndex
      return remainingSteps * 2000 // 2 seconds per step average
    }

    // Calculate average time per completed step
    const totalCompletedTime = Array.from(this.stepDurations.values()).reduce((a, b) => a + b, 0)
    const averageStepTime = totalCompletedTime / completedSteps
    
    // Estimate remaining time based on remaining steps
    const remainingSteps = this.totalSteps - this.currentStepIndex
    return remainingSteps * averageStepTime
  }

  /**
   * Get current processing metrics
   */
  getMetrics(): ProcessingMetrics {
    const elapsedTime = this.startTime ? Date.now() - this.startTime.getTime() : 0
    const completedSteps = Array.from(this.stepDurations.keys())
    const totalCompletedTime = Array.from(this.stepDurations.values()).reduce((a, b) => a + b, 0)
    const averageStepTime = completedSteps.length > 0 ? totalCompletedTime / completedSteps.length : 0
    
    // Calculate overall progress based on step weights
    const totalWeight = this.totalSteps * 2 // average weight
    const completedWeight = completedSteps.length * 2
    const currentStepWeight = this.stepConfigs[this.currentStep]?.weight || 1
    const currentStepProgress = this.getCurrentStepProgress()
    
    const overallProgress = Math.min(100, 
      ((completedWeight + (currentStepWeight * currentStepProgress / 100)) / totalWeight) * 100
    )

    return {
      totalSteps: this.totalSteps,
      currentStep: this.currentStepIndex,
      overallProgress,
      elapsedTime,
      estimatedTotalTime: elapsedTime + this.calculateEstimatedTimeRemaining(),
      averageStepTime,
      stepsCompleted: completedSteps,
      currentStepProgress
    }
  }

  /**
   * Get current step progress
   */
  private getCurrentStepProgress(): number {
    // This would be set by the last updateStep call
    return 0 // Placeholder - could be enhanced to track sub-step progress
  }

  /**
   * Add progress callback
   */
  onProgress(callback: ProgressCallback): void {
    this.callbacks.push(callback)
  }

  /**
   * Remove progress callback
   */
  offProgress(callback: ProgressCallback): void {
    const index = this.callbacks.indexOf(callback)
    if (index > -1) {
      this.callbacks.splice(index, 1)
    }
  }

  /**
   * Get step configuration
   */
  getStepConfig(step: ProcessingStep): typeof this.stepConfigs[ProcessingStep] {
    return this.stepConfigs[step]
  }

  /**
   * Update step configuration
   */
  updateStepConfig(step: ProcessingStep, config: Partial<typeof this.stepConfigs[ProcessingStep]>): void {
    this.stepConfigs[step] = { ...this.stepConfigs[step], ...config }
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.startTime = null
    this.currentStep = ProcessingStep.INITIALIZING
    this.stepStartTime = null
    this.stepDurations.clear()
    this.isCompleted = false
    this.hasError = false
    this.currentStepIndex = 0
  }

  /**
   * Get processing summary
   */
  getSummary(): {
    totalDuration: number
    stepDurations: Record<string, number>
    averageStepTime: number
    status: 'completed' | 'error' | 'in_progress'
  } {
    const totalDuration = this.startTime ? Date.now() - this.startTime.getTime() : 0
    const stepDurations: Record<string, number> = {}
    
    this.stepDurations.forEach((duration, step) => {
      stepDurations[step] = duration
    })

    const averageStepTime = this.stepDurations.size > 0 
      ? Array.from(this.stepDurations.values()).reduce((a, b) => a + b, 0) / this.stepDurations.size
      : 0

    const status = this.isCompleted ? 'completed' : this.hasError ? 'error' : 'in_progress'

    return {
      totalDuration,
      stepDurations,
      averageStepTime,
      status
    }
  }
}

// Default processing steps for standard PDF extraction
export const DEFAULT_PROCESSING_STEPS: ProcessingStep[] = [
  ProcessingStep.INITIALIZING,
  ProcessingStep.VALIDATING_FILE,
  ProcessingStep.LOADING_PARSER,
  ProcessingStep.EXTRACTING_TEXT,
  ProcessingStep.EXTRACTING_METADATA,
  ProcessingStep.PATTERN_MATCHING,
  ProcessingStep.LLM_PROCESSING,
  ProcessingStep.RAG_ENHANCEMENT,
  ProcessingStep.VALIDATING_DATA,
  ProcessingStep.FINALIZING
]

// Simplified steps for pattern-only extraction
export const PATTERN_ONLY_STEPS: ProcessingStep[] = [
  ProcessingStep.INITIALIZING,
  ProcessingStep.VALIDATING_FILE,
  ProcessingStep.LOADING_PARSER,
  ProcessingStep.EXTRACTING_TEXT,
  ProcessingStep.PATTERN_MATCHING,
  ProcessingStep.VALIDATING_DATA,
  ProcessingStep.FINALIZING
]

// Export convenience functions
export function createProgressTracker(steps: ProcessingStep[] = DEFAULT_PROCESSING_STEPS): PdfProgressTracker {
  return new PdfProgressTracker(steps)
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`
  } else {
    const minutes = Math.floor(milliseconds / 60000)
    const seconds = Math.floor((milliseconds % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }
}

export function formatProgress(progress: number): string {
  return `${Math.round(progress)}%`
} 