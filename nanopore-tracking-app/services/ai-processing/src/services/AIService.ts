import axios from 'axios'
import { ExtractedField, ConfidenceLevel, AIExtractionRequest } from '../types/processing'

export class AIService {
  private ollamaUrl: string
  private defaultModel: string

  constructor(ollamaUrl: string = 'http://localhost:11434', defaultModel: string = 'llama2') {
    this.ollamaUrl = ollamaUrl
    this.defaultModel = defaultModel
  }

  /**
   * Extract structured data from text using AI
   */
  async extractDataFromText(request: AIExtractionRequest): Promise<{
    extractedFields: ExtractedField[]
    confidence: number
    processingTime: number
    model: string
  }> {
    const startTime = Date.now()

    try {
      const prompt = this.buildExtractionPrompt(request.text, request.extractionPrompt, request.fields)
      
      const response = await this.callOllama(prompt, {
        model: this.defaultModel,
        temperature: 0.1,
        max_tokens: 1000
      })

      const extractedFields = this.parseAIResponse(response.response, request.fields)
      const processingTime = Date.now() - startTime
      const confidence = this.calculateOverallConfidence(extractedFields)

      return {
        extractedFields,
        confidence,
        processingTime,
        model: this.defaultModel
      }
    } catch (error) {
      throw new Error(`AI extraction failed: ${error}`)
    }
  }

  /**
   * Generate embeddings for text content
   */
  async generateEmbeddings(text: string): Promise<number[]> {
    try {
      // For now, we'll use a simple embedding approach
      // In production, you'd want to use a proper embedding model
      const response = await this.callOllama(text, {
        model: 'llama2',
        temperature: 0,
        max_tokens: 1,
        embeddings: true
      })

      // Parse embeddings from response
      // This is a placeholder - actual implementation depends on Ollama's embedding format
      return this.parseEmbeddings(response)
    } catch (error) {
      throw new Error(`Failed to generate embeddings: ${error}`)
    }
  }

  /**
   * Validate extracted data using AI
   */
  async validateExtractedData(fields: ExtractedField[]): Promise<{
    isValid: boolean
    confidence: number
    errors: string[]
    suggestions: string[]
  }> {
    try {
      const validationPrompt = this.buildValidationPrompt(fields)
      
      const response = await this.callOllama(validationPrompt, {
        model: this.defaultModel,
        temperature: 0.1,
        max_tokens: 500
      })

      return this.parseValidationResponse(response.response)
    } catch (error) {
      throw new Error(`AI validation failed: ${error}`)
    }
  }

  /**
   * Answer questions using RAG (Retrieval Augmented Generation)
   */
  async answerQuestion(question: string, context: string): Promise<{
    answer: string
    confidence: number
    sources: string[]
    processingTime: number
  }> {
    const startTime = Date.now()

    try {
      const ragPrompt = this.buildRAGPrompt(question, context)
      
      const response = await this.callOllama(ragPrompt, {
        model: this.defaultModel,
        temperature: 0.2,
        max_tokens: 800
      })

      const processingTime = Date.now() - startTime
      const confidence = this.calculateAnswerConfidence(response.response)

      return {
        answer: response.response,
        confidence,
        sources: [context], // In a real RAG system, you'd return actual sources
        processingTime
      }
    } catch (error) {
      throw new Error(`RAG question answering failed: ${error}`)
    }
  }

