import { getComponentLogger } from '../logging/StructuredLogger'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'

const logger = getComponentLogger('DistributedTracing')

/**
 * Trace context for distributed tracing
 */
export interface TraceContext {
  traceId: string
  spanId: string
  parentSpanId?: string
  baggage?: Record<string, string>
  flags?: number
}

/**
 * Span information
 */
export interface Span {
  traceId: string
  spanId: string
  parentSpanId?: string
  operationName: string
  startTime: Date
  endTime?: Date
  duration?: number
  tags: Record<string, any>
  logs: Array<{
    timestamp: Date
    fields: Record<string, any>
  }>
  status: 'ok' | 'error' | 'timeout'
  serviceName: string
  baggage?: Record<string, string>
}

/**
 * Trace information
 */
export interface Trace {
  traceId: string
  spans: Span[]
  startTime: Date
  endTime?: Date
  duration?: number
  serviceName: string
  rootOperationName: string
  status: 'ok' | 'error' | 'timeout'
}

/**
 * Tracer configuration
 */
export interface TracerConfig {
  serviceName: string
  samplingRate: number
  maxSpans: number
  flushInterval: number
  exportUrl?: string
  enableLogging: boolean
}

/**
 * Span builder for creating spans
 */
export class SpanBuilder {
  private span: Partial<Span>
  private tracer: DistributedTracer

  constructor(tracer: DistributedTracer, operationName: string, parentContext?: TraceContext) {
    this.tracer = tracer
    this.span = {
      traceId: parentContext?.traceId || randomUUID(),
      spanId: randomUUID(),
      ...(parentContext?.spanId && { parentSpanId: parentContext.spanId }),
      operationName,
      startTime: new Date(),
      tags: {},
      logs: [],
      status: 'ok',
      serviceName: tracer.getServiceName(),
      ...(parentContext?.baggage && { baggage: parentContext.baggage })
    }
  }

  /**
   * Add tag to span
   */
  setTag(key: string, value: any): SpanBuilder {
    this.span.tags![key] = value
    return this
  }

  /**
   * Add multiple tags to span
   */
  setTags(tags: Record<string, any>): SpanBuilder {
    this.span.tags = { ...this.span.tags, ...tags }
    return this
  }

  /**
   * Add baggage item
   */
  setBaggage(key: string, value: string): SpanBuilder {
    if (!this.span.baggage) {
      this.span.baggage = {}
    }
    this.span.baggage[key] = value
    return this
  }

  /**
   * Start the span
   */
  start(): ActiveSpan {
    const span = this.span as Span
    
    logger.debug('Starting span', {
      action: 'start_span',
      metadata: {
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        operationName: span.operationName,
        serviceName: span.serviceName
      }
    })

    return new ActiveSpan(span, this.tracer)
  }
}

/**
 * Active span that can be finished
 */
export class ActiveSpan {
  constructor(private span: Span, private tracer: DistributedTracer) {}

  /**
   * Get trace context
   */
  getContext(): TraceContext {
    return {
      traceId: this.span.traceId,
      spanId: this.span.spanId,
      ...(this.span.parentSpanId && { parentSpanId: this.span.parentSpanId }),
      ...(this.span.baggage && { baggage: this.span.baggage })
    }
  }

  /**
   * Set tag on active span
   */
  setTag(key: string, value: any): ActiveSpan {
    this.span.tags[key] = value
    return this
  }

  /**
   * Log event on span
   */
  log(fields: Record<string, any>): ActiveSpan {
    this.span.logs.push({
      timestamp: new Date(),
      fields
    })
    return this
  }

  /**
   * Set span status
   */
  setStatus(status: 'ok' | 'error' | 'timeout'): ActiveSpan {
    this.span.status = status
    return this
  }

  /**
   * Get baggage item
   */
  getBaggage(key: string): string | undefined {
    return this.span.baggage?.[key]
  }

  /**
   * Set baggage item
   */
  setBaggage(key: string, value: string): ActiveSpan {
    if (!this.span.baggage) {
      this.span.baggage = {}
    }
    this.span.baggage[key] = value
    return this
  }

  /**
   * Finish the span
   */
  finish(): void {
    this.span.endTime = new Date()
    this.span.duration = this.span.endTime.getTime() - this.span.startTime.getTime()

    logger.debug('Finishing span', {
      action: 'finish_span',
      metadata: {
        traceId: this.span.traceId,
        spanId: this.span.spanId,
        operationName: this.span.operationName,
        duration: this.span.duration,
        status: this.span.status
      }
    })

    this.tracer.finishSpan(this.span)
  }

  /**
   * Get span information
   */
  getSpan(): Span {
    return { ...this.span }
  }
}

/**
 * Distributed tracer implementation
 */
