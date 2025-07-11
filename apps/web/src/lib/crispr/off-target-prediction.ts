import type { GuideRNA } from './guide-design'

export interface OffTargetSite {
  id: string
  sequence: string
  position: number
  chromosome: string
  strand: '+' | '-'
  mismatches: number
  mismatchPositions: number[]
  cffdScore: number // CFD (Cutting Frequency Determination) score
  mitScore: number // MIT specificity score
  riskLevel: 'low' | 'medium' | 'high'
  geneContext?: {
    geneName: string
    geneType: 'coding' | 'non-coding' | 'regulatory'
    exonNumber?: number
  }
}

export interface OffTargetAnalysis {
  totalSites: number
  highRiskSites: number
  mediumRiskSites: number
  lowRiskSites: number
  specificity: number
  recommendation: 'excellent' | 'good' | 'caution' | 'avoid'
  sites: OffTargetSite[]
}

// Simulated human genome reference for demonstration
const SIMULATED_GENOME_SEGMENTS = [
  'ATCGATCGATCGATCGATCGATCGATCGATCG',
  'GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTA',
  'TTAAGGCCTTAAGGCCTTAAGGCCTTAAGGCC',
  'CCCGGGAAACCCGGGAAACCCGGGAAACCCGG',
  'AAATTTGGCCAAATTTGGCCAAATTTGGCCAA',
]

// CFD scoring matrix (simplified) - real implementation would use full published matrix
const CFD_MATRIX: Record<string, Record<string, number>> = {
  A: { A: 1.0, C: 0.6, G: 0.4, T: 0.3 },
  C: { A: 0.5, C: 1.0, G: 0.8, T: 0.2 },
  G: { A: 0.3, C: 0.7, G: 1.0, T: 0.4 },
  T: { A: 0.4, C: 0.2, G: 0.5, T: 1.0 },
}

/**
 * Calculate CFD (Cutting Frequency Determination) score
 * Higher score = higher likelihood of off-target cutting
 */
function calculateCFDScore(
  guideSequence: string,
  targetSequence: string,
): number {
  if (guideSequence.length !== targetSequence.length) {
    return 0
  }

  let score = 1.0

  for (const [i, guideBase] of Array.from(guideSequence).entries()) {
    const targetBase = targetSequence[i]

    if (guideBase in CFD_MATRIX && targetBase in CFD_MATRIX[guideBase]) {
      score *= CFD_MATRIX[guideBase][targetBase]
    } else {
      score *= 0.1 // Unknown base penalty
    }
  }

  return score
}

/**
 * Calculate MIT specificity score
 * Based on position-weighted mismatch penalties
 */
function calculateMITScore(
  guideSequence: string,
  targetSequence: string,
): number {
  if (guideSequence.length !== targetSequence.length) {
    return 0
  }

  let score = 1.0
  const mismatches: number[] = []

  for (const [i, element] of Array.from(guideSequence).entries()) {
    if (element !== targetSequence[i]) {
      mismatches.push(i)
    }
  }

  // Apply position-weighted penalties (seed region is more important)
  for (const pos of mismatches) {
    let penalty = 1.0

    // Seed region (positions 1-8 from 3' end) has higher penalty
    if (pos >= 12) {
      penalty = 0.1 // Very high penalty for seed region mismatches
    } else if (pos >= 8) {
      penalty = 0.3 // Medium penalty
    } else {
      penalty = 0.7 // Lower penalty for 5' mismatches
    }

    score *= penalty
  }

  return score
}

/**
 * Generate reverse complement of DNA sequence
 */
function reverseComplement(sequence: string): string {
  const complement: Record<string, string> = {
    A: 'T',
    T: 'A',
    G: 'C',
    C: 'G',
    N: 'N',
  }

  return sequence
    .split('')
    .reverse()
    .map((base) => complement[base] || 'N')
    .join('')
}

/**
 * Find potential off-target sites allowing up to 4 mismatches
 */
