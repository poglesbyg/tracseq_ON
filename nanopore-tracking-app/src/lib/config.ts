export interface AppConfig {
  // Database
  database: {
    url: string
    maxConnections: number
    idleTimeout: number
    connectionTimeout: number
  }
  
  // AI/ML Services
  ai: {
    ollamaHost: string
    defaultModel: string
    enabled: boolean
    timeout: number
  }
  
  // Application
  app: {
    nodeEnv: 'development' | 'production' | 'test'
    port: number
    host: string
    baseUrl: string
  }
  
  // Security
  security: {
    jwtSecret: string
    sessionSecret: string
    encryptionKey: string
    rateLimitWindow: number
    rateLimitMax: number
  }
  
  // File Storage
  storage: {
    uploadDir: string
    maxFileSize: number
    allowedFileTypes: string[]
  }
  
  // Email
  email: {
    smtp: {
      host: string
      port: number
      user: string
      pass: string
    }
    from: string
    enabled: boolean
  }
  
  // Monitoring
  monitoring: {
    logLevel: 'error' | 'warn' | 'info' | 'debug'
    sentryDsn?: string
  }
  
  // Features
  features: {
    aiFeatures: boolean
    pdfProcessing: boolean
    notifications: boolean
    auditLog: boolean
  }
  
  // Backup
  backup: {
    enabled: boolean
    schedule: string
    retentionDays: number
  }
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue
  if (!value) {
    throw new Error(`Environment variable ${name} is required`)
  }
  return value
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name]
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`)
  }
  return parsed
}

function getEnvBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]
  if (!value) return defaultValue
  return value.toLowerCase() === 'true'
}

export const config: AppConfig = {
  database: {
    url: getEnvVar('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/nanopore_db'),
    maxConnections: getEnvNumber('DB_MAX_CONNECTIONS', 10),
    idleTimeout: getEnvNumber('DB_IDLE_TIMEOUT', 30000),
    connectionTimeout: getEnvNumber('DB_CONNECTION_TIMEOUT', 2000)
  },
  
  ai: {
    ollamaHost: getEnvVar('OLLAMA_HOST', 'http://localhost:11434'),
    defaultModel: getEnvVar('OLLAMA_MODEL', 'llama3.2'),
    enabled: getEnvBoolean('ENABLE_AI_FEATURES', true),
    timeout: getEnvNumber('AI_TIMEOUT', 30000)
  },
  
  app: {
    nodeEnv: (process.env.NODE_ENV as AppConfig['app']['nodeEnv']) || 'development',
    port: getEnvNumber('PORT', 3001),
    host: getEnvVar('HOST', '0.0.0.0'),
    baseUrl: getEnvVar('BASE_URL', 'http://localhost:3001')
  },
  
  security: {
    jwtSecret: getEnvVar('JWT_SECRET', 'your-super-secret-jwt-key-here'),
    sessionSecret: getEnvVar('SESSION_SECRET', 'your-session-secret-here'),
    encryptionKey: getEnvVar('ENCRYPTION_KEY', 'your-32-character-encryption-key'),
    rateLimitWindow: getEnvNumber('RATE_LIMIT_WINDOW', 15),
    rateLimitMax: getEnvNumber('RATE_LIMIT_MAX', 100)
  },
  
  storage: {
    uploadDir: getEnvVar('UPLOAD_DIR', '/tmp/uploads'),
    maxFileSize: getEnvNumber('MAX_FILE_SIZE', 10485760), // 10MB
    allowedFileTypes: getEnvVar('ALLOWED_FILE_TYPES', 'pdf,doc,docx,txt,csv,xlsx').split(',')
  },
  
  email: {
    smtp: {
      host: getEnvVar('SMTP_HOST', 'smtp.gmail.com'),
      port: getEnvNumber('SMTP_PORT', 587),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    from: getEnvVar('FROM_EMAIL', 'noreply@nanopore-tracking.com'),
    enabled: getEnvBoolean('ENABLE_EMAIL', false)
  },
  
  monitoring: {
    logLevel: (process.env.LOG_LEVEL as AppConfig['monitoring']['logLevel']) || 'info',
    ...(process.env.SENTRY_DSN && { sentryDsn: process.env.SENTRY_DSN })
  },
  
  features: {
    aiFeatures: getEnvBoolean('ENABLE_AI_FEATURES', true),
    pdfProcessing: getEnvBoolean('ENABLE_PDF_PROCESSING', true),
    notifications: getEnvBoolean('ENABLE_NOTIFICATIONS', true),
    auditLog: getEnvBoolean('ENABLE_AUDIT_LOG', true)
  },
  
  backup: {
    enabled: getEnvBoolean('BACKUP_ENABLED', false),
    schedule: getEnvVar('BACKUP_SCHEDULE', '0 2 * * *'),
    retentionDays: getEnvNumber('BACKUP_RETENTION_DAYS', 30)
  }
}

// Validate critical configuration on startup
export function validateConfig(): void {
  const errors: string[] = []
  
  // Database validation
  if (!config.database.url.startsWith('postgresql://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string')
  }
  
  // Security validation
  if (config.app.nodeEnv === 'production') {
    if (config.security.jwtSecret === 'your-super-secret-jwt-key-here') {
      errors.push('JWT_SECRET must be set to a secure value in production')
    }
    if (config.security.sessionSecret === 'your-session-secret-here') {
      errors.push('SESSION_SECRET must be set to a secure value in production')
    }
    if (config.security.encryptionKey === 'your-32-character-encryption-key') {
      errors.push('ENCRYPTION_KEY must be set to a secure value in production')
    }
  }
  
  // AI service validation
  if (config.features.aiFeatures && !config.ai.ollamaHost) {
    errors.push('OLLAMA_HOST must be set when AI features are enabled')
  }
  
  if (errors.length > 0) {
    console.error('Configuration validation failed:')
    errors.forEach(error => console.error(`  - ${error}`))
    process.exit(1)
  }
}

// Helper functions for feature flags
export const isFeatureEnabled = (feature: keyof AppConfig['features']): boolean => {
  return config.features[feature]
}

export const isDevelopment = (): boolean => config.app.nodeEnv === 'development'
export const isProduction = (): boolean => config.app.nodeEnv === 'production'
export const isTest = (): boolean => config.app.nodeEnv === 'test'

// Export commonly used config values
export const {
  database: dbConfig,
  ai: aiConfig,
  app: appConfig,
  security: securityConfig,
  storage: storageConfig,
  email: emailConfig,
  monitoring: monitoringConfig,
  features: featureConfig,
  backup: backupConfig
} = config 