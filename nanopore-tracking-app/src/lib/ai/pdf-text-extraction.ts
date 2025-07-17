// PDF worker configuration removed for lightweight version
import { withPdfRetry, createPdfError, PdfErrorType } from '../pdf-error-handler'
import { pdfPatternMatcher } from '../pdf-pattern-matcher'
import { 
  PdfProgressTracker, 
  ProcessingStep, 
  DEFAULT_PROCESSING_STEPS,
  PATTERN_ONLY_STEPS,
  type ProgressCallback 
} from '../pdf-progress-tracker'

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
    sampleType?: string
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

export interface PdfExtractionOptions {
  onProgress?: ProgressCallback
  useAI?: boolean
  useRAG?: boolean
}

class PdfTextExtractionService {
  private pdfParseModule: any = null
  private isServerSideInitialized = false
  private isServerSide = typeof window === 'undefined'

  /**
   * Helper function to build metadata object with proper typing
   */
  private buildMetadata(info: any): ExtractedPdfData['metadata'] {
    const metadata: ExtractedPdfData['metadata'] = {}
    
    if (info?.Title) metadata.title = info.Title
    if (info?.Author) metadata.author = info.Author
    if (info?.Subject) metadata.subject = info.Subject
    if (info?.Creator) metadata.creator = info.Creator
    if (info?.Producer) metadata.producer = info.Producer
    if (info?.CreationDate) metadata.creationDate = new Date(info.CreationDate)
    if (info?.ModDate) metadata.modificationDate = new Date(info.ModDate)
    
    return metadata
  }

  /**
   * Initialize PDF parsing modules - using multiple fallback approaches
   */
  private async initializePdfParsers(): Promise<{ server: boolean }> {
    const results = { server: false }

    // Only try server-side initialization with pdf-parse
    if (this.isServerSide && !this.isServerSideInitialized) {
      console.log('Attempting PDF parsing initialization...')
      
      // Method 1: Try direct require first (most reliable in Node.js)
      try {
        // Use eval to avoid bundler issues
        const requireFunc = eval('require')
        this.pdfParseModule = requireFunc('pdf-parse')
        this.isServerSideInitialized = true
        results.server = true
        console.log('✅ PDF parsing initialized successfully via direct require')
        return results
      } catch (requireError) {
        console.warn('❌ Direct require failed:', requireError instanceof Error ? requireError.message : 'Unknown error')
      }

      // Method 2: Try dynamic import (ES modules)
      try {
        const pdfParseModule = await import('pdf-parse')
        // Handle default export
        this.pdfParseModule = pdfParseModule.default || pdfParseModule
        this.isServerSideInitialized = true
        results.server = true
        console.log('✅ PDF parsing initialized successfully via dynamic import')
        return results
      } catch (importError) {
        console.warn('❌ Dynamic import failed:', importError instanceof Error ? importError.message : 'Unknown error')
      }

      // Method 3: Try createRequire (compatibility fallback)
      try {
        const { createRequire } = await import('module')
        const require = createRequire(import.meta.url)
        this.pdfParseModule = require('pdf-parse')
        this.isServerSideInitialized = true
        results.server = true
        console.log('✅ PDF parsing initialized successfully via createRequire')
        return results
      } catch (createRequireError) {
        console.warn('❌ createRequire failed:', createRequireError instanceof Error ? createRequireError.message : 'Unknown error')
      }

      // Method 4: Try alternative import approaches
      try {
        // Try importing from the exact path
        // @ts-ignore - pdf-parse lib path may not have types
        const pdfParseModule = await import('pdf-parse/lib/pdf-parse')
        this.pdfParseModule = pdfParseModule.default || pdfParseModule
        this.isServerSideInitialized = true
        results.server = true
        console.log('✅ PDF parsing initialized successfully via lib path import')
        return results
      } catch (libPathError) {
        console.warn('❌ Lib path import failed:', libPathError instanceof Error ? libPathError.message : 'Unknown error')
      }

      // Method 5: Last resort - try to load from node_modules directly
      try {
        const path = await import('path')
        const fs = await import('fs')
        const nodeModulesPath = path.resolve(process.cwd(), 'node_modules', 'pdf-parse')
        if (fs.existsSync(nodeModulesPath)) {
          const pdfParseModule = await import(nodeModulesPath)
          this.pdfParseModule = pdfParseModule.default || pdfParseModule
          this.isServerSideInitialized = true
          results.server = true
          console.log('✅ PDF parsing initialized successfully via node_modules path')
          return results
        }
      } catch (nodeModulesError) {
        console.warn('❌ Node modules path import failed:', nodeModulesError instanceof Error ? nodeModulesError.message : 'Unknown error')
      }

      console.error('❌ All PDF parsing initialization methods failed')
      console.log('Available methods tried: direct require, dynamic import, createRequire, lib path, node_modules path')
      
      // Log debugging information
      try {
        const fs = await import('fs')
        const path = await import('path')
        const nodeModulesPath = path.resolve(process.cwd(), 'node_modules')
        console.log('Current working directory:', process.cwd())
        console.log('Node modules exists:', fs.existsSync(nodeModulesPath))
        if (fs.existsSync(nodeModulesPath)) {
          const pdfParseExists = fs.existsSync(path.join(nodeModulesPath, 'pdf-parse'))
          console.log('pdf-parse directory exists:', pdfParseExists)
          if (pdfParseExists) {
            const pdfParsePackage = path.join(nodeModulesPath, 'pdf-parse', 'package.json')
            if (fs.existsSync(pdfParsePackage)) {
              const packageContent = fs.readFileSync(pdfParsePackage, 'utf8')
              const packageJson = JSON.parse(packageContent)
              console.log('pdf-parse version:', packageJson.version)
              console.log('pdf-parse main:', packageJson.main)
            }
          }
        }
      } catch (debugError) {
        console.error('Debug info failed:', debugError instanceof Error ? debugError.message : 'Unknown error')
      }
    }

    return results
  }

