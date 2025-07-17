/**
 * Security headers middleware for protecting against common web vulnerabilities
 */

export interface SecurityHeadersConfig {
  // Content Security Policy
  csp: {
    enabled: boolean
    directives: {
      defaultSrc: string[]
      scriptSrc: string[]
      styleSrc: string[]
      imgSrc: string[]
      connectSrc: string[]
      fontSrc: string[]
      objectSrc: string[]
      mediaSrc: string[]
      frameSrc: string[]
    }
  }
  
  // HTTP Strict Transport Security
  hsts: {
    enabled: boolean
    maxAge: number
    includeSubDomains: boolean
    preload: boolean
  }
  
  // X-Frame-Options
  frameOptions: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM' | 'DISABLED'
  
  // X-Content-Type-Options
  contentTypeOptions: boolean
  
  // X-XSS-Protection
  xssProtection: {
    enabled: boolean
    mode: 'block' | 'sanitize'
  }
  
  // Referrer Policy
  referrerPolicy: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url'
  
  // Permissions Policy
  permissionsPolicy: {
    enabled: boolean
    directives: Record<string, string[]>
  }
  
  // Cross-Origin Policies
  crossOriginEmbedderPolicy: 'unsafe-none' | 'require-corp' | 'credentialless'
  crossOriginOpenerPolicy: 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin'
  crossOriginResourcePolicy: 'same-site' | 'same-origin' | 'cross-origin'
}

/**
 * Default security headers configuration
 */
const defaultConfig: SecurityHeadersConfig = {
  csp: {
    enabled: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    enabled: true,
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameOptions: 'DENY',
  contentTypeOptions: true,
  xssProtection: {
    enabled: true,
    mode: 'block'
  },
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    enabled: true,
    directives: {
      camera: [],
      microphone: [],
      geolocation: [],
      gyroscope: [],
      magnetometer: [],
      accelerometer: [],
      payment: [],
      usb: []
    }
  },
  crossOriginEmbedderPolicy: 'unsafe-none',
  crossOriginOpenerPolicy: 'same-origin-allow-popups',
  crossOriginResourcePolicy: 'same-site'
}

/**
 * Security headers middleware class
 */
export class SecurityHeaders {
  private config: SecurityHeadersConfig

  constructor(config: Partial<SecurityHeadersConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Apply security headers to a response
   */
  public applyHeaders(response: Response): Response {
    const headers = new Headers(response.headers)

    // Content Security Policy
    if (this.config.csp.enabled) {
      const cspDirectives = Object.entries(this.config.csp.directives)
        .map(([key, values]) => `${this.camelToKebab(key)} ${values.join(' ')}`)
        .join('; ')
      
      headers.set('Content-Security-Policy', cspDirectives)
    }

    // HTTP Strict Transport Security
    if (this.config.hsts.enabled) {
      let hstsValue = `max-age=${this.config.hsts.maxAge}`
      if (this.config.hsts.includeSubDomains) {
        hstsValue += '; includeSubDomains'
      }
      if (this.config.hsts.preload) {
        hstsValue += '; preload'
      }
      headers.set('Strict-Transport-Security', hstsValue)
    }

    // X-Frame-Options
    if (this.config.frameOptions !== 'DISABLED') {
      headers.set('X-Frame-Options', this.config.frameOptions)
    }

    // X-Content-Type-Options
    if (this.config.contentTypeOptions) {
      headers.set('X-Content-Type-Options', 'nosniff')
    }

    // X-XSS-Protection
    if (this.config.xssProtection.enabled) {
      const xssValue = this.config.xssProtection.mode === 'block' ? '1; mode=block' : '1'
      headers.set('X-XSS-Protection', xssValue)
    }

    // Referrer Policy
    headers.set('Referrer-Policy', this.config.referrerPolicy)

    // Permissions Policy
    if (this.config.permissionsPolicy.enabled) {
      const permissionsDirectives = Object.entries(this.config.permissionsPolicy.directives)
        .map(([key, values]) => `${key}=(${values.join(' ')})`)
        .join(', ')
      
      if (permissionsDirectives) {
        headers.set('Permissions-Policy', permissionsDirectives)
      }
    }

    // Cross-Origin Policies
    headers.set('Cross-Origin-Embedder-Policy', this.config.crossOriginEmbedderPolicy)
    headers.set('Cross-Origin-Opener-Policy', this.config.crossOriginOpenerPolicy)
    headers.set('Cross-Origin-Resource-Policy', this.config.crossOriginResourcePolicy)

    // Additional security headers
    headers.set('X-Powered-By', '') // Hide server information
    headers.set('Server', '') // Hide server information
    headers.set('X-DNS-Prefetch-Control', 'off') // Disable DNS prefetching
    headers.set('X-Download-Options', 'noopen') // Prevent file downloads from opening
    headers.set('X-Permitted-Cross-Domain-Policies', 'none') // Restrict cross-domain policies

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  }

  /**
   * Middleware function for Astro
   */
  public middleware() {
    return (request: Request, next: () => Promise<Response>) => {
      return next().then(response => this.applyHeaders(response))
    }
  }

  /**
   * Check if request is secure (HTTPS)
   */
  public isSecureRequest(request: Request): boolean {
    const url = new URL(request.url)
    return url.protocol === 'https:' || url.hostname === 'localhost'
  }

  /**
   * Validate Content-Type header
   */
  public validateContentType(request: Request, allowedTypes: string[]): boolean {
    const contentType = request.headers.get('Content-Type')
    if (!contentType) return false
    
    return allowedTypes.some(type => contentType.includes(type))
  }

  /**
   * Generate nonce for CSP
   */
  public generateNonce(): string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Update CSP with nonce
   */
  public updateCSPWithNonce(nonce: string): void {
    this.config.csp.directives.scriptSrc = [
      ...this.config.csp.directives.scriptSrc.filter(src => !src.includes('nonce-')),
      `'nonce-${nonce}'`
    ]
  }

  /**
   * Convert camelCase to kebab-case
   */
  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
  }
}

/**
 * Create security headers middleware instance
 */
export const securityHeaders = new SecurityHeaders()

/**
 * Security headers for API responses
 */
export function apiSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  
  // API-specific security headers
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-XSS-Protection', '1; mode=block')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Cross-Origin-Resource-Policy', 'same-site')
  
  // Remove server information
  headers.set('X-Powered-By', '')
  headers.set('Server', '')
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

/**
 * CORS configuration for API endpoints
 */
export interface CORSConfig {
  origin: string[] | string | boolean
  credentials: boolean
  methods: string[]
  allowedHeaders: string[]
  exposedHeaders: string[]
  maxAge: number
}

export const defaultCORSConfig: CORSConfig = {
  origin: ['http://localhost:3001', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400 // 24 hours
}

/**
 * Apply CORS headers to response
 */
export function applyCORSHeaders(response: Response, config: CORSConfig = defaultCORSConfig): Response {
  const headers = new Headers(response.headers)
  
  // Handle origin
  if (typeof config.origin === 'string') {
    headers.set('Access-Control-Allow-Origin', config.origin)
  } else if (Array.isArray(config.origin)) {
    // In a real implementation, you'd check the request origin
    headers.set('Access-Control-Allow-Origin', config.origin[0])
  } else if (config.origin === true) {
    headers.set('Access-Control-Allow-Origin', '*')
  }
  
  // Other CORS headers
  headers.set('Access-Control-Allow-Credentials', config.credentials.toString())
  headers.set('Access-Control-Allow-Methods', config.methods.join(', '))
  headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '))
  headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '))
  headers.set('Access-Control-Max-Age', config.maxAge.toString())
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
} 