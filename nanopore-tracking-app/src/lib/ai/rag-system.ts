// Simplified RAG system without heavy transformers dependency
// Uses pattern matching and fuzzy string matching instead

interface FieldMapping {
  fieldName: string
  aliases: string[]
  description: string
  dataType: 'string' | 'number' | 'boolean' | 'select'
  required: boolean
  validation?: RegExp
  examples: string[]
}

interface SemanticMatch {
  fieldName: string
  extractedValue: string
  confidence: number
  reasoning: string
  validationPassed: boolean
  issues: string[]
}

export interface RAGResult {
  matches: SemanticMatch[]
  overallConfidence: number
  totalFields: number
  extractedFields: number
  validationIssues: string[]
  processingTime: number
}

class RAGSystem {
  private fieldMappings: FieldMapping[] = []
  private isInitialized = false

  constructor() {
    this.initializeFieldMappings()
  }

  /**
   * Initialize without heavy ML dependencies
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }
    
    // Simple initialization without transformers
    this.isInitialized = true
  }

  /**
   * Check if RAG system is available (always true for lightweight version)
   */
  async isAvailable(): Promise<boolean> {
    return true
  }

  /**
   * Simple fuzzy string matching function
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim()
    const s2 = str2.toLowerCase().trim()
    
    // Exact match
    if (s1 === s2) return 1.0
    
    // Contains match
    if (s1.includes(s2) || s2.includes(s1)) return 0.8
    
    // Word overlap
    const words1 = s1.split(/\s+/)
    const words2 = s2.split(/\s+/)
    const overlap = words1.filter(w => words2.includes(w)).length
    const maxWords = Math.max(words1.length, words2.length)
    
    if (maxWords === 0) return 0
    return overlap / maxWords
  }

  /**
   * Find best field mapping using simple string similarity
   */
  private async findBestFieldMapping(
    inputText: string,
  ): Promise<{ fieldName: string; confidence: number; reasoning: string } | null> {
    let bestMatch: { fieldName: string; confidence: number; reasoning: string } | null = null
    let bestScore = 0

    for (const field of this.fieldMappings) {
      // Check against field name
      let score = this.calculateSimilarity(inputText, field.fieldName)
      let matchedAlias = field.fieldName
      
      // Check against aliases
      for (const alias of field.aliases) {
        const aliasScore = this.calculateSimilarity(inputText, alias)
        if (aliasScore > score) {
          score = aliasScore
          matchedAlias = alias
        }
      }

      if (score > bestScore && score > 0.3) { // Minimum threshold
        bestScore = score
        bestMatch = {
          fieldName: field.fieldName,
          confidence: score,
          reasoning: `Matched "${inputText}" to "${matchedAlias}" with ${(score * 100).toFixed(1)}% confidence`
        }
      }
    }

    return bestMatch
  }

  /**
   * Initialize field mappings for nanopore sequencing
   */
  private initializeFieldMappings(): void {
    this.fieldMappings = [
      {
        fieldName: 'sampleName',
        aliases: ['sample name', 'sample id', 'sample identifier', 'id', 'name'],
        description: 'Unique sample identifier',
        dataType: 'string',
        required: true,
        examples: ['SAMPLE001', 'DNA_Sample_1', 'RNA-001'],
      },
      {
        fieldName: 'submitterName',
        aliases: ['submitter', 'submitted by', 'contact name', 'researcher', 'pi'],
        description: 'Name of person submitting sample',
        dataType: 'string',
        required: true,
        examples: ['John Doe', 'Dr. Smith', 'Jane Wilson'],
      },
      {
        fieldName: 'submitterEmail',
        aliases: ['email', 'contact email', 'e-mail', 'contact'],
        description: 'Contact email address',
        dataType: 'string',
        required: true,
        validation: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        examples: ['john.doe@university.edu', 'researcher@lab.org'],
      },
      {
        fieldName: 'concentration',
        aliases: ['conc', 'concentration', 'ng/ul', 'amount'],
        description: 'Sample concentration in ng/μL',
        dataType: 'string',
        required: false,
        validation: /^\d+(\.\d+)?\s*(ng\/ul|ng\/ml|ug\/ml)?$/i,
        examples: ['50 ng/μL', '25.5', '100 ng/ul'],
      },
      {
        fieldName: 'volume',
        aliases: ['vol', 'volume', 'ul', 'ml'],
        description: 'Sample volume in μL',
        dataType: 'string',
        required: false,
        validation: /^\d+(\.\d+)?\s*(ul|ml)?$/i,
        examples: ['20 μL', '50', '25 ul'],
      },
      {
        fieldName: 'priority',
        aliases: ['priority', 'urgency', 'turnaround', 'rush', 'standard'],
        description: 'Processing priority level',
        dataType: 'select',
        required: false,
        examples: ['Standard', 'High', 'Rush', 'Urgent'],
      },
      // Add more field mappings as needed...
    ]
  }