  /**
   * Check if PDF parsing is available
   */
  async isAvailable(): Promise<boolean> {
    const results = await this.initializePdfParsers()
    return results.server
  }

  /**
   * Extract text from PDF using only pdf-parse (server-side)
   */
  async extractText(
    file: File,
    options: PdfExtractionOptions = {}
  ): Promise<PdfExtractionResult> {
    const { onProgress } = options
    
    // Create simple progress tracker
    const tracker = new PdfProgressTracker()
    if (onProgress) {
      tracker.onProgress(onProgress)
    }

    try {
      tracker.start()
      tracker.updateStep(ProcessingStep.INITIALIZING, 0, 'Initializing PDF parser...')
      
      const { server } = await this.initializePdfParsers()
      
      if (!server) {
        tracker.error('PDF parsing is not available. Please ensure pdf-parse is installed.')
        return {
          success: false,
          error: 'PDF parsing is not available. Please ensure pdf-parse is installed.'
        }
      }

      tracker.updateStep(ProcessingStep.INITIALIZING, 100, 'PDF parser initialized')

      // Only use server-side parsing with pdf-parse
      if (this.isServerSide && this.pdfParseModule) {
        return await this.extractWithPdfParse(file, tracker)
      }

      // If we're on client-side, return error
      tracker.error('PDF parsing is only available on the server in lightweight version')
      return {
        success: false,
        error: 'PDF parsing is only available on the server in lightweight version'
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      tracker.error(`PDF extraction failed: ${errorMessage}`)
      
      return {
        success: false,
        error: `PDF extraction failed: ${errorMessage}`
      }
    }
  }

  /**
   * Extract text using pdf-parse (server-side only)
   */
  private async extractWithPdfParse(
    file: File,
    tracker: PdfProgressTracker
  ): Promise<PdfExtractionResult> {
    return withPdfRetry(async () => {
      tracker.updateStep(ProcessingStep.EXTRACTING_TEXT, 0, 'Extracting text from PDF...')
      
      try {
        // Convert File to Buffer for pdf-parse
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Extract text using pdf-parse
        const result = await this.pdfParseModule(buffer)
        
        tracker.updateStep(ProcessingStep.EXTRACTING_TEXT, 50, 'Text extraction completed')
        tracker.updateStep(ProcessingStep.PATTERN_MATCHING, 0, 'Extracting structured data...')
        
        // Extract structured data using pattern matching
        const extractedFields = pdfPatternMatcher.extractAllFields(result.text)
        
        tracker.updateStep(ProcessingStep.PATTERN_MATCHING, 100, 'Pattern matching completed')
       
        // Build metadata from pdf-parse result
        const metadata = this.buildMetadata(result.info || {})
        
        // Convert pattern matching results to our format with proper typing
        const sampleName = extractedFields.sampleName?.[0]?.value
        const submitterName = extractedFields.submitterName?.[0]?.value
        const submitterEmail = extractedFields.submitterEmail?.[0]?.value
        const labName = extractedFields.labName?.[0]?.value
        const projectName = extractedFields.projectName?.[0]?.value
        const sequencingType = extractedFields.sequencingType?.[0]?.value
        const sampleType = extractedFields.sampleType?.[0]?.value
        const libraryType = extractedFields.libraryType?.[0]?.value
        const flowCellType = extractedFields.flowCellType?.[0]?.value
        const priority = extractedFields.priority?.[0]?.value
        
        // Calculate confidence
        const totalFields = 10
        const extractedCount = [sampleName, submitterName, submitterEmail, labName, projectName, 
                               sequencingType, sampleType, libraryType, flowCellType, priority]
                               .filter(Boolean).length
        const confidence = extractedCount / totalFields
        
        // Build extractedFields object conditionally
        const extractedFieldsData: ExtractedPdfData['extractedFields'] = {
          confidence
        }
        
        // Only add fields if they have values
        if (sampleName) extractedFieldsData.sampleName = sampleName
        if (submitterName) extractedFieldsData.submitterName = submitterName
        if (submitterEmail) extractedFieldsData.submitterEmail = submitterEmail
        if (labName) extractedFieldsData.labName = labName
        if (projectName) extractedFieldsData.projectName = projectName
        if (sequencingType) extractedFieldsData.sequencingType = sequencingType
        if (sampleType) extractedFieldsData.sampleType = sampleType
        if (libraryType) extractedFieldsData.libraryType = libraryType
        if (flowCellType) extractedFieldsData.flowCellType = flowCellType
        if (priority) extractedFieldsData.priority = priority
        
        const extractedData: ExtractedPdfData = {
          rawText: result.text,
          pageCount: result.numpages || 1,
          metadata,
          extractedFields: extractedFieldsData
        }

        tracker.complete('PDF processing completed successfully')
        
        return {
          success: true,
          data: extractedData
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        tracker.error(`PDF extraction failed: ${errorMessage}`)
        
        throw createPdfError(
          PdfErrorType.PARSER_ERROR,
          `pdf-parse extraction failed: ${errorMessage}`,
          { fileName: file.name, fileSize: file.size }
        )
      }
    })
  }

  /**
   * Extract structured data from raw text (helper method)
   */
  extractStructuredData(rawText: string): any {
    return pdfPatternMatcher.extractAllFields(rawText)
  }
}

// Export singleton instance
export const pdfTextService = new PdfTextExtractionService()
