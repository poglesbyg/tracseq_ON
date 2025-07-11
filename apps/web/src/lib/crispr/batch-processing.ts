import type { GuideRNA, DesignParameters } from './guide-design'
import { designGuideRNAs } from './guide-design'
import type { OffTargetAnalysis } from './off-target-prediction'
import { analyzeOffTargets } from './off-target-prediction'

export interface BatchSequence {
  id: string
  name: string
  sequence: string
  type: 'genomic' | 'cdna' | 'custom'
  description?: string
}

export interface BatchGuideResult {
  sequenceId: string
  sequenceName: string
  guides: GuideRNA[]
  offTargetAnalyses: Map<string, OffTargetAnalysis>
  summary: {
    totalGuides: number
    highEfficiencyGuides: number
    lowRiskGuides: number
    recommendedGuides: number
    averageEfficiency: number
    averageSpecificity: number
  }
}

export interface BatchProcessingResult {
  id: string
  timestamp: Date
  totalSequences: number
  processedSequences: number
  results: BatchGuideResult[]
  overallSummary: {
    totalGuides: number
    averageGuidesPerSequence: number
    bestSequenceId: string
    bestSequenceName: string
    overallSuccessRate: number
  }
  processingTime: number
}

export interface BatchProcessingProgress {
  currentSequence: number
  totalSequences: number
  currentStep: 'design' | 'off-target' | 'analysis' | 'complete'
  currentSequenceName: string
  percentage: number
  estimatedTimeRemaining: number
}

/**
 * Parse FASTA format sequences
 */
export function parseFASTASequences(fastaContent: string): BatchSequence[] {
  const sequences: BatchSequence[] = []
  const lines = fastaContent.split('\n').filter((line) => line.trim() !== '')

  let currentSequence: Partial<BatchSequence> | null = null
  let sequenceLines: string[] = []

  for (const line_ of lines) {
    const line = line_.trim()

    if (line.startsWith('>')) {
      // Save previous sequence if exists
      if (currentSequence && sequenceLines.length > 0) {
        sequences.push({
          ...currentSequence,
          sequence: sequenceLines.join('').toUpperCase(),
        } as BatchSequence)
      }

      // Start new sequence
      const header = line.substring(1).trim()
      const parts = header.split('|')
      currentSequence = {
        id: `seq_${sequences.length + 1}`,
        name: parts[0] || `Sequence ${sequences.length + 1}`,
        type: 'genomic',
        description: parts.length > 1 ? parts.slice(1).join(' | ') : undefined,
      }
      sequenceLines = []
    } else {
      // Add to current sequence
      sequenceLines.push(line.replace(/[^acgnt]/gi, ''))
    }
  }

  // Save last sequence
  if (currentSequence && sequenceLines.length > 0) {
    sequences.push({
      ...currentSequence,
      sequence: sequenceLines.join('').toUpperCase(),
    } as BatchSequence)
  }

  return sequences
}

/**
 * Parse CSV format sequences
 */
export function parseCSVSequences(csvContent: string): BatchSequence[] {
  const lines = csvContent.split('\n').filter((line) => line.trim() !== '')
  if (lines.length <= 1) {
    return []
  }

  const sequences: BatchSequence[] = []
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())

  // Expected headers: name, sequence, type?, description?
  const nameIndex = headers.findIndex((h) => h.includes('name'))
  const sequenceIndex = headers.findIndex((h) => h.includes('sequence'))
  const typeIndex = headers.findIndex((h) => h.includes('type'))
  const descriptionIndex = headers.findIndex((h) => h.includes('description'))

  if (nameIndex === -1 || sequenceIndex === -1) {
    throw new Error('CSV must contain "name" and "sequence" columns')
  }

  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''))

    if (columns.length <= Math.max(nameIndex, sequenceIndex)) {
      continue
    }

    const sequence = columns[sequenceIndex]
      .toUpperCase()
      .replace(/[^ACGNT]/g, '')
    if (sequence.length < 20) {
      continue
    } // Skip sequences too short for guide design

    sequences.push({
      id: `seq_${i}`,
      name: columns[nameIndex] || `Sequence ${i}`,
      sequence,
      type:
        typeIndex >= 0 && columns[typeIndex]
          ? (columns[typeIndex] as 'genomic' | 'cdna' | 'custom')
          : 'genomic',
      description:
        descriptionIndex >= 0 ? columns[descriptionIndex] : undefined,
    })
  }

  return sequences
}

/**
 * Process a single sequence and return comprehensive results
 */
