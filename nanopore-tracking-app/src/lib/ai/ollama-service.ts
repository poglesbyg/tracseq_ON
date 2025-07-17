export interface OllamaResponse {
  message: {
    content: string
  }
}

export interface OllamaRequest {
  model: string
  messages: Array<{
    role: string
    content: string
  }>
  stream?: boolean
}

export interface NanoporeFormData {
  sampleName?: string
  submitterName?: string
  submitterEmail?: string
  labName?: string
  projectName?: string
  sequencingType?: string
  sampleType?: string
  libraryType?: string
  flowCellType?: string
  concentration?: string
  volume?: string
  purity?: string
  fragmentSize?: string
  priority?: string
  basecalling?: string
  demultiplexing?: boolean
  referenceGenome?: string
  analysisType?: string
  dataDelivery?: string
  chartField?: string
  confidence?: number
  extractionMethod?: string
  issues?: string[]
}

import { aiConfig } from '../config'

class OllamaService {
  private baseUrl: string
  private defaultModel: string

  constructor() {
    this.baseUrl = aiConfig.ollamaHost
    this.defaultModel = aiConfig.defaultModel
  }

  async isAvailable(): Promise<boolean> {
    // First check if AI features are enabled
    if (!aiConfig.enabled) {
      return false
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      return response.ok
    } catch (error) {
      console.error('Ollama availability check failed:', error)
      return false
    }
  }

  async generateResponse(prompt: string, model: string = this.defaultModel): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          stream: false,
        } as OllamaRequest),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }

      const data: OllamaResponse = await response.json()
      return data.message.content
    } catch (error) {
      console.error('Ollama service error:', error)
      throw new Error('Failed to generate AI response')
    }
  }

  async extractFormData(text: string): Promise<NanoporeFormData> {
    const prompt = `
      You are a nanopore sequencing form data extraction specialist. 
      Extract relevant information from the following text and return ONLY a valid JSON object.
      
      Focus on these key fields for nanopore sequencing:
      - sampleName: The name/ID of the sample
      - submitterName: Name of the person submitting
      - submitterEmail: Email address
      - labName: Laboratory name
      - projectName: Project identifier
      - sequencingType: DNA, RNA, cDNA, etc.
      - sampleType: Genomic DNA, Total RNA, Amplicon, etc.
      - libraryType: Ligation, Rapid, PCR-free, etc.
      - flowCellType: MinION, GridION, PromethION, R9.4.1, R10.4.1, etc.
      - concentration: Sample concentration (ng/μL)
      - volume: Sample volume (μL)
      - purity: A260/280 ratio or similar
      - fragmentSize: Expected fragment size
      - priority: low, normal, high, urgent
      - basecalling: Standard, High Accuracy, Fast
      - demultiplexing: true/false
      - referenceGenome: Reference genome to use
      - analysisType: Assembly, variant calling, etc.
      - dataDelivery: Raw, Processed, FASTQ, etc.
      - chartField: Any chart/billing field mentioned
      
      Return confidence score (0-100) and list any issues found.
      
      Text to analyze:
      ${text}
      
      Return only valid JSON:
    `

    try {
      const response = await this.generateResponse(prompt)
      
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0])
        
        // Add metadata
        extracted.extractionMethod = 'llm'
        extracted.confidence = extracted.confidence || 75
        extracted.issues = extracted.issues || []
        
        return extracted
      }
      
      return {
        extractionMethod: 'llm',
        confidence: 0,
        issues: ['Failed to extract valid JSON from AI response']
      }
    } catch (error) {
      console.error('Form extraction error:', error)
      return {
        extractionMethod: 'llm',
        confidence: 0,
        issues: ['AI extraction failed: ' + (error instanceof Error ? error.message : 'Unknown error')]
      }
    }
  }

  async validateSampleData(data: NanoporeFormData): Promise<{
    isValid: boolean
    issues: string[]
    suggestions: string[]
  }> {
    const prompt = `
      You are a nanopore sequencing quality control specialist.
      Validate the following sample data and provide feedback:
      
      ${JSON.stringify(data, null, 2)}
      
      Check for:
      1. Required fields completeness
      2. Data format correctness
      3. Realistic values for concentration, volume, etc.
      4. Compatibility between sample type and flow cell
      5. Appropriate analysis type for sample
      
      Return JSON with:
      - isValid: boolean
      - issues: array of problems found
      - suggestions: array of recommendations
    `

    try {
      const response = await this.generateResponse(prompt)
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      return {
        isValid: true,
        issues: [],
        suggestions: []
      }
    } catch (error) {
      console.error('Validation error:', error)
      return {
        isValid: false,
        issues: ['Validation service unavailable'],
        suggestions: []
      }
    }
  }

  async suggestOptimalSettings(sampleData: NanoporeFormData): Promise<{
    flowCellType?: string
    libraryKit?: string
    basecallingModel?: string
    analysisType?: string
    runTime?: string
    reasoning: string
  }> {
    const prompt = `
      You are a nanopore sequencing optimization expert.
      Based on the sample data below, suggest optimal sequencing settings:
      
      ${JSON.stringify(sampleData, null, 2)}
      
      Consider:
      - Sample type and expected fragment size
      - Concentration and volume available
      - Desired analysis outcome
      - Cost-effectiveness
      
      Recommend:
      - Best flow cell type (MinION, GridION, PromethION)
      - Optimal library prep kit
      - Appropriate basecalling model
      - Suitable analysis pipeline
      - Estimated run time
      
      Return JSON with recommendations and reasoning.
    `

    try {
      const response = await this.generateResponse(prompt)
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      return {
        reasoning: 'Unable to generate recommendations at this time'
      }
    } catch (error) {
      console.error('Optimization error:', error)
      return {
        reasoning: 'Optimization service unavailable'
      }
    }
  }
}

export const aiService = new OllamaService() 