function findPotentialSites(
  guideSequence: string,
  maxMismatches: number = 4,
): OffTargetSite[] {
  const sites: OffTargetSite[] = []
  let siteId = 1

  // Search in simulated genome segments (both strands)
  SIMULATED_GENOME_SEGMENTS.forEach((segment, chrIndex) => {
    const chromosome = `chr${chrIndex + 1}`

    // Search forward strand
    for (let i = 0; i <= segment.length - guideSequence.length; i++) {
      const targetSeq = segment.substring(i, i + guideSequence.length)
      const mismatches = countMismatches(guideSequence, targetSeq)

      if (mismatches <= maxMismatches) {
        const cffdScore = calculateCFDScore(guideSequence, targetSeq)
        const mitScore = calculateMITScore(guideSequence, targetSeq)

        sites.push({
          id: `site_${siteId++}`,
          sequence: targetSeq,
          position: i,
          chromosome,
          strand: '+',
          mismatches,
          mismatchPositions: getMismatchPositions(guideSequence, targetSeq),
          cffdScore,
          mitScore,
          riskLevel: determineRiskLevel(cffdScore, mitScore, mismatches),
          geneContext: generateMockGeneContext(chromosome, i),
        })
      }
    }

    // Search reverse strand
    const reverseSegment = reverseComplement(segment)
    for (let i = 0; i <= reverseSegment.length - guideSequence.length; i++) {
      const targetSeq = reverseSegment.substring(i, i + guideSequence.length)
      const mismatches = countMismatches(guideSequence, targetSeq)

      if (mismatches <= maxMismatches) {
        const cffdScore = calculateCFDScore(guideSequence, targetSeq)
        const mitScore = calculateMITScore(guideSequence, targetSeq)

        sites.push({
          id: `site_${siteId++}`,
          sequence: targetSeq,
          position: segment.length - i - guideSequence.length,
          chromosome,
          strand: '-',
          mismatches,
          mismatchPositions: getMismatchPositions(guideSequence, targetSeq),
          cffdScore,
          mitScore,
          riskLevel: determineRiskLevel(cffdScore, mitScore, mismatches),
          geneContext: generateMockGeneContext(chromosome, i),
        })
      }
    }
  })

  return sites.sort((a, b) => b.cffdScore - a.cffdScore) // Sort by CFD score descending
}

/**
 * Count mismatches between two sequences
 */
function countMismatches(seq1: string, seq2: string): number {
  let count = 0
  for (let i = 0; i < Math.min(seq1.length, seq2.length); i++) {
    if (seq1[i] !== seq2[i]) {
      count++
    }
  }
  return count
}

/**
 * Get positions of mismatches between sequences
 */
function getMismatchPositions(seq1: string, seq2: string): number[] {
  const positions: number[] = []
  for (let i = 0; i < Math.min(seq1.length, seq2.length); i++) {
    if (seq1[i] !== seq2[i]) {
      positions.push(i)
    }
  }
  return positions
}

/**
 * Determine risk level based on scoring metrics
 */
function determineRiskLevel(
  cffdScore: number,
  mitScore: number,
  mismatches: number,
): 'low' | 'medium' | 'high' {
  // High risk: high cutting probability with few mismatches
  if (cffdScore > 0.5 && mismatches <= 2) {
    return 'high'
  }

  // Medium risk: moderate cutting probability or seed region mismatches
  if (cffdScore > 0.1 && mismatches <= 3) {
    return 'medium'
  }

  // Low risk: low cutting probability with multiple mismatches
  return 'low'
}

/**
 * Generate mock gene context for demonstration
 */
