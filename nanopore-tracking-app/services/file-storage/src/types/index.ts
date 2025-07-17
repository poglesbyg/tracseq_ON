import { z } from 'zod'

// File types
export interface FileMetadata {
  id: string
  originalName: string
  fileName: string
  fileType: string
  mimeType: string
  sizeBytes: number
  filePath: string
  description?: string
  uploadedBy?: string
  uploadedAt: Date
  updatedAt: Date
  isPublic: boolean
  tags?: string[]
  metadata?: Record<string, any>
}

export interface CreateFileRequest {
  originalName: string
  fileType: string
  mimeType: string
  sizeBytes: number
  description?: string
  uploadedBy?: string
  isPublic?: boolean
  tags?: string[]
  metadata?: Record<string, any>
}

export interface UpdateFileRequest {
  description?: string
  isPublic?: boolean
  tags?: string[]
  metadata?: Record<string, any>
}

// Upload types
export interface UploadResult {
  file: FileMetadata
  filePath: string
  url: string
}

export interface UploadProgress {
  fileId: string
  progress: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
}

// Download types
export interface DownloadRequest {
  fileId: string
  userId?: string
}

export interface DownloadResult {
  file: FileMetadata
  stream: NodeJS.ReadableStream
  headers: Record<string, string>
}

// File processing types
export interface FileProcessingResult {
  success: boolean
  data?: any
  error?: string
  processingTime?: number
}

export interface ImageProcessingOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

export interface PDFProcessingOptions {
  extractText?: boolean
  extractImages?: boolean
  extractMetadata?: boolean
}

// Search and filtering types
export interface FileSearchFilters {
  fileType?: string
  uploadedBy?: string
  isPublic?: boolean
  tags?: string[]
  dateFrom?: Date
  dateTo?: Date
  minSize?: number
  maxSize?: number
}

export interface FileSearchResult {
  files: FileMetadata[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Validation schemas
export const uploadFileSchema = z.object({
  originalName: z.string().min(1, 'Original name is required'),
  fileType: z.string().min(1, 'File type is required'),
  mimeType: z.string().min(1, 'MIME type is required'),
  sizeBytes: z.number().positive('File size must be positive'),
  description: z.string().optional(),
  uploadedBy: z.string().optional(),
  isPublic: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
})

export const updateFileSchema = z.object({
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
})

export const fileSearchSchema = z.object({
  fileType: z.string().optional(),
  uploadedBy: z.string().optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  minSize: z.number().positive().optional(),
  maxSize: z.number().positive().optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20)
})

// Database types
export interface Database {
  files: FilesTable
  file_metadata: FileMetadataTable
  file_access_log: FileAccessLogTable
}

export interface FilesTable {
  id: string
  original_name: string
  file_name: string
  file_type: string
  mime_type: string
  size_bytes: bigint
  file_path: string
  description?: string
  uploaded_by?: string
  uploaded_at: Date
  updated_at: Date
  is_public: boolean
  tags?: string[]
  metadata?: Record<string, any>
}

export interface FileMetadataTable {
  id: string
  file_id: string
  key: string
  value: string
  created_at: Date
}

export interface FileAccessLogTable {
  id: string
  file_id: string
  user_id?: string
  action: 'download' | 'upload' | 'delete' | 'view'
  ip_address?: string
  user_agent?: string
  accessed_at: Date
}

// Service configuration
export interface FileStorageConfig {
  storagePath: string
  maxFileSize: number
  allowedTypes: string[]
  allowedMimeTypes: string[]
  corsOrigin: string
  databaseUrl: string
  port: number
  environment: string
  enableImageProcessing: boolean
  enablePDFProcessing: boolean
  enableCompression: boolean
}

// File processing capabilities
export interface ProcessingCapabilities {
  imageProcessing: boolean
  pdfProcessing: boolean
  compression: boolean
  thumbnailGeneration: boolean
  metadataExtraction: boolean
}

// Storage statistics
export interface StorageStats {
  totalFiles: number
  totalSizeBytes: number
  averageFileSizeBytes: number
  filesByType: Record<string, number>
  filesByDate: Record<string, number>
  storageUsagePercent: number
}