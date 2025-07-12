import { RepositoryError } from '../errors/domain-errors'
import type { AIAnalysisResult } from '../lib/ai/ollama-service'
import type { GuideRNA, DesignParameters } from '../lib/crispr/guide-design'
import { designGuideRNAs } from '../lib/crispr/guide-design'

export interface DesignSession {
  id?: string
  userId: string
  projectId?: string
  sequence: string
  parameters: DesignParameters
  guides: GuideRNA[]
  createdAt: Date
}

export interface AnalysisResult {
  id?: string
  sequence: string
  guides: GuideRNA[]
  analysisType: 'off-target' | '3d-structure' | 'efficiency'
  result: AIAnalysisResult
  timestamp: Date
}

export interface OptimizationResult {
  id?: string
  originalGuide: GuideRNA
  optimizedResult: any
  context?: string
  timestamp: Date
}

export interface BatchResult {
  id?: string
  userId: string
  batchName?: string
  parameters: DesignParameters
  results: Array<{ sequence: string; guides: GuideRNA[]; errors?: string[] }>
  summary: {
    total: number
    successful: number
    failed: number
    totalGuides: number
  }
  createdAt: Date
}

/**
 * Repository interface for CRISPR data operations
 */
export interface ICrisprRepository {
  // Design operations
  designGuides(
    sequence: string,
    parameters: DesignParameters,
  ): Promise<GuideRNA[]>
  saveDesignSession(session: DesignSession): Promise<string>
  getDesignHistory(userId: string, limit?: number): Promise<DesignSession[]>

  // Analysis operations
  saveAnalysisResult(result: AnalysisResult): Promise<string>
  getAnalysisHistory(userId: string, limit?: number): Promise<AnalysisResult[]>

  // Optimization operations
  saveOptimizationResult(result: OptimizationResult): Promise<string>
  getOptimizationHistory(
    userId: string,
    limit?: number,
  ): Promise<OptimizationResult[]>

  // Batch operations
  saveBatchResult(result: BatchResult): Promise<string>
  getBatchHistory(userId: string, limit?: number): Promise<BatchResult[]>

  // Utility operations
  deleteDesignSession(id: string): Promise<void>
  deleteAnalysisResult(id: string): Promise<void>
}

/**
 * In-memory implementation of CRISPR repository
 * In a real application, this would use a database
 */
export class CrisprRepository implements ICrisprRepository {
  private designSessions = new Map<string, DesignSession>()
  private analysisResults = new Map<string, AnalysisResult>()
  private optimizationResults = new Map<string, OptimizationResult>()
  private batchResults = new Map<string, BatchResult>()

  /**
   * Design guide RNAs using the core algorithm
   */
  async designGuides(
    sequence: string,
    parameters: DesignParameters,
  ): Promise<GuideRNA[]> {
    try {
      // Use the existing guide design algorithm
      const designParams = {
        ...parameters,
        targetSequence: sequence,
      }

      const guides = await Promise.resolve(designGuideRNAs(designParams))
      return guides
    } catch (error) {
      throw new RepositoryError(
        'Failed to design guides',
        'DESIGN_GUIDES_FAILED',
        { sequence, parameters, originalError: error },
      )
    }
  }

  /**
   * Save design session
   */
  saveDesignSession(session: DesignSession): Promise<string> {
    try {
      const id = session.id || this.generateId()
      const sessionWithId = { ...session, id }
      this.designSessions.set(id, sessionWithId)
      return Promise.resolve(id)
    } catch (error) {
      throw new RepositoryError(
        'Failed to save design session',
        'SAVE_DESIGN_SESSION_FAILED',
        { session, originalError: error },
      )
    }
  }

  /**
   * Get design history for a user
   */
  getDesignHistory(userId: string, limit = 10): Promise<DesignSession[]> {
    try {
      const userSessions = Array.from(this.designSessions.values())
        .filter((session) => session.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)

      return Promise.resolve(userSessions)
    } catch (error) {
      throw new RepositoryError(
        'Failed to get design history',
        'GET_DESIGN_HISTORY_FAILED',
        { userId, limit, originalError: error },
      )
    }
  }

  /**
   * Save analysis result
   */
  saveAnalysisResult(result: AnalysisResult): Promise<string> {
    try {
      const id = result.id || this.generateId()
      const resultWithId = { ...result, id }
      this.analysisResults.set(id, resultWithId)
      return Promise.resolve(id)
    } catch (error) {
      throw new RepositoryError(
        'Failed to save analysis result',
        'SAVE_ANALYSIS_RESULT_FAILED',
        { result, originalError: error },
      )
    }
  }

