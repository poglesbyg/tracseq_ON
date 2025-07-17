import { Router } from 'express'
import { body, query, param, validationResult } from 'express-validator'
import { AuditService } from '../services/AuditService.js'
import { logger } from '../utils/logger.js'
import type { ApiResponse, AuditSearchFilters } from '../types/index.js'

const router = Router()
const auditService = new AuditService({
  retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '90'),
  maxEventsPerRequest: parseInt(process.env.AUDIT_MAX_EVENTS_PER_REQUEST || '1000'),
  enableRealTimeAlerts: process.env.AUDIT_ENABLE_REALTIME_ALERTS !== 'false',
  enableScheduledReports: process.env.AUDIT_ENABLE_SCHEDULED_REPORTS !== 'false',
  enableDataRetention: process.env.AUDIT_ENABLE_DATA_RETENTION !== 'false'
})

// Middleware to handle validation errors
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    } as ApiResponse)
  }
  next()
}

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await auditService.getAuditStats(1)
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'audit-service'
      }
    } as ApiResponse)
  } catch (error) {
    logger.error('Health check failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'audit-service'
      }
    } as ApiResponse)
  }
})

// Audit Events endpoints
router.post('/events', [
  body('service').isString().notEmpty().withMessage('Service is required'),
  body('action').isString().notEmpty().withMessage('Action is required'),
  body('resource').isString().notEmpty().withMessage('Resource is required'),
  body('userId').optional().isString(),
  body('userEmail').optional().isEmail().withMessage('Valid email required'),
  body('resourceId').optional().isString(),
  body('details').optional().isObject(),
  body('ipAddress').optional().isIP().withMessage('Valid IP address required'),
  body('userAgent').optional().isString(),
  body('sessionId').optional().isString(),
  body('severity').optional().isIn(['info', 'warn', 'error', 'critical']),
  body('category').optional().isIn(['authentication', 'authorization', 'data_access', 'data_modification', 'system', 'security']),
  body('tags').optional().isArray(),
  body('metadata').optional().isObject(),
  handleValidationErrors
], async (req, res) => {
  try {
    const event = await auditService.createAuditEvent(req.body)
    res.status(201).json({
      success: true,
      data: event
    } as ApiResponse)
  } catch (error) {
    logger.error('Failed to create audit event', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(500).json({
      success: false,
      error: 'Failed to create audit event'
    } as ApiResponse)
  }
})

router.get('/events', [
  query('userId').optional().isString(),
  query('userEmail').optional().isEmail(),
  query('service').optional().isString(),
  query('action').optional().isString(),
  query('resource').optional().isString(),
  query('resourceId').optional().isString(),
  query('severity').optional().isIn(['info', 'warn', 'error', 'critical']),
  query('category').optional().isIn(['authentication', 'authorization', 'data_access', 'data_modification', 'system', 'security']),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('sessionId').optional().isString(),
  query('ipAddress').optional().isIP(),
  query('tags').optional().isArray(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const filters: AuditSearchFilters = {
      userId: req.query.userId as string,
      userEmail: req.query.userEmail as string,
      service: req.query.service as string,
      action: req.query.action as string,
      resource: req.query.resource as string,
      resourceId: req.query.resourceId as string,
      severity: req.query.severity as any,
      category: req.query.category as any,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      sessionId: req.query.sessionId as string,
      ipAddress: req.query.ipAddress as string,
      tags: req.query.tags as string[]
    }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await auditService.getAuditEvents(filters, page, limit)
    res.json({
      success: true,
      data: result
    } as ApiResponse)
  } catch (error) {
    logger.error('Failed to get audit events', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(500).json({
      success: false,
      error: 'Failed to get audit events'
    } as ApiResponse)
  }
})

// Audit Logs endpoints
router.post('/logs', [
  body('level').isIn(['info', 'warn', 'error', 'debug']).withMessage('Valid log level required'),
  body('message').isString().notEmpty().withMessage('Message is required'),
  body('service').isString().notEmpty().withMessage('Service is required'),
  body('userId').optional().isString(),
  body('sessionId').optional().isString(),
  body('ipAddress').optional().isIP(),
  body('userAgent').optional().isString(),
  body('details').optional().isObject(),
  body('stackTrace').optional().isString(),
  body('tags').optional().isArray(),
  handleValidationErrors
], async (req, res) => {
  try {
    const log = await auditService.createAuditLog(req.body)
    res.status(201).json({
      success: true,
      data: log
    } as ApiResponse)
  } catch (error) {
    logger.error('Failed to create audit log', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(500).json({
      success: false,
      error: 'Failed to create audit log'
    } as ApiResponse)
  }
})

router.get('/logs', [
  query('level').optional().isIn(['info', 'warn', 'error', 'debug']),
  query('service').optional().isString(),
  query('userId').optional().isString(),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const filters = {
      level: req.query.level as string,
      service: req.query.service as string,
      userId: req.query.userId as string,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined
    }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 100

    const result = await auditService.getAuditLogs(filters, page, limit)
    res.json({
      success: true,
      data: result
    } as ApiResponse)
  } catch (error) {
    logger.error('Failed to get audit logs', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(500).json({
      success: false,
      error: 'Failed to get audit logs'
    } as ApiResponse)
  }
})

// User Activities endpoints
router.post('/activities', [
  body('userId').isString().notEmpty().withMessage('User ID is required'),
  body('userEmail').isEmail().withMessage('Valid email is required'),
  body('action').isString().notEmpty().withMessage('Action is required'),
  body('service').isString().notEmpty().withMessage('Service is required'),
  body('resource').isString().notEmpty().withMessage('Resource is required'),
  body('resourceId').optional().isString(),
  body('ipAddress').optional().isIP(),
  body('userAgent').optional().isString(),
  body('sessionId').optional().isString(),
  body('duration').optional().isInt({ min: 0 }),
  body('success').isBoolean().withMessage('Success flag is required'),
  body('details').optional().isObject(),
  handleValidationErrors
], async (req, res) => {
  try {
    const activity = await auditService.createUserActivity(req.body)
    res.status(201).json({
      success: true,
      data: activity
    } as ApiResponse)
  } catch (error) {
    logger.error('Failed to create user activity', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(500).json({
      success: false,
      error: 'Failed to create user activity'
    } as ApiResponse)
  }
})

router.get('/activities', [
  query('userId').optional().isString(),
  query('userEmail').optional().isEmail(),
  query('service').optional().isString(),
  query('action').optional().isString(),
  query('success').optional().isBoolean(),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId as string,
      userEmail: req.query.userEmail as string,
      service: req.query.service as string,
      action: req.query.action as string,
      success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined
    }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 50

    const result = await auditService.getUserActivities(filters, page, limit)
    res.json({
      success: true,
      data: result
    } as ApiResponse)
  } catch (error) {
    logger.error('Failed to get user activities', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(500).json({
      success: false,
      error: 'Failed to get user activities'
    } as ApiResponse)
  }
})

// Statistics and Metrics endpoints
router.get('/stats', [
  query('daysBack').optional().isInt({ min: 1, max: 365 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const daysBack = parseInt(req.query.daysBack as string) || 30
    const stats = await auditService.getAuditStats(daysBack)
    res.json({
      success: true,
      data: stats
    } as ApiResponse)
  } catch (error) {
    logger.error('Failed to get audit stats', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(500).json({
      success: false,
      error: 'Failed to get audit statistics'
    } as ApiResponse)
  }
})

router.get('/metrics', [
  query('daysBack').optional().isInt({ min: 1, max: 365 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const daysBack = parseInt(req.query.daysBack as string) || 30
    const metrics = await auditService.getActivityMetrics(daysBack)
    res.json({
      success: true,
      data: metrics
    } as ApiResponse)
  } catch (error) {
    logger.error('Failed to get activity metrics', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(500).json({
      success: false,
      error: 'Failed to get activity metrics'
    } as ApiResponse)
  }
})

// Reports endpoints
router.post('/reports', [
  body('name').isString().notEmpty().withMessage('Report name is required'),
  body('description').optional().isString(),
  body('type').isIn(['activity', 'security', 'compliance', 'performance', 'custom']).withMessage('Valid report type required'),
  body('filters').isObject().withMessage('Filters object is required'),
  body('schedule').optional().isString(),
  body('recipients').optional().isArray(),
  body('format').isIn(['json', 'csv', 'pdf']).withMessage('Valid format required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const report = await auditService.createAuditReport(req.body)
    res.status(201).json({
      success: true,
      data: report
    } as ApiResponse)
  } catch (error) {
    logger.error('Failed to create audit report', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(500).json({
      success: false,
      error: 'Failed to create audit report'
    } as ApiResponse)
  }
})

router.get('/reports/:reportId/generate', [
  param('reportId').isUUID().withMessage('Valid report ID required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const result = await auditService.generateReport(req.params.reportId)
    
    res.setHeader('Content-Type', result.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
    res.setHeader('Content-Length', result.data.length)
    
    res.send(result.data)
  } catch (error) {
    logger.error('Failed to generate report', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(500).json({
      success: false,
      error: 'Failed to generate report'
    } as ApiResponse)
  }
})

// Alerts endpoints
router.post('/alerts', [
  body('name').isString().notEmpty().withMessage('Alert name is required'),
  body('description').optional().isString(),
  body('condition').isObject().withMessage('Alert condition is required'),
  body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Valid severity required'),
  body('service').isString().notEmpty().withMessage('Service is required'),
  body('recipients').isArray({ min: 1 }).withMessage('At least one recipient required'),
  body('cooldownMinutes').optional().isInt({ min: 0 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const alert = await auditService.createAuditAlert(req.body)
    res.status(201).json({
      success: true,
      data: alert
    } as ApiResponse)
  } catch (error) {
    logger.error('Failed to create audit alert', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(500).json({
      success: false,
      error: 'Failed to create audit alert'
    } as ApiResponse)
  }
})

// Data Retention endpoint
router.post('/cleanup', [
  query('retentionDays').optional().isInt({ min: 1, max: 365 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const retentionDays = req.query.retentionDays ? parseInt(req.query.retentionDays as string) : undefined
    const deletedCount = await auditService.cleanupOldData(retentionDays)
    res.json({
      success: true,
      data: {
        deletedCount,
        retentionDays: retentionDays || 90
      }
    } as ApiResponse)
  } catch (error) {
    logger.error('Failed to cleanup old data', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup old data'
    } as ApiResponse)
  }
})

// Bulk operations endpoint
router.post('/bulk', [
  body('events').optional().isArray(),
  body('logs').optional().isArray(),
  body('activities').optional().isArray(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { events, logs, activities } = req.body
    const results = {
      events: [],
      logs: [],
      activities: []
    }

    if (events && Array.isArray(events)) {
      for (const event of events) {
        try {
          const createdEvent = await auditService.createAuditEvent(event)
          results.events.push(createdEvent)
        } catch (error) {
          logger.error('Failed to create bulk audit event', { error: error instanceof Error ? error.message : 'Unknown error', event })
        }
      }
    }

    if (logs && Array.isArray(logs)) {
      for (const log of logs) {
        try {
          const createdLog = await auditService.createAuditLog(log)
          results.logs.push(createdLog)
        } catch (error) {
          logger.error('Failed to create bulk audit log', { error: error instanceof Error ? error.message : 'Unknown error', log })
        }
      }
    }

    if (activities && Array.isArray(activities)) {
      for (const activity of activities) {
        try {
          const createdActivity = await auditService.createUserActivity(activity)
          results.activities.push(createdActivity)
        } catch (error) {
          logger.error('Failed to create bulk user activity', { error: error instanceof Error ? error.message : 'Unknown error', activity })
        }
      }
    }

    res.status(201).json({
      success: true,
      data: results
    } as ApiResponse)
  } catch (error) {
    logger.error('Failed to process bulk operations', { error: error instanceof Error ? error.message : 'Unknown error' })
    res.status(500).json({
      success: false,
      error: 'Failed to process bulk operations'
    } as ApiResponse)
  }
})

export default router