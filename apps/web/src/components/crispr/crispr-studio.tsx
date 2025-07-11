import { motion } from 'framer-motion'
import {
  Dna,
  Zap,
  Target,
  BarChart3,
  Microscope,
  Settings,
  Layers,
} from 'lucide-react'
import { useState } from 'react'

import {
  designGuideRNAs,
  type GuideRNA,
  type DesignParameters,
} from '../../lib/crispr/guide-design'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'

import { AIChatAssistant } from './ai-chat-assistant'
import { AIGuideOptimizer } from './ai-guide-optimizer'
import { BatchAnalysis } from './batch-analysis'
import ExperimentsDashboard from './experiments-dashboard'
import { GuideResultsTable } from './guide-results-table'
import { MolecularViewer3D } from './molecular-viewer-3d'
import { OffTargetAnalysis } from './off-target-analysis'
import { SequenceInput } from './sequence-input'

export function CrisprStudio() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [currentSequence, setCurrentSequence] = useState('')
  const [allGuides, setAllGuides] = useState<GuideRNA[]>([])
  const [selectedGuideFor3D, setSelectedGuideFor3D] = useState<
    GuideRNA | undefined
  >()
  const [selectedGuideForOffTarget, setSelectedGuideForOffTarget] = useState<
    GuideRNA | undefined
  >()
  const [selectedGuideForOptimization, setSelectedGuideForOptimization] = useState<
    GuideRNA | undefined
  >()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-white/10 backdrop-blur-sm bg-black/20"
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <Dna className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  CRISPR Design Studio
                </h1>
                <p className="text-sm text-slate-400">
                  AI-Powered Gene Editing Platform
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="border-white/30 bg-white/5 text-white hover:bg-white/20 hover:border-white/40 transition-all duration-200"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Navigation Tabs */}
      <motion.nav
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="border-b border-white/10 bg-black/10 backdrop-blur-sm"
      >
        <div className="container mx-auto px-6">
          <div className="flex space-x-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'design', label: 'Guide Design', icon: Target },
              { id: 'batch', label: 'Batch Processing', icon: Layers },
              { id: 'analysis', label: 'Analysis', icon: Microscope },
              { id: 'ai', label: 'AI Tools', icon: Zap },
              { id: 'results', label: 'Results', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium rounded-t-lg transition-all duration-200 flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'bg-white/15 text-purple-300 border-b-2 border-purple-400 shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-white/10 hover:text-purple-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </motion.nav>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {activeTab === 'dashboard' && <ExperimentsDashboard />}
        {activeTab === 'design' && (
          <DesignView
            onSequenceDesigned={setCurrentSequence}
            onGuidesGenerated={setAllGuides}
          />
        )}
        {activeTab === 'batch' && <BatchProcessingView />}
        {activeTab === 'analysis' && (
          <AnalysisView
            sequence={currentSequence}
            guides={allGuides}
            selectedGuideFor3D={selectedGuideFor3D}
            onGuideSelectFor3D={setSelectedGuideFor3D}
            selectedGuideForOffTarget={selectedGuideForOffTarget}
            onGuideSelectForOffTarget={setSelectedGuideForOffTarget}
          />
        )}
        {activeTab === 'ai' && (
          <AIToolsView
            sequence={currentSequence}
            guides={allGuides}
            selectedGuideForOptimization={selectedGuideForOptimization}
            onGuideSelectForOptimization={setSelectedGuideForOptimization}
          />
        )}
        {activeTab === 'results' && <ResultsView />}
      </main>

      {/* AI Chat Assistant - Always Available */}
      <AIChatAssistant 
        context={{
          currentTab: activeTab,
          sequence: currentSequence,
          guides: allGuides,
          selectedGuides: {
            for3D: selectedGuideFor3D,
            forOffTarget: selectedGuideForOffTarget,
            forOptimization: selectedGuideForOptimization
          }
        }}
      />
    </div>
  )
}

