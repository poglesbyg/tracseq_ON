import { getComponentLogger } from '../logging/StructuredLogger'
import crypto from 'crypto'
import { performance } from 'perf_hooks'

const logger = getComponentLogger('SecurityHardening')

export interface SecurityPolicy {
  authentication: {
    enabled: boolean
    tokenExpiration: number
    refreshTokenExpiration: number
    maxFailedAttempts: number
    lockoutDuration: number
  }
  authorization: {
    rbacEnabled: boolean
    defaultRole: string
    roleHierarchy: Record<string, string[]>
  }
  encryption: {
    algorithm: string
    keySize: number
    rotationInterval: number
  }
  networkSecurity: {
    tlsEnabled: boolean
    tlsVersion: string
    allowedCiphers: string[]
    certificateValidation: boolean
  }
  inputValidation: {
    sanitizeInput: boolean
    maxRequestSize: number
    rateLimiting: {
      enabled: boolean
      maxRequests: number
      windowMs: number
    }
  }
  audit: {
    enabled: boolean
    logLevel: 'info' | 'warn' | 'error'
    retentionDays: number
  }
}

export interface SecurityMetrics {
  authenticationFailures: number
  authorizationDenials: number
  suspiciousActivities: number
  blockedRequests: number
  encryptionOperations: number
  certificateExpirations: number
  vulnerabilityScans: number
  securityIncidents: number
}

export interface ThreatDetection {
  type: 'brute_force' | 'sql_injection' | 'xss' | 'csrf' | 'ddos' | 'unauthorized_access'
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  timestamp: Date
  details: Record<string, any>
  blocked: boolean
}

export interface SecurityAuditLog {
  id: string
  timestamp: Date
  userId?: string
  action: string
  resource: string
  result: 'success' | 'failure' | 'blocked'
  ipAddress: string
  userAgent: string
  details: Record<string, any>
  riskScore: number
}

/**
 * Comprehensive security hardening system for quota-optimized service mesh
 */
export class SecurityHardening {
  private policy: SecurityPolicy
  private metrics: SecurityMetrics
  private threatDetections: ThreatDetection[] = []
  private auditLogs: SecurityAuditLog[] = []
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map()
  private failedAttempts: Map<string, { count: number; lockoutTime?: number }> = new Map()
  private encryptionKeys: Map<string, { key: Buffer; createdAt: Date }> = new Map()

  constructor(policy?: Partial<SecurityPolicy>) {
    this.policy = {
      authentication: {
        enabled: true,
        tokenExpiration: 3600000, // 1 hour
        refreshTokenExpiration: 86400000, // 24 hours
        maxFailedAttempts: 5,
        lockoutDuration: 900000 // 15 minutes
      },
      authorization: {
        rbacEnabled: true,
        defaultRole: 'user',
        roleHierarchy: {
          admin: ['user', 'moderator'],
          moderator: ['user'],
          user: []
        }
      },
      encryption: {
        algorithm: 'aes-256-gcm',
        keySize: 32,
        rotationInterval: 86400000 // 24 hours
      },
      networkSecurity: {
        tlsEnabled: true,
        tlsVersion: '1.3',
        allowedCiphers: [
          'TLS_AES_256_GCM_SHA384',
          'TLS_CHACHA20_POLY1305_SHA256',
          'TLS_AES_128_GCM_SHA256'
        ],
        certificateValidation: true
      },
      inputValidation: {
        sanitizeInput: true,
        maxRequestSize: 10485760, // 10MB
        rateLimiting: {
          enabled: true,
          maxRequests: 100,
          windowMs: 60000 // 1 minute
        }
      },
      audit: {
        enabled: true,
        logLevel: 'info',
        retentionDays: 30
      },
      ...policy
    }

    this.metrics = {
      authenticationFailures: 0,
      authorizationDenials: 0,
      suspiciousActivities: 0,
      blockedRequests: 0,
      encryptionOperations: 0,
      certificateExpirations: 0,
      vulnerabilityScans: 0,
      securityIncidents: 0
    }

    this.initializeEncryptionKeys()
    this.startSecurityMonitoring()
  }

