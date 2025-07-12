import { z } from 'zod'

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url().optional(),
  OLLAMA_HOST: z.string().url().default('http://localhost:11434'),
  OPENAI_API_KEY: z.string().optional(),
  MODAL_TOKEN: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ENABLE_ANALYTICS: z.boolean().default(false),
  ENABLE_DEVTOOLS: z.boolean().default(false),
})

// Application configuration schema
const appConfigSchema = z.object({
  app: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string(),
    homepage: z.string().url(),
  }),
  
  features: z.object({
    crispr: z.object({
      enabled: z.boolean(),
      maxGuides: z.number().min(1).max(100),
      defaultPamType: z.enum(['NGG', 'NRG', 'NNGRRT']),
      algorithms: z.array(z.string()),
    }),
    nanopore: z.object({
      enabled: z.boolean(),
      maxFileSize: z.number(), // in MB
      supportedFormats: z.array(z.string()),
    }),
    ai: z.object({
      enabled: z.boolean(),
      defaultModel: z.string(),
      maxTokens: z.number(),
      temperature: z.number().min(0).max(2),
    }),
  }),
  
  performance: z.object({
    caching: z.object({
      enabled: z.boolean(),
      ttl: z.number(), // in seconds
      maxSize: z.number(), // in MB
    }),
    polling: z.object({
      baseInterval: z.number(),
      maxInterval: z.number(),
      backoffMultiplier: z.number(),
    }),
    batch: z.object({
      maxSize: z.number(),
      timeout: z.number(),
    }),
  }),
  
  ui: z.object({
    theme: z.object({
      defaultMode: z.enum(['light', 'dark', 'system']),
      accentColor: z.string(),
    }),
    layout: z.object({
      sidebar: z.object({
        defaultCollapsed: z.boolean(),
        width: z.number(),
      }),
      header: z.object({
        showLogo: z.boolean(),
        showUserMenu: z.boolean(),
      }),
    }),
  }),
  
  api: z.object({
    baseUrl: z.string().url(),
    timeout: z.number(),
    retries: z.number(),
    rateLimit: z.object({
      requests: z.number(),
      window: z.number(), // in seconds
    }),
  }),
  
  security: z.object({
    cors: z.object({
      origins: z.array(z.string()),
      credentials: z.boolean(),
    }),
    headers: z.object({
      contentSecurityPolicy: z.boolean(),
      xssProtection: z.boolean(),
    }),
  }),
})

// Environment-specific configurations
const configurations = {
  development: {
    app: {
      name: 'TracSeq ON',
      version: '1.0.0',
      description: 'Laboratory Management System for CRISPR and Oxford Nanopore Sequencing',
      homepage: 'http://localhost:3000',
    },
    features: {
      crispr: {
        enabled: true,
        maxGuides: 50,
        defaultPamType: 'NGG' as const,
        algorithms: ['cas9', 'cas12', 'base-editing'],
      },
      nanopore: {
        enabled: true,
        maxFileSize: 100, // 100MB
        supportedFormats: ['pdf', 'xlsx', 'csv', 'txt'],
      },
      ai: {
        enabled: true,
        defaultModel: 'llama3.1:8b',
        maxTokens: 4096,
        temperature: 0.7,
      },
    },
    performance: {
      caching: {
        enabled: true,
        ttl: 300, // 5 minutes
        maxSize: 50, // 50MB
      },
      polling: {
        baseInterval: 5000, // 5 seconds
        maxInterval: 30000, // 30 seconds
        backoffMultiplier: 1.5,
      },
      batch: {
        maxSize: 10,
        timeout: 30000, // 30 seconds
      },
    },
    ui: {
      theme: {
        defaultMode: 'system' as const,
        accentColor: '#3b82f6',
      },
      layout: {
        sidebar: {
          defaultCollapsed: false,
          width: 280,
        },
        header: {
          showLogo: true,
          showUserMenu: true,
        },
      },
    },
    api: {
      baseUrl: 'http://localhost:3000',
      timeout: 30000,
      retries: 3,
      rateLimit: {
        requests: 100,
        window: 60, // 1 minute
      },
    },
    security: {
      cors: {
        origins: ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
      },
      headers: {
        contentSecurityPolicy: false,
        xssProtection: true,
      },
    },
  },
  
  production: {
    app: {
      name: 'TracSeq ON',
      version: '1.0.0',
      description: 'Laboratory Management System for CRISPR and Oxford Nanopore Sequencing',
      homepage: 'https://tracseq.unc.edu',
    },
    features: {
      crispr: {
        enabled: true,
        maxGuides: 100,
        defaultPamType: 'NGG' as const,
        algorithms: ['cas9', 'cas12', 'base-editing', 'prime-editing'],
      },
      nanopore: {
        enabled: true,
        maxFileSize: 500, // 500MB
        supportedFormats: ['pdf', 'xlsx', 'csv', 'txt', 'tsv'],
      },
      ai: {
        enabled: true,
        defaultModel: 'llama3.1:8b',
        maxTokens: 8192,
        temperature: 0.5,
      },
    },
    performance: {
      caching: {
        enabled: true,
        ttl: 600, // 10 minutes
        maxSize: 200, // 200MB
      },
      polling: {
        baseInterval: 10000, // 10 seconds
        maxInterval: 60000, // 1 minute
        backoffMultiplier: 2.0,
      },
      batch: {
        maxSize: 20,
        timeout: 60000, // 1 minute
      },
    },
    ui: {
      theme: {
        defaultMode: 'light' as const,
        accentColor: '#1e40af',
      },
      layout: {
        sidebar: {
          defaultCollapsed: false,
          width: 320,
        },
        header: {
          showLogo: true,
          showUserMenu: true,
        },
      },
    },
    api: {
      baseUrl: 'https://tracseq.unc.edu',
      timeout: 60000,
      retries: 5,
      rateLimit: {
        requests: 200,
        window: 60, // 1 minute
      },
    },
    security: {
      cors: {
        origins: ['https://tracseq.unc.edu'],
        credentials: true,
      },
      headers: {
        contentSecurityPolicy: true,
        xssProtection: true,
      },
    },
  },
  
  test: {
    app: {
      name: 'TracSeq ON (Test)',
      version: '1.0.0-test',
      description: 'Laboratory Management System for CRISPR and Oxford Nanopore Sequencing - Test Environment',
      homepage: 'http://localhost:3000',
    },
    features: {
      crispr: {
        enabled: true,
        maxGuides: 10,
        defaultPamType: 'NGG' as const,
        algorithms: ['cas9'],
      },
      nanopore: {
        enabled: true,
        maxFileSize: 10, // 10MB
        supportedFormats: ['pdf', 'txt'],
      },
      ai: {
        enabled: false,
        defaultModel: 'mock',
        maxTokens: 1024,
        temperature: 0.0,
      },
    },
    performance: {
      caching: {
        enabled: false,
        ttl: 60, // 1 minute
        maxSize: 10, // 10MB
      },
      polling: {
        baseInterval: 1000, // 1 second
        maxInterval: 5000, // 5 seconds
        backoffMultiplier: 1.2,
      },
      batch: {
        maxSize: 5,
        timeout: 10000, // 10 seconds
      },
    },
    ui: {
      theme: {
        defaultMode: 'light' as const,
        accentColor: '#ef4444',
      },
      layout: {
        sidebar: {
          defaultCollapsed: true,
          width: 240,
        },
        header: {
          showLogo: true,
          showUserMenu: false,
        },
      },
    },
    api: {
      baseUrl: 'http://localhost:3000',
      timeout: 5000,
      retries: 1,
      rateLimit: {
        requests: 50,
        window: 60, // 1 minute
      },
    },
    security: {
      cors: {
        origins: ['*'],
        credentials: false,
      },
      headers: {
        contentSecurityPolicy: false,
        xssProtection: false,
      },
    },
  },
} as const

