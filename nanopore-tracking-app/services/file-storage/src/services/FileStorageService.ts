import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import mime from 'mime-types'
import sharp from 'sharp'
import pdf from 'pdf-parse'
import { db } from '../database/connection.js'
import { logger, logFileOperation } from '../utils/logger.js'
import {
  FileMetadata,
  CreateFileRequest,
  UpdateFileRequest,
  UploadResult,
  DownloadResult,
  FileProcessingResult,
  ImageProcessingOptions,
  PDFProcessingOptions,
  FileSearchFilters,
  FileSearchResult,
  ProcessingCapabilities,
  StorageStats
} from '../types/index.js'

export class FileStorageService {
  private storagePath: string
  private maxFileSize: number
  private allowedTypes: string[]
  private allowedMimeTypes: string[]

  constructor() {
    this.storagePath = process.env.FILE_STORAGE_PATH || './storage/files'
    this.maxFileSize = parseInt(process.env.FILE_STORAGE_MAX_SIZE || '104857600') // 100MB default
    this.allowedTypes = (process.env.FILE_STORAGE_ALLOWED_TYPES || 'pdf,jpg,jpeg,png,gif,txt,csv,xlsx,docx').split(',')
    this.allowedMimeTypes = (process.env.FILE_STORAGE_ALLOWED_MIME_TYPES || 'application/pdf,image/jpeg,image/png,image/gif,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document').split(',')
    
    this.ensureStorageDirectory()
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true })
      logger.info('Storage directory ensured', { path: this.storagePath })
    } catch (error) {
      logger.error('Failed to create storage directory', { error: error instanceof Error ? error.message : 'Unknown error' })
      throw error
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId?: string,
    description?: string,
    isPublic: boolean = false,
    tags?: string[],
    metadata?: Record<string, any>
  ): Promise<UploadResult> {
    try {
      // Validate file
      this.validateFile(originalName, mimeType, buffer.length)

      // Generate unique filename
      const fileType = this.getFileExtension(originalName)
      const fileName = `${uuidv4()}_${Date.now()}.${fileType}`
      const filePath = path.join(this.storagePath, fileName)

      // Save file to disk
      await fs.writeFile(filePath, buffer)

      // Create database record
      const fileData = {
        original_name: originalName,
        file_name: fileName,
        file_type: fileType,
        mime_type: mimeType,
        size_bytes: BigInt(buffer.length),
        file_path: filePath,
        description: description || null,
        uploaded_by: userId || null,
        is_public: isPublic,
        tags: tags || [],
        metadata: metadata || null,
        uploaded_at: new Date(),
        updated_at: new Date()
      }

      const file = await db
        .insertInto('files')
        .values(fileData)
        .returningAll()
        .executeTakeFirstOrThrow()

      // Log access
      await this.logFileAccess(file.id, userId, 'upload')

      // Convert to FileMetadata
      const fileMetadata: FileMetadata = {
        id: file.id,
        originalName: file.original_name,
        fileName: file.file_name,
        fileType: file.file_type,
        mimeType: file.mime_type,
        sizeBytes: Number(file.size_bytes),
        filePath: file.file_path,
        description: file.description || undefined,
        uploadedBy: file.uploaded_by || undefined,
        uploadedAt: file.uploaded_at,
        updatedAt: file.updated_at,
        isPublic: file.is_public,
        tags: file.tags || undefined,
        metadata: file.metadata || undefined
      }

      logFileOperation('upload', file.id, userId, { originalName, size: buffer.length })

      return {
        file: fileMetadata,
        filePath,
        url: `/api/files/${file.id}`
      }
    } catch (error) {
      logger.error('File upload failed', { error: error instanceof Error ? error.message : 'Unknown error', originalName })
      throw error
    }
  }

  /**
   * Download a file
   */
  async downloadFile(fileId: string, userId?: string): Promise<DownloadResult> {
    try {
      const file = await db
        .selectFrom('files')
        .selectAll()
        .where('id', '=', fileId)
        .executeTakeFirst()

      if (!file) {
        throw new Error('File not found')
      }

      // Check access permissions
      if (!file.is_public && file.uploaded_by !== userId) {
        throw new Error('Access denied')
      }

      // Check if file exists on disk
      if (!await this.fileExists(file.file_path)) {
        throw new Error('File not found on disk')
      }

      // Read file
      const buffer = await fs.readFile(file.file_path)

      // Log access
      await this.logFileAccess(fileId, userId, 'download')

      // Convert to FileMetadata
      const fileMetadata: FileMetadata = {
        id: file.id,
        originalName: file.original_name,
        fileName: file.file_name,
        fileType: file.file_type,
        mimeType: file.mime_type,
        sizeBytes: Number(file.size_bytes),
        filePath: file.file_path,
        description: file.description || undefined,
        uploadedBy: file.uploaded_by || undefined,
        uploadedAt: file.uploaded_at,
        updatedAt: file.updated_at,
        isPublic: file.is_public,
        tags: file.tags || undefined,
        metadata: file.metadata || undefined
      }

      logFileOperation('download', fileId, userId)

      return {
        file: fileMetadata,
        stream: require('stream').Readable.from(buffer),
        headers: {
          'Content-Type': file.mime_type,
          'Content-Disposition': `attachment; filename="${file.original_name}"`,
          'Content-Length': buffer.length.toString()
        }
      }
    } catch (error) {
      logger.error('File download failed', { error: error instanceof Error ? error.message : 'Unknown error', fileId })
      throw error
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string, userId?: string): Promise<FileMetadata | null> {
    try {
      const file = await db
        .selectFrom('files')
        .selectAll()
        .where('id', '=', fileId)
        .executeTakeFirst()

      if (!file) {
        return null
      }

      // Check access permissions
      if (!file.is_public && file.uploaded_by !== userId) {
        throw new Error('Access denied')
      }

      // Log access
      await this.logFileAccess(fileId, userId, 'view')

      return {
        id: file.id,
        originalName: file.original_name,
        fileName: file.file_name,
        fileType: file.file_type,
        mimeType: file.mime_type,
        sizeBytes: Number(file.size_bytes),
        filePath: file.file_path,
        description: file.description || undefined,
        uploadedBy: file.uploaded_by || undefined,
        uploadedAt: file.uploaded_at,
        updatedAt: file.updated_at,
        isPublic: file.is_public,
        tags: file.tags || undefined,
        metadata: file.metadata || undefined
      }
    } catch (error) {
      logger.error('Get file metadata failed', { error: error instanceof Error ? error.message : 'Unknown error', fileId })
      throw error
    }
  }

  /**
   * Update file metadata
   */
  async updateFileMetadata(fileId: string, updates: UpdateFileRequest, userId?: string): Promise<FileMetadata> {
    try {
      const file = await db
        .selectFrom('files')
        .selectAll()
        .where('id', '=', fileId)
        .executeTakeFirst()

      if (!file) {
        throw new Error('File not found')
      }

      // Check permissions
      if (file.uploaded_by !== userId) {
        throw new Error('Access denied')
      }

      // Update file
      const updatedFile = await db
        .updateTable('files')
        .set({
          description: updates.description,
          is_public: updates.isPublic,
          tags: updates.tags,
          metadata: updates.metadata,
          updated_at: new Date()
        })
        .where('id', '=', fileId)
        .returningAll()
        .executeTakeFirstOrThrow()

      logFileOperation('update', fileId, userId, updates)

      return {
        id: updatedFile.id,
        originalName: updatedFile.original_name,
        fileName: updatedFile.file_name,
        fileType: updatedFile.file_type,
        mimeType: updatedFile.mime_type,
        sizeBytes: Number(updatedFile.size_bytes),
        filePath: updatedFile.file_path,
        description: updatedFile.description || undefined,
        uploadedBy: updatedFile.uploaded_by || undefined,
        uploadedAt: updatedFile.uploaded_at,
        updatedAt: updatedFile.updated_at,
        isPublic: updatedFile.is_public,
        tags: updatedFile.tags || undefined,
        metadata: updatedFile.metadata || undefined
      }
    } catch (error) {
      logger.error('Update file metadata failed', { error: error instanceof Error ? error.message : 'Unknown error', fileId })
      throw error
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string, userId?: string): Promise<void> {
    try {
      const file = await db
        .selectFrom('files')
        .selectAll()
        .where('id', '=', fileId)
        .executeTakeFirst()

      if (!file) {
        throw new Error('File not found')
      }

      // Check permissions
      if (file.uploaded_by !== userId) {
        throw new Error('Access denied')
      }

      // Delete from disk
      if (await this.fileExists(file.file_path)) {
        await fs.unlink(file.file_path)
      }

      // Delete from database
      await db
        .deleteFrom('files')
        .where('id', '=', fileId)
        .execute()

      // Log access
      await this.logFileAccess(fileId, userId, 'delete')

      logFileOperation('delete', fileId, userId)
    } catch (error) {
      logger.error('File deletion failed', { error: error instanceof Error ? error.message : 'Unknown error', fileId })
      throw error
    }
  }

  /**
   * Search files
   */
  async searchFiles(filters: FileSearchFilters, page: number = 1, limit: number = 20): Promise<FileSearchResult> {
    try {
      let query = db
        .selectFrom('files')
        .selectAll()

      // Apply filters
      if (filters.fileType) {
        query = query.where('file_type', '=', filters.fileType)
      }

      if (filters.uploadedBy) {
        query = query.where('uploaded_by', '=', filters.uploadedBy)
      }

      if (filters.isPublic !== undefined) {
        query = query.where('is_public', '=', filters.isPublic)
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.where('tags', '@>', filters.tags)
      }

      if (filters.dateFrom) {
        query = query.where('uploaded_at', '>=', filters.dateFrom)
      }

      if (filters.dateTo) {
        query = query.where('uploaded_at', '<=', filters.dateTo)
      }

      if (filters.minSize) {
        query = query.where('size_bytes', '>=', BigInt(filters.minSize))
      }

      if (filters.maxSize) {
        query = query.where('size_bytes', '<=', BigInt(filters.maxSize))
      }

      // Get total count
      const totalResult = await query
        .select(db.fn.count('id').as('count'))
        .executeTakeFirst()

      const total = Number(totalResult?.count || 0)

      // Get paginated results
      const offset = (page - 1) * limit
      const files = await query
        .orderBy('uploaded_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()

      const fileMetadata: FileMetadata[] = files.map(file => ({
        id: file.id,
        originalName: file.original_name,
        fileName: file.file_name,
        fileType: file.file_type,
        mimeType: file.mime_type,
        sizeBytes: Number(file.size_bytes),
        filePath: file.file_path,
        description: file.description || undefined,
        uploadedBy: file.uploaded_by || undefined,
        uploadedAt: file.uploaded_at,
        updatedAt: file.updated_at,
        isPublic: file.is_public,
        tags: file.tags || undefined,
        metadata: file.metadata || undefined
      }))

      return {
        files: fileMetadata,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    } catch (error) {
      logger.error('File search failed', { error: error instanceof Error ? error.message : 'Unknown error', filters })
      throw error
    }
  }

  /**
   * Process image file
   */
  async processImage(fileId: string, options: ImageProcessingOptions): Promise<FileProcessingResult> {
    try {
      const file = await this.getFileMetadata(fileId)
      if (!file) {
        throw new Error('File not found')
      }

      if (!file.mimeType.startsWith('image/')) {
        throw new Error('File is not an image')
      }

      const startTime = Date.now()
      const buffer = await fs.readFile(file.filePath)
      
      let processedImage = sharp(buffer)

      if (options.width || options.height) {
        processedImage = processedImage.resize(options.width, options.height)
      }

      if (options.quality) {
        processedImage = processedImage.jpeg({ quality: options.quality })
      }

      if (options.format) {
        switch (options.format) {
          case 'jpeg':
            processedImage = processedImage.jpeg()
            break
          case 'png':
            processedImage = processedImage.png()
            break
          case 'webp':
            processedImage = processedImage.webp()
            break
        }
      }

      const processedBuffer = await processedImage.toBuffer()
      const processingTime = Date.now() - startTime

      return {
        success: true,
        data: {
          buffer: processedBuffer,
          size: processedBuffer.length,
          format: options.format || 'jpeg'
        },
        processingTime
      }
    } catch (error) {
      logger.error('Image processing failed', { error: error instanceof Error ? error.message : 'Unknown error', fileId })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Process PDF file
   */
  async processPDF(fileId: string, options: PDFProcessingOptions): Promise<FileProcessingResult> {
    try {
      const file = await this.getFileMetadata(fileId)
      if (!file) {
        throw new Error('File not found')
      }

      if (file.mimeType !== 'application/pdf') {
        throw new Error('File is not a PDF')
      }

      const startTime = Date.now()
      const buffer = await fs.readFile(file.filePath)
      
      const result: any = {}

      if (options.extractText) {
        const pdfData = await pdf(buffer)
        result.text = pdfData.text
        result.pages = pdfData.numpages
      }

      if (options.extractMetadata) {
        const pdfData = await pdf(buffer)
        result.metadata = pdfData.info
      }

      const processingTime = Date.now() - startTime

      return {
        success: true,
        data: result,
        processingTime
      }
    } catch (error) {
      logger.error('PDF processing failed', { error: error instanceof Error ? error.message : 'Unknown error', fileId })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const stats = await db
        .selectFrom('files')
        .select([
          db.fn.count('id').as('totalFiles'),
          db.fn.sum('size_bytes').as('totalSizeBytes'),
          db.fn.avg('size_bytes').as('averageFileSizeBytes')
        ])
        .executeTakeFirst()

      const filesByType = await db
        .selectFrom('files')
        .select([
          'file_type',
          db.fn.count('id').as('count')
        ])
        .groupBy('file_type')
        .execute()

      const filesByDate = await db
        .selectFrom('files')
        .select([
          db.fn.date('uploaded_at').as('date'),
          db.fn.count('id').as('count')
        ])
        .groupBy(db.fn.date('uploaded_at'))
        .orderBy(db.fn.date('uploaded_at'), 'desc')
        .limit(30)
        .execute()

      const totalFiles = Number(stats?.totalFiles || 0)
      const totalSizeBytes = Number(stats?.totalSizeBytes || 0)
      const averageFileSizeBytes = Number(stats?.averageFileSizeBytes || 0)

      const filesByTypeMap: Record<string, number> = {}
      filesByType.forEach(item => {
        filesByTypeMap[item.file_type] = Number(item.count)
      })

      const filesByDateMap: Record<string, number> = {}
      filesByDate.forEach(item => {
        filesByDateMap[item.date as string] = Number(item.count)
      })

      return {
        totalFiles,
        totalSizeBytes,
        averageFileSizeBytes,
        filesByType: filesByTypeMap,
        filesByDate: filesByDateMap,
        storageUsagePercent: 0 // Would need to calculate based on available disk space
      }
    } catch (error) {
      logger.error('Get storage stats failed', { error: error instanceof Error ? error.message : 'Unknown error' })
      throw error
    }
  }

  /**
   * Get processing capabilities
   */
  getProcessingCapabilities(): ProcessingCapabilities {
    return {
      imageProcessing: true,
      pdfProcessing: true,
      compression: true,
      thumbnailGeneration: true,
      metadataExtraction: true
    }
  }

  /**
   * Validate file
   */
  private validateFile(originalName: string, mimeType: string, size: number): void {
    const fileType = this.getFileExtension(originalName)

    if (!this.allowedTypes.includes(fileType.toLowerCase())) {
      throw new Error(`File type ${fileType} is not allowed`)
    }

    if (!this.allowedMimeTypes.includes(mimeType)) {
      throw new Error(`MIME type ${mimeType} is not allowed`)
    }

    if (size > this.maxFileSize) {
      throw new Error(`File size ${size} exceeds maximum allowed size of ${this.maxFileSize} bytes`)
    }
  }

  /**
   * Get file extension
   */
  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.')
    return lastDot > 0 ? fileName.substring(lastDot + 1).toLowerCase() : ''
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Log file access
   */
  private async logFileAccess(fileId: string, userId?: string, action: 'download' | 'upload' | 'delete' | 'view'): Promise<void> {
    try {
      await db
        .insertInto('file_access_log')
        .values({
          file_id: fileId,
          user_id: userId || null,
          action,
          accessed_at: new Date()
        })
        .execute()
    } catch (error) {
      logger.error('Failed to log file access', { error: error instanceof Error ? error.message : 'Unknown error', fileId, action })
    }
  }
}

export default FileStorageService