  /**
   * Validate field value against field requirements
   */
  private validateFieldValue(fieldName: string, value: string): { isValid: boolean; issues: string[] } {
    const field = this.fieldMappings.find(f => f.fieldName === fieldName)
    if (!field) {
      return { isValid: false, issues: ['Unknown field'] }
    }

    const issues: string[] = []

    // Check if required field is empty
    if (field.required && (!value || value.trim() === '')) {
      issues.push('Required field is empty')
    }

    // Validate against regex if provided
    if (field.validation && value && !field.validation.test(value)) {
      issues.push('Value does not match expected format')
    }

    // Type-specific validation
    switch (field.dataType) {
      case 'number':
        if (value && isNaN(Number(value))) {
          issues.push('Value is not a valid number')
        }
        break
      case 'boolean':
        if (value && !['true', 'false', 'yes', 'no', '1', '0'].includes(value.toLowerCase())) {
          issues.push('Value is not a valid boolean')
        }
        break
    }

    return { isValid: issues.length === 0, issues }
  }

  /**
   * Process extracted text using simplified pattern matching
   */
  async processExtractedText(
    extractedPairs: { key: string; value: string }[],
  ): Promise<RAGResult> {
    const startTime = Date.now()

    if (!this.isInitialized) {
      await this.initialize()
    }

    const matches: SemanticMatch[] = []
    const validationIssues: string[] = []

    for (const pair of extractedPairs) {
      try {
        const mapping = await this.findBestFieldMapping(pair.key)

        if (mapping) {
          const validation = this.validateFieldValue(mapping.fieldName, pair.value)

          matches.push({
            fieldName: mapping.fieldName,
            extractedValue: pair.value,
            confidence: mapping.confidence,
            reasoning: mapping.reasoning,
            validationPassed: validation.isValid,
            issues: validation.issues,
          })

          if (!validation.isValid) {
            validationIssues.push(
              `${mapping.fieldName}: ${validation.issues.join(', ')}`,
            )
          }
        }
      } catch (error) {
        validationIssues.push(
          `Error processing "${pair.key}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    const totalConfidence = matches.reduce((sum, match) => sum + match.confidence, 0)
    const overallConfidence = matches.length > 0 ? totalConfidence / matches.length : 0

    return {
      matches,
      overallConfidence,
      totalFields: this.fieldMappings.filter(f => f.required).length,
      extractedFields: matches.filter(m => m.validationPassed).length,
      validationIssues,
      processingTime: Date.now() - startTime,
    }
  }

  /**
   * Enhance existing extraction results
   */
  async enhanceExtractionResults(extractedData: Record<string, any>): Promise<{
    enhancedData: Record<string, any>
    ragInsights: RAGResult
    recommendations: string[]
  }> {
    const pairs = Object.entries(extractedData)
      .filter(([_, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => ({ key, value: String(value) }))

    const ragResult = await this.processExtractedText(pairs)
    const recommendations: string[] = []

    // Check for missing required fields
    const extractedFieldNames = ragResult.matches.map(m => m.fieldName)
    const missingRequired = this.fieldMappings
      .filter(f => f.required && !extractedFieldNames.includes(f.fieldName))
      .map(f => f.fieldName)

    if (missingRequired.length > 0) {
      recommendations.push(`Missing required fields: ${missingRequired.join(', ')}`)
    }

    // Check for low confidence matches
    const lowConfidenceMatches = ragResult.matches.filter(m => m.confidence < 0.7)
    if (lowConfidenceMatches.length > 0) {
      recommendations.push(
        `Low confidence matches: ${lowConfidenceMatches.map(m => m.fieldName).join(', ')}`
      )
    }

    // Enhanced data from RAG matches
    const enhancedData = { ...extractedData }
    for (const match of ragResult.matches) {
      if (match.validationPassed && match.confidence > 0.6) {
        enhancedData[match.fieldName] = match.extractedValue
      }
    }

    return {
      enhancedData,
      ragInsights: ragResult,
      recommendations,
    }
  }

  /**
   * Enhance extraction with simplified approach
   */
  async enhanceExtraction(formData: any): Promise<{
    enhancedData: any
    ragInsights: RAGResult
    recommendations: string[]
  }> {
    return this.enhanceExtractionResults(formData)
  }
}

export const ragService = new RAGSystem()
export type { FieldMapping, SemanticMatch }