  /**
   * Get analysis history (mock implementation)
   */
  getAnalysisHistory(userId: string, limit = 10): Promise<AnalysisResult[]> {
    try {
      // In a real implementation, this would filter by userId
      const results = Array.from(this.analysisResults.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit)

      return Promise.resolve(results)
    } catch (error) {
      throw new RepositoryError(
        'Failed to get analysis history',
        'GET_ANALYSIS_HISTORY_FAILED',
        { userId, limit, originalError: error },
      )
    }
  }

  /**
   * Save optimization result
   */
  saveOptimizationResult(result: OptimizationResult): Promise<string> {
    try {
      const id = result.id || this.generateId()
      const resultWithId = { ...result, id }
      this.optimizationResults.set(id, resultWithId)
      return Promise.resolve(id)
    } catch (error) {
      throw new RepositoryError(
        'Failed to save optimization result',
        'SAVE_OPTIMIZATION_RESULT_FAILED',
        { result, originalError: error },
      )
    }
  }

  /**
   * Get optimization history (mock implementation)
   */
  getOptimizationHistory(
    userId: string,
    limit = 10,
  ): Promise<OptimizationResult[]> {
    try {
      // In a real implementation, this would filter by userId
      const results = Array.from(this.optimizationResults.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit)

      return Promise.resolve(results)
    } catch (error) {
      throw new RepositoryError(
        'Failed to get optimization history',
        'GET_OPTIMIZATION_HISTORY_FAILED',
        { userId, limit, originalError: error },
      )
    }
  }

  /**
   * Save batch result
   */
  saveBatchResult(result: BatchResult): Promise<string> {
    try {
      const id = result.id || this.generateId()
      const resultWithId = { ...result, id }
      this.batchResults.set(id, resultWithId)
      return Promise.resolve(id)
    } catch (error) {
      throw new RepositoryError(
        'Failed to save batch result',
        'SAVE_BATCH_RESULT_FAILED',
        { result, originalError: error },
      )
    }
  }

  /**
   * Get batch history for a user
   */
  getBatchHistory(userId: string, limit = 10): Promise<BatchResult[]> {
    try {
      const userBatches = Array.from(this.batchResults.values())
        .filter((batch) => batch.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)

      return Promise.resolve(userBatches)
    } catch (error) {
      throw new RepositoryError(
        'Failed to get batch history',
        'GET_BATCH_HISTORY_FAILED',
        { userId, limit, originalError: error },
      )
    }
  }

  /**
   * Delete design session
   */
  deleteDesignSession(id: string): Promise<void> {
    try {
      if (!this.designSessions.has(id)) {
        throw new RepositoryError(
          'Design session not found',
          'DESIGN_SESSION_NOT_FOUND',
          { id },
        )
      }

      this.designSessions.delete(id)
      return Promise.resolve()
    } catch (error) {
      throw new RepositoryError(
        'Failed to delete design session',
        'DELETE_DESIGN_SESSION_FAILED',
        { id, originalError: error },
      )
    }
  }

  /**
   * Delete analysis result
   */
  deleteAnalysisResult(id: string): Promise<void> {
    try {
      if (!this.analysisResults.has(id)) {
        throw new RepositoryError(
          'Analysis result not found',
          'ANALYSIS_RESULT_NOT_FOUND',
          { id },
        )
      }

      this.analysisResults.delete(id)
      return Promise.resolve()
    } catch (error) {
      throw new RepositoryError(
        'Failed to delete analysis result',
        'DELETE_ANALYSIS_RESULT_FAILED',
        { id, originalError: error },
      )
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get repository statistics (utility method)
   */
  getStatistics(): Promise<{
    totalDesignSessions: number
    totalAnalysisResults: number
    totalOptimizationResults: number
    totalBatchResults: number
  }> {
    return Promise.resolve({
      totalDesignSessions: this.designSessions.size,
      totalAnalysisResults: this.analysisResults.size,
      totalOptimizationResults: this.optimizationResults.size,
      totalBatchResults: this.batchResults.size,
    })
  }

  /**
   * Clear all data (for testing purposes)
   */
  clearAll(): Promise<void> {
    this.designSessions.clear()
    this.analysisResults.clear()
    this.optimizationResults.clear()
    this.batchResults.clear()
    return Promise.resolve()
  }
}
