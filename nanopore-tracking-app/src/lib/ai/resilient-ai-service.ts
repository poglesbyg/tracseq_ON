import { aiService } from './ollama-service'
import { nanoporeFormService } from './nanopore-llm-service'
import { ragService } from './rag-system'
import { pdfTextService } from './pdf-text-extraction'
import type { NanoporeFormData } from './ollama-service'

interface CircuitBreakerState {
  failures: number
  lastFailureTime: number
  state: 'closed' | 'open' | 'half-open'
  nextAttemptTime: number
}

interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitterFactor: number
}

interface FallbackConfig {
  enablePatternMatching: boolean
  enableBasicExtraction: boolean
  enableCachedResults: boolean
  cacheExpirationMs: number
}

interface AIServiceMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  circuitBreakerTrips: number
  fallbackUsage: number
  lastSuccessTime: number
  lastFailureTime: number
}

class ResilientAIService {
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed',
    nextAttemptTime: 0
  }

  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.1
  }

  private fallbackConfig: FallbackConfig = {
    enablePatternMatching: true,
    enableBasicExtraction: true,
    enableCachedResults: true,
    cacheExpirationMs: 3600000 // 1 hour
  }

  private metrics: AIServiceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    circuitBreakerTrips: 0,
    fallbackUsage: 0,
    lastSuccessTime: 0,
    lastFailureTime: 0
  }

  private resultCache = new Map<string, { data: any; timestamp: number }>()
  private readonly circuitBreakerThreshold = 5
  private readonly circuitBreakerTimeout = 60000 // 1 minute

  constructor(
    retryConfig?: Partial<RetryConfig>,
    fallbackConfig?: Partial<FallbackConfig>
  ) {
    this.retryConfig = { ...this.retryConfig, ...retryConfig }
    this.fallbackConfig = { ...this.fallbackConfig, ...fallbackConfig }
  }

  private updateCircuitBreaker(success: boolean): void {
    const now = Date.now()

    if (success) {
      this.circuitBreaker.failures = 0
      this.circuitBreaker.state = 'closed'
      this.metrics.lastSuccessTime = now
    } else {
      this.circuitBreaker.failures++
      this.circuitBreaker.lastFailureTime = now
      this.metrics.lastFailureTime = now

      if (this.circuitBreaker.failures >= this.circuitBreakerThreshold) {
        this.circuitBreaker.state = 'open'
        this.circuitBreaker.nextAttemptTime = now + this.circuitBreakerTimeout
        this.metrics.circuitBreakerTrips++
        console.warn('AI service circuit breaker opened due to repeated failures')
      }
    }
  }

  private canAttemptRequest(): boolean {
    const now = Date.now()

    switch (this.circuitBreaker.state) {
      case 'closed':
        return true
      case 'open':
        if (now >= this.circuitBreaker.nextAttemptTime) {
          this.circuitBreaker.state = 'half-open'
          return true
        }
        return false
      case 'half-open':
        return true
      default:
        return false
    }
  }

  private calculateDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
      this.retryConfig.maxDelay
    )

    // Add jitter to prevent thundering herd
    const jitter = delay * this.retryConfig.jitterFactor * Math.random()
    return delay + jitter
  }

  private getCacheKey(operation: string, input: any): string {
    return `${operation}:${JSON.stringify(input)}`
  }

  private getCachedResult(key: string): any | null {
    if (!this.fallbackConfig.enableCachedResults) {
      return null
    }

    const cached = this.resultCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.fallbackConfig.cacheExpirationMs) {
      return cached.data
    }

    if (cached) {
      this.resultCache.delete(key)
    }

    return null
  }

  private setCachedResult(key: string, data: any): void {
    if (this.fallbackConfig.enableCachedResults) {
      this.resultCache.set(key, { data, timestamp: Date.now() })
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      if (!this.canAttemptRequest()) {
        throw new Error('AI service circuit breaker is open')
      }

      try {
        const startTime = Date.now()
        const result = await operation()
        
        const responseTime = Date.now() - startTime
        this.metrics.averageResponseTime = 
          (this.metrics.averageResponseTime * this.metrics.successfulRequests + responseTime) / 
          (this.metrics.successfulRequests + 1)

        this.updateCircuitBreaker(true)
        this.metrics.successfulRequests++
        
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt === this.retryConfig.maxRetries) {
          this.updateCircuitBreaker(false)
          this.metrics.failedRequests++
          break
        }

        const delay = this.calculateDelay(attempt)
        console.warn(`${operationName} failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, lastError.message)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError || new Error(`${operationName} failed after ${this.retryConfig.maxRetries} attempts`)
  }

  private async patternMatchingFallback(text: string): Promise<NanoporeFormData> {
    console.log('Using pattern matching fallback for text extraction')
    
    // Basic pattern matching for common fields
    const patterns = {
      sampleName: /(?:sample\s+name|sample\s+id|id):\s*([^\n\r]+)/i,
      submitterName: /(?:submitter|submitted\s+by|contact\s+name):\s*([^\n\r]+)/i,
      submitterEmail: /(?:email|e-mail|contact):\s*([^\n\r]+)/i,
      concentration: /(?:concentration|conc):\s*([^\n\r]+)/i,
      volume: /(?:volume|vol):\s*([^\n\r]+)/i,
      sampleType: /(?:sample\s+type|type):\s*([^\n\r]+)/i,
      priority: /(?:priority|urgency):\s*([^\n\r]+)/i
    }

    const extracted: Partial<NanoporeFormData> = {}
    
         for (const [field, pattern] of Object.entries(patterns)) {
       const match = text.match(pattern)
       if (match && match[1]) {
         (extracted as any)[field] = match[1].trim()
       }
     }

    return {
      ...extracted,
      extractionMethod: 'pattern',
      confidence: 0.6,
      issues: ['Extracted using pattern matching fallback']
    } as NanoporeFormData
  }

  private async basicExtractionFallback(text: string): Promise<NanoporeFormData> {
    console.log('Using basic extraction fallback')
    
    // Very basic extraction - just look for key-value pairs
    const lines = text.split('\n')
    const extracted: Partial<NanoporeFormData> = {}
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase()
        const value = line.substring(colonIndex + 1).trim()
        
        if (value) {
          if (key.includes('sample') && key.includes('name')) {
            extracted.sampleName = value
          } else if (key.includes('submitter') || key.includes('contact')) {
            extracted.submitterName = value
          } else if (key.includes('email')) {
            extracted.submitterEmail = value
          } else if (key.includes('concentration')) {
            extracted.concentration = value
          } else if (key.includes('volume')) {
            extracted.volume = value
          }
        }
      }
    }

    return {
      ...extracted,
      extractionMethod: 'basic',
      confidence: 0.4,
      issues: ['Extracted using basic fallback method']
    } as NanoporeFormData
  }

  async extractFormData(file: File): Promise<{
    success: boolean
    data?: NanoporeFormData
    error?: string
    processingTime: number
    fallbackUsed: boolean
  }> {
    const startTime = Date.now()
    this.metrics.totalRequests++

    const cacheKey = this.getCacheKey('extractFormData', { name: file.name, size: file.size })
    const cachedResult = this.getCachedResult(cacheKey)
    
    if (cachedResult) {
      console.log('Using cached result for form data extraction')
      return {
        ...cachedResult,
        processingTime: Date.now() - startTime,
        fallbackUsed: false
      }
    }

    try {
      // Try primary AI service
      const result = await this.executeWithRetry(
        () => nanoporeFormService.extractFormData(file),
        'AI form extraction'
      )

      this.setCachedResult(cacheKey, result)
      return {
        ...result,
        processingTime: Date.now() - startTime,
        fallbackUsed: false
      }
    } catch (error) {
      console.warn('Primary AI service failed, attempting fallback methods:', error)
      this.metrics.fallbackUsage++

      try {
        // Fallback 1: Extract text and use pattern matching
        const textResult = await pdfTextService.extractText(file)
        if (textResult.success && textResult.data) {
          let fallbackData: NanoporeFormData

          if (this.fallbackConfig.enablePatternMatching) {
            fallbackData = await this.patternMatchingFallback(textResult.data.rawText)
          } else if (this.fallbackConfig.enableBasicExtraction) {
            fallbackData = await this.basicExtractionFallback(textResult.data.rawText)
          } else {
            throw new Error('No fallback methods enabled')
          }

          const fallbackResult = {
            success: true,
            data: fallbackData,
            processingTime: Date.now() - startTime
          }

          this.setCachedResult(cacheKey, fallbackResult)
          return {
            ...fallbackResult,
            fallbackUsed: true
          }
        }
      } catch (fallbackError) {
        console.error('Fallback methods also failed:', fallbackError)
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        fallbackUsed: true
      }
    }
  }

  async enhanceWithRAG(data: any, originalText?: string): Promise<{
    success: boolean
    enhancedData?: any
    ragInsights?: any
    recommendations?: string[]
    error?: string
    fallbackUsed: boolean
  }> {
    this.metrics.totalRequests++

    const cacheKey = this.getCacheKey('enhanceWithRAG', data)
    const cachedResult = this.getCachedResult(cacheKey)
    
    if (cachedResult) {
      return { ...cachedResult, fallbackUsed: false }
    }

    try {
      const result = await this.executeWithRetry(
        () => ragService.enhanceExtraction(data),
        'RAG enhancement'
      )

      const enhancedResult = {
        success: true,
        enhancedData: result.enhancedData,
        ragInsights: result.ragInsights,
        recommendations: result.recommendations
      }

      this.setCachedResult(cacheKey, enhancedResult)
      return { ...enhancedResult, fallbackUsed: false }
    } catch (error) {
      console.warn('RAG enhancement failed, using original data:', error)
      this.metrics.fallbackUsage++

      return {
        success: true,
        enhancedData: data,
        ragInsights: null,
        recommendations: ['RAG enhancement unavailable, using original data'],
        fallbackUsed: true
      }
    }
  }

  async checkServiceHealth(): Promise<{
    aiService: boolean
    ragService: boolean
    pdfService: boolean
    circuitBreakerState: string
    metrics: AIServiceMetrics
  }> {
    const [aiHealthy, ragHealthy, pdfHealthy] = await Promise.all([
      aiService.isAvailable().catch(() => false),
      ragService.isAvailable().catch(() => false),
      pdfTextService.isAvailable().catch(() => false)
    ])

    return {
      aiService: aiHealthy,
      ragService: ragHealthy,
      pdfService: pdfHealthy,
      circuitBreakerState: this.circuitBreaker.state,
      metrics: { ...this.metrics }
    }
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed',
      nextAttemptTime: 0
    }
    console.log('AI service circuit breaker reset')
  }

  clearCache(): void {
    this.resultCache.clear()
    console.log('AI service cache cleared')
  }

  getMetrics(): AIServiceMetrics {
    return { ...this.metrics }
  }

  updateConfig(
    retryConfig?: Partial<RetryConfig>,
    fallbackConfig?: Partial<FallbackConfig>
  ): void {
    if (retryConfig) {
      this.retryConfig = { ...this.retryConfig, ...retryConfig }
    }
    if (fallbackConfig) {
      this.fallbackConfig = { ...this.fallbackConfig, ...fallbackConfig }
    }
    console.log('AI service configuration updated')
  }
}

// Export singleton instance
export const resilientAIService = new ResilientAIService()

// Export types
export type { RetryConfig, FallbackConfig, AIServiceMetrics } 