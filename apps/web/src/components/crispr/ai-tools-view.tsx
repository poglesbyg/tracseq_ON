import { motion } from 'framer-motion'
import { Zap, Target, Settings } from 'lucide-react'

import type { GuideRNA } from '../../lib/crispr/guide-design'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'

import { AIGuideOptimizer } from './ai-guide-optimizer'

interface AIToolsViewProps {
  sequence: string
  guides: GuideRNA[]
  selectedGuideForOptimization?: GuideRNA
  onGuideSelectForOptimization: (guide: GuideRNA) => void
}

export function AIToolsView({
  sequence,
  guides,
  selectedGuideForOptimization,
  onGuideSelectForOptimization,
}: AIToolsViewProps) {
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
          className="text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent"
        >
          AI-Powered CRISPR Tools
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          Leverage advanced AI to optimize guide RNAs, analyze sequences, and
          get expert recommendations
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
            <Card className="bg-card border-border">
              <CardContent className="p-8">
                <div className="text-center text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    AI Guide Optimization
                  </h3>
                  <p>Select a guide RNA to optimize with AI</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Guide Selection Panel */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">
              Select Guide for AI Optimization
            </CardTitle>
            <CardDescription className="text-muted-foreground">
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
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p>No guides available</p>
                <p className="text-sm">Design guides first in the Design tab</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-foreground font-semibold">AI Optimization</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Enhance guide RNA efficiency and specificity using machine
              learning algorithms
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-foreground font-semibold">Smart Analysis</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Get intelligent insights about sequence quality and potential
              challenges
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-foreground font-semibold">Expert Assistant</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Ask questions and get expert guidance through our AI chat
              assistant
            </p>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
} 