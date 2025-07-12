import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { GuideRNA } from '../lib/crispr/guide-design'
import { ServiceContainer } from '../services/service-container'

export interface OffTargetSite {
  id: string
  sequence: string
  chromosome: string
  position: number
  strand: '+' | '-'
  mismatches: number
  mismatchPositions: number[]
  bindingScore: number
  cuttingScore: number
  gene?: string
  geneFunction?: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface OffTargetAnalysisState {
  sites: OffTargetSite[]
  isAnalyzing: boolean
  error: string | null
  progress: number
  summary: AnalysisSummary | null
  selectedGuide: GuideRNA | null
}

export interface AnalysisSummary {
  totalSites: number
  highRiskSites: number
  averageBindingScore: number
  averageCuttingScore: number
  riskDistribution: Record<string, number>
  recommendedAction: 'proceed' | 'caution' | 'modify' | 'reject'
  warnings: string[]
}

export interface UseOffTargetAnalysisOptions {
  maxSites?: number
  minBindingScore?: number
  enableRealTimeUpdates?: boolean
  autoAnalyze?: boolean
  includeGeneAnnotation?: boolean
}

const DEFAULT_OPTIONS: UseOffTargetAnalysisOptions = {
  maxSites: 100,
  minBindingScore: 0.1,
  enableRealTimeUpdates: true,
  autoAnalyze: true,
  includeGeneAnnotation: true,
}

export function useOffTargetAnalysis(options: UseOffTargetAnalysisOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const [state, setState] = useState<OffTargetAnalysisState>({
    sites: [],
    isAnalyzing: false,
    error: null,
    progress: 0,
    summary: null,
    selectedGuide: null,
  })

  // Cache for analysis results
  const cacheRef = useRef<Map<string, OffTargetSite[]>>(new Map())
  const abortControllerRef = useRef<AbortController | null>(null)

  // Get services
  const serviceContainer = ServiceContainer.getInstance()
  const crisprService = serviceContainer.getCrisprService()

  /**
   * Analyze off-target sites for a guide RNA
   */
  const analyzeOffTargets = useCallback(
    async (guide: GuideRNA, genomeBuild: string = 'hg38') => {
      try {
        // Check cache first
        const cacheKey = `${guide.sequence}-${genomeBuild}`
        if (cacheRef.current.has(cacheKey)) {
          const cachedSites = cacheRef.current.get(cacheKey)!
          setState(prev => ({
            ...prev,
            sites: cachedSites,
            selectedGuide: guide,
            summary: generateSummary(cachedSites),
          }))
          toast.success('Loaded off-target analysis from cache')
          return cachedSites
        }

        // Cancel any ongoing analysis
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()

        setState(prev => ({
          ...prev,
          isAnalyzing: true,
          error: null,
          progress: 0,
          selectedGuide: guide,
        }))

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setState(prev => ({
            ...prev,
            progress: Math.min(prev.progress + 15, 90),
          }))
        }, 500)

                          // Perform off-target analysis
         await crisprService.analyzeGuides({
           sequence: guide.sequence,
           guides: [guide],
           analysisType: 'off-target',
           context: `Genome build: ${genomeBuild}, Max sites: ${opts.maxSites}`,
         })

         clearInterval(progressInterval)

         // Generate mock off-target sites (in real implementation, this would come from the analysis)
         const sites = generateMockOffTargetSites(guide, opts.maxSites!)

        // Cache results
        cacheRef.current.set(cacheKey, sites)

        const summary = generateSummary(sites)

        setState(prev => ({
          ...prev,
          sites,
          isAnalyzing: false,
          progress: 100,
          summary,
        }))

        toast.success(`Found ${sites.length} potential off-target sites`)
        return sites

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Analysis failed'
        setState(prev => ({
          ...prev,
          isAnalyzing: false,
          error: errorMessage,
          progress: 0,
        }))
        toast.error(`Off-target analysis failed: ${errorMessage}`)
        throw error
      }
    },
    [crisprService, opts.maxSites]
  )

  /**
   * Generate analysis summary
   */
  const generateSummary = useCallback((sites: OffTargetSite[]): AnalysisSummary => {
    if (sites.length === 0) {
      return {
        totalSites: 0,
        highRiskSites: 0,
        averageBindingScore: 0,
        averageCuttingScore: 0,
        riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
        recommendedAction: 'proceed',
        warnings: ['No off-target sites detected'],
      }
    }

    const highRiskSites = sites.filter(s => s.riskLevel === 'high' || s.riskLevel === 'critical')
    const averageBindingScore = sites.reduce((sum, s) => sum + s.bindingScore, 0) / sites.length
    const averageCuttingScore = sites.reduce((sum, s) => sum + s.cuttingScore, 0) / sites.length

    const riskDistribution = sites.reduce((acc, site) => {
      acc[site.riskLevel] = (acc[site.riskLevel] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Determine recommended action
    let recommendedAction: AnalysisSummary['recommendedAction'] = 'proceed'
    const warnings: string[] = []

    if (riskDistribution.critical > 0) {
      recommendedAction = 'reject'
      warnings.push(`${riskDistribution.critical} critical risk sites found`)
    } else if (riskDistribution.high > 2) {
      recommendedAction = 'modify'
      warnings.push(`${riskDistribution.high} high-risk sites found`)
    } else if (riskDistribution.high > 0 || riskDistribution.medium > 5) {
      recommendedAction = 'caution'
      warnings.push('Moderate off-target risk detected')
    }

    if (averageBindingScore > 0.7) {
      warnings.push('High average binding score - consider guide modification')
    }

    if (sites.some(s => s.gene && s.geneFunction?.includes('essential'))) {
      warnings.push('Off-target sites found in essential genes')
    }

    return {
      totalSites: sites.length,
      highRiskSites: highRiskSites.length,
      averageBindingScore,
      averageCuttingScore,
      riskDistribution,
      recommendedAction,
      warnings,
    }
  }, [])

  /**
   * Filter sites by risk level
   */
  const filterSitesByRisk = useCallback((riskLevels: string[]): OffTargetSite[] => {
    return state.sites.filter(site => riskLevels.includes(site.riskLevel))
  }, [state.sites])

  /**
   * Get sites in specific genes
   */
  const getSitesInGenes = useCallback((geneNames: string[]): OffTargetSite[] => {
    return state.sites.filter(site => 
      site.gene && geneNames.some(name => 
        site.gene!.toLowerCase().includes(name.toLowerCase())
      )
    )
  }, [state.sites])

  /**
   * Clear analysis results
   */
  const clearResults = useCallback(() => {
    setState({
      sites: [],
      isAnalyzing: false,
      error: null,
      progress: 0,
      summary: null,
      selectedGuide: null,
    })
    cacheRef.current.clear()
    toast.info('Off-target analysis cleared')
  }, [])

  /**
   * Cancel ongoing analysis
   */
  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: 0,
      }))
      toast.info('Analysis cancelled')
    }
  }, [])

  /**
   * Re-analyze with updated parameters
   */
  const reanalyze = useCallback(async () => {
    if (!state.selectedGuide) {return}
    
    // Clear cache to force fresh analysis
    cacheRef.current.clear()
    await analyzeOffTargets(state.selectedGuide)
  }, [state.selectedGuide, analyzeOffTargets])

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
    if (!opts.enableRealTimeUpdates || state.sites.length === 0) {return}

    const interval = setInterval(() => {
      // Simulate minor score updates
      setState(prev => ({
        ...prev,
        sites: prev.sites.map(site => ({
          ...site,
          bindingScore: Math.max(0, Math.min(1, site.bindingScore + (Math.random() - 0.5) * 0.02)),
          cuttingScore: Math.max(0, Math.min(1, site.cuttingScore + (Math.random() - 0.5) * 0.02)),
        })),
      }))
    }, 15000) // Update every 15 seconds

    return () => clearInterval(interval)
  }, [opts.enableRealTimeUpdates, state.sites.length])

  return {
    // State
    ...state,
    
    // Actions
    analyzeOffTargets,
    clearResults,
    cancelAnalysis,
    reanalyze,
    
    // Computed values
    hasResults: state.sites.length > 0,
    isProcessing: state.isAnalyzing,
    highRiskSites: filterSitesByRisk(['high', 'critical']),
    
    // Utilities
    filterSitesByRisk,
    getSitesInGenes,
    generateSummary,
  }
}

