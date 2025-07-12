import { motion } from 'framer-motion'
import { useState } from 'react'

import {
  designGuideRNAs,
  type GuideRNA,
  type DesignParameters,
} from '../../lib/crispr/guide-design'
import { Button } from '../ui/button'

import { GuideResultsTable } from './guide-results-table'
import { SequenceInput } from './sequence-input'

interface DesignViewProps {
  onSequenceDesigned: (sequence: string) => void
  onGuidesGenerated: (guides: GuideRNA[]) => void
}

export function DesignView({
  onSequenceDesigned,
  onGuidesGenerated,
}: DesignViewProps) {
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
        <h2 className="text-2xl font-bold text-foreground">Guide RNA Design</h2>
        {currentStep === 'results' && (
          <Button variant="outline" onClick={handleStartOver}>
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