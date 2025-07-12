import { motion } from 'framer-motion'
import { useState } from 'react'

import type { GuideRNA } from '../../lib/crispr/guide-design'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'

import { MolecularViewer3D } from './molecular-viewer-3d'
import { OffTargetAnalysis } from './off-target-analysis'

interface AnalysisViewProps {
  sequence: string
  guides: GuideRNA[]
  selectedGuideFor3D?: GuideRNA
  onGuideSelectFor3D: (guide: GuideRNA) => void
  selectedGuideForOffTarget?: GuideRNA
  onGuideSelectForOffTarget: (guide: GuideRNA) => void
}

export function AnalysisView({
  sequence,
  guides,
  selectedGuideFor3D,
  onGuideSelectFor3D,
  selectedGuideForOffTarget,
  onGuideSelectForOffTarget,
}: AnalysisViewProps) {
  const [analysisTab, setAnalysisTab] = useState<'3d' | 'offtarget'>('3d')

  if (!sequence || guides.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <h2 className="text-2xl font-bold text-foreground">
          Advanced Analysis & AI Predictions
        </h2>
        <Card className="bg-card border-border">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="text-4xl mb-4">🧬</div>
              <p className="text-muted-foreground text-lg mb-2">
                No sequence data available
              </p>
              <p className="text-muted-foreground text-sm">
                Design guide RNAs first to view 3D molecular analysis
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-foreground">
        Advanced Analysis & AI Predictions
      </h2>

      {/* Analysis Type Tabs */}
      <div className="flex space-x-1 bg-muted rounded-lg p-1">
        <button
          onClick={() => setAnalysisTab('3d')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            analysisTab === '3d'
              ? 'bg-primary text-primary-foreground shadow-lg'
              : 'text-muted-foreground hover:text-foreground hover:bg-background'
          }`}
        >
          3D Visualization
        </button>
        <button
          onClick={() => setAnalysisTab('offtarget')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            analysisTab === 'offtarget'
              ? 'bg-primary text-primary-foreground shadow-lg'
              : 'text-muted-foreground hover:text-foreground hover:bg-background'
          }`}
        >
          Off-Target Analysis
        </button>
      </div>

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
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">
                3D Guide Selection
              </CardTitle>
              <CardDescription className="text-muted-foreground">
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
                        ? 'bg-primary/20 border border-primary'
                        : 'bg-muted hover:bg-muted/80 border border-border'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-foreground text-sm font-mono">
                          {guide.sequence}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Position: {guide.position} | Efficiency:{' '}
                          {(guide.efficiencyScore * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {guide.strand}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Molecular Analysis Stats */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">
                Molecular Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sequence Length</span>
                  <span className="text-foreground">{sequence.length} bp</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Total Guides Found
                  </span>
                  <span className="text-foreground">{guides.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PAM Sites</span>
                  <span className="text-foreground">{guides.length}</span>
                </div>
                {selectedGuideFor3D && (
                  <>
                    <div className="border-t border-border pt-2 mt-4">
                      <div className="text-foreground font-semibold mb-2">
                        Selected Guide
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Efficiency Score
                        </span>
                        <span className="text-foreground">
                          {(selectedGuideFor3D.efficiencyScore * 100).toFixed(
                            1,
                          )}
                          %
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Specificity Score
                        </span>
                        <span className="text-foreground">
                          {(selectedGuideFor3D.specificityScore * 100).toFixed(
                            1,
                          )}
                          %
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          GC Content
                        </span>
                        <span className="text-foreground">
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
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">
                Off-Target Guide Selection
              </CardTitle>
              <CardDescription className="text-muted-foreground">
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
                        ? 'bg-destructive/20 border border-destructive'
                        : 'bg-muted hover:bg-muted/80 border border-border'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-foreground text-sm font-mono">
                          {guide.sequence}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Pos: {guide.position} | Eff:{' '}
                          {(guide.efficiencyScore * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-muted-foreground text-xs">
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
    </motion.div>
  )
}
