import { pipeline, env } from '@xenova/transformers'

// Configure transformers to use local models
env.allowLocalModels = false
env.useBrowserCache = true

export interface FieldMapping {
  fieldName: string
  aliases: string[]
  description: string
  dataType: 'string' | 'number' | 'boolean' | 'email' | 'select'
  required: boolean
  validation?: RegExp
  examples: string[]
}

export interface VectorEmbedding {
  text: string
  embedding: number[]
  metadata: {
    fieldName: string
    context: string
    confidence: number
  }
}

export interface SemanticMatch {
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
  private embedder: any = null
  private isInitialized = false
  private fieldMappings: FieldMapping[] = []
  private fieldEmbeddings: VectorEmbedding[] = []

  constructor() {
    this.initializeFieldMappings()
  }

  /**
   * Initialize the embedding model
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      // Use a lightweight sentence transformer model
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
      )

      // Generate embeddings for all field mappings
      await this.generateFieldEmbeddings()

      this.isInitialized = true
    } catch (error) {
      console.error('Failed to initialize RAG system:', error)
      throw new Error(
        `RAG initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Check if RAG system is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize()
      }
      return this.embedder !== null
    } catch {
      return false
    }
  }

  /**
   * Initialize comprehensive field mappings for Nanopore forms
   */
  private initializeFieldMappings(): void {
    this.fieldMappings = [
      {
        fieldName: 'sampleName',
        aliases: [
          'sample name',
          'sample id',
          'specimen name',
          'sample identifier',
          'sample code',
        ],
        description: 'Unique identifier for the biological sample',
        dataType: 'string',
        required: true,
        validation: /^[\w.\-]+$/,
        examples: [
          'Human_DNA_Sample_001',
          'Plant_Genome_002',
          'Bacterial_Culture_003',
        ],
      },
      {
        fieldName: 'submitterName',
        aliases: [
          'submitter',
          'researcher name',
          'principal investigator',
          'contact person',
          'scientist name',
        ],
        description: 'Name of the person submitting the sample',
        dataType: 'string',
        required: true,
        examples: ['Dr. Sarah Johnson', 'Michael Chen', 'Prof. Lisa Rodriguez'],
      },
      {
        fieldName: 'submitterEmail',
        aliases: [
          'email',
          'contact email',
          'researcher email',
          'submitter email address',
        ],
        description: 'Email address of the submitter',
        dataType: 'email',
        required: true,
        validation: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        examples: ['sarah.johnson@unc.edu', 'michael.chen@university.edu'],
      },
      {
        fieldName: 'labName',
        aliases: [
          'lab',
          'laboratory',
          'research group',
          'lab name',
          'department',
        ],
        description: 'Name of the laboratory or research group',
        dataType: 'string',
        required: false,
        examples: [
          'Johnson Lab',
          'Chen Laboratory',
          'Molecular Biology Department',
        ],
      },
      {
        fieldName: 'projectName',
        aliases: [
          'project',
          'project name',
          'study name',
          'research project',
          'grant number',
        ],
        description: 'Name or identifier of the research project',
        dataType: 'string',
        required: false,
        examples: [
          'HTSF-CJ-001',
          'Cancer Genomics Study',
          'Plant Diversity Project',
        ],
      },
      {
        fieldName: 'sequencingType',
        aliases: [
          'sequencing type',
          'nucleic acid type',
          'sample type',
          'material type',
        ],
        description: 'Type of nucleic acid to be sequenced',
        dataType: 'select',
        required: true,
        examples: ['DNA', 'RNA', 'cDNA', 'Genomic DNA', 'Total RNA'],
      },
      {
        fieldName: 'sampleType',
        aliases: [
          'sample type',
          'specimen type',
          'biological material',
          'source material',
        ],
        description: 'Type of biological sample',
        dataType: 'select',
        required: true,
        examples: [
          'Genomic DNA',
          'Total RNA',
          'Plasmid DNA',
          'PCR Product',
          'cDNA',
        ],
      },
      {
        fieldName: 'libraryType',
        aliases: [
          'library type',
          'library prep',
          'library preparation',
          'sequencing library',
        ],
        description: 'Type of sequencing library preparation',
        dataType: 'select',
        required: true,
        examples: ['Ligation', 'Rapid', 'PCR-free', 'Amplicon', 'Direct RNA'],
      },
      {
        fieldName: 'flowCellType',
        aliases: [
          'flow cell',
          'flowcell type',
          'sequencing platform',
          'nanopore device',
        ],
        description: 'Type of nanopore flow cell to use',
        dataType: 'select',
        required: true,
        examples: [
          'MinION',
          'GridION',
          'PromethION',
          'Flongle',
          'R9.4.1',
          'R10.4.1',
        ],
      },
      {
        fieldName: 'concentration',
        aliases: [
          'concentration',
          'dna concentration',
          'rna concentration',
          'conc',
          'ng/ul',
        ],
        description: 'Concentration of the sample in ng/μL',
        dataType: 'string',
        required: false,
        validation: /^\d+(\.\d+)?\s*(ng\/μl|ng\/ul|ng\/µl|μg\/μl|ug\/ul)$/i,
        examples: ['50 ng/μL', '100.5 ng/ul', '25.3 ng/μL'],
      },
      {
        fieldName: 'volume',
        aliases: ['volume', 'sample volume', 'total volume', 'vol', 'μL', 'ul'],
        description: 'Volume of the sample in μL',
        dataType: 'string',
        required: false,
        validation: /^\d+(\.\d+)?\s*(μl|ul|µl|ml)$/i,
        examples: ['50 μL', '100 ul', '25.5 μL'],
      },
      {
        fieldName: 'purity',
        aliases: [
          'purity',
          '260/280',
          '260/230',
          'a260/a280',
          'ratio',
          'quality',
        ],
        description: 'Sample purity ratios (260/280, 260/230)',
        dataType: 'string',
        required: false,
        validation: /^\d+(\.\d+)?(\/\d+(\.\d+)?)?$/,
        examples: ['1.8', '1.9/2.1', '260/280: 1.8'],
      },
      {
        fieldName: 'fragmentSize',
        aliases: [
          'fragment size',
          'size',
          'length',
          'bp',
          'base pairs',
          'molecular weight',
        ],
        description: 'Expected fragment size in base pairs',
        dataType: 'string',
        required: false,
        validation: /^\d+(\.\d+)?\s*(bp|kb|mb|kbp|mbp)?$/i,
        examples: ['10 kb', '5000 bp', '15-20 kb'],
      },
      {
        fieldName: 'priority',
        aliases: [
          'priority',
          'urgency',
          'turnaround time',
          'rush',
          'standard',
          'urgent',
        ],
        description: 'Processing priority level',
        dataType: 'select',
        required: false,
        examples: ['Standard', 'High', 'Rush', 'Urgent', 'Low'],
      },
      {
        fieldName: 'basecalling',
        aliases: [
          'basecalling',
          'base calling',
          'basecaller',
          'guppy',
          'dorado',
        ],
        description: 'Basecalling method or software',
        dataType: 'select',
        required: false,
        examples: ['Standard', 'High Accuracy', 'Fast', 'Guppy', 'Dorado'],
      },
      {
        fieldName: 'demultiplexing',
        aliases: [
          'demultiplexing',
          'demux',
          'barcoding',
          'barcode',
          'multiplexing',
        ],
        description: 'Whether demultiplexing is required',
        dataType: 'boolean',
        required: false,
        examples: ['Yes', 'No', 'True', 'False', 'Required'],
      },
      {
        fieldName: 'referenceGenome',
        aliases: [
          'reference genome',
          'reference',
          'genome',
          'organism',
          'species',
        ],
        description: 'Reference genome for analysis',
        dataType: 'string',
        required: false,
        examples: ['Human (hg38)', 'Mouse (mm10)', 'E. coli', 'Arabidopsis'],
      },
      {
        fieldName: 'analysisType',
        aliases: [
          'analysis type',
          'analysis',
          'bioinformatics',
          'pipeline',
          'workflow',
        ],
        description: 'Type of bioinformatics analysis required',
        dataType: 'string',
        required: false,
        examples: [
          'Genome Assembly',
          'Variant Calling',
          'RNA-seq',
          'Metagenomics',
        ],
      },
      {
        fieldName: 'dataDelivery',
        aliases: [
          'data delivery',
          'delivery method',
          'output format',
          'results format',
        ],
        description: 'How results should be delivered',
        dataType: 'select',
        required: false,
        examples: ['Raw Data', 'Processed', 'FASTQ', 'BAM', 'VCF'],
      },
    ]
  }

