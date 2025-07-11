export interface GuideRNA {
  id: string
  sequence: string // 20bp guide sequence (without PAM)
  pamSequence: string
  position: number
  strand: '+' | '-'
  efficiencyScore: number
  specificityScore: number
  onTargetScore: number
  gcContent: number
  annotationInfo?: string
}

export interface DesignParameters {
  targetSequence: string
  pamType: 'NGG' | 'NRG' | 'NNGRRT' // SpCas9, SpCas9-NG, Cas12a
  minEfficiencyScore: number
  maxOffTargets: number
  allowNonCanonicalPAMs: boolean
}

// Common PAM patterns
const PAM_PATTERNS = {
  NGG: /[ACGT]GG/g, // SpCas9 canonical
  NRG: /[ACGT][AG]G/g, // SpCas9-NG variant
  NNGRRT: /[ACGT]{2}G[AG]{2}T/g, // Cas12a (simplified)
}

/**
 * Calculate GC content percentage
 */
function calculateGCContent(sequence: string): number {
  const gcCount = (sequence.match(/[CG]/g) || []).length
  return (gcCount / sequence.length) * 100
}

/**
 * Calculate guide RNA efficiency score using simplified Doench 2016 model
 * This is a simplified version - real implementation would use the full model
 */
function calculateEfficiencyScore(
  guideSequence: string,
  _context?: string,
): number {
  let score = 0.5 // Base score

  // GC content optimization (40-60% is optimal)
  const gcContent = calculateGCContent(guideSequence)
  if (gcContent >= 40 && gcContent <= 60) {
    score += 0.2
  } else if (gcContent < 30 || gcContent > 80) {
    score -= 0.2
  }

  // Avoid runs of identical nucleotides
  const hasRuns = /(.)\1{3,}/.test(guideSequence)
  if (hasRuns) {
    score -= 0.15
  }

  // Prefer T at position 1 (index 0) - SpCas9 preference
  if (guideSequence[0] === 'T') {
    score += 0.1
  }

  // Avoid G at position 20 (index 19) - can reduce efficiency
  if (guideSequence[19] === 'G') {
    score -= 0.1
  }

  // Penalize Cs in positions 1-5 (simplified rule)
  const earlyCs = guideSequence.slice(0, 5).match(/C/g)?.length || 0
  score -= earlyCs * 0.05

  // Ensure score is between 0 and 1
  return Math.max(0, Math.min(1, score))
}

/**
 * Calculate on-target score (simplified CFD score)
 */
function calculateOnTargetScore(guideSequence: string): number {
  let score = 0.8 // Base score

  // Position-specific weights (simplified)
  const positionWeights = [
    0.0, 0.0, 0.014, 0.0, 0.0, 0.395, 0.317, 0.0, 0.389, 0.079, 0.445, 0.508,
    0.613, 0.851, 0.732, 0.828, 0.615, 0.804, 0.685, 0.583,
  ]

  // Simple scoring based on nucleotide composition and position
  for (
    let i = 0;
    i < Math.min(guideSequence.length, positionWeights.length);
    i++
  ) {
    if (guideSequence[i] === 'G' || guideSequence[i] === 'C') {
      score += positionWeights[i] * 0.1
    }
  }

  return Math.max(0, Math.min(1, score))
}

/**
 * Calculate specificity score (simplified - real implementation would check genome-wide)
 */
function calculateSpecificityScore(guideSequence: string): number {
  let score = 0.9 // High base specificity

  // Simple heuristics for likely off-targets
  const gcContent = calculateGCContent(guideSequence)

  // Very high or low GC content may increase off-targets
  if (gcContent < 25 || gcContent > 75) {
    score -= 0.1
  }

  // Repetitive sequences are more likely to have off-targets
  const hasRepeats = /(.{3,})\1/.test(guideSequence)
  if (hasRepeats) {
    score -= 0.2
  }

  // Common motifs that might increase off-targets
  const commonMotifs = ['AAAA', 'TTTT', 'CCCC', 'GGGG']
  for (const motif of commonMotifs) {
    if (guideSequence.includes(motif)) {
      score -= 0.1
      break
    }
  }

  return Math.max(0, Math.min(1, score))
}

/**
 * Reverse complement a DNA sequence
 */
function reverseComplement(sequence: string): string {
  const complement: { [key: string]: string } = {
    A: 'T',
    T: 'A',
    C: 'G',
    G: 'C',
    N: 'N',
  }
  return sequence
    .split('')
    .reverse()
    .map((base) => complement[base] || base)
    .join('')
}

/**
 * Find all PAM sites in a sequence
 */
