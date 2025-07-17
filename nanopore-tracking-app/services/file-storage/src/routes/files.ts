import { Router, Request, Response } from 'express'
import multer from 'multer'
import { body, param, query } from 'express-validator'
import { FileStorageService } from '../services/FileStorageService.js'
import { authenticateToken, requireAuth, optionalAuth, getUserId } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'
import { uploadFileSchema, updateFileSchema, fileSearchSchema } from '../types/index.js'

const router = Router()
const fileStorageService = new FileStorageService()

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.FILE_STORAGE_MAX_SIZE || '104857600'), // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.FILE_STORAGE_ALLOWED_TYPES || 'pdf,jpg,jpeg,png,gif,txt,csv,xlsx,docx').split(',')
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase()
    
    if (fileExtension && allowedTypes.includes(fileExtension)) {
      cb(null, true)
    } else {
      cb(new Error(`File type ${fileExtension} is not allowed`))
    }
  }
})

/**
 * Upload a file
 * POST /api/files/upload
 */
router.post('/upload',
  authenticateToken,
  upload.single('file'),
  [
    body('description').optional().isString().trim(),
    body('isPublic').optional().isBoolean(),
    body('tags').optional().isArray(),
    body('metadata').optional().isObject()
  ],
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        })
      }

      const userId = getUserId(req)
      const { description, isPublic, tags, metadata } = req.body

      const result = await fileStorageService.uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        userId,
        description,
        isPublic === 'true' || isPublic === true,
        tags ? JSON.parse(tags) : undefined,
        metadata ? JSON.parse(metadata) : undefined
      )

      res.status(201).json({
        success: true,
        data: result
      })
    } catch (error) {
      logger.error('File upload route error', { error: error instanceof Error ? error.message : 'Unknown error' })
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'File upload failed'
      })
    }
  }
)

/**
 * Download a file
 * GET /api/files/:fileId/download
 */
router.get('/:fileId/download',
  optionalAuth,
  [param('fileId').isUUID()],
  async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params
      const userId = getUserId(req)

      const result = await fileStorageService.downloadFile(fileId, userId)

      // Set response headers
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value)
      })

      // Stream the file
      result.stream.pipe(res)
    } catch (error) {
      logger.error('File download route error', { error: error instanceof Error ? error.message : 'Unknown error', fileId: req.params.fileId })
      
      if (error instanceof Error && error.message === 'File not found') {
        res.status(404).json({
          success: false,
          error: 'File not found'
        })
      } else if (error instanceof Error && error.message === 'Access denied') {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      } else {
        res.status(500).json({
          success: false,
          error: 'File download failed'
        })
      }
    }
  }
)

/**
 * Get file metadata
 * GET /api/files/:fileId
 */
router.get('/:fileId',
  optionalAuth,
  [param('fileId').isUUID()],
  async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params
      const userId = getUserId(req)

      const file = await fileStorageService.getFileMetadata(fileId, userId)

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        })
      }

      res.json({
        success: true,
        data: file
      })
    } catch (error) {
      logger.error('Get file metadata route error', { error: error instanceof Error ? error.message : 'Unknown error', fileId: req.params.fileId })
      
      if (error instanceof Error && error.message === 'Access denied') {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to get file metadata'
        })
      }
    }
  }
)

/**
 * Update file metadata
 * PUT /api/files/:fileId
 */
router.put('/:fileId',
  requireAuth,
  [
    param('fileId').isUUID(),
    body('description').optional().isString().trim(),
    body('isPublic').optional().isBoolean(),
    body('tags').optional().isArray(),
    body('metadata').optional().isObject()
  ],
  async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params
      const userId = getUserId(req)
      const updates = req.body

      const file = await fileStorageService.updateFileMetadata(fileId, updates, userId)

      res.json({
        success: true,
        data: file
      })
    } catch (error) {
      logger.error('Update file metadata route error', { error: error instanceof Error ? error.message : 'Unknown error', fileId: req.params.fileId })
      
      if (error instanceof Error && error.message === 'File not found') {
        res.status(404).json({
          success: false,
          error: 'File not found'
        })
      } else if (error instanceof Error && error.message === 'Access denied') {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update file metadata'
        })
      }
    }
  }
)

/**
 * Delete a file
 * DELETE /api/files/:fileId
 */