  /**
   * Generate embeddings for all field mappings
   */
  private async generateFieldEmbeddings(): Promise<void> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized')
    }

    this.fieldEmbeddings = []

    for (const field of this.fieldMappings) {
      // Create comprehensive text representations for each field
      const textVariations = [
        field.fieldName,
        ...field.aliases,
        field.description,
        ...field.examples,
      ]

      for (const text of textVariations) {
        try {
          const embedding = await this.generateEmbedding(text)
          this.fieldEmbeddings.push({
            text,
            embedding,
            metadata: {
              fieldName: field.fieldName,
              context: 'field_mapping',
              confidence: 1.0,
            },
          })
        } catch (error) {
          console.warn(`Failed to generate embedding for "${text}":`, error)
        }
      }
    }
  }

  /**
   * Generate embedding for a text string
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized')
    }

    try {
      const output = await this.embedder(text, {
        pooling: 'mean',
        normalize: true,
      })
      return Array.from(output.data)
    } catch (error) {
      throw new Error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (const [i, element] of vecA.entries()) {
      dotProduct += element * vecB[i]
      normA += element * element
      normB += vecB[i] * vecB[i]
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Find the best field mapping for a given text using semantic similarity
   */
  private async findBestFieldMapping(
    text: string,
    threshold = 0.6,
  ): Promise<{
    fieldName: string
    confidence: number
    reasoning: string
  } | null> {
    try {
      const queryEmbedding = await this.generateEmbedding(text)
      let bestMatch = { fieldName: '', confidence: 0, reasoning: '' }

      for (const fieldEmbedding of this.fieldEmbeddings) {
        const similarity = this.cosineSimilarity(
          queryEmbedding,
          fieldEmbedding.embedding,
        )

        if (similarity > bestMatch.confidence) {
          bestMatch = {
            fieldName: fieldEmbedding.metadata.fieldName,
            confidence: similarity,
            reasoning: `Matched with "${fieldEmbedding.text}" (similarity: ${similarity.toFixed(3)})`,
          }
        }
      }

      return bestMatch.confidence >= threshold ? bestMatch : null
    } catch (error) {
      console.warn(`Failed to find field mapping for "${text}":`, error)
      return null
    }
  }

  /**
   * Validate extracted value against field requirements
   */
  private validateFieldValue(
    fieldName: string,
    value: string,
  ): {
    isValid: boolean
    issues: string[]
  } {
    const field = this.fieldMappings.find((f) => f.fieldName === fieldName)
    if (!field) {
      return { isValid: false, issues: ['Unknown field'] }
    }

    const issues: string[] = []

    // Check if required field is empty
    if (field.required && (!value || value.trim() === '')) {
      issues.push('Required field is empty')
    }

    // Validate format if regex is provided
    if (field.validation && value && !field.validation.test(value)) {
      issues.push(`Value does not match expected format for ${field.dataType}`)
    }

    // Type-specific validation
    switch (field.dataType) {
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          issues.push('Invalid email format')
        }
        break
      case 'number':
        if (value && Number.isNaN(Number(value))) {
          issues.push('Value is not a valid number')
        }
        break
      case 'boolean':
        if (
          value &&
          !['true', 'false', 'yes', 'no', '1', '0'].includes(
            value.toLowerCase(),
          )
        ) {
          issues.push('Value is not a valid boolean')
        }
        break
    }

    return { isValid: issues.length === 0, issues }
  }

  /**
   * Process extracted text using RAG for intelligent field mapping
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
        // Find the best field mapping using semantic similarity
        const mapping = await this.findBestFieldMapping(pair.key)

        if (mapping) {
          // Validate the extracted value
          const validation = this.validateFieldValue(
            mapping.fieldName,
            pair.value,
          )

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
        } else {
          // No good mapping found
          validationIssues.push(
            `Could not map field "${pair.key}" to any known field`,
          )
        }
      } catch (error) {
        validationIssues.push(
          `Error processing "${pair.key}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    // Calculate overall confidence
    const totalConfidence = matches.reduce(
      (sum, match) => sum + match.confidence,
      0,
    )
    const overallConfidence =
      matches.length > 0 ? totalConfidence / matches.length : 0

    return {
      matches,
      overallConfidence,
      totalFields: this.fieldMappings.filter((f) => f.required).length,
      extractedFields: matches.filter((m) => m.validationPassed).length,
      validationIssues,
      processingTime: Date.now() - startTime,
    }
  }

  /**
   * Enhance existing extraction results with RAG insights
   */
  async enhanceExtractionResults(extractedData: Record<string, any>): Promise<{
    enhancedData: Record<string, any>
    ragInsights: RAGResult
    recommendations: string[]
  }> {
    // Convert extracted data to key-value pairs
    const pairs = Object.entries(extractedData)
      .filter(
        ([_, value]) => value !== null && value !== undefined && value !== '',
      )
      .map(([key, value]) => ({ key, value: String(value) }))

    // Process with RAG
    const ragResult = await this.processExtractedText(pairs)

    // Generate recommendations
    const recommendations: string[] = []

    // Check for missing required fields
    const extractedFieldNames = ragResult.matches.map((m) => m.fieldName)
    const missingRequired = this.fieldMappings
      .filter((f) => f.required && !extractedFieldNames.includes(f.fieldName))
      .map((f) => f.fieldName)

    if (missingRequired.length > 0) {
      recommendations.push(
        `Missing required fields: ${missingRequired.join(', ')}`,
      )
    }

    // Check for low confidence matches
    const lowConfidenceMatches = ragResult.matches.filter(
      (m) => m.confidence < 0.7,
    )
    if (lowConfidenceMatches.length > 0) {
      recommendations.push(
        `Low confidence matches found for: ${lowConfidenceMatches.map((m) => m.fieldName).join(', ')}`,
      )
    }

    // Check for validation failures
    const failedValidation = ragResult.matches.filter(
      (m) => !m.validationPassed,
    )
    if (failedValidation.length > 0) {
      recommendations.push(
        `Validation failed for: ${failedValidation.map((m) => m.fieldName).join(', ')}`,
      )
    }

    // Create enhanced data with RAG mappings
    const enhancedData = { ...extractedData }
    for (const match of ragResult.matches) {
      if (match.validationPassed && match.confidence > 0.7) {
        enhancedData[match.fieldName] = match.extractedValue
      }
    }

    return {
      enhancedData,
      ragInsights: ragResult,
      recommendations,
    }
  }
}

// Export singleton instance
export const ragSystem = new RAGSystem()

// Export service interface
export const ragService = {
  async isAvailable(): Promise<boolean> {
    return await ragSystem.isAvailable()
  },

  async enhanceExtraction(extractedData: Record<string, any>) {
    return await ragSystem.enhanceExtractionResults(extractedData)
  },

  async processKeyValuePairs(
    pairs: { key: string; value: string }[],
  ): Promise<RAGResult> {
    return await ragSystem.processExtractedText(pairs)
  },
}
