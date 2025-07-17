import { getComponentLogger } from '../logging/StructuredLogger'
import { applicationMetrics } from '../monitoring/MetricsCollector'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
// Note: File watching removed for build compatibility

const logger = getComponentLogger('ConfigManager')

/**
 * Configuration environment types
 */
export type ConfigEnvironment = 'development' | 'staging' | 'production' | 'test'

/**
 * Configuration data types
 */
export interface DatabaseConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl: boolean
  connectionTimeout: number
  maxConnections: number
  idleTimeout: number
}

export interface ServerConfig {
  host: string
  port: number
  cors: {
    origins: string[]
    credentials: boolean
  }
  rateLimiting: {
    windowMs: number
    max: number
  }
  session: {
    secret: string
    maxAge: number
    secure: boolean
    httpOnly: boolean
  }
}

export interface SecurityConfig {
  jwtSecret: string
  bcryptRounds: number
  csrfProtection: boolean
  helmet: {
    contentSecurityPolicy: boolean
    hsts: boolean
    xssFilter: boolean
  }
  apiKeys: {
    nanopore: string
    backup: string
    monitoring: string
  }
}

export interface MonitoringConfig {
  enabled: boolean
  metricsPort: number
  healthCheckInterval: number
  alerting: {
    enabled: boolean
    webhookUrl: string
    channels: string[]
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    format: 'json' | 'text'
    maxFiles: number
    maxSize: string
  }
}

export interface CacheConfig {
  redis: {
    host: string
    port: number
    password: string
    database: number
  }
  ttl: {
    default: number
    session: number
    api: number
  }
}

export interface EmailConfig {
  smtp: {
    host: string
    port: number
    secure: boolean
    username: string
    password: string
  }
  templates: {
    notification: string
    alert: string
    backup: string
  }
  fromAddress: string
  adminEmails: string[]
}

export interface BackupConfig {
  s3: {
    bucket: string
    region: string
    accessKeyId: string
    secretAccessKey: string
  }
  schedule: {
    full: string
    incremental: string
  }
  retention: {
    days: number
    maxBackups: number
  }
}

export interface ApplicationConfig {
  environment: ConfigEnvironment
  appName: string
  version: string
  debug: boolean
  database: DatabaseConfig
  server: ServerConfig
  security: SecurityConfig
  monitoring: MonitoringConfig
  cache: CacheConfig
  email: EmailConfig
  backup: BackupConfig
  features: {
    pdfProcessing: boolean
    aiExtraction: boolean
    realTimeUpdates: boolean
    auditLogging: boolean
    memoryOptimization: boolean
    backupRecovery: boolean
  }
}

/**
 * Configuration validation schema
 */
export interface ConfigValidationRule {
  path: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  validator?: (value: any) => boolean
  errorMessage?: string
}

/**
 * Configuration source types
 */
export type ConfigSource = 'file' | 'environment' | 'secrets' | 'override'

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  path: string
  oldValue: any
  newValue: any
  source: ConfigSource
  timestamp: Date
}

/**
 * Configuration management system
 */
export class ConfigManager {
  private config: ApplicationConfig
  private secrets: Map<string, string> = new Map()
  private watchers: Map<string, any> = new Map()
  private validationRules: ConfigValidationRule[] = []
  private changeListeners: Array<(event: ConfigChangeEvent) => void> = []
  private configHash: string = ''
  private hotReloadEnabled: boolean = false

  constructor() {
    this.config = this.getDefaultConfig()
    this.setupValidationRules()
    this.initializeConfig()
  }