// Get environment variables
function getEnvVars() {
  if (typeof window !== 'undefined') {
    // Client-side: use import.meta.env
    return {
      NODE_ENV: import.meta.env.MODE || 'development',
      DATABASE_URL: import.meta.env.DATABASE_URL,
      OLLAMA_HOST: import.meta.env.PUBLIC_OLLAMA_HOST || 'http://localhost:11434',
      OPENAI_API_KEY: import.meta.env.OPENAI_API_KEY,
      MODAL_TOKEN: import.meta.env.MODAL_TOKEN,
      LOG_LEVEL: import.meta.env.PUBLIC_LOG_LEVEL || 'info',
      ENABLE_ANALYTICS: import.meta.env.PUBLIC_ENABLE_ANALYTICS === 'true',
      ENABLE_DEVTOOLS: import.meta.env.PUBLIC_ENABLE_DEVTOOLS === 'true',
    }
  } else {
    // Server-side: use process.env
    return {
      NODE_ENV: process.env.NODE_ENV || 'development',
      DATABASE_URL: process.env.DATABASE_URL,
      OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://localhost:11434',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      MODAL_TOKEN: process.env.MODAL_TOKEN,
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS === 'true',
      ENABLE_DEVTOOLS: process.env.ENABLE_DEVTOOLS === 'true',
    }
  }
}

// Validate environment variables
const env = envSchema.parse(getEnvVars())

// Get the configuration for the current environment
const currentEnv = env.NODE_ENV
const rawConfig = configurations[currentEnv]

// Validate and parse the configuration
const config = appConfigSchema.parse(rawConfig)

// Export the configuration and environment
export { config, env }
export type AppConfig = z.infer<typeof appConfigSchema>
export type Environment = z.infer<typeof envSchema>

// Configuration utilities
export const configUtils = {
  isDevelopment: () => env.NODE_ENV === 'development',
  isProduction: () => env.NODE_ENV === 'production',
  isTest: () => env.NODE_ENV === 'test',
  
  // Feature flags
  isFeatureEnabled: (feature: keyof AppConfig['features']) => {
    return config.features[feature].enabled
  },
  
  // API configuration
  getApiConfig: () => ({
    baseUrl: config.api.baseUrl,
    timeout: config.api.timeout,
    retries: config.api.retries,
    headers: {
      'Content-Type': 'application/json',
      ...(env.ENABLE_ANALYTICS && { 'X-Analytics': 'enabled' }),
    },
  }),
  
  // Performance settings
  getPerformanceConfig: () => config.performance,
  
  // UI configuration
  getUIConfig: () => config.ui,
  
  // Security settings
  getSecurityConfig: () => config.security,
  
  // Debug information
  getDebugInfo: () => ({
    environment: env.NODE_ENV,
    version: config.app.version,
    features: Object.entries(config.features).map(([key, value]) => ({
      name: key,
      enabled: value.enabled,
    })),
    performance: {
      caching: config.performance.caching.enabled,
      polling: config.performance.polling.baseInterval,
    },
  }),
}

// Export individual configuration sections for convenience
export const appInfo = config.app
export const features = config.features
export const performance = config.performance
export const ui = config.ui
export const api = config.api
export const security = config.security 