  /**
   * Build extraction prompt for AI
   */
  private buildExtractionPrompt(text: string, customPrompt?: string, fields?: string[]): string {
    const defaultFields = [
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

    const targetFields = fields || defaultFields
    const prompt = customPrompt || 'Extract the following fields from this scientific document:'

    return `
${prompt}

Target fields: ${targetFields.join(', ')}

Document text:
${text}

Please extract the requested fields and return them in JSON format like this:
{
  "sample_name": "extracted value",
  "project_id": "extracted value",
  ...
}

If a field is not found, use null. Be as accurate as possible and maintain the original format of values.
`
  }

  /**
   * Build validation prompt for AI
   */
  private buildValidationPrompt(fields: ExtractedField[]): string {
    const fieldsText = fields.map(f => `${f.fieldName}: ${f.value}`).join('\n')

    return `
Please validate the following extracted data from a nanopore sample form:

${fieldsText}

Please check for:
1. Missing required fields
2. Invalid formats (email, numbers, etc.)
3. Logical inconsistencies
4. Data quality issues

Return your validation in JSON format:
{
  "isValid": true/false,
  "errors": ["error1", "error2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "confidence": 0.0-1.0
}
`
  }

  /**
   * Build RAG prompt for question answering
   */
  private buildRAGPrompt(question: string, context: string): string {
    return `
Based on the following context, please answer the question:

Context:
${context}

Question: ${question}

Please provide a clear, accurate answer based only on the information in the context. If the context doesn't contain enough information to answer the question, say so.
`
  }

  /**
   * Call Ollama API
   */
  private async callOllama(prompt: string, options: any = {}): Promise<any> {
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: options.model || this.defaultModel,
        prompt,
        temperature: options.temperature || 0.1,
        max_tokens: options.max_tokens || 1000,
        stream: false,
        ...options
      }, {
        timeout: 30000 // 30 second timeout
      })

      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Ollama API error: ${error.response?.data?.error || error.message}`)
      }
      throw error
    }
  }

  /**
   * Parse AI response into structured data
   */
  private parseAIResponse(response: string, expectedFields?: string[]): ExtractedField[] {
    const extractedFields: ExtractedField[] = []

    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        
        for (const [fieldName, value] of Object.entries(data)) {
          if (value !== null && value !== undefined && value !== '') {
            const confidence = this.calculateFieldConfidence(value as string, fieldName)
            
            extractedFields.push({
              fieldName,
              value: String(value),
              confidence,
              confidenceLevel: this.getConfidenceLevel(confidence),
              source: 'ai_extraction'
            })
          }
        }
      } else {
        // Fallback: try to extract key-value pairs from text
        const pairs = this.extractKeyValuePairs(response)
        for (const [fieldName, value] of pairs) {
          const confidence = this.calculateFieldConfidence(value, fieldName)
          
          extractedFields.push({
            fieldName,
            value,
            confidence,
            confidenceLevel: this.getConfidenceLevel(confidence),
            source: 'ai_extraction'
          })
        }
      }
    } catch (error) {
      console.warn('Failed to parse AI response as JSON, using fallback parsing')
      // Use fallback parsing
      const pairs = this.extractKeyValuePairs(response)
      for (const [fieldName, value] of pairs) {
        const confidence = this.calculateFieldConfidence(value, fieldName)
        
        extractedFields.push({
          fieldName,
          value,
          confidence,
          confidenceLevel: this.getConfidenceLevel(confidence),
          source: 'ai_extraction'
        })
      }
    }

    return extractedFields
  }

  /**
   * Extract key-value pairs from text response
   */
  private extractKeyValuePairs(text: string): Array<[string, string]> {
    const pairs: Array<[string, string]> = []
    const lines = text.split('\n')
    
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.+)$/)
      if (match) {
        const fieldName = match[1].trim().toLowerCase().replace(/\s+/g, '_')
        const value = match[2].trim()
        if (value && value !== 'null' && value !== 'undefined') {
          pairs.push([fieldName, value])
        }
      }
    }
    
    return pairs
  }

  /**
   * Parse validation response from AI
   */
  private parseValidationResponse(response: string): {
    isValid: boolean
    confidence: number
    errors: string[]
    suggestions: string[]
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        return {
          isValid: data.isValid || false,
          confidence: data.confidence || 0.5,
          errors: data.errors || [],
          suggestions: data.suggestions || []
        }
      }
    } catch (error) {
      console.warn('Failed to parse validation response as JSON')
    }

    // Fallback parsing
    const isValid = !response.toLowerCase().includes('invalid') && !response.toLowerCase().includes('error')
    const errors: string[] = []
    const suggestions: string[] = []

    if (response.toLowerCase().includes('suggestion')) {
      suggestions.push('Review extracted data for accuracy')
    }

    return {
      isValid,
      confidence: isValid ? 0.7 : 0.3,
      errors,
      suggestions
    }
  }

  /**
   * Parse embeddings from Ollama response
   */
  private parseEmbeddings(response: any): number[] {
    // This is a placeholder implementation
    // Actual implementation depends on Ollama's embedding format
    if (response.embeddings) {
      return response.embeddings
    }
    
    // Fallback: generate simple embeddings based on text length
    const text = response.response || ''
    const embedding = new Array(1536).fill(0)
    for (let i = 0; i < Math.min(text.length, 1536); i++) {
      embedding[i] = text.charCodeAt(i) / 255
    }
    return embedding
  }

  /**
   * Calculate confidence for a single field
   */
  private calculateFieldConfidence(value: string, fieldName: string): number {
    let confidence = 0.5 // Base confidence

    // Increase confidence for longer values
    if (value.length > 2) {
      confidence += 0.2
    }

    // Increase confidence for specific field types
    if (fieldName.includes('email') && value.includes('@')) {
      confidence += 0.3
    }

    if (fieldName.includes('name') && value.length > 2) {
      confidence += 0.2
    }

    if (fieldName.includes('id') && /^[A-Z0-9-]+$/.test(value)) {
      confidence += 0.3
    }

    return Math.min(confidence, 1.0)
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
   * Calculate confidence for answer
   */
  private calculateAnswerConfidence(answer: string): number {
    let confidence = 0.5

    // Increase confidence for longer, more detailed answers
    if (answer.length > 50) {
      confidence += 0.2
    }

    // Decrease confidence for uncertain language
    if (answer.toLowerCase().includes('i don\'t know') || answer.toLowerCase().includes('not sure')) {
      confidence -= 0.3
    }

    // Increase confidence for specific, factual answers
    if (answer.includes(':') || answer.includes('-')) {
      confidence += 0.1
    }

    return Math.max(0, Math.min(confidence, 1.0))
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
   * Check if Ollama service is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 5000 })
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get available models from Ollama
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`)
      return response.data.models?.map((model: any) => model.name) || []
    } catch (error) {
      console.warn('Failed to get available models from Ollama')
      return [this.defaultModel]
    }
  }
}