async function processSequence(
  batchSequence: BatchSequence,
  designParams: DesignParameters,
  onProgress?: (step: string) => void,
): Promise<BatchGuideResult> {
  onProgress?.('Designing guide RNAs...')

  // Design guides
  const guides = designGuideRNAs({
    ...designParams,
    targetSequence: batchSequence.sequence,
  })

  onProgress?.('Analyzing off-targets...')

  // Analyze off-targets for each guide
  const offTargetAnalyses = new Map<string, OffTargetAnalysis>()

  // Process guides in batches to avoid overwhelming the system
  const batchSize = 5
  for (let i = 0; i < guides.length; i += batchSize) {
    const batch = guides.slice(i, i + batchSize)
    const promises = batch.map((guide) => analyzeOffTargets(guide))
    const results = await Promise.all(promises)

    batch.forEach((guide, index) => {
      offTargetAnalyses.set(guide.id, results[index])
    })
  }

  onProgress?.('Generating summary...')

  // Calculate summary statistics
  const highEfficiencyGuides = guides.filter(
    (g) => g.efficiencyScore >= 0.7,
  ).length
  const lowRiskGuides = Array.from(offTargetAnalyses.values()).filter(
    (analysis) => analysis.highRiskSites === 0,
  ).length
  const recommendedGuides = Array.from(offTargetAnalyses.values()).filter(
    (analysis) => ['excellent', 'good'].includes(analysis.recommendation),
  ).length

  const averageEfficiency =
    guides.reduce((sum, g) => sum + g.efficiencyScore, 0) / guides.length
  const averageSpecificity =
    guides.reduce((sum, g) => sum + g.specificityScore, 0) / guides.length

  return {
    sequenceId: batchSequence.id,
    sequenceName: batchSequence.name,
    guides,
    offTargetAnalyses,
    summary: {
      totalGuides: guides.length,
      highEfficiencyGuides,
      lowRiskGuides,
      recommendedGuides,
      averageEfficiency,
      averageSpecificity,
    },
  }
}

/**
 * Process multiple sequences in batch with progress tracking
 */
export async function processBatchSequences(
  sequences: BatchSequence[],
  designParams: DesignParameters,
  onProgress?: (progress: BatchProcessingProgress) => void,
): Promise<BatchProcessingResult> {
  const startTime = Date.now()
  const batchId = `batch_${Date.now()}`

  const results: BatchGuideResult[] = []

  for (let i = 0; i < sequences.length; i++) {
    const sequence = sequences[i]

    // Calculate progress
    const percentage = (i / sequences.length) * 100
    const averageTimePerSequence = i > 0 ? (Date.now() - startTime) / i : 30000 // 30s estimate
    const estimatedTimeRemaining =
      (sequences.length - i) * averageTimePerSequence

    onProgress?.({
      currentSequence: i + 1,
      totalSequences: sequences.length,
      currentStep: 'design',
      currentSequenceName: sequence.name,
      percentage,
      estimatedTimeRemaining,
    })

    try {
      const result = await processSequence(sequence, designParams, (step) => {
        const currentStep = step.includes('Designing')
          ? 'design'
          : step.includes('off-target')
            ? 'off-target'
            : 'analysis'
        onProgress?.({
          currentSequence: i + 1,
          totalSequences: sequences.length,
          currentStep,
          currentSequenceName: sequence.name,
          percentage:
            (i / sequences.length) * 100 + (1 / sequences.length) * 50, // Add partial progress within sequence
          estimatedTimeRemaining,
        })
      })

      results.push(result)
    } catch (error) {
      console.error(`Failed to process sequence ${sequence.name}:`, error)
      // Continue with other sequences even if one fails
    }
  }

  // Calculate overall summary
  const totalGuides = results.reduce((sum, r) => sum + r.guides.length, 0)
  const averageGuidesPerSequence = totalGuides / results.length

  // Find best sequence (highest average efficiency * specificity)
  let bestSequence = results[0]
  let bestScore = 0

  for (const result of results) {
    const score =
      result.summary.averageEfficiency * result.summary.averageSpecificity
    if (score > bestScore) {
      bestScore = score
      bestSequence = result
    }
  }

  const overallSuccessRate =
    results.reduce(
      (sum, r) => sum + r.summary.recommendedGuides / r.summary.totalGuides,
      0,
    ) / results.length

  const processingTime = Date.now() - startTime

  onProgress?.({
    currentSequence: sequences.length,
    totalSequences: sequences.length,
    currentStep: 'complete',
    currentSequenceName: 'All sequences processed',
    percentage: 100,
    estimatedTimeRemaining: 0,
  })

  return {
    id: batchId,
    timestamp: new Date(),
    totalSequences: sequences.length,
    processedSequences: results.length,
    results,
    overallSummary: {
      totalGuides,
      averageGuidesPerSequence,
      bestSequenceId: bestSequence.sequenceId,
      bestSequenceName: bestSequence.sequenceName,
      overallSuccessRate,
    },
    processingTime,
  }
}

/**
 * Generate detailed comparison report
 */
