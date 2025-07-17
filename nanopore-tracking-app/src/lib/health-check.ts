import { db, testDatabaseConnection } from './database'
import { aiService } from './ai/ollama-service'
import { config, isFeatureEnabled } from './config'

export interface HealthCheckResult {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  message: string
  timestamp: Date
  responseTime?: number
  details?: Record<string, any>
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded'
  services: HealthCheckResult[]
  timestamp: Date
}

export class HealthChecker {
  async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now()
    
    try {
      const isConnected = await testDatabaseConnection()
      const responseTime = Date.now() - start
      
      if (isConnected) {
        // Additional database health checks
        const sampleCount = await db
          .selectFrom('nanopore_samples')
          .select((eb) => eb.fn.count('id').as('count'))
          .executeTakeFirst()
        
        return {
          service: 'database',
          status: 'healthy',
          message: 'Database connection successful',
          timestamp: new Date(),
          responseTime,
          details: {
            sampleCount: sampleCount?.count || 0,
            connectionString: config.database.url.replace(/:[^:@]*@/, ':***@') // Hide password
          }
        }
      } else {
        return {
          service: 'database',
          status: 'unhealthy',
          message: 'Database connection failed',
          timestamp: new Date(),
          responseTime
        }
      }
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        responseTime: Date.now() - start
      }
    }
  }

  async checkAI(): Promise<HealthCheckResult> {
    const start = Date.now()
    
    if (!isFeatureEnabled('aiFeatures')) {
      return {
        service: 'ai',
        status: 'healthy',
        message: 'AI features disabled',
        timestamp: new Date(),
        responseTime: 0,
        details: { enabled: false }
      }
    }

    try {
      const isAvailable = await aiService.isAvailable()
      const responseTime = Date.now() - start
      
      if (isAvailable) {
        // Test AI functionality with a simple query
        try {
          const testResponse = await aiService.generateResponse('Hello, respond with "OK"')
          const testPassed = testResponse.toLowerCase().includes('ok')
          
          return {
            service: 'ai',
            status: testPassed ? 'healthy' : 'degraded',
            message: testPassed ? 'AI service operational' : 'AI service responding but may have issues',
            timestamp: new Date(),
            responseTime,
            details: {
              host: config.ai.ollamaHost,
              model: config.ai.defaultModel,
              testResponse: testResponse.substring(0, 100)
            }
          }
        } catch (testError) {
          return {
            service: 'ai',
            status: 'degraded',
            message: 'AI service available but test failed',
            timestamp: new Date(),
            responseTime,
            details: {
              host: config.ai.ollamaHost,
              error: testError instanceof Error ? testError.message : 'Unknown error'
            }
          }
        }
      } else {
        return {
          service: 'ai',
          status: 'unhealthy',
          message: 'AI service unavailable',
          timestamp: new Date(),
          responseTime,
          details: { host: config.ai.ollamaHost }
        }
      }
    } catch (error) {
      return {
        service: 'ai',
        status: 'unhealthy',
        message: `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        responseTime: Date.now() - start
      }
    }
  }

  async checkFileSystem(): Promise<HealthCheckResult> {
    const start = Date.now()
    
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      
      // Check if upload directory exists and is writable
      const uploadDir = config.storage.uploadDir
      
      try {
        await fs.access(uploadDir)
      } catch {
        // Directory doesn't exist, try to create it
        await fs.mkdir(uploadDir, { recursive: true })
      }
      
      // Test write permissions
      const testFile = path.join(uploadDir, 'health-check.tmp')
      await fs.writeFile(testFile, 'health check test')
      await fs.unlink(testFile)
      
      const responseTime = Date.now() - start
      
      return {
        service: 'filesystem',
        status: 'healthy',
        message: 'File system accessible',
        timestamp: new Date(),
        responseTime,
        details: {
          uploadDir,
          maxFileSize: config.storage.maxFileSize,
          allowedTypes: config.storage.allowedFileTypes
        }
      }
    } catch (error) {
      return {
        service: 'filesystem',
        status: 'unhealthy',
        message: `File system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        responseTime: Date.now() - start
      }
    }
  }

  async checkEmail(): Promise<HealthCheckResult> {
    const start = Date.now()
    
    if (!config.email.enabled) {
      return {
        service: 'email',
        status: 'healthy',
        message: 'Email service disabled',
        timestamp: new Date(),
        responseTime: 0,
        details: { enabled: false }
      }
    }

    try {
      // Basic SMTP configuration check
      const nodemailer = await import('nodemailer')
      
      const transporter = nodemailer.default.createTransport({
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.port === 465,
        auth: {
          user: config.email.smtp.user,
          pass: config.email.smtp.pass
        }
      })
      
      // Verify SMTP connection
      await transporter.verify()
      
      const responseTime = Date.now() - start
      
      return {
        service: 'email',
        status: 'healthy',
        message: 'Email service configured',
        timestamp: new Date(),
        responseTime,
        details: {
          host: config.email.smtp.host,
          port: config.email.smtp.port,
          from: config.email.from
        }
      }
    } catch (error) {
      return {
        service: 'email',
        status: 'degraded',
        message: `Email service issue: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        responseTime: Date.now() - start
      }
    }
  }

  async checkSystemResources(): Promise<HealthCheckResult> {
    const start = Date.now()
    
    try {
      const os = await import('os')
      const process = await import('process')
      
      const totalMemory = os.totalmem()
      const freeMemory = os.freemem()
      const usedMemory = totalMemory - freeMemory
      const memoryUsage = (usedMemory / totalMemory) * 100
      
      const cpuUsage = os.loadavg()[0] // 1-minute load average
      const uptime = os.uptime()
      
      const processMemory = process.memoryUsage()
      
      const responseTime = Date.now() - start
      
      // Calculate process memory usage as percentage of heap
      const heapUsagePercent = (processMemory.heapUsed / processMemory.heapTotal) * 100
      const rssUsageMB = processMemory.rss / 1024 / 1024
      
      // Determine health based on process memory usage (more appropriate for containers)
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      let message = 'System resources normal'
      
      // Use process memory thresholds instead of system memory
      if (heapUsagePercent > 95 || rssUsageMB > 350) {
        status = 'unhealthy'
        message = 'High process memory usage detected'
      } else if (heapUsagePercent > 90 || rssUsageMB > 300) {
        status = 'degraded'
        message = 'Elevated process memory usage'
      }
      
      return {
        service: 'system',
        status,
        message,
        timestamp: new Date(),
        responseTime,
        details: {
          memory: {
            total: Math.round(totalMemory / 1024 / 1024),
            used: Math.round(usedMemory / 1024 / 1024),
            free: Math.round(freeMemory / 1024 / 1024),
            usagePercent: Math.round(memoryUsage)
          },
          process: {
            rss: Math.round(processMemory.rss / 1024 / 1024),
            heapUsed: Math.round(processMemory.heapUsed / 1024 / 1024),
            heapTotal: Math.round(processMemory.heapTotal / 1024 / 1024),
            heapUsagePercent: Math.round(heapUsagePercent)
          },
          cpu: {
            loadAverage: cpuUsage,
            uptime: Math.round(uptime)
          }
        }
      }
    } catch (error) {
      return {
        service: 'system',
        status: 'unhealthy',
        message: `System check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        responseTime: Date.now() - start
      }
    }
  }

  async checkAll(): Promise<SystemHealth> {
    const start = Date.now()
    
    // Run all health checks in parallel
    const [database, ai, filesystem, email, system] = await Promise.all([
      this.checkDatabase(),
      this.checkAI(),
      this.checkFileSystem(),
      this.checkEmail(),
      this.checkSystemResources()
    ])
    
    const services = [database, ai, filesystem, email, system]
    
    // Determine overall health
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length
    const degradedCount = services.filter(s => s.status === 'degraded').length
    
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (unhealthyCount > 0) {
      overall = 'unhealthy'
    } else if (degradedCount > 0) {
      overall = 'degraded'
    }
    
    console.log(`Health check completed in ${Date.now() - start}ms - Overall: ${overall}`)
    
    return {
      overall,
      services,
      timestamp: new Date()
    }
  }
}

export const healthChecker = new HealthChecker()

// Express middleware for health check endpoint
export function createHealthCheckMiddleware() {
  return async (req: any, res: any) => {
    try {
      const health = await healthChecker.checkAll()
      
      const statusCode = health.overall === 'healthy' ? 200 : 
                        health.overall === 'degraded' ? 200 : 503
      
      res.status(statusCode).json(health)
    } catch (error) {
      res.status(500).json({
        overall: 'unhealthy',
        services: [],
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
} 