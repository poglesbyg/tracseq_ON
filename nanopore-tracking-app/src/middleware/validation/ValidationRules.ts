import { z } from 'zod'
import { inputSanitizer } from '../security/InputSanitizer'

/**
 * Common validation patterns
 */
const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  chartField: /^(HTSF|NANO|SEQ)-\d{3}$/,
  alphanumeric: /^[a-zA-Z0-9\s\-_\.]+$/,
  labName: /^[a-zA-Z0-9\s\-_\.,']+$/,
  personName: /^[a-zA-Z\s\-'\.]+$/,
}

/**
 * Validation messages
 */
const messages = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  uuid: 'Invalid ID format',
  chartField: 'Chart field must be in format: HTSF-001, NANO-001, or SEQ-001',
  minLength: (min: number) => `Must be at least ${min} characters`,
  maxLength: (max: number) => `Must not exceed ${max} characters`,
  positive: 'Must be a positive number',
  range: (min: number, max: number) => `Must be between ${min} and ${max}`,
  invalidFormat: 'Invalid format',
  alphanumeric: 'Only letters, numbers, spaces, hyphens, underscores, and dots are allowed',
  personName: 'Only letters, spaces, hyphens, apostrophes, and dots are allowed',
  labName: 'Invalid lab name format',
}

/**
 * Base validation schemas
 */
export const baseValidations = {
  // String validations with sanitization
  requiredString: z.string().min(1, messages.required).transform(val => inputSanitizer.sanitizeString(val)),
  optionalString: z.string().optional().transform(val => val ? inputSanitizer.sanitizeString(val) : val),
  email: z.string().email(messages.email).transform(val => inputSanitizer.sanitizeString(val)),
  uuid: z.string().uuid(messages.uuid),
  
  // Sample-specific validations
  sampleName: z.string()
    .min(1, messages.required)
    .max(255, messages.maxLength(255))
    .regex(patterns.alphanumeric, messages.alphanumeric)
    .trim(),
  
  projectId: z.string()
    .max(100, messages.maxLength(100))
    .regex(patterns.alphanumeric, messages.alphanumeric)
    .trim()
    .optional(),
  
  personName: z.string()
    .min(1, messages.required)
    .max(255, messages.maxLength(255))
    .regex(patterns.personName, messages.personName)
    .trim(),
  
  labName: z.string()
    .max(255, messages.maxLength(255))
    .regex(patterns.labName, messages.labName)
    .trim()
    .optional(),
  
  sampleType: z.enum(['DNA', 'RNA', 'Protein', 'Other'], {
    required_error: messages.required,
    invalid_type_error: 'Sample type must be DNA, RNA, Protein, or Other'
  }),
  
  chartField: z.string()
    .min(1, messages.required)
    .regex(patterns.chartField, messages.chartField)
    .trim(),
  
  // Numeric validations
  positiveNumber: z.number().positive(messages.positive).optional(),
  concentration: z.union([
    z.number().min(0.001, 'Concentration must be at least 0.001 ng/μL').max(10000, 'Concentration cannot exceed 10,000 ng/μL'),
    z.null(),
    z.undefined()
  ]).optional(),
  volume: z.union([
    z.number().min(0.1, 'Volume must be at least 0.1 μL').max(1000, 'Volume cannot exceed 1,000 μL'),
    z.null(),
    z.undefined()
  ]).optional(),
  totalAmount: z.number().min(0.001, 'Total amount must be at least 0.001 ng').max(100000, 'Total amount cannot exceed 100,000 ng').optional(),
  flowCellCount: z.number().int().min(1, 'Flow cell count must be at least 1').max(10, 'Flow cell count cannot exceed 10').default(1),
  
  // Enum validations
  status: z.enum(['submitted', 'prep', 'sequencing', 'analysis', 'completed', 'archived'], {
    required_error: messages.required,
    invalid_type_error: 'Invalid status value'
  }),
  
  priority: z.enum(['low', 'normal', 'high', 'urgent'], {
    required_error: messages.required,
    invalid_type_error: 'Priority must be low, normal, high, or urgent'
  }).default('normal'),
  
  flowCellType: z.enum(['R9.4.1', 'R10.4.1', 'R10.5.1', 'Other'], {
    invalid_type_error: 'Invalid flow cell type'
  }).optional(),
}

/**
 * Validation for creating nanopore samples
 */
export const createSampleValidation = z.object({
  sampleName: baseValidations.sampleName,
  projectId: baseValidations.projectId,
  submitterName: baseValidations.personName,
  submitterEmail: baseValidations.email,
  labName: baseValidations.labName,
  sampleType: baseValidations.sampleType,
  sampleBuffer: z.string().max(100, messages.maxLength(100)).trim().optional(),
  concentration: baseValidations.concentration,
  volume: baseValidations.volume,
  totalAmount: baseValidations.totalAmount,
  flowCellType: baseValidations.flowCellType,
  flowCellCount: baseValidations.flowCellCount,
  priority: baseValidations.priority,
  assignedTo: baseValidations.personName.optional(),
  libraryPrepBy: baseValidations.personName.optional(),
  chartField: baseValidations.chartField,
}).refine(
  (data) => {
    // If concentration and volume are provided, calculate total amount
    if (data.concentration && data.volume) {
      const calculated = data.concentration * data.volume
      if (data.totalAmount && Math.abs(calculated - data.totalAmount) > 0.001) {
        return false
      }
    }
    return true
  },
  {
    message: "Total amount doesn't match concentration × volume",
    path: ['totalAmount']
  }
)

