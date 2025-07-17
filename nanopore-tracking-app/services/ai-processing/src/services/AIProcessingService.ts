import { PDFProcessingService } from './PDFProcessingService'
import { AIService } from './AIService'
import { VectorService } from './VectorService'
import { 
  ProcessingJob, 
  ProcessingResult, 
  ExtractedField, 
  ProcessingStatus, 
  ProcessingType,
  ConfidenceLevel,
  PDFProcessingRequest,
  AIExtractionRequest,
  VectorSearchRequest,
  FormValidationRequest,
  ValidationResult,
  RAGRequest,
  RAGResult
} from '../types/processing'

export class AIProcessingService {
  private pdfService: PDFProcessingService
  private aiService: AIService
  private vectorService: VectorService

  constructor(
    ollamaUrl: string = 'http://localhost:11434',
    qdrantUrl: string = 'http://localhost:6333'
  ) {
    this.pdfService = new PDFProcessingService()
    this.aiService = new AIService(ollamaUrl)
    this.vectorService = new VectorService(qdrantUrl)
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    try {
      await this.vectorService.initialize()
      console.log('AI Processing Service initialized successfully')
    } catch (error) {
      throw new Error(`Failed to initialize AI Processing Service: ${error}`)
    }
  }

  /**
   * Process PDF file with full pipeline
   */
  async processPDF(request: PDFProcessingRequest): Promise<ProcessingResult> {
    const startTime = Date.now()

    try {
      // Step 1: Extract text from PDF
      const pdfData = await this.pdfService.extractTextFromPDF(request.file.buffer)
      
      // Step 2: Extract structured data using regex patterns
      const regexFields = this.pdfService.extractNanoporeFormFields(pdfData.text)
      
      // Step 3: Use AI to extract additional data
      const aiFields = await this.aiService.extractDataFromText({
        text: pdfData.text,
        sampleId: request.sampleId,
        extractionPrompt: 'Extract any missing fields from this nanopore sample form',
        fields: this.getMissingFields(regexFields)
      })

      // Step 4: Combine and deduplicate fields
      const combinedFields = this.combineExtractedFields(regexFields, aiFields.extractedFields)
      
      // Step 5: Validate extracted data
      const validation = this.pdfService.validateExtractedFields(combinedFields)
      
      // Step 6: Generate embeddings and store in vector database
      const embeddings = await this.aiService.generateEmbeddings(pdfData.text)
      const vectorId = await this.vectorService.storeEmbeddings(embeddings, {
        text: pdfData.text,
        extractedFields: combinedFields,
        metadata: {
          fileName: request.file.originalname,
          fileSize: request.file.size,
          mimeType: request.file.mimetype,
          sampleId: request.sampleId,
          processingType: request.processingType,
          pages: pdfData.pages,
          ...request.metadata
        }
      })

      const processingTime = Date.now() - startTime
      const confidence = this.calculateOverallConfidence(combinedFields)

      return {
        extractedFields: combinedFields,
        confidence,
        confidenceLevel: this.getConfidenceLevel(confidence),
        processingTime,
        pagesProcessed: pdfData.pages,
        validationScore: validation.isValid ? 1.0 : 0.5,
        suggestions: validation.warnings,
        warnings: validation.errors
      }
    } catch (error) {
      throw new Error(`PDF processing failed: ${error}`)
    }
  }

  /**
   * Extract data from text using AI
   */
  async extractDataFromText(request: AIExtractionRequest): Promise<{
    extractedFields: ExtractedField[]
    confidence: number
    processingTime: number
    model: string
  }> {
    return await this.aiService.extractDataFromText(request)
  }

