// Advanced CRISPR operation hooks
export { useGuideDesign } from './use-guide-design'
export type {
  GuideDesignState,
  AnalysisResult,
  UseGuideDesignOptions,
} from './use-guide-design'

export { useOffTargetAnalysis } from './use-off-target-analysis'
export type {
  OffTargetSite,
  OffTargetAnalysisState,
  AnalysisSummary,
  UseOffTargetAnalysisOptions,
} from './use-off-target-analysis'

export { useBatchProcessing } from './use-batch-processing'
export type {
  BatchSequence,
  BatchProcessingState,
  BatchSummary,
  UseBatchProcessingOptions,
} from './use-batch-processing'

// Existing hooks
export { useIsMobile } from './use-mobile'
export { useSmartPolling } from './use-smart-polling' 