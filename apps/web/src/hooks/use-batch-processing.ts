import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { GuideRNA, DesignParameters } from '../lib/crispr/guide-design'
import { ServiceContainer } from '../services/service-container'

export interface BatchSequence {
  id: string
  name: string
  sequence: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  guides?: GuideRNA[]
  errors?: string[]
  progress?: number
}

export interface BatchProcessingState {
  sequences: BatchSequence[]
  isProcessing: boolean
  error: string | null
  overallProgress: number
  summary: BatchSummary | null
  startTime: Date | null
  endTime: Date | null
}

export interface BatchSummary {
  total: number
  completed: number
  failed: number
  totalGuides: number
  averageGuides: number
  processingTime: number
  successRate: number
  recommendations: string[]
}

export interface UseBatchProcessingOptions {
  maxConcurrent?: number
  retryFailures?: boolean
  maxRetries?: number
  enableProgressUpdates?: boolean
  autoStart?: boolean
}

const DEFAULT_OPTIONS: UseBatchProcessingOptions = {
  maxConcurrent: 3,
  retryFailures: true,
  maxRetries: 2,
  enableProgressUpdates: true,
  autoStart: false,
}

export function useBatchProcessing(options: UseBatchProcessingOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const [state, setState] = useState<BatchProcessingState>({
    sequences: [],
    isProcessing: false,
    error: null,
    overallProgress: 0,
    summary: null,
    startTime: null,
    endTime: null,
  })

  // Processing control
  const abortControllerRef = useRef<AbortController | null>(null)
  const processingQueueRef = useRef<string[]>([])
  const activeProcessingRef = useRef<Set<string>>(new Set())

  // Get services
  const serviceContainer = ServiceContainer.getInstance()
  const crisprService = serviceContainer.getCrisprService()

  /**
   * Add sequences to the batch
   */
  const addSequences = useCallback((sequences: Array<{ name: string; sequence: string }>) => {
    const newSequences: BatchSequence[] = sequences.map((seq, index) => ({
      id: `seq-${Date.now()}-${index}`,
      name: seq.name || `Sequence ${state.sequences.length + index + 1}`,
      sequence: seq.sequence,
      status: 'pending',
      progress: 0,
    }))

    setState(prev => ({
      ...prev,
      sequences: [...prev.sequences, ...newSequences],
    }))

    toast.success(`Added ${sequences.length} sequences to batch`)
    return newSequences.map(s => s.id)
  }, [state.sequences.length])

  /**
   * Remove sequences from the batch
   */
  const removeSequences = useCallback((sequenceIds: string[]) => {
    setState(prev => ({
      ...prev,
      sequences: prev.sequences.filter(seq => !sequenceIds.includes(seq.id)),
    }))
    toast.info(`Removed ${sequenceIds.length} sequences from batch`)
  }, [])

  /**
   * Clear all sequences
   */
  const clearBatch = useCallback(() => {
    if (state.isProcessing) {
      toast.error('Cannot clear batch while processing')
      return
    }

    setState(prev => ({
      ...prev,
      sequences: [],
      summary: null,
    }))
    toast.info('Batch cleared')
  }, [state.isProcessing])

  /**
   * Process a single sequence
   */
  const processSequence = useCallback(
    async (sequenceId: string, parameters: DesignParameters): Promise<void> => {
      const sequence = state.sequences.find(s => s.id === sequenceId)
      if (!sequence) {return}

      try {
        // Update status to processing
        setState(prev => ({
          ...prev,
          sequences: prev.sequences.map(s =>
            s.id === sequenceId
              ? { ...s, status: 'processing', progress: 0 }
              : s
          ),
        }))

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setState(prev => ({
            ...prev,
            sequences: prev.sequences.map(s =>
              s.id === sequenceId
                ? { ...s, progress: Math.min((s.progress || 0) + 20, 90) }
                : s
            ),
          }))
        }, 300)

        // Design guides for the sequence
        const guides = await crisprService.designGuideRNAs({
          sequence: sequence.sequence,
          parameters,
        })

        clearInterval(progressInterval)

        // Update with results
        setState(prev => ({
          ...prev,
          sequences: prev.sequences.map(s =>
            s.id === sequenceId
              ? {
                  ...s,
                  status: 'completed',
                  guides,
                  progress: 100,
                  errors: undefined,
                }
              : s
          ),
        }))

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Processing failed'
        
        setState(prev => ({
          ...prev,
          sequences: prev.sequences.map(s =>
            s.id === sequenceId
              ? {
                  ...s,
                  status: 'failed',
                  errors: [errorMessage],
                  progress: 0,
                }
              : s
          ),
        }))
      } finally {
        activeProcessingRef.current.delete(sequenceId)
      }
    },
    [state.sequences, crisprService]
  )

  /**
   * Process batch with concurrency control
   */
  const processBatch = useCallback(
    async (parameters: DesignParameters) => {
      if (state.sequences.length === 0) {
        toast.error('No sequences to process')
        return
      }

      if (state.isProcessing) {
        toast.error('Batch is already processing')
        return
      }

      // Setup processing state
      abortControllerRef.current = new AbortController()
      const startTime = new Date()
      
      setState(prev => ({
        ...prev,
        isProcessing: true,
        error: null,
        overallProgress: 0,
        startTime,
        endTime: null,
        sequences: prev.sequences.map(s => ({ ...s, status: 'pending', progress: 0 })),
      }))

      // Initialize processing queue
      processingQueueRef.current = state.sequences.map(s => s.id)
      activeProcessingRef.current.clear()

      try {
        // Process sequences with concurrency limit
        const processingPromises: Promise<void>[] = []

        const processNext = async (): Promise<void> => {
          while (processingQueueRef.current.length > 0 && !abortControllerRef.current?.signal.aborted) {
            if (activeProcessingRef.current.size >= opts.maxConcurrent!) {
              await new Promise(resolve => setTimeout(resolve, 100))
              continue
            }

            const sequenceId = processingQueueRef.current.shift()
            if (!sequenceId) {break}

            activeProcessingRef.current.add(sequenceId)
            await processSequence(sequenceId, parameters)
          }
        }

        // Start concurrent processing
        for (let i = 0; i < opts.maxConcurrent!; i++) {
          processingPromises.push(processNext())
        }

        await Promise.all(processingPromises)

        const endTime = new Date()
        const summary = generateBatchSummary(state.sequences, startTime, endTime)

        setState(prev => ({
          ...prev,
          isProcessing: false,
          overallProgress: 100,
          endTime,
          summary,
        }))

        toast.success(`Batch processing completed: ${summary.completed}/${summary.total} successful`)

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Batch processing failed'
        setState(prev => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
          overallProgress: 0,
        }))
        toast.error(`Batch processing failed: ${errorMessage}`)
      }
    },
    [state.sequences, state.isProcessing, processSequence, opts.maxConcurrent]
  )

  /**
   * Cancel batch processing
   */
  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setState(prev => ({
        ...prev,
        isProcessing: false,
        overallProgress: 0,
      }))
      toast.info('Batch processing cancelled')
    }
  }, [])

  /**
   * Retry failed sequences
   */
  const retryFailures = useCallback(
    async (parameters: DesignParameters) => {
      const failedSequences = state.sequences.filter(s => s.status === 'failed')
      if (failedSequences.length === 0) {
        toast.info('No failed sequences to retry')
        return
      }

      // Reset failed sequences to pending
      setState(prev => ({
        ...prev,
        sequences: prev.sequences.map(s =>
          s.status === 'failed' ? { ...s, status: 'pending', errors: undefined } : s
        ),
      }))

      // Process only failed sequences
      processingQueueRef.current = failedSequences.map(s => s.id)
      await processBatch(parameters)
    },
    [state.sequences, processBatch]
  )

  /**
   * Export results
   */
  const exportResults = useCallback(() => {
    const completedSequences = state.sequences.filter(s => s.status === 'completed')
    if (completedSequences.length === 0) {
      toast.error('No completed sequences to export')
      return
    }

    const exportData = {
      summary: state.summary,
      sequences: completedSequences.map(seq => ({
        name: seq.name,
        sequence: seq.sequence,
        guideCount: seq.guides?.length || 0,
        topGuides: seq.guides?.slice(0, 5).map(g => ({
          sequence: g.sequence,
          efficiencyScore: g.efficiencyScore,
          specificityScore: g.specificityScore,
        })),
      })),
      exportedAt: new Date().toISOString(),
    }

    // Create downloadable file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-results-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast.success('Results exported successfully')
  }, [state.sequences, state.summary])

  /**
   * Get processing statistics
   */
  const getStatistics = useCallback(() => {
    const total = state.sequences.length
    const completed = state.sequences.filter(s => s.status === 'completed').length
    const failed = state.sequences.filter(s => s.status === 'failed').length
    const processing = state.sequences.filter(s => s.status === 'processing').length
    const pending = state.sequences.filter(s => s.status === 'pending').length

    return {
      total,
      completed,
      failed,
      processing,
      pending,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    }
  }, [state.sequences])

  // Update overall progress
  useEffect(() => {
    if (!state.isProcessing) {return}

    const stats = getStatistics()
    const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
    
    setState(prev => ({
      ...prev,
      overallProgress: progress,
    }))
  }, [state.sequences, state.isProcessing, getStatistics])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    // State
    ...state,
    
    // Actions
    addSequences,
    removeSequences,
    clearBatch,
    processBatch,
    cancelProcessing,
    retryFailures,
    exportResults,
    
    // Computed values
    hasSequences: state.sequences.length > 0,
    canProcess: state.sequences.length > 0 && !state.isProcessing,
    statistics: getStatistics(),
    
    // Utilities
    getStatistics,
  }
}