function generateMockGeneContext(
  chromosome: string,
  position: number,
): {
  geneName: string
  geneType: 'coding' | 'non-coding' | 'regulatory'
  exonNumber?: number
} {
  const geneNames = ['BRCA1', 'TP53', 'EGFR', 'MYC', 'PTEN', 'KRAS', 'PIK3CA']
  const geneTypes: Array<'coding' | 'non-coding' | 'regulatory'> = [
    'coding',
    'non-coding',
    'regulatory',
  ]

  const geneIndex = position % geneNames.length
  const typeIndex = position % geneTypes.length

  return {
    geneName: geneNames[geneIndex],
    geneType: geneTypes[typeIndex],
    exonNumber:
      geneTypes[typeIndex] === 'coding'
        ? Math.floor(position % 10) + 1
        : undefined,
  }
}

/**
 * Calculate overall specificity score for a guide RNA
 */
function calculateSpecificity(sites: OffTargetSite[]): number {
  if (sites.length === 0) {
    return 1.0 // Perfect specificity
  }

  // Weight high-risk sites more heavily
  const weightedRisk = sites.reduce((sum, site) => {
    const weight =
      site.riskLevel === 'high' ? 3 : site.riskLevel === 'medium' ? 2 : 1
    return sum + site.cffdScore * weight
  }, 0)

  // Normalize to 0-1 scale (higher = more specific)
  return Math.max(0, 1 - weightedRisk / sites.length)
}

/**
 * Generate recommendation based on off-target analysis
 */
function generateRecommendation(
  analysis: OffTargetAnalysis,
): 'excellent' | 'good' | 'caution' | 'avoid' {
  if (analysis.highRiskSites === 0 && analysis.specificity > 0.9) {
    return 'excellent'
  }

  if (analysis.highRiskSites <= 1 && analysis.specificity > 0.7) {
    return 'good'
  }

  if (analysis.highRiskSites <= 3 && analysis.specificity > 0.5) {
    return 'caution'
  }

  return 'avoid'
}

/**
 * Main function to perform comprehensive off-target analysis
 */
export async function analyzeOffTargets(
  guide: GuideRNA,
): Promise<OffTargetAnalysis> {
  // Simulate API delay for realistic feel
  await new Promise((resolve) => setTimeout(resolve, 1500))

  const sites = findPotentialSites(guide.sequence)

  const highRiskSites = sites.filter((s) => s.riskLevel === 'high').length
  const mediumRiskSites = sites.filter((s) => s.riskLevel === 'medium').length
  const lowRiskSites = sites.filter((s) => s.riskLevel === 'low').length

  const specificity = calculateSpecificity(sites)

  const analysis: OffTargetAnalysis = {
    totalSites: sites.length,
    highRiskSites,
    mediumRiskSites,
    lowRiskSites,
    specificity,
    sites: sites.slice(0, 20), // Limit to top 20 sites for UI
    recommendation: 'excellent', // Will be overwritten
  }

  analysis.recommendation = generateRecommendation(analysis)

  return analysis
}

/**
 * Bulk analysis for multiple guides
 */
export async function analyzeBulkOffTargets(
  guides: GuideRNA[],
): Promise<Map<string, OffTargetAnalysis>> {
  const results = new Map<string, OffTargetAnalysis>()

  // Process in batches to avoid overwhelming the UI
  for (const guide of guides) {
    const analysis = await analyzeOffTargets(guide)
    results.set(guide.id, analysis)
  }

  return results
}

/**
 * Enhanced guide scoring that incorporates off-target analysis
 */
export function calculateEnhancedScore(
  guide: GuideRNA,
  offTargetAnalysis: OffTargetAnalysis,
): number {
  // Weighted combination of efficiency, specificity, and off-target risk
  const efficiencyWeight = 0.4
  const specificityWeight = 0.4
  const offTargetWeight = 0.2

  const offTargetPenalty =
    1 -
    (offTargetAnalysis.highRiskSites * 0.3 +
      offTargetAnalysis.mediumRiskSites * 0.1)

  return (
    guide.efficiencyScore * efficiencyWeight +
    guide.specificityScore * specificityWeight +
    Math.max(0, offTargetPenalty) * offTargetWeight
  )
}
