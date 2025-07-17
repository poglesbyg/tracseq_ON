import * as pdfParse from 'pdf-parse'
import { ExtractedField, ConfidenceLevel } from '../types/processing'

export class PDFProcessingService {
  /**
   * Extract text from PDF buffer
   */
  async extractTextFromPDF(pdfBuffer: Buffer): Promise<{
    text: string
    pages: number
    info: any
  }> {
    try {
      const data = await pdfParse(pdfBuffer)
      
      return {
        text: data.text,
        pages: data.numpages,
        info: data.info
      }
    } catch (error) {
      throw new Error(`Failed to extract text from PDF: ${error}`)
    }
  }

  /**
   * Extract text from PDF file
   */
  async extractTextFromFile(filePath: string): Promise<{
    text: string
    pages: number
    info: any
  }> {
    try {
      const fs = await import('fs/promises')
      const pdfBuffer = await fs.readFile(filePath)
      return await this.extractTextFromPDF(pdfBuffer)
    } catch (error) {
      throw new Error(`Failed to read PDF file: ${error}`)
    }
  }

  /**
   * Extract structured data from PDF text using regex patterns
   */
  extractStructuredData(text: string, patterns: Record<string, RegExp>): ExtractedField[] {
    const extractedFields: ExtractedField[] = []

    for (const [fieldName, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern)
      if (match) {
        const value = match[1] || match[0]
        const confidence = this.calculateConfidence(value, pattern)
        
        extractedFields.push({
          fieldName,
          value: value.trim(),
          confidence,
          confidenceLevel: this.getConfidenceLevel(confidence),
          source: 'pdf_regex',
          pageNumber: this.findPageNumber(text, value)
        })
      }
    }

    return extractedFields
  }

