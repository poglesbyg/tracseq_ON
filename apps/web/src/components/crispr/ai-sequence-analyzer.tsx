import { motion } from 'framer-motion'
import {
  Brain,
  Sparkles,
  TrendingUp,
  CheckCircle,
  Loader2,
  Lightbulb,
  Target,
  Zap,
} from 'lucide-react'
import { useState, useEffect } from 'react'

import { aiService, type AIAnalysisResult } from '../../lib/ai/ollama-service'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Progress } from '../ui/progress'

interface AISequenceAnalyzerProps {
  sequence: string
  context?: string
  onAnalysisComplete?: (analysis: AIAnalysisResult) => void
}

export function AISequenceAnalyzer({
  sequence,
  context,
  onAnalysisComplete,
}: AISequenceAnalyzerProps) {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isAIAvailable, setIsAIAvailable] = useState(false)

  useEffect(() => {
    setIsAIAvailable(aiService.isAIAvailable())
  }, [])

  const performAIAnalysis = async () => {
    if (!sequence || sequence.length < 20) {
      return
    }

    setIsAnalyzing(true)

    try {
      const result = await aiService.analyzeSequence(sequence, context)
      setAnalysis(result)
      onAnalysisComplete?.(result)
    } catch (error) {
      console.error('AI analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) {
      return 'text-green-400'
    }
    if (confidence >= 0.6) {
      return 'text-yellow-400'
    }
    return 'text-red-400'
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) {
      return 'High Confidence'
    }
    if (confidence >= 0.6) {
      return 'Medium Confidence'
    }
    return 'Low Confidence'
  }

  if (!sequence || sequence.length < 20) {
    return (
      <Card className="bg-white/5 border-white/20 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="text-center text-slate-400">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Enter a sequence (≥20 bp) to enable AI analysis</p>
          </div>
        </CardContent>
      </Card>
    )
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
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">
                  AI Sequence Analysis
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {isAIAvailable
                    ? 'Powered by Ollama LLM'
                    : 'Algorithmic Analysis (AI Offline)'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge
                variant="outline"
                className={`${isAIAvailable ? 'border-green-500/50 text-green-400' : 'border-yellow-500/50 text-yellow-400'}`}
              >
                {isAIAvailable ? (
                  <>
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Active
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3 mr-1" />
                    Fallback Mode
                  </>
                )}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!analysis && !isAnalyzing && (
            <div className="text-center">
              <Button
                onClick={performAIAnalysis}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg transition-all duration-200"
              >
                <Brain className="h-4 w-4 mr-2" />
                Analyze with AI
              </Button>
            </div>
          )}

          {isAnalyzing && (
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
                <Loader2 className="h-8 w-8 text-purple-400" />
              </motion.div>
              <p className="text-white mb-2">
                AI is analyzing your sequence...
              </p>
              <p className="text-slate-400 text-sm">
                {isAIAvailable
                  ? 'Consulting Ollama LLM for expert insights'
                  : 'Running algorithmic analysis'}
              </p>
              <div className="mt-4 max-w-xs mx-auto">
                <div className="bg-slate-800 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3, ease: 'easeInOut' }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {analysis && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Confidence Score */}
              <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                <div className="flex items-center space-x-2">
                  <TrendingUp
                    className={`h-4 w-4 ${getConfidenceColor(analysis.confidence)}`}
                  />
                  <span className="text-white text-sm font-medium">
                    {getConfidenceLabel(analysis.confidence)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Progress
                    value={analysis.confidence * 100}
                    className="w-16 h-2"
                  />
                  <span
                    className={`text-sm ${getConfidenceColor(analysis.confidence)}`}
                  >
                    {(analysis.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Main Analysis */}
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-white font-medium mb-1">
                      Analysis Summary
                    </h4>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {analysis.analysis}
                    </p>
                  </div>
                </div>

                {/* Reasoning */}
                {analysis.reasoning && (
                  <div className="flex items-start space-x-2">
                    <Lightbulb className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-medium mb-1">
                        AI Reasoning
                      </h4>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {analysis.reasoning}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Suggestions */}
              {analysis.suggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Target className="h-4 w-4 text-purple-400" />
                    <h4 className="text-white font-medium">
                      AI Recommendations
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {analysis.suggestions.map((suggestion, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start space-x-2 p-2 bg-white/5 rounded-md"
                      >
                        <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                        <p className="text-slate-300 text-sm">{suggestion}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reanalyze Button */}
              <div className="pt-2">
                <Button
                  onClick={performAIAnalysis}
                  variant="outline"
                  size="sm"
                  className="border-white/30 bg-white/5 text-white hover:bg-white/20 hover:border-white/40 transition-all duration-200"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Reanalyze
                </Button>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
