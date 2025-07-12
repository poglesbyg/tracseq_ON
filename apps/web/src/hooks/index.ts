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

// Configuration hooks
export { useConfig, useAppInfo, useFeatures, usePerformanceConfig, useUIConfig, useAPIConfig, useSecurityConfig } from './use-config'
export { useFeatureFlag, useCrisprConfig, useNanoporeConfig, useAIConfig } from './use-config'
export { useEnvironment, useIsDevelopment, useIsProduction, useIsTest, useDebugInfo } from './use-config'
export type { ConfigState, UseConfigOptions } from './use-config'

// Performance hooks
export { usePerformance, usePerformanceMeasurement, useMemoizedCallback, useDebouncedCallback, useThrottledCallback } from './use-performance'
export type { PerformanceState, UsePerformanceOptions } from './use-performance'

// Existing hooks
export { useIsMobile } from './use-mobile'
export { useSmartPolling } from './use-smart-polling' 