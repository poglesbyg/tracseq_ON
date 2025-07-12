import { useState } from 'react'

import type { GuideRNA } from '../../lib/crispr/guide-design'

import { AIChatAssistant } from './ai-chat-assistant'
import { AIToolsView } from './ai-tools-view'
import { AnalysisView } from './analysis-view'
import { BatchProcessingView } from './batch-processing-view'
import { DesignView } from './design-view'
import ExperimentsDashboard from './experiments-dashboard'
import { ResultsView } from './results-view'
import { StudioHeader } from './studio-header'
import { StudioNavigation, type StudioTab } from './studio-navigation'

export function CrisprStudio() {
  const [activeTab, setActiveTab] = useState<StudioTab>('dashboard')
  const [currentSequence, setCurrentSequence] = useState('')
  const [allGuides, setAllGuides] = useState<GuideRNA[]>([])
  const [selectedGuideFor3D, setSelectedGuideFor3D] = useState<
    GuideRNA | undefined
  >()
  const [selectedGuideForOffTarget, setSelectedGuideForOffTarget] = useState<
    GuideRNA | undefined
  >()
  const [selectedGuideForOptimization, setSelectedGuideForOptimization] =
    useState<GuideRNA | undefined>()

  const handleSettingsClick = () => {
    console.log('Settings clicked')
    // TODO: Implement settings modal
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <ExperimentsDashboard />
      case 'design':
        return (
          <DesignView
            onSequenceDesigned={setCurrentSequence}
            onGuidesGenerated={setAllGuides}
          />
        )
      case 'batch':
        return <BatchProcessingView />
      case 'analysis':
        return (
          <AnalysisView
            sequence={currentSequence}
            guides={allGuides}
            selectedGuideFor3D={selectedGuideFor3D}
            onGuideSelectFor3D={setSelectedGuideFor3D}
            selectedGuideForOffTarget={selectedGuideForOffTarget}
            onGuideSelectForOffTarget={setSelectedGuideForOffTarget}
          />
        )
      case 'ai':
        return (
          <AIToolsView
            sequence={currentSequence}
            guides={allGuides}
            selectedGuideForOptimization={selectedGuideForOptimization}
            onGuideSelectForOptimization={setSelectedGuideForOptimization}
          />
        )
      case 'results':
        return <ResultsView />
      default:
        return <ExperimentsDashboard />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <StudioHeader onSettingsClick={handleSettingsClick} />

      <StudioNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="container mx-auto px-6 py-8">{renderActiveTab()}</main>

      {/* AI Chat Assistant - Always Available */}
      <AIChatAssistant
        context={{
          currentTab: activeTab,
          sequence: currentSequence,
          guides: allGuides,
          selectedGuides: {
            for3D: selectedGuideFor3D,
            forOffTarget: selectedGuideForOffTarget,
            forOptimization: selectedGuideForOptimization,
          },
        }}
      />
    </div>
  )
}