  /**
   * Search for similar documents using vector similarity
   */
  async searchSimilarDocuments(
    query: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<any[]> {
    try {
      // Generate embeddings for the query
      const queryEmbeddings = await this.aiService.generateEmbeddings(query)
      
      // Search in vector database
      const results = await this.vectorService.searchByText(query, queryEmbeddings, {
        query: queryEmbeddings,
        limit,
        threshold
      })

      return results
    } catch (error) {
      throw new Error(`Similar document search failed: ${error}`)
    }
  }

  /**
   * Validate form data using AI
   */
  async validateFormData(request: FormValidationRequest): Promise<ValidationResult> {
    try {
      // Use AI to validate the extracted fields
      const aiValidation = await this.aiService.validateExtractedData(request.extractedFields)
      
      // Combine with rule-based validation
      const ruleValidation = this.validateAgainstRules(request.extractedFields, request.validationRules)
      
      return {
        isValid: aiValidation.isValid && ruleValidation.isValid,
        score: (aiValidation.confidence + ruleValidation.score) / 2,
        errors: [...aiValidation.errors, ...ruleValidation.errors],
        warnings: [...aiValidation.suggestions, ...ruleValidation.warnings],
        suggestions: ruleValidation.suggestions
      }
    } catch (error) {
      throw new Error(`Form validation failed: ${error}`)
    }
  }

  /**
   * Answer questions using RAG (Retrieval Augmented Generation)
   */
  async answerQuestion(request: RAGRequest): Promise<RAGResult> {
    try {
      // Search for relevant documents
      const queryEmbeddings = await this.aiService.generateEmbeddings(request.query)
      const searchResults = await this.vectorService.searchByText(request.query, queryEmbeddings, {
        query: queryEmbeddings,
        limit: request.maxResults,
        threshold: request.threshold
      })

      // Build context from search results
      const context = this.buildContextFromSearchResults(searchResults, request.context)
      
      // Generate answer using AI
      const answer = await this.aiService.answerQuestion(request.query, context)
      
      return {
        answer: answer.answer,
        confidence: answer.confidence,
        sources: searchResults.map(result => result.payload.text || result.payload.title || 'Unknown source'),
        processingTime: answer.processingTime
      }
    } catch (error) {
      throw new Error(`RAG question answering failed: ${error}`)
    }
  }

  /**
   * Get processing statistics
   */
  async getStatistics(): Promise<{
    totalDocuments: number
    averageConfidence: number
    processingSuccessRate: number
    vectorDatabaseStats: any
    aiServiceHealth: boolean
    vectorServiceHealth: boolean
  }> {
    try {
      const vectorStats = await this.vectorService.getCollectionStats()
      const aiHealth = await this.aiService.checkHealth()
      const vectorHealth = await this.vectorService.checkHealth()

      return {
        totalDocuments: vectorStats.totalPoints,
        averageConfidence: 0.75, // This would be calculated from actual data
        processingSuccessRate: 0.95, // This would be calculated from actual data
        vectorDatabaseStats: vectorStats,
        aiServiceHealth: aiHealth,
        vectorServiceHealth: vectorHealth
      }
    } catch (error) {
      throw new Error(`Failed to get statistics: ${error}`)
    }
  }

  /**
   * Health check for all services
   */
  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy'
    services: {
      ai: boolean
      vector: boolean
      pdf: boolean
    }
    details: string[]
  }> {
    const details: string[] = []
    const services = {
      ai: false,
      vector: false,
      pdf: true // PDF service is local, always healthy
    }

    try {
      services.ai = await this.aiService.checkHealth()
      if (!services.ai) {
        details.push('AI service (Ollama) is not responding')
      }
    } catch (error) {
      details.push(`AI service error: ${error}`)
    }

    try {
      services.vector = await this.vectorService.checkHealth()
      if (!services.vector) {
        details.push('Vector database (Qdrant) is not responding')
      }
    } catch (error) {
      details.push(`Vector service error: ${error}`)
    }

    const status = services.ai && services.vector ? 'healthy' : 'unhealthy'

    return {
      status,
      services,
      details
    }
  }

  /**
   * Get missing fields from extracted data
   */
  private getMissingFields(extractedFields: ExtractedField[]): string[] {
    const expectedFields = [
      'sample_name',
      'project_id',
      'submitter_name',
      'submitter_email',
      'lab_name',
      'sample_type',
      'sample_buffer',
      'concentration',
      'volume',
      'total_amount',
      'flow_cell_type',
      'flow_cell_count',
      'priority',
      'chart_field'
    ]

    const extractedFieldNames = extractedFields.map(f => f.fieldName)
    return expectedFields.filter(field => !extractedFieldNames.includes(field))
  }

