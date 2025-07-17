import { z } from 'zod'

// Processing status enum
export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Processing type enum
export enum ProcessingType {
  PDF_EXTRACTION = 'pdf_extraction',
  AI_EXTRACTION = 'ai_extraction',
  FORM_VALIDATION = 'form_validation',
  DATA_ENRICHMENT = 'data_enrichment'
}

// Confidence level enum
export enum ConfidenceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

// Extracted field interface
export interface ExtractedField {
  fieldName: string
  value: string
  confidence: number
  confidenceLevel: ConfidenceLevel
  source: string
  pageNumber?: number
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  validationErrors?: string[]
}

// Processing job interface
export interface ProcessingJob {
  id: string
  sampleId?: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  processingType: ProcessingType
  status: ProcessingStatus
  progress: number
  result?: ProcessingResult
  error?: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  startedAt?: Date
  completedAt?: Date
}

// Processing result interface
export interface ProcessingResult {
  extractedFields: ExtractedField[]
  confidence: number
  confidenceLevel: ConfidenceLevel
  processingTime: number
  pagesProcessed: number
  validationScore: number
  suggestions?: string[]
  warnings?: string[]
}

// PDF processing request
export interface PDFProcessingRequest {
  file: Express.Multer.File
  sampleId?: string
  processingType: ProcessingType
  metadata?: Record<string, any>
}

// AI extraction request
export interface AIExtractionRequest {
  text: string
  sampleId?: string
  extractionPrompt?: string
  fields?: string[]
  metadata?: Record<string, any>
}

// Vector search request
export interface VectorSearchRequest {
  query: string
  limit: number
  threshold: number
  filters?: Record<string, any>
}

// Vector search result
export interface VectorSearchResult {
  id: string
  score: number
  payload: Record<string, any>
  metadata?: Record<string, any>
}

// Form validation request
export interface FormValidationRequest {
  extractedFields: ExtractedField[]
  validationRules: ValidationRule[]
  sampleId?: string
}

// Validation rule interface
export interface ValidationRule {
  fieldName: string
  required: boolean
  type: 'string' | 'number' | 'email' | 'date' | 'regex'
  minLength?: number
  maxLength?: number
  minValue?: number
  maxValue?: number
  pattern?: string
  allowedValues?: string[]
  customValidation?: string
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean
  score: number
  errors: ValidationError[]
  warnings: string[]
  suggestions: string[]
}

// Validation error interface
export interface ValidationError {
  fieldName: string
  error: string
  severity: 'error' | 'warning'
  suggestion?: string
}

// RAG system request
export interface RAGRequest {
  query: string
  context?: string
  maxResults: number
  threshold: number
}

// RAG system result
export interface RAGResult {
  answer: string
  confidence: number
  sources: RAGSource[]
  processingTime: number
}

// RAG source interface
export interface RAGSource {
  id: string
  title: string
  content: string
  score: number
  metadata?: Record<string, any>
}

// Zod schemas for validation
export const processingJobSchema = z.object({
  sampleId: z.string().optional(),
  fileName: z.string().min(1, 'File name is required'),
  filePath: z.string().min(1, 'File path is required'),
  fileSize: z.number().positive('File size must be positive'),
  mimeType: z.string().min(1, 'MIME type is required'),
  processingType: z.nativeEnum(ProcessingType),
  metadata: z.record(z.any()).optional()
})

export const aiExtractionRequestSchema = z.object({
  text: z.string().min(1, 'Text content is required'),
  sampleId: z.string().optional(),
  extractionPrompt: z.string().optional(),
  fields: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
})

export const vectorSearchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().int().positive().max(100),
  threshold: z.number().min(0).max(1),
  filters: z.record(z.any()).optional()
})

export const formValidationRequestSchema = z.object({
  extractedFields: z.array(z.object({
    fieldName: z.string(),
    value: z.string(),
    confidence: z.number().min(0).max(1),
    confidenceLevel: z.nativeEnum(ConfidenceLevel),
    source: z.string(),
    pageNumber: z.number().optional(),
    boundingBox: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    }).optional(),
    validationErrors: z.array(z.string()).optional()
  })),
  validationRules: z.array(z.object({
    fieldName: z.string(),
    required: z.boolean(),
    type: z.enum(['string', 'number', 'email', 'date', 'regex']),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    pattern: z.string().optional(),
    allowedValues: z.array(z.string()).optional(),
    customValidation: z.string().optional()
  })),
  sampleId: z.string().optional()
})

export const ragRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  context: z.string().optional(),
  maxResults: z.number().int().positive().max(50),
  threshold: z.number().min(0).max(1)
})

// Type exports
export type ProcessingJobType = z.infer<typeof processingJobSchema>
export type AIExtractionRequestType = z.infer<typeof aiExtractionRequestSchema>
export type VectorSearchRequestType = z.infer<typeof vectorSearchRequestSchema>
export type FormValidationRequestType = z.infer<typeof formValidationRequestSchema>
export type RAGRequestType = z.infer<typeof ragRequestSchema>