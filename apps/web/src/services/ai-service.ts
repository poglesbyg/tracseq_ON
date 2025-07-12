import { AIError } from '../errors/domain-errors'
import type {
  AIAnalysisResult,
  GuideOptimizationResult,
} from '../lib/ai/ollama-service'
import { aiService as ollamaService } from '../lib/ai/ollama-service'
import type { GuideRNA } from '../lib/crispr/guide-design'

export class AIService {
  /**
   * Analyze DNA sequence for CRISPR design
   */
  async analyzeSequence(
    sequence: string,
    context?: string,
  ): Promise<AIAnalysisResult> {
    try {
      return await ollamaService.analyzeSequence(sequence, context)
    } catch (error) {
      throw new AIError(
        'Failed to analyze sequence with AI',
        'SEQUENCE_ANALYSIS_FAILED',
        { sequence, context, originalError: error },
      )
    }
  }

  /**
   * Optimize guide RNA using AI
   */
  async optimizeGuide(
    guide: GuideRNA,
    context?: string,
  ): Promise<GuideOptimizationResult> {
    try {
      // Extract guide sequence and target info from GuideRNA
      const guideSequence = guide.sequence
      const targetSequence = '' // Will be provided by context if needed
      const pamSequence = guide.pamSequence || 'NGG'

      return await ollamaService.optimizeGuideRNA(
        guideSequence,
        targetSequence,
        pamSequence,
      )
    } catch (error) {
      throw new AIError(
        'Failed to optimize guide with AI',
        'GUIDE_OPTIMIZATION_FAILED',
        { guide, context, originalError: error },
      )
    }
  }

  /**
   * Get experiment suggestions based on sequence and context
   */
  async getExperimentSuggestions(
    sequence: string,
    guides: GuideRNA[],
    context?: string,
  ): Promise<string[]> {
    try {
      const suggestions = await ollamaService.generateExperimentSuggestions(
        'crispr',
        context,
        'human',
      )
      return suggestions.map((s: any) => s.title)
    } catch (error) {
      throw new AIError(
        'Failed to get experiment suggestions',
        'EXPERIMENT_SUGGESTIONS_FAILED',
        { sequence, guides, context, originalError: error },
      )
    }
  }

  /**
   * Check if AI service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await Promise.resolve(ollamaService.isAIAvailable())
    } catch {
      return false
    }
  }
}