function DesignView({
  onSequenceDesigned,
  onGuidesGenerated,
}: {
  onSequenceDesigned: (sequence: string) => void
  onGuidesGenerated: (guides: GuideRNA[]) => void
}) {
  const [currentStep, setCurrentStep] = useState<'input' | 'results'>('input')
  const [designResults, setDesignResults] = useState<GuideRNA[]>([])
  const [isDesigning, setIsDesigning] = useState(false)

  const handleSequenceSubmit = async (
    sequence: string,
    _name: string,
    _type: 'genomic' | 'cdna' | 'custom',
  ) => {
    setIsDesigning(true)
    onSequenceDesigned(sequence) // Save sequence to parent state

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    try {
      const designParams: DesignParameters = {
        targetSequence: sequence,
        pamType: 'NGG',
        minEfficiencyScore: 0.3,
        maxOffTargets: 100,
        allowNonCanonicalPAMs: false,
      }

      const guides = designGuideRNAs(designParams)
      setDesignResults(guides)
      onGuidesGenerated(guides) // Save guides to parent state
      setCurrentStep('results')
    } catch (error) {
      console.error('Design failed:', error)
    } finally {
      setIsDesigning(false)
    }
  }

  const handleExportResults = () => {
    const csvContent = [
      'Position,Strand,Guide Sequence,PAM,Efficiency Score,Specificity Score,GC Content',
      ...designResults.map(
        (guide) =>
          `${guide.position},${guide.strand},${guide.sequence},${guide.pamSequence},${guide.efficiencyScore.toFixed(3)},${guide.specificityScore.toFixed(3)},${guide.gcContent.toFixed(1)}`,
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'crispr_guide_results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleStartOver = () => {
    setCurrentStep('input')
    setDesignResults([])
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Guide RNA Design</h2>
        {currentStep === 'results' && (
          <Button
            variant="outline"
            onClick={handleStartOver}
            className="border-white/30 bg-white/5 text-white hover:bg-white/20 hover:border-white/40 transition-all duration-200"
          >
            Start New Design
          </Button>
        )}
      </div>

      {currentStep === 'input' && (
        <SequenceInput
          onSequenceSubmit={handleSequenceSubmit}
          isLoading={isDesigning}
        />
      )}

      {currentStep === 'results' && (
        <GuideResultsTable
          guides={designResults}
          onExportResults={handleExportResults}
          onGuideSelect={(guide: GuideRNA) =>
            console.log('Selected guide:', guide)
          }
        />
      )}
    </motion.div>
  )
}

function AnalysisView({
  sequence,
  guides,
  selectedGuideFor3D,
  onGuideSelectFor3D,
  selectedGuideForOffTarget,
  onGuideSelectForOffTarget,
}: {
  sequence: string
  guides: GuideRNA[]
  selectedGuideFor3D?: GuideRNA
  onGuideSelectFor3D: (guide: GuideRNA) => void
  selectedGuideForOffTarget?: GuideRNA
  onGuideSelectForOffTarget: (guide: GuideRNA) => void
}) {
  const [analysisTab, setAnalysisTab] = useState<'3d' | 'offtarget'>('3d')
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-white">
        Advanced Analysis & AI Predictions
      </h2>

      {/* Analysis Type Tabs */}
      <div className="flex space-x-1 bg-white/10 rounded-lg p-1">
        <button
          onClick={() => setAnalysisTab('3d')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            analysisTab === '3d'
              ? 'bg-purple-500 text-white shadow-lg hover:bg-purple-600'
              : 'text-slate-400 hover:text-white hover:bg-white/10'
          }`}
        >
          3D Visualization
        </button>
        <button
          onClick={() => setAnalysisTab('offtarget')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            analysisTab === 'offtarget'
              ? 'bg-purple-500 text-white shadow-lg hover:bg-purple-600'
              : 'text-slate-400 hover:text-white hover:bg-white/10'
          }`}
        >
          Off-Target Analysis
        </button>
      </div>

      {sequence && guides.length > 0 ? (
        <div>
          {analysisTab === '3d' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* 3D Molecular Viewer */}
              <div className="xl:col-span-2">
                <MolecularViewer3D
                  sequence={sequence}
                  guides={guides}
                  selectedGuide={selectedGuideFor3D}
                  onGuideSelect={onGuideSelectFor3D}
                />
              </div>

              {/* Guide Selection Panel for 3D */}
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">
                    3D Guide Selection
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Click on a guide to visualize it in 3D
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {guides.slice(0, 10).map((guide) => (
                      <div
                        key={guide.id}
                        onClick={() => onGuideSelectFor3D(guide)}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          selectedGuideFor3D?.id === guide.id
                            ? 'bg-purple-500/20 border border-purple-400'
                            : 'bg-white/5 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-white text-sm font-mono">
                              {guide.sequence}
                            </div>
                            <div className="text-slate-400 text-xs">
                              Position: {guide.position} | Efficiency:{' '}
                              {(guide.efficiencyScore * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="text-slate-300 text-xs">
                            {guide.strand}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Molecular Analysis Stats */}
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">
                    Molecular Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Sequence Length</span>
                      <span className="text-white">{sequence.length} bp</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Guides Found</span>
                      <span className="text-white">{guides.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">PAM Sites</span>
                      <span className="text-white">{guides.length}</span>
                    </div>
                    {selectedGuideFor3D && (
                      <>
                        <div className="border-t border-white/10 pt-2 mt-4">
                          <div className="text-white font-semibold mb-2">
                            Selected Guide
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">
                              Efficiency Score
                            </span>
                            <span className="text-white">
                              {(
                                selectedGuideFor3D.efficiencyScore * 100
                              ).toFixed(1)}
                              %
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">
                              Specificity Score
                            </span>
                            <span className="text-white">
                              {(
                                selectedGuideFor3D.specificityScore * 100
                              ).toFixed(1)}
                              %
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">GC Content</span>
                            <span className="text-white">
                              {selectedGuideFor3D.gcContent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {analysisTab === 'offtarget' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Off-Target Analysis */}
              <div className="xl:col-span-2">
                <OffTargetAnalysis selectedGuide={selectedGuideForOffTarget} />
              </div>

              {/* Guide Selection Panel for Off-Target */}
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">
                    Off-Target Guide Selection
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Click on a guide to analyze off-targets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {guides.map((guide) => (
                      <div
                        key={guide.id}
                        onClick={() => onGuideSelectForOffTarget(guide)}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          selectedGuideForOffTarget?.id === guide.id
                            ? 'bg-red-500/20 border border-red-400'
                            : 'bg-white/5 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-white text-sm font-mono">
                              {guide.sequence}
                            </div>
                            <div className="text-slate-400 text-xs">
                              Pos: {guide.position} | Eff:{' '}
                              {(guide.efficiencyScore * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="text-slate-300 text-xs">
                            {guide.strand}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="text-4xl mb-4">🧬</div>
              <p className="text-slate-400 text-lg mb-2">
                No sequence data available
              </p>
              <p className="text-slate-500 text-sm">
                Design guide RNAs first to view 3D molecular analysis
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}

function BatchProcessingView() {
  const defaultDesignParameters: DesignParameters = {
    targetSequence: '',
    pamType: 'NGG',
    minEfficiencyScore: 0.3,
    maxOffTargets: 100,
    allowNonCanonicalPAMs: false,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center space-y-4 mb-8">
        <motion.h2
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent"
        >
          Batch Processing & Advanced Analytics
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-slate-300 max-w-2xl mx-auto"
        >
          Process multiple sequences simultaneously with comprehensive analysis
          and professional reporting
        </motion.p>
      </div>

      <BatchAnalysis designParameters={defaultDesignParameters} />
    </motion.div>
  )
}

function AIToolsView({
  sequence,
  guides,
  selectedGuideForOptimization,
  onGuideSelectForOptimization,
}: {
  sequence: string
  guides: GuideRNA[]
  selectedGuideForOptimization?: GuideRNA
  onGuideSelectForOptimization: (guide: GuideRNA) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center space-y-4 mb-8">
        <motion.h2
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent"
        >
          AI-Powered CRISPR Tools
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-slate-300 max-w-2xl mx-auto"
        >
          Leverage advanced AI to optimize guide RNAs, analyze sequences, and get expert recommendations
        </motion.p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Guide Optimization */}
        <div className="xl:col-span-2">
          {selectedGuideForOptimization ? (
            <AIGuideOptimizer
              guide={selectedGuideForOptimization}
              targetSequence={sequence}
            />
          ) : (
            <Card className="bg-white/5 border-white/20 backdrop-blur-sm">
              <CardContent className="p-8">
                <div className="text-center text-slate-400">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    AI Guide Optimization
                  </h3>
                  <p>Select a guide RNA to optimize with AI</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Guide Selection Panel */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">
              Select Guide for AI Optimization
            </CardTitle>
            <CardDescription className="text-slate-400">
              Choose a guide RNA to enhance with AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            {guides.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {guides.map((guide) => (
                  <div
                    key={guide.id}
                    onClick={() => onGuideSelectForOptimization(guide)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedGuideForOptimization?.id === guide.id
                        ? 'bg-blue-500/20 border border-blue-400'
                        : 'bg-white/5 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-white text-sm font-mono">
                          {guide.sequence}
                        </div>
                        <div className="text-slate-400 text-xs">
                          Pos: {guide.position} | Eff:{' '}
                          {(guide.efficiencyScore * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-slate-300 text-xs">
                        {guide.strand}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8">
                <p>No guides available</p>
                <p className="text-sm">Design guides first in the Design tab</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Zap className="h-5 w-5 text-purple-400" />
              </div>
              <h3 className="text-white font-semibold">AI Optimization</h3>
            </div>
            <p className="text-slate-300 text-sm">
              Enhance guide RNA efficiency and specificity using machine learning algorithms
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Target className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold">Smart Analysis</h3>
            </div>
            <p className="text-slate-300 text-sm">
              Get intelligent insights about sequence quality and potential challenges
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Settings className="h-5 w-5 text-green-400" />
              </div>
              <h3 className="text-white font-semibold">Expert Assistant</h3>
            </div>
            <p className="text-slate-300 text-sm">
              Ask questions and get expert guidance through our AI chat assistant
            </p>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}

function ResultsView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-white">Results & Export</h2>
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardContent className="p-8">
          <p className="text-slate-400 text-center">
            Results display coming soon...
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