export function generateComparisonReport(results: BatchProcessingResult): {
  sequences: Array<{
    name: string
    totalGuides: number
    bestGuide: GuideRNA
    averageEfficiency: number
    averageSpecificity: number
    recommendationScore: number
  }>
  recommendations: string[]
} {
  const sequences = results.results.map((result) => {
    const bestGuide = result.guides.reduce((best, current) =>
      current.efficiencyScore * current.specificityScore >
      best.efficiencyScore * best.specificityScore
        ? current
        : best,
    )

    const recommendationScore =
      result.summary.recommendedGuides / result.summary.totalGuides

    return {
      name: result.sequenceName,
      totalGuides: result.summary.totalGuides,
      bestGuide,
      averageEfficiency: result.summary.averageEfficiency,
      averageSpecificity: result.summary.averageSpecificity,
      recommendationScore,
    }
  })

  // Generate recommendations
  const recommendations: string[] = []

  // Find sequences with best performance
  const topSequences = sequences
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, 3)

  recommendations.push(
    `Top performing sequences: ${topSequences.map((s) => s.name).join(', ')}`,
  )

  // Find sequences that might need attention
  const lowPerformingSequences = sequences.filter(
    (s) => s.recommendationScore < 0.5,
  )
  if (lowPerformingSequences.length > 0) {
    recommendations.push(
      `Consider alternative approaches for: ${lowPerformingSequences.map((s) => s.name).join(', ')}`,
    )
  }

  // Overall efficiency insights
  const avgEfficiency =
    sequences.reduce((sum, s) => sum + s.averageEfficiency, 0) /
    sequences.length
  if (avgEfficiency < 0.6) {
    recommendations.push(
      'Consider adjusting design parameters to improve overall efficiency',
    )
  }

  return { sequences, recommendations }
}

/**
 * Export batch results to various formats
 */
export function exportBatchResults(
  results: BatchProcessingResult,
  format: 'csv' | 'json' | 'summary',
): string {
  switch (format) {
    case 'csv':
      return exportToCSV(results)
    case 'json':
      return JSON.stringify(results, null, 2)
    case 'summary':
      return exportToSummary(results)
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}

function exportToCSV(results: BatchProcessingResult): string {
  const headers = [
    'Sequence Name',
    'Sequence ID',
    'Guide ID',
    'Guide Sequence',
    'Position',
    'Strand',
    'PAM Sequence',
    'Efficiency Score',
    'Specificity Score',
    'GC Content',
    'Off-Target Risk',
    'High Risk Sites',
    'Recommendation',
  ]

  const rows = []

  for (const result of results.results) {
    for (const guide of result.guides) {
      const offTargetAnalysis = result.offTargetAnalyses.get(guide.id)
      rows.push([
        result.sequenceName,
        result.sequenceId,
        guide.id,
        guide.sequence,
        guide.position,
        guide.strand,
        guide.pamSequence,
        guide.efficiencyScore.toFixed(3),
        guide.specificityScore.toFixed(3),
        guide.gcContent.toFixed(1),
        offTargetAnalysis?.recommendation || 'N/A',
        offTargetAnalysis?.highRiskSites || 0,
        offTargetAnalysis?.recommendation || 'N/A',
      ])
    }
  }

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
}

function exportToSummary(results: BatchProcessingResult): string {
  const report = generateComparisonReport(results)

  let summary = `CRISPR Design Studio - Batch Analysis Summary\n`
  summary += `Generated: ${results.timestamp.toLocaleString()}\n`
  summary += `Processing Time: ${(results.processingTime / 1000).toFixed(1)} seconds\n\n`

  summary += `OVERALL STATISTICS:\n`
  summary += `- Total Sequences: ${results.totalSequences}\n`
  summary += `- Total Guide RNAs: ${results.overallSummary.totalGuides}\n`
  summary += `- Average Guides per Sequence: ${results.overallSummary.averageGuidesPerSequence.toFixed(1)}\n`
  summary += `- Overall Success Rate: ${(results.overallSummary.overallSuccessRate * 100).toFixed(1)}%\n`
  summary += `- Best Performing Sequence: ${results.overallSummary.bestSequenceName}\n\n`

  summary += `SEQUENCE PERFORMANCE:\n`
  for (const seq of report.sequences) {
    summary += `${seq.name}:\n`
    summary += `  - Total Guides: ${seq.totalGuides}\n`
    summary += `  - Average Efficiency: ${(seq.averageEfficiency * 100).toFixed(1)}%\n`
    summary += `  - Average Specificity: ${(seq.averageSpecificity * 100).toFixed(1)}%\n`
    summary += `  - Recommendation Score: ${(seq.recommendationScore * 100).toFixed(1)}%\n\n`
  }

  summary += `RECOMMENDATIONS:\n`
  for (const rec of report.recommendations) {
    summary += `- ${rec}\n`
  }

  return summary
}