/**
 * Generate batch processing summary
 */
function generateBatchSummary(
  sequences: BatchSequence[],
  startTime: Date,
  endTime: Date
): BatchSummary {
  const total = sequences.length
  const completed = sequences.filter(s => s.status === 'completed').length
  const failed = sequences.filter(s => s.status === 'failed').length
  const totalGuides = sequences.reduce((sum, s) => sum + (s.guides?.length || 0), 0)
  const averageGuides = completed > 0 ? totalGuides / completed : 0
  const processingTime = (endTime.getTime() - startTime.getTime()) / 1000
  const successRate = total > 0 ? (completed / total) * 100 : 0

  const recommendations: string[] = []

  if (successRate === 100) {
    recommendations.push('Excellent! All sequences processed successfully.')
  } else if (successRate >= 80) {
    recommendations.push('Good success rate. Review failed sequences for common issues.')
  } else if (successRate >= 50) {
    recommendations.push('Moderate success rate. Consider adjusting design parameters.')
  } else {
    recommendations.push('Low success rate. Review sequence quality and parameters.')
  }

  if (averageGuides < 3) {
    recommendations.push('Low average guide count. Consider using longer sequences or relaxing parameters.')
  } else if (averageGuides > 15) {
    recommendations.push('High guide count. Consider more stringent filtering for quality.')
  }

  if (processingTime > 60) {
    recommendations.push('Long processing time. Consider processing smaller batches.')
  }

  return {
    total,
    completed,
    failed,
    totalGuides,
    averageGuides,
    processingTime,
    successRate,
    recommendations,
  }
} 