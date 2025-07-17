/**
 * Advanced Pattern Matching for PDF Field Extraction
 * Provides sophisticated regex patterns and fuzzy matching for nanopore sequencing forms
 */

export interface PatternMatch {
  value: string
  confidence: number
  pattern: string
  context: string
  position: number
}

export interface FieldPatterns {
  primary: RegExp[]
  secondary: RegExp[]
  contextual: RegExp[]
  fuzzy: RegExp[]
}

export class PdfPatternMatcher {
  private static instance: PdfPatternMatcher
  private patterns: Record<string, FieldPatterns> = {}

  private constructor() {
    this.initializePatterns()
  }

  static getInstance(): PdfPatternMatcher {
    if (!PdfPatternMatcher.instance) {
      PdfPatternMatcher.instance = new PdfPatternMatcher()
    }
    return PdfPatternMatcher.instance
  }

  private initializePatterns(): void {
    this.patterns = {
      sampleName: {
        primary: [
          /sample\s*(?:name|id|identifier|code|number)[\s:]*([A-Za-z0-9_.\-#]+)/gi,
          /(?:sample|specimen|aliquot)[\s:]*([A-Za-z0-9_.\-#]+)/gi,
          /(?:barcode|tube\s*id|vial\s*id)[\s:]*([A-Za-z0-9_.\-#]+)/gi,
        ],
        secondary: [
          /name\s*of\s*sample[\s:]*([A-Za-z0-9_.\-#]+)/gi,
          /sample\s*label[\s:]*([A-Za-z0-9_.\-#]+)/gi,
          /unique\s*identifier[\s:]*([A-Za-z0-9_.\-#]+)/gi,
        ],
        contextual: [
          /([A-Za-z0-9_.\-#]+)\s*(?:is|was|contains|represents)(?:\s+the)?\s*sample/gi,
          /processing\s*sample[\s:]*([A-Za-z0-9_.\-#]+)/gi,
        ],
        fuzzy: [
          /\b([A-Za-z0-9_.\-#]{3,20})\b(?=.*(?:sample|specimen|aliquot))/gi,
        ]
      },
      
      submitterName: {
        primary: [
          /(?:submitter|submitted\s*by|contact\s*person|principal\s*investigator|pi)[\s:]*([A-Za-z\s,.\-']+?)(?:\n|$|email|phone|lab|department|@)/gi,
          /(?:investigator|researcher|scientist)[\s:]*([A-Za-z\s,.\-']+?)(?:\n|$|email|phone|lab|department|@)/gi,
          /(?:requestor|requester|applicant)[\s:]*([A-Za-z\s,.\-']+?)(?:\n|$|email|phone|lab|department|@)/gi,
        ],
        secondary: [
          /name[\s:]*([A-Za-z\s,.\-']+?)(?:\n|$|email|phone|lab|department|@)/gi,
          /(?:dr|prof|professor|mr|ms|mrs)\.?\s*([A-Za-z\s,.\-']+?)(?:\n|$|email|phone|lab|department|@)/gi,
          /contact[\s:]*([A-Za-z\s,.\-']+?)(?:\n|$|email|phone|lab|department|@)/gi,
        ],
        contextual: [
          /([A-Za-z\s,.\-']+?)\s*(?:is|will|has)?\s*(?:submitting|requesting|providing)/gi,
          /prepared\s*by[\s:]*([A-Za-z\s,.\-']+?)(?:\n|$|email|phone|lab|department|@)/gi,
        ],
        fuzzy: [
          /\b([A-Za-z]{2,}\s+[A-Za-z]{2,}(?:\s+[A-Za-z]{2,})?)\b(?=.*(?:submit|request|contact|investigator))/gi,
        ]
      },
      
      submitterEmail: {
        primary: [
          /(?:email|e-mail|electronic\s*mail)[\s:]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
          /(?:contact\s*email|email\s*address)[\s:]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
        ],
        secondary: [
          /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
        ],
        contextual: [
          /(?:correspondence|contact|reach|reply)[\s\w]*[\s:]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
        ],
        fuzzy: [
          /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi,
        ]
      },
      
      labName: {
        primary: [
          /(?:lab|laboratory|dept|department)[\s:]*([A-Za-z\s&(),.'\-]+?)(?:\n|$|university|institution|email|phone)/gi,
          /(?:institution|university|facility|center|centre)[\s:]*([A-Za-z\s&(),.'\-]+?)(?:\n|$|lab|department|email|phone)/gi,
          /(?:affiliation|organization)[\s:]*([A-Za-z\s&(),.'\-]+?)(?:\n|$|lab|department|email|phone)/gi,
        ],
        secondary: [
          /(?:school|college|institute)[\s:]*([A-Za-z\s&(),.'\-]+?)(?:\n|$|lab|department|email|phone)/gi,
          /(?:group|team|unit)[\s:]*([A-Za-z\s&(),.'\-]+?)(?:\n|$|lab|department|email|phone)/gi,
        ],
        contextual: [
          /(?:at|from|of)\s*([A-Za-z\s&(),.'\-]+?)\s*(?:lab|laboratory|university|institution)/gi,
          /([A-Za-z\s&(),.'\-]+?)\s*(?:lab|laboratory|department|facility)/gi,
        ],
        fuzzy: [
          /\b([A-Za-z\s&(),.'\-]{5,50})\b(?=.*(?:lab|university|institution|research))/gi,
        ]
      },
      
      projectName: {
        primary: [
          /(?:project|study|research)[\s:]*([A-Za-z\s&(),.'\-0-9]+?)(?:\n|$|grant|funding|pi|investigator)/gi,
          /(?:grant|funding|award)[\s:]*([A-Za-z\s&(),.'\-0-9]+?)(?:\n|$|project|study|research)/gi,
          /(?:title|name\s*of\s*project)[\s:]*([A-Za-z\s&(),.'\-0-9]+?)(?:\n|$|grant|funding|pi)/gi,
        ],
        secondary: [
          /(?:experiment|investigation|analysis)[\s:]*([A-Za-z\s&(),.'\-0-9]+?)(?:\n|$|project|study|research)/gi,
          /(?:protocol|procedure|method)[\s:]*([A-Za-z\s&(),.'\-0-9]+?)(?:\n|$|project|study|research)/gi,
        ],
        contextual: [
          /(?:for|regarding|concerning)\s*([A-Za-z\s&(),.'\-0-9]+?)\s*(?:project|study|research)/gi,
          /([A-Za-z\s&(),.'\-0-9]+?)\s*(?:project|study|research)/gi,
        ],
        fuzzy: [
          /\b([A-Za-z\s&(),.'\-0-9]{5,100})\b(?=.*(?:project|study|research|grant))/gi,
        ]
      },
      
      sequencingType: {
        primary: [
          /(?:sequencing\s*type|platform|technology)[\s:]*([A-Za-z\s\-]+?)(?:\n|$|library|sample|extraction)/gi,
          /(?:DNA|RNA|cDNA|genomic|transcriptomic|metagenomic|amplicon|targeted|whole\s*genome|whole\s*transcriptome)/gi,
          /(?:nanopore|minion|gridion|promethion|flongle|ont|oxford)/gi,
        ],
        secondary: [
          /(?:analysis\s*type|sequencing\s*method|approach)[\s:]*([A-Za-z\s\-]+?)(?:\n|$|library|sample|extraction)/gi,
          /(?:long\s*read|short\s*read|third\s*generation)/gi,
        ],
        contextual: [
          /(?:using|with|via|through)\s*([A-Za-z\s\-]+?)\s*(?:sequencing|technology|platform)/gi,
          /([A-Za-z\s\-]+?)\s*(?:sequencing|technology|platform)/gi,
        ],
        fuzzy: [
          /\b(DNA|RNA|cDNA|genomic|transcriptomic|metagenomic|nanopore|minion|gridion|promethion)\b/gi,
        ]
      },
      
      libraryType: {
        primary: [
          /(?:library\s*type|library\s*prep|preparation|kit)[\s:]*([A-Za-z\s\-]+?)(?:\n|$|protocol|method|sequencing)/gi,
          /(?:ligation|rapid|pcr-free|direct|native|amplified|barcoded|multiplexed)/gi,
        ],
        secondary: [
          /(?:prep\s*method|protocol|procedure)[\s:]*([A-Za-z\s\-]+?)(?:\n|$|library|sequencing)/gi,
          /(?:adapter|barcode|index)[\s:]*([A-Za-z\s\-]+?)(?:\n|$|library|sequencing)/gi,
        ],
        contextual: [
          /(?:using|with|via)\s*([A-Za-z\s\-]+?)\s*(?:library|prep|protocol)/gi,
          /([A-Za-z\s\-]+?)\s*(?:library|prep|protocol)/gi,
        ],
        fuzzy: [
          /\b(ligation|rapid|pcr-free|direct|native|amplified|barcoded|multiplexed)\b/gi,
        ]
      },
      
      flowCellType: {
        primary: [
          /(?:flow\s*cell|cell\s*type|device|instrument)[\s:]*([A-Za-z0-9\s\-]+?)(?:\n|$|chemistry|version)/gi,
          /(?:minion|gridion|promethion|flongle|r9|r10|r10\.3|r10\.4)/gi,
        ],
        secondary: [
          /(?:chemistry|version|model)[\s:]*([A-Za-z0-9\s\-]+?)(?:\n|$|flow|cell|device)/gi,
          /(?:flo-|flg-|prom-|grid-|min-)/gi,
        ],
        contextual: [
          /(?:using|with|on)\s*([A-Za-z0-9\s\-]+?)\s*(?:flow\s*cell|device|instrument)/gi,
          /([A-Za-z0-9\s\-]+?)\s*(?:flow\s*cell|device|instrument)/gi,
        ],
        fuzzy: [
          /\b(minion|gridion|promethion|flongle|r9|r10)\b/gi,
        ]
      },
      
      priority: {
        primary: [
          /(?:priority|urgency|turnaround|processing\s*priority)[\s:]*([A-Za-z\s\-]+?)(?:\n|$|delivery|timeline)/gi,
          /(?:high|medium|low|standard|normal|rush|urgent|routine|stat|emergency)/gi,
        ],
        secondary: [
          /(?:timeline|deadline|delivery)[\s:]*([A-Za-z\s\-]+?)(?:\n|$|priority|urgency)/gi,
          /(?:asap|fast|quick|slow|regular)/gi,
        ],
        contextual: [
          /(?:need|require|request)\s*([A-Za-z\s\-]+?)\s*(?:priority|urgency|turnaround)/gi,
          /([A-Za-z\s\-]+?)\s*(?:priority|urgency|turnaround)/gi,
        ],
        fuzzy: [
          /\b(high|medium|low|standard|normal|rush|urgent|routine|stat|emergency|asap|fast|quick)\b/gi,
        ]
      },
      
      concentration: {
        primary: [
          /(?:concentration|conc|amount)[\s:]*([0-9.,]+\s*(?:ng\/μl|ng\/ul|ng\/ml|μg\/μl|μg\/ul|μg\/ml|nm|μm|mg\/ml|pg\/μl))/gi,
          /([0-9.,]+\s*(?:ng\/μl|ng\/ul|ng\/ml|μg\/μl|μg\/ul|μg\/ml|nm|μm|mg\/ml|pg\/μl))/gi,
        ],
        secondary: [
          /(?:yield|quantity|volume)[\s:]*([0-9.,]+\s*(?:ng\/μl|ng\/ul|ng\/ml|μg\/μl|μg\/ul|μg\/ml|nm|μm|mg\/ml|pg\/μl))/gi,
        ],
        contextual: [
          /(?:at|approximately|around|about)\s*([0-9.,]+\s*(?:ng\/μl|ng\/ul|ng\/ml|μg\/μl|μg\/ul|μg\/ml|nm|μm|mg\/ml|pg\/μl))/gi,
        ],
        fuzzy: [
          /\b([0-9.,]+\s*(?:ng|μg|mg|pg)\/?\s*(?:μl|ul|ml|l))\b/gi,
        ]
      },
      
      volume: {
        primary: [
          /(?:volume|vol|amount)[\s:]*([0-9.,]+\s*(?:μl|ul|ml|l))/gi,
          /([0-9.,]+\s*(?:μl|ul|ml|l))/gi,
        ],
        secondary: [
          /(?:quantity|aliquot|sample\s*size)[\s:]*([0-9.,]+\s*(?:μl|ul|ml|l))/gi,
        ],
        contextual: [
          /(?:in|of|approximately|around|about)\s*([0-9.,]+\s*(?:μl|ul|ml|l))/gi,
        ],
        fuzzy: [
          /\b([0-9.,]+\s*(?:μl|ul|ml|l))\b/gi,
        ]
      },
      
      purity: {
        primary: [
          /(?:purity|a260\/a280|a260\/a230|260\/280|260\/230|od|optical\s*density)[\s:]*([0-9.,]+)/gi,
          /(?:ratio|quality|qc)[\s:]*([0-9.,]+)/gi,
        ],
        secondary: [
          /(?:absorbance|spectrophotometry|nanodrop)[\s:]*([0-9.,]+)/gi,
        ],
        contextual: [
          /(?:measured|determined|calculated)\s*(?:at|to\s*be)?\s*([0-9.,]+)/gi,
        ],
        fuzzy: [
          /\b([0-9.,]+)\b(?=.*(?:purity|ratio|quality|a260|260))/gi,
        ]
      }
    }
  }

  /**
   * Extract field value using multiple pattern matching strategies
   */
  extractField(fieldName: string, text: string): PatternMatch[] {
    const patterns = this.patterns[fieldName]
    if (!patterns) {
      return []
    }

    const matches: PatternMatch[] = []
    const strategies = [
      { patterns: patterns.primary, confidence: 0.95 },
      { patterns: patterns.secondary, confidence: 0.85 },
      { patterns: patterns.contextual, confidence: 0.75 },
      { patterns: patterns.fuzzy, confidence: 0.65 }
    ]

    for (const strategy of strategies) {
      for (const pattern of strategy.patterns) {
        const patternMatches = this.findMatches(text, pattern, strategy.confidence)
        matches.push(...patternMatches)
      }
    }

    // Sort by confidence and position
    matches.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence
      }
      return a.position - b.position
    })

    // Remove duplicates and low-quality matches
    return this.deduplicateMatches(matches)
  }

  /**
   * Find all matches for a pattern in text
   */
  private findMatches(text: string, pattern: RegExp, baseConfidence: number): PatternMatch[] {
    const matches: PatternMatch[] = []
    let match: RegExpExecArray | null

    // Reset pattern lastIndex for global patterns
    pattern.lastIndex = 0

    while ((match = pattern.exec(text)) !== null) {
      const value = match[1]?.trim()
      if (value && value.length > 0) {
        // Get context around the match
        const start = Math.max(0, match.index - 50)
        const end = Math.min(text.length, match.index + match[0].length + 50)
        const context = text.substring(start, end)

        // Calculate confidence based on context and match quality
        const confidence = this.calculateConfidence(value, context, baseConfidence)

        matches.push({
          value,
          confidence,
          pattern: pattern.source,
          context,
          position: match.index
        })
      }

      // Prevent infinite loops with non-global patterns
      if (!pattern.global) {
        break
      }
    }

    return matches
  }

  /**
   * Calculate confidence score for a match
   */
  private calculateConfidence(value: string, context: string, baseConfidence: number): number {
    let confidence = baseConfidence

    // Boost confidence for common indicators
    const positiveIndicators = [
      'sample', 'name', 'id', 'code', 'submitter', 'contact', 'email',
      'lab', 'laboratory', 'project', 'study', 'sequencing', 'library',
      'flow', 'cell', 'priority', 'concentration', 'volume', 'purity'
    ]

    const negativeIndicators = [
      'example', 'placeholder', 'template', 'default', 'test', 'demo',
      'xxx', 'yyy', 'zzz', 'abc', '123', 'sample123', 'test123'
    ]

    // Check for positive indicators
    for (const indicator of positiveIndicators) {
      if (context.toLowerCase().includes(indicator)) {
        confidence += 0.05
      }
    }

    // Check for negative indicators
    for (const indicator of negativeIndicators) {
      if (value.toLowerCase().includes(indicator)) {
        confidence -= 0.2
      }
    }

    // Penalize very short or very long values
    if (value.length < 2) {
      confidence -= 0.3
    } else if (value.length > 100) {
      confidence -= 0.1
    }

    // Boost confidence for properly formatted values
    if (this.hasProperFormatting(value)) {
      confidence += 0.1
    }

    return Math.max(0.1, Math.min(1.0, confidence))
  }

  /**
   * Check if value has proper formatting
   */
  private hasProperFormatting(value: string): boolean {
    // Check for common formatting patterns
    const patterns = [
      /^[A-Za-z0-9_.\-#]+$/, // Alphanumeric with common separators
      /^[A-Za-z\s,.\-']+$/, // Names with spaces and punctuation
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // Email
      /^[0-9.,]+\s*[A-Za-z\/μ]+$/, // Measurements
    ]

    return patterns.some(pattern => pattern.test(value))
  }

  /**
   * Remove duplicate matches and keep the best ones
   */
  private deduplicateMatches(matches: PatternMatch[]): PatternMatch[] {
    const seen = new Map<string, PatternMatch>()

    for (const match of matches) {
      const key = match.value.toLowerCase().trim()
      const existing = seen.get(key)

      if (!existing || match.confidence > existing.confidence) {
        seen.set(key, match)
      }
    }

    return Array.from(seen.values())
      .filter(match => match.confidence > 0.5)
      .slice(0, 5) // Keep top 5 matches
  }

  /**
   * Extract all fields from text
   */
  extractAllFields(text: string): Record<string, PatternMatch[]> {
    const results: Record<string, PatternMatch[]> = {}

    for (const fieldName of Object.keys(this.patterns)) {
      results[fieldName] = this.extractField(fieldName, text)
    }

    return results
  }

  /**
   * Get the best match for a field
   */
  getBestMatch(fieldName: string, text: string): PatternMatch | null {
    const matches = this.extractField(fieldName, text)
    return matches.length > 0 ? matches[0] ?? null : null
  }

  /**
   * Add custom patterns for a field
   */
  addCustomPatterns(fieldName: string, patterns: Partial<FieldPatterns>): void {
    if (!this.patterns[fieldName]) {
      this.patterns[fieldName] = {
        primary: [],
        secondary: [],
        contextual: [],
        fuzzy: []
      }
    }

    const field = this.patterns[fieldName]
    if (field && patterns.primary) field.primary.push(...patterns.primary)
    if (field && patterns.secondary) field.secondary.push(...patterns.secondary)
    if (field && patterns.contextual) field.contextual.push(...patterns.contextual)
    if (field && patterns.fuzzy) field.fuzzy.push(...patterns.fuzzy)
  }
}

// Export singleton instance
export const pdfPatternMatcher = PdfPatternMatcher.getInstance()

// Export convenience functions
export function extractField(fieldName: string, text: string): PatternMatch[] {
  return pdfPatternMatcher.extractField(fieldName, text)
}

export function getBestMatch(fieldName: string, text: string): PatternMatch | null {
  return pdfPatternMatcher.getBestMatch(fieldName, text)
}

export function extractAllFields(text: string): Record<string, PatternMatch[]> {
  return pdfPatternMatcher.extractAllFields(text)
} 