  /**
   * Initialize encryption keys
   */
  private initializeEncryptionKeys(): void {
    const masterKey = crypto.randomBytes(this.policy.encryption.keySize)
    this.encryptionKeys.set('master', {
      key: masterKey,
      createdAt: new Date()
    })

    logger.info('Encryption keys initialized', {
      action: 'encryption_init',
      metadata: { keyCount: this.encryptionKeys.size }
    })
  }

  /**
   * Start security monitoring
   */
  private startSecurityMonitoring(): void {
    // Key rotation
    setInterval(() => {
      this.rotateEncryptionKeys()
    }, this.policy.encryption.rotationInterval)

    // Cleanup old audit logs
    setInterval(() => {
      this.cleanupAuditLogs()
    }, 86400000) // Daily cleanup

    // Rate limit cleanup
    setInterval(() => {
      this.cleanupRateLimitStore()
    }, 60000) // Every minute

    logger.info('Security monitoring started')
  }

  /**
   * Authenticate user request
   */
  async authenticateRequest(token: string, ipAddress: string): Promise<{
    success: boolean
    userId?: string
    role?: string
    error?: string
  }> {
    const startTime = performance.now()

    try {
      if (!this.policy.authentication.enabled) {
        return { success: true }
      }

      // Check if IP is locked out
      const lockoutInfo = this.failedAttempts.get(ipAddress)
      if (lockoutInfo?.lockoutTime && Date.now() < lockoutInfo.lockoutTime) {
        this.metrics.authenticationFailures++
        this.logSecurityEvent('authentication_blocked', {
          ipAddress,
          reason: 'IP locked out',
          lockoutTime: lockoutInfo.lockoutTime
        })
        return { success: false, error: 'IP address is locked out' }
      }

      // Validate token (simplified - in production use JWT or similar)
      const tokenData = this.validateToken(token)
      if (!tokenData) {
        this.recordFailedAttempt(ipAddress)
        this.metrics.authenticationFailures++
        this.logSecurityEvent('authentication_failed', {
          ipAddress,
          reason: 'Invalid token'
        })
        return { success: false, error: 'Invalid token' }
      }

      // Check token expiration
      if (Date.now() > tokenData.expiresAt) {
        this.metrics.authenticationFailures++
        this.logSecurityEvent('authentication_failed', {
          ipAddress,
          reason: 'Token expired'
        })
        return { success: false, error: 'Token expired' }
      }

      // Reset failed attempts on successful authentication
      this.failedAttempts.delete(ipAddress)

      this.logSecurityEvent('authentication_success', {
        userId: tokenData.userId,
        ipAddress
      })

      return {
        success: true,
        userId: tokenData.userId,
        role: tokenData.role
      }

    } catch (error) {
      this.metrics.authenticationFailures++
      logger.error('Authentication error', {
        action: 'authentication_error',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        metadata: { 
          ipAddress,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          processingTime: performance.now() - startTime
        }
      })
      return { success: false, error: 'Authentication error' }
    }
  }

