import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Shield,
  Target,
  TrendingUp,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Dna,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

import type { GuideRNA } from '../../lib/crispr/guide-design'
import type {
  OffTargetAnalysis,
  OffTargetSite,
} from '../../lib/crispr/off-target-prediction'
import { analyzeOffTargets } from '../../lib/crispr/off-target-prediction'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Progress } from '../ui/progress'

interface OffTargetAnalysisProps {
  selectedGuide?: GuideRNA
  onAnalysisComplete?: (analysis: OffTargetAnalysis) => void
}

interface RiskBadgeProps {
  level: 'low' | 'medium' | 'high'
  count: number
}

function RiskBadge({ level, count }: RiskBadgeProps) {
  const colors = {
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  const icons = {
    low: CheckCircle,
    medium: AlertCircle,
    high: XCircle,
  }

  const Icon = icons[level]

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${colors[level]}`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium capitalize">{level} Risk</span>
      <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  )
}

function RecommendationBadge({
  recommendation,
}: {
  recommendation: 'excellent' | 'good' | 'caution' | 'avoid'
}) {
  const configs = {
    excellent: {
      color: 'bg-green-500/20 text-green-400 border-green-500/30',
      icon: CheckCircle,
    },
    good: {
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      icon: CheckCircle,
    },
    caution: {
      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      icon: AlertTriangle,
    },
    avoid: {
      color: 'bg-red-500/20 text-red-400 border-red-500/30',
      icon: XCircle,
    },
  }

  const config = configs[recommendation]
  const Icon = config.icon

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${config.color}`}
    >
      <Icon className="h-5 w-5" />
      <span className="font-semibold capitalize">{recommendation}</span>
    </div>
  )
}