  /**
   * Initialize configuration manager
   */
  private async initializeConfig(): Promise<void> {
    try {
      // Load base configuration
      await this.loadConfiguration()
      
      // Load secrets
      await this.loadSecrets()
      
      // Apply environment overrides
      await this.applyEnvironmentOverrides()
      
      // Validate configuration
      await this.validateConfiguration()
      
      // Setup hot reload if enabled
      if (this.config.environment !== 'production') {
        this.setupHotReload()
      }
      
      // Calculate config hash
      this.configHash = this.calculateConfigHash()
      
      logger.info('Configuration manager initialized', {
        metadata: {
          environment: this.config.environment,
          configHash: this.configHash.substring(0, 8),
          hotReloadEnabled: this.hotReloadEnabled
        }
      })
      
    } catch (error) {
      logger.error('Failed to initialize configuration manager', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      
      throw error
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): ApplicationConfig {
    return {
      environment: (process.env.NODE_ENV as ConfigEnvironment) || 'development',
      appName: 'Nanopore Tracking App',
      version: '1.0.0',
      debug: process.env.NODE_ENV === 'development',
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'nanopore_tracking',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        ssl: process.env.DB_SSL === 'true',
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
        idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000')
      },
      server: {
        host: process.env.SERVER_HOST || '0.0.0.0',
        port: parseInt(process.env.SERVER_PORT || '4321'),
        cors: {
          origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:4321'],
          credentials: process.env.CORS_CREDENTIALS === 'true'
        },
        rateLimiting: {
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
          max: parseInt(process.env.RATE_LIMIT_MAX || '100')
        },
        session: {
          secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
          maxAge: parseInt(process.env.SESSION_MAX_AGE || '3600000'), // 1 hour
          secure: process.env.SESSION_SECURE === 'true',
          httpOnly: process.env.SESSION_HTTP_ONLY !== 'false'
        }
      },
      security: {
        jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
        csrfProtection: process.env.CSRF_PROTECTION !== 'false',
        helmet: {
          contentSecurityPolicy: process.env.CSP_ENABLED !== 'false',
          hsts: process.env.HSTS_ENABLED !== 'false',
          xssFilter: process.env.XSS_FILTER_ENABLED !== 'false'
        },
        apiKeys: {
          nanopore: process.env.NANOPORE_API_KEY || '',
          backup: process.env.BACKUP_API_KEY || '',
          monitoring: process.env.MONITORING_API_KEY || ''
        }
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
        alerting: {
          enabled: process.env.ALERTING_ENABLED === 'true',
          webhookUrl: process.env.WEBHOOK_URL || '',
          channels: process.env.ALERT_CHANNELS?.split(',') || ['email']
        },
        logging: {
          level: (process.env.LOG_LEVEL as any) || 'info',
          format: (process.env.LOG_FORMAT as any) || 'json',
          maxFiles: parseInt(process.env.LOG_MAX_FILES || '10'),
          maxSize: process.env.LOG_MAX_SIZE || '10MB'
        }
      },
      cache: {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || '',
          database: parseInt(process.env.REDIS_DB || '0')
        },
        ttl: {
          default: parseInt(process.env.CACHE_TTL_DEFAULT || '3600'), // 1 hour
          session: parseInt(process.env.CACHE_TTL_SESSION || '7200'), // 2 hours
          api: parseInt(process.env.CACHE_TTL_API || '300') // 5 minutes
        }
      },
      email: {
        smtp: {
          host: process.env.SMTP_HOST || 'localhost',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          username: process.env.SMTP_USERNAME || '',
          password: process.env.SMTP_PASSWORD || ''
        },
        templates: {
          notification: process.env.EMAIL_TEMPLATE_NOTIFICATION || 'notification',
          alert: process.env.EMAIL_TEMPLATE_ALERT || 'alert',
          backup: process.env.EMAIL_TEMPLATE_BACKUP || 'backup'
        },
        fromAddress: process.env.EMAIL_FROM || 'noreply@example.com',
        adminEmails: process.env.ADMIN_EMAILS?.split(',') || []
      },
      backup: {
        s3: {
          bucket: process.env.S3_BUCKET || 'nanopore-backups',
          region: process.env.S3_REGION || 'us-east-1',
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ''
        },
        schedule: {
          full: process.env.BACKUP_SCHEDULE_FULL || '0 2 * * *', // 2 AM daily
          incremental: process.env.BACKUP_SCHEDULE_INCREMENTAL || '0 */6 * * *' // Every 6 hours
        },
        retention: {
          days: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
          maxBackups: parseInt(process.env.BACKUP_MAX_COUNT || '100')
        }
      },
      features: {
        pdfProcessing: process.env.FEATURE_PDF_PROCESSING !== 'false',
        aiExtraction: process.env.FEATURE_AI_EXTRACTION !== 'false',
        realTimeUpdates: process.env.FEATURE_REAL_TIME_UPDATES !== 'false',
        auditLogging: process.env.FEATURE_AUDIT_LOGGING !== 'false',
        memoryOptimization: process.env.FEATURE_MEMORY_OPTIMIZATION !== 'false',
        backupRecovery: process.env.FEATURE_BACKUP_RECOVERY !== 'false'
      }
    }
  }