  /**
   * Authorize user action
   */
  async authorizeAction(
    userId: string,
    role: string,
    resource: string,
    action: string
  ): Promise<{ authorized: boolean; reason?: string }> {
    try {
      if (!this.policy.authorization.rbacEnabled) {
        return { authorized: true }
      }

      // Check role hierarchy
      const allowedRoles = this.policy.authorization.roleHierarchy[role] || []
      const hasPermission = this.checkPermission(role, resource, action) ||
        allowedRoles.some(r => this.checkPermission(r, resource, action))

      if (!hasPermission) {
        this.metrics.authorizationDenials++
        this.logSecurityEvent('authorization_denied', {
          userId,
          role,
          resource,
          action,
          reason: 'Insufficient permissions'
        })
        return { authorized: false, reason: 'Insufficient permissions' }
      }

      this.logSecurityEvent('authorization_granted', {
        userId,
        role,
        resource,
        action
      })

      return { authorized: true }

    } catch (error) {
      this.metrics.authorizationDenials++
      logger.error('Authorization error', {
        action: 'authorization_error',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        metadata: { 
          userId,
          role,
          resource,
          action,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      return { authorized: false, reason: 'Authorization error' }
    }
  }

  /**
   * Validate and sanitize input
   */
  validateInput(input: any, type: 'string' | 'number' | 'email' | 'url' | 'json'): {
    valid: boolean
    sanitized?: any
    error?: string
  } {
    try {
      if (!this.policy.inputValidation.sanitizeInput) {
        return { valid: true, sanitized: input }
      }

      switch (type) {
        case 'string':
          return this.validateString(input)
        case 'number':
          return this.validateNumber(input)
        case 'email':
          return this.validateEmail(input)
        case 'url':
          return this.validateUrl(input)
        case 'json':
          return this.validateJson(input)
        default:
          return { valid: false, error: 'Unknown validation type' }
      }

    } catch (error) {
      logger.error('Input validation error', {
        action: 'validation_error',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        metadata: { 
          input: typeof input === 'string' ? input.substring(0, 100) : input,
          type,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      return { valid: false, error: 'Validation error' }
    }
  }

  /**
   * Check rate limiting
   */
  checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    if (!this.policy.inputValidation.rateLimiting.enabled) {
      return { allowed: true, remaining: Infinity, resetTime: 0 }
    }

    const now = Date.now()
    const windowMs = this.policy.inputValidation.rateLimiting.windowMs
    const maxRequests = this.policy.inputValidation.rateLimiting.maxRequests

    const record = this.rateLimitStore.get(identifier)
    
    if (!record || now > record.resetTime) {
      // New window
      const newRecord = {
        count: 1,
        resetTime: now + windowMs
      }
      this.rateLimitStore.set(identifier, newRecord)
      return { allowed: true, remaining: maxRequests - 1, resetTime: newRecord.resetTime }
    }

    if (record.count >= maxRequests) {
      this.metrics.blockedRequests++
      this.logSecurityEvent('rate_limit_exceeded', {
        identifier,
        count: record.count,
        maxRequests
      })
      return { allowed: false, remaining: 0, resetTime: record.resetTime }
    }

    record.count++
    return { allowed: true, remaining: maxRequests - record.count, resetTime: record.resetTime }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data: string, keyId: string = 'master'): { encrypted: string; iv: string } {
    const key = this.encryptionKeys.get(keyId)
    if (!key) {
      throw new Error(`Encryption key not found: ${keyId}`)
    }

    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(this.policy.encryption.algorithm, key.key, iv)
    
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    this.metrics.encryptionOperations++

    return {
      encrypted,
      iv: iv.toString('hex')
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: string, iv: string, keyId: string = 'master'): string {
    const key = this.encryptionKeys.get(keyId)
    if (!key) {
      throw new Error(`Encryption key not found: ${keyId}`)
    }

    const ivBuffer = Buffer.from(iv, 'hex')
    const decipher = crypto.createDecipheriv(this.policy.encryption.algorithm, key.key, ivBuffer)
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    this.metrics.encryptionOperations++

    return decrypted
  }

  /**
   * Detect security threats
   */
  detectThreat(request: {
    method: string
    url: string
    headers: Record<string, string>
    body?: string
    ipAddress: string
    userAgent: string
  }): ThreatDetection[] {
    const threats: ThreatDetection[] = []

    // SQL Injection detection
    if (this.detectSqlInjection(request.url, request.body)) {
      threats.push({
        type: 'sql_injection',
        severity: 'high',
        source: request.ipAddress,
        timestamp: new Date(),
        details: { url: request.url, method: request.method },
        blocked: true
      })
    }

    // XSS detection
    if (this.detectXss(request.url, request.body)) {
      threats.push({
        type: 'xss',
        severity: 'medium',
        source: request.ipAddress,
        timestamp: new Date(),
        details: { url: request.url, method: request.method },
        blocked: true
      })
    }

    // Brute force detection
    const failedAttempts = this.failedAttempts.get(request.ipAddress)
    if (failedAttempts && failedAttempts.count > this.policy.authentication.maxFailedAttempts) {
      threats.push({
        type: 'brute_force',
        severity: 'high',
        source: request.ipAddress,
        timestamp: new Date(),
        details: { attempts: failedAttempts.count },
        blocked: true
      })
    }

    // Store detected threats
    this.threatDetections.push(...threats)
    this.metrics.suspiciousActivities += threats.length

    return threats
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    return { ...this.metrics }
  }

  /**
   * Get threat detections
   */
  getThreatDetections(limit: number = 100): ThreatDetection[] {
    return this.threatDetections.slice(-limit)
  }

  /**
   * Get audit logs
   */
  getAuditLogs(limit: number = 100): SecurityAuditLog[] {
    return this.auditLogs.slice(-limit)
  }

  /**
   * Generate security report
   */
  generateSecurityReport(): string {
    const metrics = this.getSecurityMetrics()
    const threats = this.getThreatDetections(10)
    const recentAudits = this.getAuditLogs(10)

    let report = '# Security Hardening Report\n\n'
    
    report += '## Security Metrics\n\n'
    report += `- **Authentication Failures**: ${metrics.authenticationFailures}\n`
    report += `- **Authorization Denials**: ${metrics.authorizationDenials}\n`
    report += `- **Suspicious Activities**: ${metrics.suspiciousActivities}\n`
    report += `- **Blocked Requests**: ${metrics.blockedRequests}\n`
    report += `- **Encryption Operations**: ${metrics.encryptionOperations}\n`
    report += `- **Security Incidents**: ${metrics.securityIncidents}\n\n`

    report += '## Recent Threats\n\n'
    if (threats.length > 0) {
      for (const threat of threats) {
        report += `- **${threat.type}** (${threat.severity}) from ${threat.source} at ${threat.timestamp.toISOString()}\n`
      }
    } else {
      report += 'No recent threats detected.\n'
    }
    report += '\n'

    report += '## Recent Audit Events\n\n'
    if (recentAudits.length > 0) {
      for (const audit of recentAudits) {
        report += `- **${audit.action}** on ${audit.resource} by ${audit.userId || 'anonymous'} (${audit.result}) at ${audit.timestamp.toISOString()}\n`
      }
    } else {
      report += 'No recent audit events.\n'
    }
    report += '\n'

    report += '## Security Policy Status\n\n'
    report += `- **Authentication**: ${this.policy.authentication.enabled ? 'Enabled' : 'Disabled'}\n`
    report += `- **Authorization (RBAC)**: ${this.policy.authorization.rbacEnabled ? 'Enabled' : 'Disabled'}\n`
    report += `- **TLS**: ${this.policy.networkSecurity.tlsEnabled ? 'Enabled' : 'Disabled'}\n`
    report += `- **Input Validation**: ${this.policy.inputValidation.sanitizeInput ? 'Enabled' : 'Disabled'}\n`
    report += `- **Rate Limiting**: ${this.policy.inputValidation.rateLimiting.enabled ? 'Enabled' : 'Disabled'}\n`
    report += `- **Audit Logging**: ${this.policy.audit.enabled ? 'Enabled' : 'Disabled'}\n\n`

    return report
  }

  // Private helper methods

  private validateToken(token: string): { userId: string; role: string; expiresAt: number } | null {
    // Simplified token validation - in production use JWT
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8')
      const tokenData = JSON.parse(decoded)
      return tokenData
    } catch {
      return null
    }
  }

  private recordFailedAttempt(ipAddress: string): void {
    const record = this.failedAttempts.get(ipAddress) || { count: 0 }
    record.count++
    
    if (record.count >= this.policy.authentication.maxFailedAttempts) {
      record.lockoutTime = Date.now() + this.policy.authentication.lockoutDuration
    }
    
    this.failedAttempts.set(ipAddress, record)
  }

  private checkPermission(role: string, resource: string, action: string): boolean {
    // Simplified permission check - in production use proper RBAC
    const permissions = {
      admin: ['*'],
      moderator: ['read', 'write'],
      user: ['read']
    }
    
    const rolePermissions = permissions[role as keyof typeof permissions] || []
    return rolePermissions.includes('*') || rolePermissions.includes(action)
  }

  private validateString(input: any): { valid: boolean; sanitized?: string; error?: string } {
    if (typeof input !== 'string') {
      return { valid: false, error: 'Input must be a string' }
    }
    
    // Basic XSS prevention
    const sanitized = input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
    
    return { valid: true, sanitized }
  }

  private validateNumber(input: any): { valid: boolean; sanitized?: number; error?: string } {
    const num = Number(input)
    if (isNaN(num)) {
      return { valid: false, error: 'Input must be a number' }
    }
    return { valid: true, sanitized: num }
  }

  private validateEmail(input: any): { valid: boolean; sanitized?: string; error?: string } {
    if (typeof input !== 'string') {
      return { valid: false, error: 'Email must be a string' }
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(input)) {
      return { valid: false, error: 'Invalid email format' }
    }
    
    return { valid: true, sanitized: input.toLowerCase() }
  }

  private validateUrl(input: any): { valid: boolean; sanitized?: string; error?: string } {
    if (typeof input !== 'string') {
      return { valid: false, error: 'URL must be a string' }
    }
    
    try {
      const url = new URL(input)
      return { valid: true, sanitized: url.toString() }
    } catch {
      return { valid: false, error: 'Invalid URL format' }
    }
  }

  private validateJson(input: any): { valid: boolean; sanitized?: any; error?: string } {
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input)
        return { valid: true, sanitized: parsed }
      } catch {
        return { valid: false, error: 'Invalid JSON format' }
      }
    }
    return { valid: true, sanitized: input }
  }

  private detectSqlInjection(url?: string, body?: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /('|(\\')|(;)|(\\))/,
      /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT|ONLOAD|ONERROR|ONCLICK)\b)/i
    ]
    
    const content = `${url || ''} ${body || ''}`
    return sqlPatterns.some(pattern => pattern.test(content))
  }

  private detectXss(url?: string, body?: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]*onerror/gi
    ]
    
    const content = `${url || ''} ${body || ''}`
    return xssPatterns.some(pattern => pattern.test(content))
  }

  private rotateEncryptionKeys(): void {
    const oldKeys = Array.from(this.encryptionKeys.entries())
    const now = new Date()
    
    for (const [keyId, keyData] of oldKeys) {
      const age = now.getTime() - keyData.createdAt.getTime()
      if (age > this.policy.encryption.rotationInterval) {
        const newKey = crypto.randomBytes(this.policy.encryption.keySize)
        this.encryptionKeys.set(keyId, {
          key: newKey,
          createdAt: now
        })
        
        logger.info('Encryption key rotated', {
          action: 'key_rotation',
          metadata: { keyId, age }
        })
      }
    }
  }

  private cleanupAuditLogs(): void {
    const cutoff = Date.now() - (this.policy.audit.retentionDays * 24 * 60 * 60 * 1000)
    const initialCount = this.auditLogs.length
    
    this.auditLogs = this.auditLogs.filter(log => log.timestamp.getTime() > cutoff)
    
    const removedCount = initialCount - this.auditLogs.length
    if (removedCount > 0) {
      logger.info('Audit logs cleaned up', {
        action: 'audit_cleanup',
        metadata: { removedCount, remainingCount: this.auditLogs.length }
      })
    }
  }

  private cleanupRateLimitStore(): void {
    const now = Date.now()
    const toRemove: string[] = []
    
    for (const [key, record] of this.rateLimitStore.entries()) {
      if (now > record.resetTime) {
        toRemove.push(key)
      }
    }
    
    toRemove.forEach(key => this.rateLimitStore.delete(key))
  }

  private logSecurityEvent(action: string, details: Record<string, any>): void {
    if (!this.policy.audit.enabled) {
      return
    }

    const auditLog: SecurityAuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      userId: details.userId,
      action,
      resource: details.resource || 'unknown',
      result: details.result || 'success',
      ipAddress: details.ipAddress || 'unknown',
      userAgent: details.userAgent || 'unknown',
      details,
      riskScore: this.calculateRiskScore(action, details)
    }

    this.auditLogs.push(auditLog)
    
    // Keep only recent logs in memory
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-5000)
    }

    logger.info('Security event logged', {
      action: 'security_audit',
      metadata: { 
        auditId: auditLog.id,
        securityAction: action,
        riskScore: auditLog.riskScore
      }
    })
  }

  private calculateRiskScore(action: string, details: Record<string, any>): number {
    let score = 0
    
    // Base scores for different actions
    const actionScores = {
      authentication_failed: 3,
      authorization_denied: 2,
      rate_limit_exceeded: 1,
      authentication_blocked: 5,
      sql_injection: 8,
      xss: 6,
      brute_force: 9
    }
    
    score += actionScores[action as keyof typeof actionScores] || 1
    
    // Additional factors
    if (details.attempts > 5) score += 2
    if (details.severity === 'critical') score += 5
    if (details.severity === 'high') score += 3
    if (details.severity === 'medium') score += 1
    
    return Math.min(score, 10) // Cap at 10
  }
}

// Export singleton instance
export const securityHardening = new SecurityHardening()
export default securityHardening 