function findPAMSites(
  sequence: string,
  pamType: keyof typeof PAM_PATTERNS,
): Array<{ position: number; pam: string; strand: '+' | '-' }> {
  const sites: Array<{ position: number; pam: string; strand: '+' | '-' }> = []
  const pattern = PAM_PATTERNS[pamType]

  // Find forward strand PAMs
  let match
  pattern.lastIndex = 0 // Reset regex
  while ((match = pattern.exec(sequence)) !== null) {
    sites.push({
      position: match.index,
      pam: match[0],
      strand: '+',
    })
  }

  // Find reverse strand PAMs
  const revCompSeq = reverseComplement(sequence)
  pattern.lastIndex = 0 // Reset regex
  while ((match = pattern.exec(revCompSeq)) !== null) {
    const originalPosition = sequence.length - match.index - match[0].length
    sites.push({
      position: originalPosition,
      pam: reverseComplement(match[0]),
      strand: '-',
    })
  }

  return sites.sort((a, b) => a.position - b.position)
}

/**
 * Design guide RNAs for a target sequence
 */
export function designGuideRNAs(parameters: DesignParameters): GuideRNA[] {
  const { targetSequence, pamType, minEfficiencyScore } = parameters
  const guides: GuideRNA[] = []

  // Find all PAM sites
  const pamSites = findPAMSites(targetSequence, pamType)

  for (const site of pamSites) {
    let guideSequence: string
    let guidePosition: number

    if (site.strand === '+') {
      // For forward strand, guide is 20bp upstream of PAM
      if (site.position >= 20) {
        guidePosition = site.position - 20
        guideSequence = targetSequence.slice(guidePosition, site.position)
      } else {
        continue // Not enough sequence upstream
      }
    } else {
      // For reverse strand, guide is 20bp downstream of PAM
      if (site.position + site.pam.length + 20 <= targetSequence.length) {
        guidePosition = site.position + site.pam.length
        const rawSequence = targetSequence.slice(
          guidePosition,
          guidePosition + 20,
        )
        guideSequence = reverseComplement(rawSequence)
      } else {
        continue // Not enough sequence downstream
      }
    }

    // Skip if guide sequence contains N or is invalid
    if (guideSequence.includes('N') || guideSequence.length !== 20) {
      continue
    }

    // Calculate scores
    const efficiencyScore = calculateEfficiencyScore(guideSequence)
    const onTargetScore = calculateOnTargetScore(guideSequence)
    const specificityScore = calculateSpecificityScore(guideSequence)
    const gcContent = calculateGCContent(guideSequence)

    // Filter by minimum efficiency score
    if (efficiencyScore < minEfficiencyScore) {
      continue
    }

    const guide: GuideRNA = {
      id: `guide_${site.position}_${site.strand}`,
      sequence: guideSequence,
      pamSequence: site.pam,
      position: site.strand === '+' ? guidePosition : site.position,
      strand: site.strand,
      efficiencyScore,
      specificityScore,
      onTargetScore,
      gcContent,
    }

    guides.push(guide)
  }

  // Sort by efficiency score (descending)
  return guides.sort((a, b) => b.efficiencyScore - a.efficiencyScore)
}

/**
 * Get design recommendations based on guides
 */
export function getDesignRecommendations(guides: GuideRNA[]): {
  topGuides: GuideRNA[]
  warnings: string[]
  recommendations: string[]
} {
  const warnings: string[] = []
  const recommendations: string[] = []

  if (guides.length === 0) {
    warnings.push(
      'No suitable guide RNAs found. Try adjusting parameters or using a different sequence.',
    )
    return { topGuides: [], warnings, recommendations }
  }

  // Get top 10 guides
  const topGuides = guides.slice(0, 10)

  // Analysis and recommendations
  const avgEfficiency =
    guides.reduce((sum, guide) => sum + guide.efficiencyScore, 0) /
    guides.length
  const avgSpecificity =
    guides.reduce((sum, guide) => sum + guide.specificityScore, 0) /
    guides.length

  if (avgEfficiency < 0.4) {
    warnings.push(
      'Overall guide efficiency is low. Consider using a longer target sequence.',
    )
  }

  if (avgSpecificity < 0.7) {
    warnings.push(
      'Some guides may have off-target effects. Perform additional validation.',
    )
  }

  if (topGuides[0]?.efficiencyScore > 0.8) {
    recommendations.push(
      'Excellent top guide found with high efficiency score.',
    )
  }

  if (guides.length > 20) {
    recommendations.push(
      'Many guide options available. Consider multiple guides for redundancy.',
    )
  } else if (guides.length < 5) {
    recommendations.push(
      'Limited guide options. Consider expanding target region.',
    )
  }

  const gcRange =
    Math.max(...guides.map((g) => g.gcContent)) -
    Math.min(...guides.map((g) => g.gcContent))
  if (gcRange > 30) {
    recommendations.push(
      'Wide GC content range in guides. Test multiple guides for optimal activity.',
    )
  }

  return { topGuides, warnings, recommendations }
}
