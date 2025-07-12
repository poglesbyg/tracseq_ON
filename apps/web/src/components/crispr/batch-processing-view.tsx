import { motion } from 'framer-motion'

import type { DesignParameters } from '../../lib/crispr/guide-design'

import { BatchAnalysis } from './batch-analysis'

interface BatchProcessingViewProps {
  designParameters?: DesignParameters
}

export function BatchProcessingView({ designParameters }: BatchProcessingViewProps) {
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
          className="text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent"
        >
          Batch Processing & Advanced Analytics
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          Process multiple sequences simultaneously with comprehensive analysis
          and professional reporting
        </motion.p>
      </div>

      <BatchAnalysis designParameters={designParameters || defaultDesignParameters} />
    </motion.div>
  )
} 