router.delete('/:fileId',
  requireAuth,
  [param('fileId').isUUID()],
  async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params
      const userId = getUserId(req)

      await fileStorageService.deleteFile(fileId, userId)

      res.json({
        success: true,
        message: 'File deleted successfully'
      })
    } catch (error) {
      logger.error('Delete file route error', { error: error instanceof Error ? error.message : 'Unknown error', fileId: req.params.fileId })
      
      if (error instanceof Error && error.message === 'File not found') {
        res.status(404).json({
          success: false,
          error: 'File not found'
        })
      } else if (error instanceof Error && error.message === 'Access denied') {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to delete file'
        })
      }
    }
  }
)

/**
 * Search files
 * GET /api/files/search
 */
router.get('/search',
  optionalAuth,
  [
    query('fileType').optional().isString(),
    query('uploadedBy').optional().isString(),
    query('isPublic').optional().isBoolean(),
    query('tags').optional().isString(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
    query('minSize').optional().isNumeric(),
    query('maxSize').optional().isNumeric(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  async (req: Request, res: Response) => {
    try {
      const filters = {
        fileType: req.query.fileType as string,
        uploadedBy: req.query.uploadedBy as string,
        isPublic: req.query.isPublic === 'true' ? true : req.query.isPublic === 'false' ? false : undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        minSize: req.query.minSize ? parseInt(req.query.minSize as string) : undefined,
        maxSize: req.query.maxSize ? parseInt(req.query.maxSize as string) : undefined
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20

      const result = await fileStorageService.searchFiles(filters, page, limit)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      logger.error('File search route error', { error: error instanceof Error ? error.message : 'Unknown error' })
      res.status(500).json({
        success: false,
        error: 'File search failed'
      })
    }
  }
)

/**
 * Process image file
 * POST /api/files/:fileId/process/image
 */
router.post('/:fileId/process/image',
  requireAuth,
  [
    param('fileId').isUUID(),
    body('width').optional().isInt({ min: 1 }),
    body('height').optional().isInt({ min: 1 }),
    body('quality').optional().isInt({ min: 1, max: 100 }),
    body('format').optional().isIn(['jpeg', 'png', 'webp'])
  ],
  async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params
      const options = req.body

      const result = await fileStorageService.processImage(fileId, options)

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        })
      }

      res.json({
        success: true,
        data: result.data,
        processingTime: result.processingTime
      })
    } catch (error) {
      logger.error('Image processing route error', { error: error instanceof Error ? error.message : 'Unknown error', fileId: req.params.fileId })
      res.status(500).json({
        success: false,
        error: 'Image processing failed'
      })
    }
  }
)

/**
 * Process PDF file
 * POST /api/files/:fileId/process/pdf
 */
router.post('/:fileId/process/pdf',
  requireAuth,
  [
    param('fileId').isUUID(),
    body('extractText').optional().isBoolean(),
    body('extractImages').optional().isBoolean(),
    body('extractMetadata').optional().isBoolean()
  ],
  async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params
      const options = req.body

      const result = await fileStorageService.processPDF(fileId, options)

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        })
      }

      res.json({
        success: true,
        data: result.data,
        processingTime: result.processingTime
      })
    } catch (error) {
      logger.error('PDF processing route error', { error: error instanceof Error ? error.message : 'Unknown error', fileId: req.params.fileId })
      res.status(500).json({
        success: false,
        error: 'PDF processing failed'
      })
    }
  }
)

/**
 * Get storage statistics
 * GET /api/files/stats
 */
router.get('/stats',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const stats = await fileStorageService.getStorageStats()

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      logger.error('Get storage stats route error', { error: error instanceof Error ? error.message : 'Unknown error' })
      res.status(500).json({
        success: false,
        error: 'Failed to get storage statistics'
      })
    }
  }
)

/**
 * Get processing capabilities
 * GET /api/files/capabilities
 */
router.get('/capabilities',
  async (req: Request, res: Response) => {
    try {
      const capabilities = fileStorageService.getProcessingCapabilities()

      res.json({
        success: true,
        data: capabilities
      })
    } catch (error) {
      logger.error('Get capabilities route error', { error: error instanceof Error ? error.message : 'Unknown error' })
      res.status(500).json({
        success: false,
        error: 'Failed to get processing capabilities'
      })
    }
  }
)

/**
 * Health check endpoint
 * GET /api/files/health
 */
router.get('/health',
  async (req: Request, res: Response) => {
    try {
      // Basic health check
      res.json({
        success: true,
        message: 'File Storage Service is healthy',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('Health check error', { error: error instanceof Error ? error.message : 'Unknown error' })
      res.status(500).json({
        success: false,
        error: 'Service unhealthy'
      })
    }
  }
)

export default router