  /**
   * Combine and deduplicate extracted fields
   */
  private combineExtractedFields(
    regexFields: ExtractedField[],
    aiFields: ExtractedField[]
  ): ExtractedField[] {
    const combined: Record<string, ExtractedField> = {}

    // Add regex fields first
    for (const field of regexFields) {
      combined[field.fieldName] = field
    }

    // Add AI fields, preferring higher confidence
    for (const field of aiFields) {
      if (!combined[field.fieldName] || field.confidence > combined[field.fieldName].confidence) {
        combined[field.fieldName] = field
      }
    }

    return Object.values(combined)
  }

  /**
   * Calculate overall confidence from extracted fields
   */
  private calculateOverallConfidence(fields: ExtractedField[]): number {
    if (fields.length === 0) return 0

    const totalConfidence = fields.reduce((sum, field) => sum + field.confidence, 0)
    return totalConfidence / fields.length
  }

  /**
   * Get confidence level from confidence score
   */
  private getConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence >= 0.9) return ConfidenceLevel.VERY_HIGH
    if (confidence >= 0.7) return ConfidenceLevel.HIGH
    if (confidence >= 0.5) return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW
  }

  /**
   * Validate extracted fields against rules
   */
  private validateAgainstRules(
    fields: ExtractedField[],
    rules: any[]
  ): {
    isValid: boolean
    score: number
    errors: string[]
    warnings: string[]
    suggestions: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []
    let validFields = 0
    let totalFields = 0

    for (const rule of rules) {
      const field = fields.find(f => f.fieldName === rule.fieldName)
      totalFields++

      if (rule.required && (!field || !field.value)) {
        errors.push(`Required field '${rule.fieldName}' is missing`)
        continue
      }

      if (field && field.value) {
        validFields++

        // Validate field type
        if (rule.type === 'email') {
          const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
          if (!emailPattern.test(field.value)) {
            errors.push(`Invalid email format for '${rule.fieldName}': ${field.value}`)
          }
        }

        if (rule.type === 'number') {
          const num = Number(field.value)
          if (isNaN(num)) {
            errors.push(`Invalid number format for '${rule.fieldName}': ${field.value}`)
          } else {
            if (rule.minValue !== undefined && num < rule.minValue) {
              errors.push(`Value for '${rule.fieldName}' is below minimum: ${num} < ${rule.minValue}`)
            }
            if (rule.maxValue !== undefined && num > rule.maxValue) {
              errors.push(`Value for '${rule.fieldName}' is above maximum: ${num} > ${rule.maxValue}`)
            }
          }
        }

        if (rule.type === 'string') {
          if (rule.minLength !== undefined && field.value.length < rule.minLength) {
            warnings.push(`Field '${rule.fieldName}' is shorter than recommended: ${field.value.length} < ${rule.minLength}`)
          }
          if (rule.maxLength !== undefined && field.value.length > rule.maxLength) {
            warnings.push(`Field '${rule.fieldName}' is longer than recommended: ${field.value.length} > ${rule.maxLength}`)
          }
        }

        if (rule.allowedValues && !rule.allowedValues.includes(field.value)) {
          errors.push(`Invalid value for '${rule.fieldName}': ${field.value}. Allowed values: ${rule.allowedValues.join(', ')}`)
        }

        if (rule.pattern) {
          const regex = new RegExp(rule.pattern)
          if (!regex.test(field.value)) {
            errors.push(`Field '${rule.fieldName}' does not match required pattern: ${field.value}`)
          }
        }
      }
    }

    const score = totalFields > 0 ? validFields / totalFields : 0
    const isValid = errors.length === 0

    if (score < 0.8) {
      suggestions.push('Consider reviewing the extracted data for accuracy')
    }

    return {
      isValid,
      score,
      errors,
      warnings,
      suggestions
    }
  }

  /**
   * Build context from search results
   */
  private buildContextFromSearchResults(searchResults: any[], additionalContext?: string): string {
    const contexts = searchResults.map(result => {
      if (result.payload.text) {
        return result.payload.text
      }
      if (result.payload.title) {
        return result.payload.title
      }
      return ''
    }).filter(text => text.length > 0)

    let context = contexts.join('\n\n')
    
    if (additionalContext) {
      context = `${additionalContext}\n\n${context}`
    }

    return context
  }
}