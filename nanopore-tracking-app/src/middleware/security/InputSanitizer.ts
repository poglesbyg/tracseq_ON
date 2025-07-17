/**
 * Input sanitization middleware for protecting against injection attacks
 */

import { z } from 'zod'

export interface SanitizationConfig {
  // HTML sanitization
  allowHTML: boolean
  allowedTags: string[]
  allowedAttributes: Record<string, string[]>
  
  // SQL injection protection
  sqlInjectionProtection: boolean
  
  // XSS protection
  xssProtection: boolean
  
  // Path traversal protection
  pathTraversalProtection: boolean
  
  // File upload validation
  fileUpload: {
    allowedTypes: string[]
    maxSize: number
    scanForMalware: boolean
  }
}

/**
 * Default sanitization configuration
 */
const defaultConfig: SanitizationConfig = {
  allowHTML: false,
  allowedTags: [],
  allowedAttributes: {},
  sqlInjectionProtection: true,
  xssProtection: true,
  pathTraversalProtection: true,
  fileUpload: {
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'],
    maxSize: 10 * 1024 * 1024, // 10MB
    scanForMalware: false
  }
}

/**
 * Input sanitizer class
 */
export class InputSanitizer {
  private config: SanitizationConfig

  constructor(config: Partial<SanitizationConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Sanitize string input
   */
  public sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string')
    }

    let sanitized = input

    // XSS protection
    if (this.config.xssProtection) {
      sanitized = this.removeXSSPatterns(sanitized)
    }

    // SQL injection protection
    if (this.config.sqlInjectionProtection) {
      sanitized = this.removeSQLInjectionPatterns(sanitized)
    }

    // Path traversal protection
    if (this.config.pathTraversalProtection) {
      sanitized = this.removePathTraversalPatterns(sanitized)
    }

    // HTML sanitization
    if (!this.config.allowHTML) {
      sanitized = this.stripHTML(sanitized)
    } else {
      sanitized = this.sanitizeHTML(sanitized)
    }

    return sanitized.trim()
  }

  /**
   * Sanitize object recursively
   */
  public sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj)
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item))
    }

    if (typeof obj === 'object') {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key)
        sanitized[sanitizedKey] = this.sanitizeObject(value)
      }
      return sanitized
    }

    return obj
  }

  /**
   * Remove XSS patterns
   */
  private removeXSSPatterns(input: string): string {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
      /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /expression\s*\(/gi
    ]

    let sanitized = input
    for (const pattern of xssPatterns) {
      sanitized = sanitized.replace(pattern, '')
    }

    return sanitized
  }

  /**
   * Remove SQL injection patterns
   */
  private removeSQLInjectionPatterns(input: string): string {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
      /(\b(OR|AND)\s+["']?\w+["']?\s*=\s*["']?\w+["']?)/gi,
      /(['"])\s*;\s*\w+/gi,
      /\/\*[\s\S]*?\*\//gi,
      /--[\s\S]*$/gm,
      /\bxp_\w+/gi,
      /\bsp_\w+/gi
    ]

    let sanitized = input
    for (const pattern of sqlPatterns) {
      sanitized = sanitized.replace(pattern, '')
    }

    return sanitized
  }

  /**
   * Remove path traversal patterns
   */
  private removePathTraversalPatterns(input: string): string {
    const pathPatterns = [
      /\.\.\//g,
      /\.\.\\/g,
      /%2e%2e%2f/gi,
      /%2e%2e%5c/gi,
      /\.\.%2f/gi,
      /\.\.%5c/gi,
      /%2e%2e\//gi,
      /%2e%2e\\/gi
    ]

    let sanitized = input
    for (const pattern of pathPatterns) {
      sanitized = sanitized.replace(pattern, '')
    }

    return sanitized
  }

  /**
   * Strip HTML tags
   */
  private stripHTML(input: string): string {
    return input.replace(/<[^>]*>/g, '')
  }

  /**
   * Sanitize HTML (basic implementation)
   */
  private sanitizeHTML(input: string): string {
    // This is a basic implementation
    // In production, consider using a library like DOMPurify
    let sanitized = input

    // Remove dangerous tags
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'applet', 'form', 'input']
    for (const tag of dangerousTags) {
      const regex = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi')
      sanitized = sanitized.replace(regex, '')
    }

    // Remove dangerous attributes
    const dangerousAttrs = ['onload', 'onclick', 'onmouseover', 'onerror', 'onsubmit']
    for (const attr of dangerousAttrs) {
      const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi')
      sanitized = sanitized.replace(regex, '')
    }

    return sanitized
  }

  /**
   * Validate file upload
   */
  public validateFileUpload(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check file type
    if (!this.config.fileUpload.allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`)
    }

    // Check file size
    if (file.size > this.config.fileUpload.maxSize) {
      errors.push(`File size exceeds maximum allowed size of ${this.config.fileUpload.maxSize} bytes`)
    }

    // Check file name for malicious patterns
    const fileName = file.name
    if (this.containsMaliciousPattern(fileName)) {
      errors.push('File name contains potentially malicious patterns')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Check for malicious patterns in file names
   */
  private containsMaliciousPattern(fileName: string): boolean {
    const maliciousPatterns = [
      /\.\./,
      /[<>:"|?*]/,
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,
      /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|ps1)$/i
    ]

    return maliciousPatterns.some(pattern => pattern.test(fileName))
  }

  /**
   * Create Zod schema with sanitization
   */
  public createSanitizedSchema<T extends z.ZodRawShape>(schema: T) {
    const sanitizedSchema = z.object(schema)

    return sanitizedSchema.transform((data) => {
      return this.sanitizeObject(data)
    })
  }

  /**
   * Middleware for request sanitization
   */
  public middleware() {
    return async (request: Request, next: () => Promise<Response>) => {
      // Only sanitize POST, PUT, PATCH requests with JSON content
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const contentType = request.headers.get('Content-Type')
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const body = await request.json()
            const sanitizedBody = this.sanitizeObject(body)
            
            // Create new request with sanitized body
            const sanitizedRequest = new Request(request.url, {
              method: request.method,
              headers: request.headers,
              body: JSON.stringify(sanitizedBody)
            })
            
            return next()
          } catch (error) {
            // If JSON parsing fails, continue with original request
            return next()
          }
        }
      }
      
      return next()
    }
  }
}

/**
 * Create input sanitizer instance
 */
export const inputSanitizer = new InputSanitizer()

/**
 * Sanitization utilities
 */
export const sanitize = {
  string: (input: string) => inputSanitizer.sanitizeString(input),
  object: (obj: any) => inputSanitizer.sanitizeObject(obj),
  file: (file: File) => inputSanitizer.validateFileUpload(file)
} 