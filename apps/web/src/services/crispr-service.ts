import { CrisprError, ValidationError } from '../errors/domain-errors'
import type { AIAnalysisResult, GuideOptimizationResult } from '../lib/ai/ollama-service'
import type { GuideRNA, DesignParameters } from '../lib/crispr/guide-design'
import type { CrisprRepository } from '../repositories/crispr-repository'

import type { AIService } from './ai-service'
import type { ValidationService } from './validation-service'


export interface CrisprDesignRequest {
  sequence: string
  parameters: DesignParameters
  userId?: string
  projectId?: string
}

export interface CrisprAnalysisRequest {
  sequence: string
  guides: GuideRNA[]
  analysisType: 'off-target' | '3d-structure' | 'efficiency'
  context?: string
}

export interface BatchProcessingRequest {
  sequences: string[]
  parameters: DesignParameters
  batchName?: string
  userId?: string
}

export class CrisprService {
  constructor(
    private readonly crisprRepository: CrisprRepository,
    private readonly aiService: AIService,
    private readonly validationService: ValidationService
  ) {}

  /**
   * Design guide RNAs for a given sequence
   */
  async designGuideRNAs(request: CrisprDesignRequest): Promise<GuideRNA[]> {
    try {
      // Validate input
      await this.validationService.validateDesignRequest(request)

      // Check sequence constraints
      this.validateSequenceConstraints(request.sequence)

      // Design guides using the repository
      const guides = await this.crisprRepository.designGuides(
        request.sequence,
        request.parameters
      )

      // Save design session if user context provided
      if (request.userId) {
        await this.crisprRepository.saveDesignSession({
          userId: request.userId,
          projectId: request.projectId,
          sequence: request.sequence,
          parameters: request.parameters,
          guides,
          createdAt: new Date()
        })
      }

      return guides
    } catch (error) {
      throw new CrisprError(
        'Failed to design guide RNAs',
        'DESIGN_FAILED',
        { request, originalError: error }
      )
    }
  }

  /**
   * Analyze guide RNAs with AI assistance
   */
  async analyzeGuides(request: CrisprAnalysisRequest): Promise<AIAnalysisResult> {
    try {
      await this.validationService.validateAnalysisRequest(request)

      const analysisResult = await this.aiService.analyzeSequence(
        request.sequence,
        request.context
      )

      // Store analysis results
      await this.crisprRepository.saveAnalysisResult({
        sequence: request.sequence,
        guides: request.guides,
        analysisType: request.analysisType,
        result: analysisResult,
        timestamp: new Date()
      })

      return analysisResult
    } catch (error) {
      throw new CrisprError(
        'Failed to analyze guides',
        'ANALYSIS_FAILED',
        { request, originalError: error }
      )
    }
  }

  /**
   * Optimize guide RNA using AI
   */
  async optimizeGuide(
    guide: GuideRNA,
    context?: string
  ): Promise<GuideOptimizationResult> {
    try {
      await this.validationService.validateGuideRNA(guide)

      const optimizationResult = await this.aiService.optimizeGuide(guide, context)

      // Log optimization for future reference
      await this.crisprRepository.saveOptimizationResult({
        originalGuide: guide,
        optimizedResult: optimizationResult,
        context,
        timestamp: new Date()
      })

      return optimizationResult
    } catch (error) {
      throw new CrisprError(
        'Failed to optimize guide',
        'OPTIMIZATION_FAILED',
        { guide, originalError: error }
      )
    }
  }

  /**
   * Process multiple sequences in batch
   */
  async processBatch(request: BatchProcessingRequest): Promise<{
    results: Array<{ sequence: string; guides: GuideRNA[]; errors?: string[] }>
    summary: {
      total: number
      successful: number
      failed: number
      totalGuides: number
    }
  }> {
    try {
      await this.validationService.validateBatchRequest(request)

      const results = []
      let successful = 0
      let failed = 0
      let totalGuides = 0

      for (const sequence of request.sequences) {
        try {
          const guides = await this.crisprRepository.designGuides(
            sequence,
            request.parameters
          )
          
          results.push({ sequence, guides })
          successful++
          totalGuides += guides.length
        } catch (error) {
          results.push({
            sequence,
            guides: [],
            errors: [error instanceof Error ? error.message : 'Unknown error']
          })
          failed++
        }
      }

      // Save batch results
      if (request.userId) {
        await this.crisprRepository.saveBatchResult({
          userId: request.userId,
          batchName: request.batchName,
          parameters: request.parameters,
          results,
          summary: {
            total: request.sequences.length,
            successful,
            failed,
            totalGuides
          },
          createdAt: new Date()
        })
      }

      return {
        results,
        summary: {
          total: request.sequences.length,
          successful,
          failed,
          totalGuides
        }
      }
    } catch (error) {
      throw new CrisprError(
        'Failed to process batch',
        'BATCH_PROCESSING_FAILED',
        { request, originalError: error }
      )
    }
  }

  /**
   * Get user's design history
   */
  async getDesignHistory(userId: string, limit = 10): Promise<any[]> {
    try {
      return await this.crisprRepository.getDesignHistory(userId, limit)
    } catch (error) {
      throw new CrisprError(
        'Failed to retrieve design history',
        'HISTORY_RETRIEVAL_FAILED',
        { userId, originalError: error }
      )
    }
  }

  /**
   * Validate sequence constraints
   */
  private validateSequenceConstraints(sequence: string): void {
    const minLength = 20
    const maxLength = 10000

    if (sequence.length < minLength) {
      throw new ValidationError(
        `Sequence too short. Minimum length: ${minLength}`,
        'SEQUENCE_TOO_SHORT',
        { sequence, minLength }
      )
    }

    if (sequence.length > maxLength) {
      throw new ValidationError(
        `Sequence too long. Maximum length: ${maxLength}`,
        'SEQUENCE_TOO_LONG',
        { sequence, maxLength }
      )
    }

    // Validate DNA sequence
    const validDNA = /^[acgt]+$/i
    if (!validDNA.test(sequence)) {
      throw new ValidationError(
        'Invalid DNA sequence. Only A, T, C, G characters allowed',
        'INVALID_DNA_SEQUENCE',
        { sequence }
      )
    }
  }
} 