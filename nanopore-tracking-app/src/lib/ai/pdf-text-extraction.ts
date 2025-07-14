export interface ExtractedPdfData {
  rawText: string
  pageCount: number
  metadata: {
    title?: string
    author?: string
    subject?: string
    creator?: string
    producer?: string
    creationDate?: Date
    modificationDate?: Date
  }
  extractedFields?: {
    sampleName?: string
    submitterName?: string
    submitterEmail?: string
    labName?: string
    projectName?: string
    sequencingType?: string
    libraryType?: string
    flowCellType?: string
    priority?: string
    confidence: number
  }
}

export interface PdfExtractionResult {
  success: boolean
  data?: ExtractedPdfData
  error?: string
}

class PdfTextExtractionService {
  private pdfParseModule: any = null
  private isInitialized = false
  private initializationError: string | null = null

  /**
   * Initialize the PDF parse module with error handling
   */
  private async initializePdfParse(): Promise<boolean> {
    if (this.isInitialized) {
      return this.pdfParseModule !== null
    }

    try {
      // Check if we're in browser environment
      if (typeof window !== 'undefined') {
        this.initializationError =
          'PDF parsing is not available in browser environment'
        this.isInitialized = true
        return false
      }

      // Use dynamic import with error handling
      const pdfModule = await import('pdf-parse')
      this.pdfParseModule = pdfModule.default || pdfModule
      this.isInitialized = true
      return true
    } catch (error) {
      this.initializationError =
        error instanceof Error ? error.message : 'Failed to load PDF parser'
      this.isInitialized = true
      console.error('Failed to initialize PDF parser:', error)
      return false
    }
  }

  /**
   * Extract text and metadata from a PDF file
   */
  async extractText(file: File): Promise<PdfExtractionResult> {
    try {
      // Initialize PDF parser
      const isReady = await this.initializePdfParse()
      if (!isReady) {
        return {
          success: false,
          error: this.initializationError || 'PDF parser not available',
        }
      }

      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Parse PDF using the module
      const pdfData = await this.pdfParseModule(buffer)

      const extractedData: ExtractedPdfData = {
        rawText: pdfData.text || '',
        pageCount: pdfData.numpages || 0,
        metadata: {
          title: pdfData.info?.Title,
          author: pdfData.info?.Author,
          subject: pdfData.info?.Subject,
          creator: pdfData.info?.Creator,
          producer: pdfData.info?.Producer,
          creationDate: pdfData.info?.CreationDate
            ? new Date(pdfData.info.CreationDate)
            : undefined,
          modificationDate: pdfData.info?.ModDate
            ? new Date(pdfData.info.ModDate)
            : undefined,
        },
      }

      return {
        success: true,
        data: extractedData,
      }
    } catch (error) {
      console.error('PDF text extraction failed:', error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to extract text from PDF',
      }
    }
  }