export class DistributedTracer extends EventEmitter {
  private activeSpans: Map<string, Span> = new Map()
  private finishedSpans: Map<string, Span[]> = new Map()
  private traces: Map<string, Trace> = new Map()
  private currentSpan?: ActiveSpan
  private flushTimer?: NodeJS.Timeout

  constructor(private config: TracerConfig) {
    super()
    this.startFlushTimer()
  }

  /**
   * Get service name
   */
  getServiceName(): string {
    return this.config.serviceName
  }

  /**
   * Start a new span
   */
  startSpan(operationName: string, parentContext?: TraceContext): ActiveSpan {
    // Check sampling rate
    if (Math.random() > this.config.samplingRate) {
      return this.createNoOpSpan(operationName)
    }

    const builder = new SpanBuilder(this, operationName, parentContext)
    const span = builder.start()
    
    this.activeSpans.set(span.getContext().spanId, span.getSpan())
    this.currentSpan = span
    
    return span
  }

  /**
   * Start child span from current span
   */
  startChildSpan(operationName: string): ActiveSpan {
    const parentContext = this.currentSpan?.getContext()
    return this.startSpan(operationName, parentContext)
  }

  /**
   * Get current active span
   */
  getCurrentSpan(): ActiveSpan | undefined {
    return this.currentSpan
  }

  /**
   * Set current span
   */
  setCurrentSpan(span: ActiveSpan): void {
    this.currentSpan = span
  }

  /**
   * Extract trace context from headers
   */
  extractContext(headers: Record<string, string>): TraceContext | undefined {
    const traceId = headers['x-trace-id'] || headers['trace-id']
    const spanId = headers['x-span-id'] || headers['span-id']
    const parentSpanId = headers['x-parent-span-id'] || headers['parent-span-id']
    const baggage = headers['x-baggage'] || headers['baggage']

    if (!traceId || !spanId) {
      return undefined
    }

    return {
      traceId,
      spanId,
      ...(parentSpanId && { parentSpanId }),
      ...(baggage && { baggage: JSON.parse(baggage) })
    }
  }

  /**
   * Inject trace context into headers
   */
  injectContext(context: TraceContext, headers: Record<string, string>): void {
    headers['x-trace-id'] = context.traceId
    headers['x-span-id'] = context.spanId
    
    if (context.parentSpanId) {
      headers['x-parent-span-id'] = context.parentSpanId
    }
    
    if (context.baggage) {
      headers['x-baggage'] = JSON.stringify(context.baggage)
    }
  }

  /**
   * Finish a span
   */
  finishSpan(span: Span): void {
    this.activeSpans.delete(span.spanId)
    
    // Add to finished spans
    if (!this.finishedSpans.has(span.traceId)) {
      this.finishedSpans.set(span.traceId, [])
    }
    this.finishedSpans.get(span.traceId)!.push(span)
    
    // Update trace
    this.updateTrace(span)
    
    // Clear current span if it's this one
    if (this.currentSpan?.getContext().spanId === span.spanId) {
      this.currentSpan = undefined as any
    }
    
    this.emit('spanFinished', span)
  }