function OffTargetSiteRow({ site }: { site: OffTargetSite }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-white/10 rounded-lg p-4 bg-white/5 hover:bg-white/10 transition-colors"
    >
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="font-mono text-sm text-white bg-slate-800 px-2 py-1 rounded">
            {site.sequence}
          </div>
          <RiskBadge level={site.riskLevel} count={site.mismatches} />
          <div className="text-sm text-slate-400">
            {site.chromosome}:{site.position} ({site.strand})
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-white">
              CFD: {site.cffdScore.toFixed(3)}
            </div>
            <div className="text-xs text-slate-400">
              MIT: {site.mitScore.toFixed(3)}
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Info className="h-4 w-4 text-slate-400" />
          </motion.div>
        </div>
      </div>

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-white/10"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">
                Mismatch Details
              </h4>
              <div className="text-xs text-slate-400">
                Positions:{' '}
                {site.mismatchPositions.join(', ') || 'Perfect match'}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Total mismatches: {site.mismatches}
              </div>
            </div>

            {site.geneContext && (
              <div>
                <h4 className="text-sm font-semibold text-white mb-2">
                  Gene Context
                </h4>
                <div className="text-xs text-slate-400">
                  Gene: {site.geneContext.geneName}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Type: {site.geneContext.geneType}
                  {site.geneContext.exonNumber &&
                    ` (Exon ${site.geneContext.exonNumber})`}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

export function OffTargetAnalysis({
  selectedGuide,
  onAnalysisComplete,
}: OffTargetAnalysisProps) {
  const [analysis, setAnalysis] = useState<OffTargetAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const performAnalysis = useCallback(
    async (guide: GuideRNA) => {
      setIsAnalyzing(true)
      setError(null)

      try {
        const result = await analyzeOffTargets(guide)
        setAnalysis(result)
        onAnalysisComplete?.(result)
      } catch (err) {
        setError('Failed to analyze off-targets. Please try again.')
        console.error('Off-target analysis error:', err)
      } finally {
        setIsAnalyzing(false)
      }
    },
    [onAnalysisComplete],
  )

  useEffect(() => {
    if (selectedGuide) {
      void performAnalysis(selectedGuide)
    } else {
      setAnalysis(null)
    }
  }, [selectedGuide, performAnalysis])

  const exportResults = () => {
    if (!analysis || !selectedGuide) {
      return
    }

    const csvContent = [
      'Chromosome,Position,Strand,Sequence,Mismatches,CFD Score,MIT Score,Risk Level,Gene Name,Gene Type',
      ...analysis.sites.map(
        (site) =>
          `${site.chromosome},${site.position},${site.strand},${site.sequence},${site.mismatches},${site.cffdScore.toFixed(3)},${site.mitScore.toFixed(3)},${site.riskLevel},${site.geneContext?.geneName || ''},${site.geneContext?.geneType || ''}`,
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `off_target_analysis_${selectedGuide.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!selectedGuide) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="text-center">
            <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              No Guide Selected
            </h3>
            <p className="text-slate-400">
              Select a guide RNA to perform off-target analysis
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isAnalyzing) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="inline-block"
            >
              <Loader2 className="h-12 w-12 text-purple-400 mb-4" />
            </motion.div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Analyzing Off-Targets
            </h3>
            <p className="text-slate-400 mb-4">
              Running AI-powered genomic analysis for guide:
              <span className="font-mono text-purple-400 ml-2">
                {selectedGuide.sequence}
              </span>
            </p>
            <div className="max-w-md mx-auto">
              <div className="text-xs text-slate-500 mb-2">
                Scanning genome for potential sites...
              </div>
              <div className="bg-slate-800 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5, ease: 'easeInOut' }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Analysis Failed
            </h3>
            <p className="text-slate-400 mb-4">{error}</p>
            <Button
              onClick={() => performAnalysis(selectedGuide)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!analysis) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Analysis Overview */}
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <div className="p-1 bg-gradient-to-r from-red-500 to-orange-500 rounded">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                Off-Target Analysis
              </CardTitle>
              <CardDescription className="text-slate-400">
                AI-powered genomic specificity analysis for guide:
                <span className="font-mono text-purple-400 ml-1">
                  {selectedGuide.sequence}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <RecommendationBadge recommendation={analysis.recommendation} />
              <Button
                variant="outline"
                size="sm"
                onClick={exportResults}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Overall Specificity */}
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium text-white">
                  Specificity
                </span>
              </div>
              <div className="text-2xl font-bold text-green-400">
                {(analysis.specificity * 100).toFixed(1)}%
              </div>
              <Progress
                value={analysis.specificity * 100}
                className="mt-2 h-2"
              />
            </div>

            {/* Total Sites */}
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Dna className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-white">
                  Total Sites
                </span>
              </div>
              <div className="text-2xl font-bold text-blue-400">
                {analysis.totalSites}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Potential targets found
              </div>
            </div>

            {/* High Risk Sites */}
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium text-white">
                  High Risk
                </span>
              </div>
              <div className="text-2xl font-bold text-red-400">
                {analysis.highRiskSites}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Critical off-targets
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-white">
                  Risk Levels
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-red-400">
                    High: {analysis.highRiskSites}
                  </span>
                  <span className="text-yellow-400">
                    Med: {analysis.mediumRiskSites}
                  </span>
                  <span className="text-green-400">
                    Low: {analysis.lowRiskSites}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Level Badges */}
          <div className="flex flex-wrap gap-3 mt-6">
            <RiskBadge level="high" count={analysis.highRiskSites} />
            <RiskBadge level="medium" count={analysis.mediumRiskSites} />
            <RiskBadge level="low" count={analysis.lowRiskSites} />
          </div>
        </CardContent>
      </Card>

      {/* Off-Target Sites Table */}
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">
            Potential Off-Target Sites
          </CardTitle>
          <CardDescription className="text-slate-400">
            Top {Math.min(analysis.sites.length, 20)} potential off-target sites
            ranked by cutting probability
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analysis.sites.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {analysis.sites.map((site) => (
                <OffTargetSiteRow key={site.id} site={site} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <p className="text-green-400 font-semibold">
                Perfect Specificity!
              </p>
              <p className="text-slate-400 text-sm">
                No potential off-target sites found
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