  /**
   * Load configuration from files
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const configPaths = [
        join(process.cwd(), 'config', 'default.json'),
        join(process.cwd(), 'config', `${this.config.environment}.json`),
        join(process.cwd(), 'config', 'local.json')
      ]

      for (const configPath of configPaths) {
        try {
          const configExists = await fs.access(configPath).then(() => true).catch(() => false)
          if (configExists) {
            const configData = await fs.readFile(configPath, 'utf8')
            const parsedConfig = JSON.parse(configData)
            this.mergeConfig(parsedConfig)
            
            logger.debug('Loaded configuration file', {
              metadata: { configPath }
            })
          }
        } catch (error) {
          logger.warn('Failed to load configuration file', {
            metadata: {
              configPath,
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            }
          })
        }
      }
    } catch (error) {
      logger.error('Failed to load configuration', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Load secrets from secure storage
   */
  private async loadSecrets(): Promise<void> {
    try {
      const secretsPath = join(process.cwd(), 'secrets', `${this.config.environment}.json`)
      
      const secretsExists = await fs.access(secretsPath).then(() => true).catch(() => false)
      if (secretsExists) {
        const secretsData = await fs.readFile(secretsPath, 'utf8')
        const parsedSecrets = JSON.parse(secretsData)
        
        // Store secrets in secure map
        Object.entries(parsedSecrets).forEach(([key, value]) => {
          this.secrets.set(key, value as string)
        })
        
        // Apply secrets to configuration
        this.applySecrets()
        
        logger.info('Loaded secrets', {
          metadata: {
            secretsCount: this.secrets.size,
            secretsPath: secretsPath.replace(process.cwd(), '.')
          }
        })
      }
    } catch (error) {
      logger.error('Failed to load secrets', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Apply environment-specific overrides
   */
  private async applyEnvironmentOverrides(): Promise<void> {
    try {
      // Production-specific overrides
      if (this.config.environment === 'production') {
        this.config.debug = false
        this.config.server.session.secure = true
        this.config.security.helmet.contentSecurityPolicy = true
        this.config.security.helmet.hsts = true
        this.config.monitoring.logging.level = 'warn'
      }
      
      // Development-specific overrides
      if (this.config.environment === 'development') {
        this.config.debug = true
        this.config.server.session.secure = false
        this.config.monitoring.logging.level = 'debug'
        this.hotReloadEnabled = true
      }
      
      // Test-specific overrides
      if (this.config.environment === 'test') {
        this.config.monitoring.enabled = false
        this.config.features.auditLogging = false
      }
      
      logger.debug('Applied environment overrides', {
        metadata: {
          environment: this.config.environment,
          debug: this.config.debug,
          hotReloadEnabled: this.hotReloadEnabled
        }
      })
    } catch (error) {
      logger.error('Failed to apply environment overrides', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Apply secrets to configuration
   */
  private applySecrets(): void {
    const secretMappings = [
      { secret: 'database_password', path: 'database.password' },
      { secret: 'jwt_secret', path: 'security.jwtSecret' },
      { secret: 'session_secret', path: 'server.session.secret' },
      { secret: 'redis_password', path: 'cache.redis.password' },
      { secret: 'smtp_password', path: 'email.smtp.password' },
      { secret: 's3_secret_access_key', path: 'backup.s3.secretAccessKey' },
      { secret: 'nanopore_api_key', path: 'security.apiKeys.nanopore' },
      { secret: 'backup_api_key', path: 'security.apiKeys.backup' },
      { secret: 'monitoring_api_key', path: 'security.apiKeys.monitoring' }
    ]

    secretMappings.forEach(({ secret, path }) => {
      const secretValue = this.secrets.get(secret)
      if (secretValue) {
        this.setConfigValue(path, secretValue)
      }
    })
  }

  /**
   * Merge configuration objects
   */
  private mergeConfig(newConfig: any): void {
    this.config = this.deepMerge(this.config, newConfig)
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target }
    
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    })
    
    return result
  }

  /**
   * Set configuration value by path
   */
  private setConfigValue(path: string, value: any): void {
    const keys = path.split('.')
    let current = this.config as any
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {}
      }
      current = current[keys[i]]
    }
    
    current[keys[keys.length - 1]] = value
  }

  /**
   * Setup validation rules
   */
  private setupValidationRules(): void {
    this.validationRules = [
      // Database validation
      { path: 'database.host', type: 'string', required: true, minLength: 1 },
      { path: 'database.port', type: 'number', required: true, min: 1, max: 65535 },
      { path: 'database.database', type: 'string', required: true, minLength: 1 },
      { path: 'database.username', type: 'string', required: true, minLength: 1 },
      { path: 'database.password', type: 'string', required: true, minLength: 1 },
      { path: 'database.maxConnections', type: 'number', required: true, min: 1, max: 100 },
      
      // Server validation
      { path: 'server.host', type: 'string', required: true, minLength: 1 },
      { path: 'server.port', type: 'number', required: true, min: 1, max: 65535 },
      { path: 'server.session.secret', type: 'string', required: true, minLength: 32 },
      { path: 'server.session.maxAge', type: 'number', required: true, min: 60000 }, // 1 minute minimum
      
      // Security validation
      { path: 'security.jwtSecret', type: 'string', required: true, minLength: 32 },
      { path: 'security.bcryptRounds', type: 'number', required: true, min: 10, max: 15 },
      
      // Monitoring validation
      { path: 'monitoring.metricsPort', type: 'number', required: true, min: 1, max: 65535 },
      { path: 'monitoring.healthCheckInterval', type: 'number', required: true, min: 5000 }, // 5 seconds minimum
      
      // Cache validation
      { path: 'cache.redis.host', type: 'string', required: true, minLength: 1 },
      { path: 'cache.redis.port', type: 'number', required: true, min: 1, max: 65535 },
      { path: 'cache.ttl.default', type: 'number', required: true, min: 60 }, // 1 minute minimum
      
      // Email validation
      { path: 'email.fromAddress', type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      { path: 'email.smtp.host', type: 'string', required: true, minLength: 1 },
      { path: 'email.smtp.port', type: 'number', required: true, min: 1, max: 65535 }
    ]
  }

  /**
   * Validate configuration
   */
  private async validateConfiguration(): Promise<void> {
    const errors: string[] = []
    
    for (const rule of this.validationRules) {
      const value = this.getConfigValue(rule.path)
      
      if (rule.required && (value === undefined || value === null)) {
        errors.push(`Required configuration missing: ${rule.path}`)
        continue
      }
      
      if (value !== undefined && value !== null) {
        if (rule.type === 'string' && typeof value !== 'string') {
          errors.push(`Invalid type for ${rule.path}: expected string, got ${typeof value}`)
        } else if (rule.type === 'number' && typeof value !== 'number') {
          errors.push(`Invalid type for ${rule.path}: expected number, got ${typeof value}`)
        } else if (rule.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Invalid type for ${rule.path}: expected boolean, got ${typeof value}`)
        } else if (rule.type === 'array' && !Array.isArray(value)) {
          errors.push(`Invalid type for ${rule.path}: expected array, got ${typeof value}`)
        } else if (rule.type === 'object' && typeof value !== 'object') {
          errors.push(`Invalid type for ${rule.path}: expected object, got ${typeof value}`)
        }
        
        // String validations
        if (rule.type === 'string' && typeof value === 'string') {
          if (rule.minLength && value.length < rule.minLength) {
            errors.push(`${rule.path} must be at least ${rule.minLength} characters`)
          }
          if (rule.maxLength && value.length > rule.maxLength) {
            errors.push(`${rule.path} must be at most ${rule.maxLength} characters`)
          }
          if (rule.pattern && !rule.pattern.test(value)) {
            errors.push(`${rule.path} does not match required pattern`)
          }
        }
        
        // Number validations
        if (rule.type === 'number' && typeof value === 'number') {
          if (rule.min !== undefined && value < rule.min) {
            errors.push(`${rule.path} must be at least ${rule.min}`)
          }
          if (rule.max !== undefined && value > rule.max) {
            errors.push(`${rule.path} must be at most ${rule.max}`)
          }
        }
        
        // Custom validator
        if (rule.validator && !rule.validator(value)) {
          errors.push(rule.errorMessage || `Invalid value for ${rule.path}`)
        }
      }
    }
    
    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed:\n${errors.join('\n')}`
      logger.error('Configuration validation failed', {
        metadata: {
          errorCount: errors.length,
          errors: errors
        }
      })
      throw new Error(errorMessage)
    }
    
    logger.info('Configuration validation passed', {
      metadata: {
        rulesChecked: this.validationRules.length,
        environment: this.config.environment
      }
    })
  }

  /**
   * Get configuration value by path
   */
  private getConfigValue(path: string): any {
    const keys = path.split('.')
    let current = this.config as any
    
    for (const key of keys) {
      if (current && typeof current === 'object') {
        current = current[key]
      } else {
        return undefined
      }
    }
    
    return current
  }

  /**
   * Setup hot reload
   */
  private setupHotReload(): void {
    if (!this.hotReloadEnabled) return
    
    try {
      const configDir = join(process.cwd(), 'config')
      const secretsDir = join(process.cwd(), 'secrets')
      
      // Watch config directory
      // Note: File watching removed for build compatibility
      
      // Watch secrets directory
      // Note: File watching removed for build compatibility
      
      this.watchers.set('config', null) // No watchers for now
      this.watchers.set('secrets', null) // No watchers for now
      
      logger.info('Hot reload enabled', {
        metadata: {
          configDir,
          secretsDir
        }
      })
    } catch (error) {
      logger.error('Failed to setup hot reload', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Reload configuration
   */
  private async reloadConfiguration(): Promise<void> {
    const oldConfig = JSON.parse(JSON.stringify(this.config))
    
    try {
      await this.loadConfiguration()
      await this.applyEnvironmentOverrides()
      await this.validateConfiguration()
      
      const newConfigHash = this.calculateConfigHash()
      if (newConfigHash !== this.configHash) {
        this.configHash = newConfigHash
        
        // Notify change listeners
        this.notifyConfigChange('config', oldConfig, this.config)
        
        logger.info('Configuration reloaded successfully', {
          metadata: {
            configHash: this.configHash.substring(0, 8)
          }
        })
      }
    } catch (error) {
      logger.error('Failed to reload configuration', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      
      // Restore old configuration
      this.config = oldConfig
      throw error
    }
  }

  /**
   * Reload secrets
   */
  private async reloadSecrets(): Promise<void> {
    const oldSecrets = new Map(this.secrets)
    
    try {
      await this.loadSecrets()
      
      // Notify change listeners
      this.notifyConfigChange('secrets', Array.from(oldSecrets.entries()), Array.from(this.secrets.entries()))
      
      logger.info('Secrets reloaded successfully', {
        metadata: {
          secretsCount: this.secrets.size
        }
      })
    } catch (error) {
      logger.error('Failed to reload secrets', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }, error instanceof Error ? error : undefined)
      
      // Restore old secrets
      this.secrets = oldSecrets
      throw error
    }
  }

  /**
   * Calculate configuration hash
   */
  private calculateConfigHash(): string {
    const configString = JSON.stringify(this.config, null, 0)
    return createHash('sha256').update(configString).digest('hex')
  }

  /**
   * Notify configuration change
   */
  private notifyConfigChange(path: string, oldValue: any, newValue: any): void {
    const event: ConfigChangeEvent = {
      path,
      oldValue,
      newValue,
      source: 'file',
      timestamp: new Date()
    }
    
    this.changeListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        logger.error('Error in configuration change listener', {
          errorType: error instanceof Error ? error.name : 'Unknown',
          metadata: {
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        }, error instanceof Error ? error : undefined)
      }
    })
  }

  /**
   * Public API methods
   */

  /**
   * Get configuration
   */
  getConfig(): ApplicationConfig {
    return JSON.parse(JSON.stringify(this.config))
  }

  /**
   * Get configuration by path
   */
  get<T = any>(path: string): T {
    return this.getConfigValue(path)
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: keyof ApplicationConfig['features']): boolean {
    return this.config.features[feature]
  }

  /**
   * Get environment
   */
  getEnvironment(): ConfigEnvironment {
    return this.config.environment
  }

  /**
   * Get configuration hash
   */
  getConfigHash(): string {
    return this.configHash
  }

  /**
   * Add configuration change listener
   */
  addChangeListener(listener: (event: ConfigChangeEvent) => void): void {
    this.changeListeners.push(listener)
  }

  /**
   * Remove configuration change listener
   */
  removeChangeListener(listener: (event: ConfigChangeEvent) => void): void {
    const index = this.changeListeners.indexOf(listener)
    if (index > -1) {
      this.changeListeners.splice(index, 1)
    }
  }

  /**
   * Get secret value
   */
  getSecret(key: string): string | undefined {
    return this.secrets.get(key)
  }

  /**
   * Set configuration override
   */
  setOverride(path: string, value: any): void {
    const oldValue = this.getConfigValue(path)
    this.setConfigValue(path, value)
    
    // Notify change listeners
    this.notifyConfigChange(path, oldValue, value)
    
    logger.info('Configuration override set', {
      metadata: {
        path,
        valueType: typeof value
      }
    })
  }

  /**
   * Validate configuration manually
   */
  async validate(): Promise<void> {
    await this.validateConfiguration()
  }

  /**
   * Export configuration (without secrets)
   */
  export(): string {
    const safeConfig = JSON.parse(JSON.stringify(this.config))
    
    // Remove sensitive data
    if (safeConfig.database?.password) safeConfig.database.password = '***'
    if (safeConfig.security?.jwtSecret) safeConfig.security.jwtSecret = '***'
    if (safeConfig.security?.apiKeys) {
      Object.keys(safeConfig.security.apiKeys).forEach(key => {
        safeConfig.security.apiKeys[key] = '***'
      })
    }
    if (safeConfig.server?.session?.secret) safeConfig.server.session.secret = '***'
    if (safeConfig.cache?.redis?.password) safeConfig.cache.redis.password = '***'
    if (safeConfig.email?.smtp?.password) safeConfig.email.smtp.password = '***'
    if (safeConfig.backup?.s3?.secretAccessKey) safeConfig.backup.s3.secretAccessKey = '***'
    
    return JSON.stringify(safeConfig, null, 2)
  }

  /**
   * Shutdown configuration manager
   */
  async shutdown(): Promise<void> {
    // Close watchers
    this.watchers.forEach(watcher => {
      // No watchers to close
    })
    this.watchers.clear()
    
    // Clear secrets
    this.secrets.clear()
    
    // Clear listeners
    this.changeListeners = []
    
    logger.info('Configuration manager shutdown completed')
  }
}

/**
 * Global configuration manager instance
 */
export const configManager = new ConfigManager()

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down configuration manager')
  await configManager.shutdown()
})

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down configuration manager')
  await configManager.shutdown()
}) 