  /**
   * Update trace with finished span
   */
  private updateTrace(span: Span): void {
    let trace = this.traces.get(span.traceId)
    
    if (!trace) {
      trace = {
        traceId: span.traceId,
        spans: [],
        startTime: span.startTime,
        serviceName: span.serviceName,
        rootOperationName: span.operationName,
        status: 'ok'
      }
      this.traces.set(span.traceId, trace)
    }
    
    trace.spans.push(span)
    
    // Update trace timing
    if (span.startTime < trace.startTime) {
      trace.startTime = span.startTime
    }
    
    if (span.endTime) {
      if (!trace.endTime || span.endTime > trace.endTime) {
        trace.endTime = span.endTime
      }
    }
    
    // Update trace status
    if (span.status === 'error') {
      trace.status = 'error'
    } else if (span.status === 'timeout' && trace.status === 'ok') {
      trace.status = 'timeout'
    }
    
    // Calculate duration
    if (trace.endTime) {
      trace.duration = trace.endTime.getTime() - trace.startTime.getTime()
    }
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId)
  }

  /**
   * Get all traces
   */
  getTraces(): Trace[] {
    return Array.from(this.traces.values())
  }

  /**
   * Get active spans
   */
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values())
  }

  /**
   * Create no-op span for sampling
   */
  private createNoOpSpan(operationName: string): ActiveSpan {
    const noOpSpan: Span = {
      traceId: 'noop',
      spanId: 'noop',
      operationName,
      startTime: new Date(),
      tags: {},
      logs: [],
      status: 'ok',
      serviceName: this.config.serviceName
    }
    
    return new ActiveSpan(noOpSpan, this)
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.config.flushInterval)
  }

  /**
   * Flush traces to export
   */
  private flush(): void {
    const traces = this.getTraces()
    
    if (traces.length === 0) {
      return
    }

    if (this.config.enableLogging) {
      logger.info('Flushing traces', {
        action: 'flush_traces',
        metadata: {
          traceCount: traces.length,
          serviceName: this.config.serviceName
        }
      })
    }

    // Export traces
    this.exportTraces(traces)
    
    // Clear old traces (keep only recent ones)
    this.cleanupOldTraces()
    
    this.emit('tracesFlush', traces)
  }

  /**
   * Export traces to external system
   */
  private exportTraces(traces: Trace[]): void {
    if (!this.config.exportUrl) {
      return
    }

    // In a real implementation, this would send to Jaeger, Zipkin, etc.
    if (this.config.enableLogging) {
      logger.debug('Exporting traces', {
        action: 'export_traces',
        metadata: {
          exportUrl: this.config.exportUrl,
          traceCount: traces.length
        }
      })
    }
  }

  /**
   * Cleanup old traces
   */
  private cleanupOldTraces(): void {
    const now = Date.now()
    const maxAge = 5 * 60 * 1000 // 5 minutes
    
    for (const [traceId, trace] of this.traces) {
      if (now - trace.startTime.getTime() > maxAge) {
        this.traces.delete(traceId)
        this.finishedSpans.delete(traceId)
      }
    }
  }

  /**
   * Get tracer statistics
   */
  getStats(): {
    activeSpans: number
    finishedTraces: number
    totalSpans: number
    serviceName: string
  } {
    let totalSpans = 0
    for (const spans of this.finishedSpans.values()) {
      totalSpans += spans.length
    }
    
    return {
      activeSpans: this.activeSpans.size,
      finishedTraces: this.traces.size,
      totalSpans,
      serviceName: this.config.serviceName
    }
  }

  /**
   * Shutdown tracer
   */
  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    
    // Final flush
    this.flush()
    
    this.removeAllListeners()
    
    logger.info('Tracer shutdown', {
      action: 'shutdown',
      metadata: {
        serviceName: this.config.serviceName,
        finalStats: this.getStats()
      }
    })
  }
}

/**
 * Tracer middleware for automatic span creation
 */
export function tracingMiddleware(tracer: DistributedTracer) {
  return (req: any, res: any, next: any) => {
    const operationName = `${req.method} ${req.path}`
    const parentContext = tracer.extractContext(req.headers)
    
    const span = tracer.startSpan(operationName, parentContext)
    
    // Set HTTP tags
    span.setTag('http.method', req.method)
    span.setTag('http.url', req.url)
    span.setTag('http.user_agent', req.headers['user-agent'])
    
    // Store span in request
    req.span = span
    
    // Inject context into response headers
    const context = span.getContext()
    tracer.injectContext(context, res.headers || {})
    
    // Finish span when response ends
    res.on('finish', () => {
      span.setTag('http.status_code', res.statusCode)
      
      if (res.statusCode >= 400) {
        span.setStatus('error')
      }
      
      span.finish()
    })
    
    next()
  }
}

/**
 * Function decorator for automatic tracing
 */
export function traced(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const opName = operationName || `${target.constructor.name}.${propertyKey}`
    
    descriptor.value = async function (...args: any[]) {
      const tracer = globalTracer
      if (!tracer) {
        return originalMethod.apply(this, args)
      }
      
      const span = tracer.startChildSpan(opName)
      
      try {
        const result = await originalMethod.apply(this, args)
        span.setStatus('ok')
        return result
      } catch (error) {
        span.setStatus('error')
        span.setTag('error', true)
        span.setTag('error.message', error instanceof Error ? error.message : 'Unknown error')
        span.log({ event: 'error', error: error instanceof Error ? error.stack : error })
        throw error
      } finally {
        span.finish()
      }
    }
    
    return descriptor
  }
}

/**
 * Global tracer instance
 */
let globalTracer: DistributedTracer | undefined

/**
 * Initialize global tracer
 */
export function initializeTracer(config: TracerConfig): DistributedTracer {
  globalTracer = new DistributedTracer(config)
  
  logger.info('Distributed tracer initialized', {
    action: 'initialize_tracer',
    metadata: {
      serviceName: config.serviceName,
      samplingRate: config.samplingRate,
      maxSpans: config.maxSpans
    }
  })
  
  return globalTracer
}

/**
 * Get global tracer
 */
export function getTracer(): DistributedTracer | undefined {
  return globalTracer
}

/**
 * Default tracer configurations
 */
export const defaultTracerConfigs = {
  development: {
    samplingRate: 1.0,
    maxSpans: 1000,
    flushInterval: 5000,
    enableLogging: true
  },
  
  production: {
    samplingRate: 0.1,
    maxSpans: 10000,
    flushInterval: 10000,
    enableLogging: false
  }
} 