  /**
   * Extract structured data from PDF text using pattern matching
   * This provides a fallback when LLM is not available
   */
  extractStructuredData(
    rawText: string,
  ): Partial<ExtractedPdfData['extractedFields']> {
    const fields: Partial<ExtractedPdfData['extractedFields']> = {}

    try {
      // Sample name patterns
      const sampleNamePatterns = [
        /sample\s*(?:name|id)?:?\s*([\w.\-]+)/i,
        /name\s*of\s*sample:?\s*([\w.\-]+)/i,
        /sample:?\s*([\w.\-]+)/i,
        /specimen:?\s*([\w.\-]+)/i,
      ]

      // Submitter patterns
      const submitterPatterns = [
        /submitter:?\s*([\s\w,.-]+)/i,
        /submitted\s*by:?\s*([\s\w,.-]+)/i,
        /contact\s*person:?\s*([\s\w,.-]+)/i,
        /principal\s*investigator:?\s*([\s\w,.-]+)/i,
        /pi:?\s*([\s\w,.-]+)/i,
        /investigator:?\s*([\s\w,.-]+)/i,
      ]

      // Email patterns
      const emailPatterns = [
        /email:?\s*([\w%+.-]+@[\d.a-z-]+\.[a-z]{2,})/i,
        /e-mail:?\s*([\w%+.-]+@[\d.a-z-]+\.[a-z]{2,})/i,
        /contact\s*email:?\s*([\w%+.-]+@[\d.a-z-]+\.[a-z]{2,})/i,
        /([\w%+.-]+@[\d.a-z-]+\.[a-z]{2,})/i,
      ]

      // Lab patterns
      const labPatterns = [
        /lab:?\s*([\s\w&(),.\-]+)/i,
        /laboratory:?\s*([\s\w&(),.\-]+)/i,
        /department:?\s*([\s\w&(),.\-]+)/i,
        /institution:?\s*([\s\w&(),.\-]+)/i,
        /facility:?\s*([\s\w&(),.\-]+)/i,
      ]

      // Project patterns
      const projectPatterns = [
        /project:?\s*([\s\w&(),.\-]+)/i,
        /project\s*name:?\s*([\s\w&(),.\-]+)/i,
        /study:?\s*([\s\w&(),.\-]+)/i,
        /research:?\s*([\s\w&(),.\-]+)/i,
      ]

      // Sequencing type patterns
      const sequencingPatterns = [
        /sequencing\s*type:?\s*([\s\w\-]+)/i,
        /platform:?\s*([\s\w\-]+)/i,
        /technology:?\s*([\s\w\-]+)/i,
        /method:?\s*([\s\w\-]+)/i,
      ]

      // Library type patterns
      const libraryPatterns = [
        /library\s*type:?\s*([\s\w\-]+)/i,
        /library\s*prep:?\s*([\s\w\-]+)/i,
        /preparation:?\s*([\s\w\-]+)/i,
        /prep\s*method:?\s*([\s\w\-]+)/i,
      ]

      // Flow cell patterns
      const flowCellPatterns = [
        /flow\s*cell:?\s*([\s\w\-]+)/i,
        /cell\s*type:?\s*([\s\w\-]+)/i,
        /flowcell:?\s*([\s\w\-]+)/i,
      ]

      // Priority patterns
      const priorityPatterns = [
        /priority:?\s*(high|medium|low|standard|rush|urgent)/i,
        /urgency:?\s*(high|medium|low|standard|rush|urgent)/i,
        /processing\s*priority:?\s*(high|medium|low|standard|rush|urgent)/i,
      ]

      // Extract fields using patterns
      for (const pattern of sampleNamePatterns) {
        const match = rawText.match(pattern)
        if (match && match[1] && match[1].trim().length > 0) {
          fields.sampleName = match[1].trim()
          break
        }
      }

      for (const pattern of submitterPatterns) {
        const match = rawText.match(pattern)
        if (match && match[1] && match[1].trim().length > 1) {
          fields.submitterName = match[1].trim()
          break
        }
      }

      for (const pattern of emailPatterns) {
        const match = rawText.match(pattern)
        if (match && match[1] && match[1].includes('@')) {
          fields.submitterEmail = match[1].trim()
          break
        }
      }

      for (const pattern of labPatterns) {
        const match = rawText.match(pattern)
        if (match && match[1] && match[1].trim().length > 2) {
          fields.labName = match[1].trim()
          break
        }
      }

      for (const pattern of projectPatterns) {
        const match = rawText.match(pattern)
        if (match && match[1] && match[1].trim().length > 2) {
          fields.projectName = match[1].trim()
          break
        }
      }

      for (const pattern of sequencingPatterns) {
        const match = rawText.match(pattern)
        if (match && match[1] && match[1].trim().length > 2) {
          fields.sequencingType = match[1].trim()
          break
        }
      }

      for (const pattern of libraryPatterns) {
        const match = rawText.match(pattern)
        if (match && match[1] && match[1].trim().length > 2) {
          fields.libraryType = match[1].trim()
          break
        }
      }

      for (const pattern of flowCellPatterns) {
        const match = rawText.match(pattern)
        if (match && match[1] && match[1].trim().length > 2) {
          fields.flowCellType = match[1].trim()
          break
        }
      }

      for (const pattern of priorityPatterns) {
        const match = rawText.match(pattern)
        if (match && match[1] && match[1].trim().length > 2) {
          fields.priority = match[1].trim()
          break
        }
      }

      // Calculate confidence based on how many fields we extracted
      const totalFields = 9 // Total possible fields
      const extractedCount = Object.keys(fields).length
      fields.confidence = Math.min(extractedCount / totalFields, 0.8) // Cap at 80% for pattern matching

      return fields
    } catch (error) {
      console.error('Structured data extraction failed:', error)
      return { confidence: 0 }
    }
  }

  /**
   * Validate extracted data quality
   */
  validateExtractedData(
    fields: Partial<ExtractedPdfData['extractedFields']> | undefined,
  ): {
    isValid: boolean
    issues: string[]
    confidence: number
  } {
    const issues: string[] = []
    let confidence = fields?.confidence || 0

    // Check email format
    if (fields?.submitterEmail) {
      const emailRegex = /^[\w%+.-]+@[\d.A-Za-z-]+\.[A-Za-z]{2,}$/
      if (!emailRegex.test(fields.submitterEmail)) {
        issues.push('Invalid email format')
        confidence *= 0.8
      }
    }

    // Check sample name format
    if (fields?.sampleName) {
      if (fields.sampleName.length < 2) {
        issues.push('Sample name too short')
        confidence *= 0.9
      }
    }

    // Check submitter name
    if (fields?.submitterName) {
      if (fields.submitterName.length < 2) {
        issues.push('Submitter name too short')
        confidence *= 0.9
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      confidence: Math.max(confidence, 0.1), // Minimum confidence
    }
  }

  /**
   * Check if PDF parsing is available
   */
  async isAvailable(): Promise<boolean> {
    return await this.initializePdfParse()
  }
}

// Export singleton instance
export const pdfTextService = new PdfTextExtractionService()