/**
 * Validation for updating nanopore samples
 */
export const updateSampleValidation = z.object({
  sampleName: baseValidations.sampleName.optional(),
  projectId: baseValidations.projectId.optional(),
  submitterName: baseValidations.personName.optional(),
  submitterEmail: baseValidations.email.optional(),
  labName: baseValidations.labName.optional(),
  sampleType: baseValidations.sampleType.optional(),
  sampleBuffer: z.string().max(100, messages.maxLength(100)).trim().optional(),
  concentration: baseValidations.concentration.optional(),
  volume: baseValidations.volume.optional(),
  totalAmount: baseValidations.totalAmount.optional(),
  flowCellType: baseValidations.flowCellType.optional(),
  flowCellCount: baseValidations.flowCellCount.optional(),
  status: baseValidations.status.optional(),
  priority: baseValidations.priority.optional(),
  assignedTo: baseValidations.personName.optional(),
  libraryPrepBy: baseValidations.personName.optional(),
})

/**
 * Validation for sample assignment
 */
export const assignSampleValidation = z.object({
  id: baseValidations.uuid,
  assignedTo: baseValidations.personName,
  libraryPrepBy: baseValidations.personName.optional(),
})

/**
 * Validation for status updates
 */
export const updateStatusValidation = z.object({
  id: baseValidations.uuid,
  status: baseValidations.status,
})

/**
 * Validation for search criteria
 */
export const searchValidation = z.object({
  searchTerm: z.string().max(255, messages.maxLength(255)).trim().optional(),
  status: baseValidations.status.optional(),
  priority: baseValidations.priority.optional(),
  assignedTo: baseValidations.personName.optional(),
  submitterName: baseValidations.personName.optional(),
  sampleType: baseValidations.sampleType.optional(),
  labName: baseValidations.labName.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
}).refine(
  (data) => {
    if (data.dateFrom && data.dateTo) {
      return data.dateFrom <= data.dateTo
    }
    return true
  },
  {
    message: "Date from must be before date to",
    path: ['dateFrom']
  }
)

/**
 * Validation for bulk operations
 */
export const bulkOperationValidation = z.object({
  ids: z.array(baseValidations.uuid).min(1, 'At least one ID is required').max(100, 'Cannot process more than 100 samples at once'),
  operation: z.enum(['delete', 'archive', 'assign', 'updateStatus'], {
    required_error: 'Operation is required',
    invalid_type_error: 'Invalid operation type'
  }),
  data: z.record(z.any()).optional(), // Additional data for the operation
})

/**
 * Validation for file uploads
 */
export const fileUploadValidation = z.object({
  filename: z.string().min(1, 'Filename is required').max(255, messages.maxLength(255)),
  contentType: z.string().min(1, 'Content type is required'),
  size: z.number().int().min(1, 'File size must be greater than 0').max(50 * 1024 * 1024, 'File size cannot exceed 50MB'),
  sampleId: baseValidations.uuid.optional(),
})

/**
 * Sanitization functions
 */
export const sanitizers = {
  /**
   * Sanitize text input to prevent XSS
   */
  sanitizeText: (text: string): string => {
    return text
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim()
  },
  
  /**
   * Sanitize email input
   */
  sanitizeEmail: (email: string): string => {
    return email.toLowerCase().trim()
  },
  
  /**
   * Sanitize numeric input
   */
  sanitizeNumber: (value: any): number | undefined => {
    if (value === null || value === undefined || value === '') {
      return undefined
    }
    const num = Number(value)
    return isNaN(num) ? undefined : num
  },
  
  /**
   * Sanitize boolean input
   */
  sanitizeBoolean: (value: any): boolean => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true'
    }
    return Boolean(value)
  },
}

/**
 * Custom validation helpers
 */
export const validators = {
  /**
   * Validate chart field format
   */
  isValidChartField: (value: string): boolean => {
    return patterns.chartField.test(value)
  },
  
  /**
   * Validate concentration range based on sample type
   */
  isValidConcentration: (concentration: number, sampleType: string): boolean => {
    const ranges = {
      'DNA': { min: 0.1, max: 1000 },
      'RNA': { min: 0.01, max: 100 },
      'Protein': { min: 0.001, max: 10 },
      'Other': { min: 0.001, max: 10000 }
    }
    
    const range = ranges[sampleType as keyof typeof ranges] || ranges.Other
    return concentration >= range.min && concentration <= range.max
  },
  
  /**
   * Validate file extension
   */
  isValidFileExtension: (filename: string, allowedExtensions: string[]): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase()
    return ext ? allowedExtensions.includes(ext) : false
  },
  
  /**
   * Validate business rules
   */
  canUpdateStatus: (currentStatus: string, newStatus: string): boolean => {
    const validTransitions: Record<string, string[]> = {
      'submitted': ['prep', 'archived'],
      'prep': ['sequencing', 'submitted', 'archived'],
      'sequencing': ['analysis', 'prep', 'archived'],
      'analysis': ['completed', 'sequencing', 'archived'],
      'completed': ['archived'],
      'archived': []
    }
    
    return validTransitions[currentStatus]?.includes(newStatus) || false
  }
} 