  /**
   * Extract common form fields from nanopore sample forms
   */
  extractNanoporeFormFields(text: string): ExtractedField[] {
    const patterns: Record<string, RegExp> = {
      sample_name: /(?:sample\s*name|sample\s*id)[:\s]*([^\n\r]+)/i,
      project_id: /(?:project\s*id|project\s*number)[:\s]*([^\n\r]+)/i,
      submitter_name: /(?:submitter|contact\s*person)[:\s]*([^\n\r]+)/i,
      submitter_email: /(?:email|e-mail)[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      lab_name: /(?:lab|laboratory)[:\s]*([^\n\r]+)/i,
      sample_type: /(?:sample\s*type|type)[:\s]*(dna|rna|protein|other)/i,
      sample_buffer: /(?:buffer|sample\s*buffer)[:\s]*([^\n\r]+)/i,
      concentration: /(?:concentration|conc)[:\s]*([0-9.]+)\s*(?:ng\/μl|ng/ul|ng\/ml|ng/ml)/i,
      volume: /(?:volume|vol)[:\s]*([0-9.]+)\s*(?:μl|ul|ml)/i,
      total_amount: /(?:total\s*amount|amount)[:\s]*([0-9.]+)\s*(?:ng|μg|ug)/i,
      flow_cell_type: /(?:flow\s*cell|flowcell)[:\s]*(FLO-MIN[0-9]+)/i,
      flow_cell_count: /(?:flow\s*cell\s*count|flowcells)[:\s]*([0-9]+)/i,
      priority: /(?:priority)[:\s]*(low|medium|high|urgent)/i,
      chart_field: /(?:chart\s*field|account)[:\s]*([A-Z]+-[0-9]+)/i
    }

    return this.extractStructuredData(text, patterns)
  }

  /**
   * Find the page number where a value appears
   */
  private findPageNumber(text: string, value: string): number | undefined {
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(value)) {
        // Estimate page number based on line position
        const estimatedPage = Math.floor(i / 50) + 1
        return estimatedPage
      }
    }
    return undefined
  }

  /**
   * Calculate confidence score based on value quality and pattern match
   */
  private calculateConfidence(value: string, pattern: RegExp): number {
    let confidence = 0.5 // Base confidence

    // Increase confidence for longer, more specific values
    if (value.length > 3) {
      confidence += 0.2
    }

    // Increase confidence for email patterns
    if (pattern.source.includes('@')) {
      confidence += 0.3
    }

    // Increase confidence for numeric values
    if (/^\d+(\.\d+)?$/.test(value)) {
      confidence += 0.2
    }

    // Increase confidence for specific formats (like chart fields)
    if (/^[A-Z]+-[0-9]+$/.test(value)) {
      confidence += 0.3
    }

    // Cap confidence at 1.0
    return Math.min(confidence, 1.0)
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
   * Validate extracted fields against expected patterns
   */
  validateExtractedFields(fields: ExtractedField[]): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    for (const field of fields) {
      // Check for low confidence fields
      if (field.confidence < 0.5) {
        warnings.push(`Low confidence for field '${field.fieldName}': ${field.value} (${field.confidence})`)
      }

      // Validate email format
      if (field.fieldName === 'submitter_email') {
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
        if (!emailPattern.test(field.value)) {
          errors.push(`Invalid email format: ${field.value}`)
        }
      }

      // Validate numeric fields
      if (['concentration', 'volume', 'total_amount', 'flow_cell_count'].includes(field.fieldName)) {
        if (isNaN(Number(field.value)) || Number(field.value) <= 0) {
          errors.push(`Invalid numeric value for '${field.fieldName}': ${field.value}`)
        }
      }

      // Validate flow cell type format
      if (field.fieldName === 'flow_cell_type') {
        const flowCellPattern = /^FLO-MIN[0-9]+$/
        if (!flowCellPattern.test(field.value)) {
          errors.push(`Invalid flow cell type format: ${field.value}`)
        }
      }

      // Validate chart field format
      if (field.fieldName === 'chart_field') {
        const chartFieldPattern = /^[A-Z]+-[0-9]+$/
        if (!chartFieldPattern.test(field.value)) {
          errors.push(`Invalid chart field format: ${field.value}`)
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Get PDF metadata and statistics
   */
  async getPDFMetadata(pdfBuffer: Buffer): Promise<{
    pages: number
    info: any
    textLength: number
    wordCount: number
    hasImages: boolean
    isScanned: boolean
  }> {
    try {
      const data = await pdfParse(pdfBuffer)
      
      const wordCount = data.text.split(/\s+/).length
      const hasImages = data.info.Producer?.includes('Image') || false
      const isScanned = this.detectScannedPDF(data.text)

      return {
        pages: data.numpages,
        info: data.info,
        textLength: data.text.length,
        wordCount,
        hasImages,
        isScanned
      }
    } catch (error) {
      throw new Error(`Failed to get PDF metadata: ${error}`)
    }
  }

  /**
   * Detect if PDF is scanned (OCR needed)
   */
  private detectScannedPDF(text: string): boolean {
    // Check for common indicators of scanned PDFs
    const indicators = [
      text.length < 100, // Very short text
      /[^\x00-\x7F]/.test(text), // Non-ASCII characters
      /\b(scan|scanned|ocr)\b/i.test(text), // Keywords
      text.split('\n').length < 5 // Very few lines
    ]

    return indicators.some(indicator => indicator)
  }

  /**
   * Extract text with page information
   */
  async extractTextWithPages(pdfBuffer: Buffer): Promise<{
    pages: Array<{
      pageNumber: number
      text: string
      wordCount: number
    }>
    totalPages: number
  }> {
    try {
      const data = await pdfParse(pdfBuffer)
      
      // Split text by pages (approximate)
      const lines = data.text.split('\n')
      const linesPerPage = Math.ceil(lines.length / data.numpages)
      const pages = []

      for (let i = 0; i < data.numpages; i++) {
        const startLine = i * linesPerPage
        const endLine = Math.min((i + 1) * linesPerPage, lines.length)
        const pageText = lines.slice(startLine, endLine).join('\n')
        
        pages.push({
          pageNumber: i + 1,
          text: pageText,
          wordCount: pageText.split(/\s+/).length
        })
      }

      return {
        pages,
        totalPages: data.numpages
      }
    } catch (error) {
      throw new Error(`Failed to extract text with pages: ${error}`)
    }
  }
}