/**
 * Generate mock off-target sites for demonstration
 */
function generateMockOffTargetSites(guide: GuideRNA, maxSites: number): OffTargetSite[] {
  const sites: OffTargetSite[] = []
  const chromosomes = ['chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6', 'chr7', 'chr8', 'chr9', 'chr10']
  const genes = ['TP53', 'BRCA1', 'EGFR', 'MYC', 'KRAS', 'PIK3CA', 'PTEN', 'RB1', 'APC', 'BRAF']

  const numSites = Math.min(maxSites, Math.floor(Math.random() * 20) + 5)

  for (let i = 0; i < numSites; i++) {
    const mismatches = Math.floor(Math.random() * 4) + 1
    const bindingScore = Math.max(0.1, 1 - (mismatches * 0.2) + (Math.random() - 0.5) * 0.3)
    const cuttingScore = Math.max(0, bindingScore * 0.8 + (Math.random() - 0.5) * 0.4)
    
    let riskLevel: OffTargetSite['riskLevel'] = 'low'
    if (cuttingScore > 0.8) {riskLevel = 'critical'}
    else if (cuttingScore > 0.6) {riskLevel = 'high'}
    else if (cuttingScore > 0.3) {riskLevel = 'medium'}

    sites.push({
      id: `site-${i + 1}`,
      sequence: generateRandomSequence(20),
      chromosome: chromosomes[Math.floor(Math.random() * chromosomes.length)],
      position: Math.floor(Math.random() * 100000000) + 1000000,
      strand: Math.random() > 0.5 ? '+' : '-',
      mismatches,
      mismatchPositions: generateMismatchPositions(mismatches),
      bindingScore,
      cuttingScore,
      gene: Math.random() > 0.3 ? genes[Math.floor(Math.random() * genes.length)] : undefined,
      geneFunction: Math.random() > 0.5 ? 'tumor suppressor' : 'oncogene',
      riskLevel,
    })
  }

  return sites.sort((a, b) => b.cuttingScore - a.cuttingScore)
}

function generateRandomSequence(length: number): string {
  const bases = ['A', 'T', 'C', 'G']
  return Array.from({ length }, () => bases[Math.floor(Math.random() * bases.length)]).join('')
}

function generateMismatchPositions(count: number): number[] {
  const positions = new Set<number>()
  while (positions.size < count) {
    positions.add(Math.floor(Math.random() * 20))
  }
  return Array.from(positions).sort((a, b) => a - b)
} 