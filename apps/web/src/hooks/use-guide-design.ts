import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { GuideRNA, DesignParameters } from '../lib/crispr/guide-design'
import { ServiceContainer } from '../services/service-container'

export interface GuideDesignState {
  guides: GuideRNA[]
  isDesigning: boolean
  isAnalyzing: boolean
  error: string | null
  progress: number
  analysisResults: AnalysisResult | null
}

export interface AnalysisResult {
  totalGuides: number
  highEfficiencyGuides: number
  averageScore: number
  recommendedGuides: GuideRNA[]
  warnings: string[]
}

export interface UseGuideDesignOptions {
  autoAnalyze?: boolean
  maxGuides?: number
  minEfficiencyScore?: number
  enableRealTimeUpdates?: boolean
  cacheResults?: boolean
}

const DEFAULT_OPTIONS: UseGuideDesignOptions = {
  autoAnalyze: true,
  maxGuides: 20,
  minEfficiencyScore: 0.3,
  enableRealTimeUpdates: true,
  cacheResults: true,
}

export function useGuideDesign(options: UseGuideDesignOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const [state, setState] = useState<GuideDesignState>({
    guides: [],
    isDesigning: false,
    isAnalyzing: false,
    error: null,
    progress: 0,
    analysisResults: null,
  })

  // Cache for designed guides
  const cacheRef = useRef<Map<string, GuideRNA[]>>(new Map())
  const abortControllerRef = useRef<AbortController | null>(null)

  // Get services
  const serviceContainer = ServiceContainer.getInstance()
  const crisprService = serviceContainer.getCrisprService()
  const validationService = serviceContainer.getValidationService()

  /**
   * Design guide RNAs for a given sequence
   */
  const designGuides = useCallback(
    async (sequence: string, parameters: DesignParameters) => {
             try {
         // Check cache first
         const cacheKey = `${sequence}-${JSON.stringify(parameters)}`
         if (opts.cacheResults && cacheRef.current.has(cacheKey)) {
           const cachedGuides = cacheRef.current.get(cacheKey)!
           setState(prev => ({
             ...prev,
             guides: cachedGuides,
             analysisResults: analyzeGuides(cachedGuides),
           }))
           toast.success('Loaded guides from cache')
           return cachedGuides
         }

         // Cancel any ongoing requests
         if (abortControllerRef.current) {
           abortControllerRef.current.abort()
         }
         abortControllerRef.current = new AbortController()

         setState(prev => ({
           ...prev,
           isDesigning: true,
           error: null,
           progress: 0,
         }))

         // Simulate progress updates
         const progressInterval = setInterval(() => {
           setState(prev => ({
             ...prev,
             progress: Math.min(prev.progress + 10, 90),
           }))
         }, 200)

         // Design guides
         const guides = await crisprService.designGuideRNAs({
           sequence,
           parameters,
         })

        clearInterval(progressInterval)

        // Filter by efficiency score
        const filteredGuides = guides.filter(
          guide => guide.efficiencyScore >= opts.minEfficiencyScore!
        )

        // Cache results
        if (opts.cacheResults) {
          cacheRef.current.set(cacheKey, filteredGuides)
        }

        const analysisResults = opts.autoAnalyze ? analyzeGuides(filteredGuides) : null

        setState(prev => ({
          ...prev,
          guides: filteredGuides,
          isDesigning: false,
          progress: 100,
          analysisResults,
        }))

        toast.success(`Designed ${filteredGuides.length} guide RNAs`)
        return filteredGuides

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Design failed'
        setState(prev => ({
          ...prev,
          isDesigning: false,
          error: errorMessage,
          progress: 0,
        }))
        toast.error(`Guide design failed: ${errorMessage}`)
        throw error
      }
    },
    [crisprService, validationService, opts]
  )

  /**
   * Analyze designed guides for quality metrics
   */
  const analyzeGuides = useCallback((guides: GuideRNA[]): AnalysisResult => {
    if (guides.length === 0) {
      return {
        totalGuides: 0,
        highEfficiencyGuides: 0,
        averageScore: 0,
        recommendedGuides: [],
        warnings: ['No guides available for analysis'],
      }
    }

    const highEfficiencyGuides = guides.filter(g => g.efficiencyScore >= 0.7)
    const averageScore = guides.reduce((sum, g) => sum + g.efficiencyScore, 0) / guides.length
    const recommendedGuides = guides
      .sort((a, b) => b.efficiencyScore - a.efficiencyScore)
      .slice(0, 5)

    const warnings: string[] = []
    if (highEfficiencyGuides.length === 0) {
      warnings.push('No high-efficiency guides found (score ≥ 0.7)')
    }
    if (averageScore < 0.5) {
      warnings.push('Average efficiency score is below recommended threshold')
    }
    if (guides.length < 5) {
      warnings.push('Limited number of guides available')
    }

    return {
      totalGuides: guides.length,
      highEfficiencyGuides: highEfficiencyGuides.length,
      averageScore,
      recommendedGuides,
      warnings,
    }
  }, [])

  /**
   * Re-analyze current guides with updated parameters
   */
  const reanalyzeGuides = useCallback(async () => {
    if (state.guides.length === 0) {return}

    setState(prev => ({ ...prev, isAnalyzing: true }))

    try {
      // Simulate analysis time
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const analysisResults = analyzeGuides(state.guides)
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        analysisResults,
      }))
      
      toast.success('Analysis updated')
    } catch (_error) {
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: 'Analysis failed',
      }))
      toast.error('Analysis failed')
    }
  }, [state.guides, analyzeGuides])

  /**
   * Clear current results and cache
   */
  const clearResults = useCallback(() => {
    setState({
      guides: [],
      isDesigning: false,
      isAnalyzing: false,
      error: null,
      progress: 0,
      analysisResults: null,
    })
    
    if (opts.cacheResults) {
      cacheRef.current.clear()
    }
    
    toast.info('Results cleared')
  }, [opts.cacheResults])

  /**
   * Cancel ongoing design process
   */
  const cancelDesign = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setState(prev => ({
        ...prev,
        isDesigning: false,
        progress: 0,
      }))
      toast.info('Design cancelled')
    }
  }, [])

  /**
   * Get recommended guides based on efficiency and specificity
   */
  const getRecommendedGuides = useCallback((count: number = 3): GuideRNA[] => {
    return state.guides
      .filter(guide => guide.efficiencyScore >= 0.6)
      .sort((a, b) => {
        // Sort by efficiency score first, then by specificity
        const effDiff = b.efficiencyScore - a.efficiencyScore
        if (Math.abs(effDiff) > 0.1) {return effDiff}
        return (b.specificityScore || 0) - (a.specificityScore || 0)
      })
      .slice(0, count)
  }, [state.guides])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Real-time updates simulation
  useEffect(() => {
    if (!opts.enableRealTimeUpdates || state.guides.length === 0) {return}

    const interval = setInterval(() => {
      // Simulate minor score updates
      setState(prev => ({
        ...prev,
        guides: prev.guides.map(guide => ({
          ...guide,
          efficiencyScore: Math.min(1, guide.efficiencyScore + (Math.random() - 0.5) * 0.01),
        })),
      }))
    }, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [opts.enableRealTimeUpdates, state.guides.length])

  return {
    // State
    ...state,
    
    // Actions
    designGuides,
    reanalyzeGuides,
    clearResults,
    cancelDesign,
    
    // Computed values
    recommendedGuides: getRecommendedGuides(),
    hasResults: state.guides.length > 0,
    isProcessing: state.isDesigning || state.isAnalyzing,
    
    // Utilities
    getRecommendedGuides,
    analyzeGuides,
  }
} 