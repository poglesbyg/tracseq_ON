import { motion } from 'framer-motion'
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Lightbulb,
  Zap,
  ArrowRight,
  RotateCcw,
} from 'lucide-react'
import { useState } from 'react'

import {
  aiService,
  type GuideOptimizationResult,
} from '../../lib/ai/ollama-service'
import type { GuideRNA } from '../../lib/crispr/guide-design'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'

interface AIGuideOptimizerProps {
  guide: GuideRNA
  targetSequence: string
  onOptimizationComplete?: (result: GuideOptimizationResult) => void
}

export function AIGuideOptimizer({
  guide,
  targetSequence,
  onOptimizationComplete,
}: AIGuideOptimizerProps) {
  const [optimization, setOptimization] =
    useState<GuideOptimizationResult | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)

  const performOptimization = async () => {
    setIsOptimizing(true)

    try {
      const result = await aiService.optimizeGuideRNA(
        guide.sequence,
        targetSequence,
        guide.pamSequence,
      )
      setOptimization(result)
      onOptimizationComplete?.(result)
    } catch (error) {
      console.error('AI optimization failed:', error)
    } finally {
      setIsOptimizing(false)
    }
  }

  const getRiskColor = (riskLevel: string) => {
    if (riskLevel.toLowerCase().includes('low')) {
      return 'text-green-400'
    }
    if (riskLevel.toLowerCase().includes('moderate')) {
      return 'text-yellow-400'
    }
    return 'text-red-400'
  }

  const getRiskIcon = (riskLevel: string) => {
    if (riskLevel.toLowerCase().includes('low')) {
      return CheckCircle
    }
    if (riskLevel.toLowerCase().includes('moderate')) {
      return AlertTriangle
    }
    return AlertTriangle
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="bg-white/5 border-white/20 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">
                  AI Guide Optimization
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Enhance guide RNA efficiency and specificity
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-blue-500/50 text-blue-400"
            >
              <Zap className="h-3 w-3 mr-1" />
              Smart Optimization
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Current Guide Info */}
          <div className="p-4 bg-white/10 rounded-lg">
            <h4 className="text-white font-medium mb-2">Current Guide RNA</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Sequence:</span>
                <code className="text-white font-mono text-sm bg-black/30 px-2 py-1 rounded">
                  {guide.sequence}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">PAM:</span>
                <code className="text-purple-400 font-mono text-sm">
                  {guide.pamSequence}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Efficiency:</span>
                <span className="text-white">
                  {(guide.efficiencyScore * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Specificity:</span>
                <span className="text-white">
                  {(guide.specificityScore * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {!optimization && !isOptimizing && (
            <div className="text-center">
              <Button
                onClick={performOptimization}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg transition-all duration-200"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Optimize with AI
              </Button>
            </div>
          )}

          {isOptimizing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-6"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="inline-block mb-4"
              >
                <Loader2 className="h-8 w-8 text-blue-400" />
              </motion.div>
              <p className="text-white mb-2">
                AI is optimizing your guide RNA...
              </p>
              <p className="text-slate-400 text-sm">
                Analyzing sequence features and suggesting improvements
              </p>
              <div className="mt-4 max-w-xs mx-auto">
                <div className="bg-slate-800 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2.5, ease: 'easeInOut' }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {optimization && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Optimized Sequence */}
              {optimization.optimizedSequence && (
                <div className="p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <h4 className="text-white font-medium">
                      Optimized Sequence
                    </h4>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400 text-sm">Original:</span>
                      <code className="text-slate-300 font-mono text-sm bg-black/30 px-2 py-1 rounded">
                        {guide.sequence}
                      </code>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ArrowRight className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400 text-sm">Optimized:</span>
                      <code className="text-green-400 font-mono text-sm bg-black/30 px-2 py-1 rounded">
                        {optimization.optimizedSequence}
                      </code>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Assessment */}
              <div className="p-4 bg-white/10 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  {(() => {
                    const RiskIcon = getRiskIcon(optimization.riskAssessment)
                    return (
                      <RiskIcon
                        className={`h-5 w-5 ${getRiskColor(optimization.riskAssessment)}`}
                      />
                    )
                  })()}
                  <h4 className="text-white font-medium">Risk Assessment</h4>
                </div>
                <p
                  className={`text-sm ${getRiskColor(optimization.riskAssessment)}`}
                >
                  {optimization.riskAssessment}
                </p>
              </div>

              {/* Improvements */}
              {optimization.improvements.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Lightbulb className="h-4 w-4 text-yellow-400" />
                    <h4 className="text-white font-medium">
                      AI Recommendations
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {optimization.improvements.map((improvement, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start space-x-2 p-3 bg-white/5 rounded-md"
                      >
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                        <p className="text-slate-300 text-sm">{improvement}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence Score */}
              <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                  <span className="text-white text-sm font-medium">
                    Confidence Score
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-slate-700 rounded-full h-2">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${optimization.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-blue-400 text-sm">
                    {(optimization.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Re-optimize Button */}
              <div className="pt-2">
                <Button
                  onClick={performOptimization}
                  variant="outline"
                  size="sm"
                  className="border-white/30 bg-white/5 text-white hover:bg-white/20 hover:border-white/40 transition-all duration-200"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Re-optimize
                </Button>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
