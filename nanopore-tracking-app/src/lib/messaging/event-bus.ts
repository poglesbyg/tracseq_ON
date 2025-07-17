import { getComponentLogger } from '../logging/StructuredLogger'
import { applicationMetrics } from '../monitoring/MetricsCollector'
import { EventEmitter } from 'events'

const logger = getComponentLogger('EventBus')

/**
 * Base event interface that all events must implement
 */
export interface BaseEvent {
  id: string
  type: string
  timestamp: Date
  version: string
  source: string
  correlationId?: string
  metadata?: Record<string, any>
}

/**
 * Event handler function type
 */
export type EventHandler<T extends BaseEvent = BaseEvent> = (event: T) => Promise<void>

/**
 * Event subscription options
 */
export interface SubscriptionOptions {
  retryAttempts?: number
  retryDelay?: number
  deadLetterQueue?: boolean
  priority?: 'low' | 'normal' | 'high'
  filter?: (event: BaseEvent) => boolean
}

/**
 * Event publishing options
 */
export interface PublishOptions {
  delay?: number
  priority?: 'low' | 'normal' | 'high'
  persistent?: boolean
  timeout?: number
}

/**
 * Event bus statistics
 */
export interface EventBusStats {
  totalEvents: number
  eventsByType: Record<string, number>
  eventsBySource: Record<string, number>
  failedEvents: number
  retryEvents: number
  deadLetterEvents: number
  averageProcessingTime: number
}

/**
 * Event processing result
 */
interface EventProcessingResult {
  success: boolean
  error?: Error
  processingTime: number
  retryCount: number
}

/**
 * Event subscription metadata
 */
interface EventSubscription {
  handler: EventHandler
  options: SubscriptionOptions
  stats: {
    processed: number
    failed: number
    lastProcessed: Date | null
    averageProcessingTime: number
  }
}

/**
 * In-memory event bus implementation with Redis-like features
 * In production, this would be replaced with Redis, RabbitMQ, or Apache Kafka
 */
export class EventBus extends EventEmitter {
  private subscriptions: Map<string, EventSubscription[]> = new Map()
  private deadLetterQueue: BaseEvent[] = []
  private retryQueue: Array<{ event: BaseEvent; handler: EventHandler; retryCount: number }> = []
  private stats: EventBusStats = {
    totalEvents: 0,
    eventsByType: {},
    eventsBySource: {},
    failedEvents: 0,
    retryEvents: 0,
    deadLetterEvents: 0,
    averageProcessingTime: 0
  }
  private processingTimes: number[] = []
  private isShuttingDown = false

  constructor() {
    super()
    this.setMaxListeners(100) // Increase listener limit for high-throughput scenarios
    this.startRetryProcessor()
  }

  /**
   * Publish an event to the event bus
   */
  async publish<T extends BaseEvent>(event: T, options: PublishOptions = {}): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Event bus is shutting down')
    }

    const startTime = Date.now()
    
    logger.info('Publishing event', {
      action: 'publish_event',
      metadata: { 
        eventType: event.type,
        eventId: event.id,
        source: event.source,
        correlationId: event.correlationId 
      }
    })

    try {
      // Validate event
      this.validateEvent(event)

      // Update statistics
      this.updatePublishStats(event)

      // Apply delay if specified
      if (options.delay && options.delay > 0) {
        setTimeout(() => this.processEvent(event), options.delay)
      } else {
        // Process immediately (async)
        setImmediate(() => this.processEvent(event))
      }

      // Emit to local listeners (for same-process communication)
      this.emit(event.type, event)
      this.emit('*', event) // Wildcard listeners

      const processingTime = Date.now() - startTime
      this.recordProcessingTime(processingTime)

      logger.debug('Event published successfully', {
        action: 'event_published',
        metadata: {
          eventType: event.type,
          eventId: event.id,
          processingTime
        }
      })

    } catch (error) {
      this.stats.failedEvents++
      // applicationMetrics.eventBusErrors.inc() // TODO: Add to metrics
      
              logger.error('Failed to publish event', {
          action: 'publish_failed',
          errorType: error instanceof Error ? error.name : 'UnknownError',
          metadata: { 
            eventType: event.type,
            eventId: event.id,
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          }
        })
      
      throw error
    }
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribe<T extends BaseEvent>(
    eventType: string,
    handler: EventHandler<T>,
    options: SubscriptionOptions = {}
  ): string {
    const subscriptionId = crypto.randomUUID()
    
    logger.info('Creating event subscription', {
      action: 'subscribe',
      metadata: { eventType, subscriptionId, options }
    })

    const subscription: EventSubscription = {
      handler: handler as EventHandler,
      options: {
        retryAttempts: 3,
        retryDelay: 1000,
        deadLetterQueue: true,
        priority: 'normal',
        ...options
      },
      stats: {
        processed: 0,
        failed: 0,
        lastProcessed: null,
        averageProcessingTime: 0
      }
    }

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, [])
    }

    this.subscriptions.get(eventType)!.push(subscription)

    // Also subscribe to EventEmitter for local events
    this.on(eventType, handler)

    logger.debug('Event subscription created', {
      action: 'subscription_created',
      metadata: { eventType, subscriptionId, totalSubscriptions: this.subscriptions.get(eventType)!.length }
    })

    return subscriptionId
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: string, subscriptionId: string): boolean {
    const subscriptions = this.subscriptions.get(eventType)
    if (!subscriptions) {
      return false
    }

    const initialLength = subscriptions.length
    this.subscriptions.set(
      eventType,
      subscriptions.filter(sub => sub !== subscriptions[0]) // Simplified removal
    )

    const removed = subscriptions.length < initialLength
    
    if (removed) {
      logger.info('Event subscription removed', {
        action: 'unsubscribe',
        metadata: { eventType, subscriptionId }
      })
    }

    return removed
  }

  /**
   * Process an event by notifying all subscribers
   */
  private async processEvent(event: BaseEvent): Promise<void> {
    const subscriptions = this.subscriptions.get(event.type) || []
    
    if (subscriptions.length === 0) {
      logger.debug('No subscribers for event type', {
        action: 'no_subscribers',
        metadata: { eventType: event.type, eventId: event.id }
      })
      return
    }

    logger.debug('Processing event for subscribers', {
      action: 'process_event',
      metadata: { eventType: event.type, eventId: event.id, subscriberCount: subscriptions.length }
    })

    // Process subscriptions in parallel
    const processingPromises = subscriptions.map(subscription => 
      this.processEventForSubscription(event, subscription)
    )

    await Promise.allSettled(processingPromises)
  }

  /**
   * Process an event for a specific subscription
   */
  private async processEventForSubscription(
    event: BaseEvent,
    subscription: EventSubscription
  ): Promise<EventProcessingResult> {
    const startTime = Date.now()
    
    try {
      // Apply filter if specified
      if (subscription.options.filter && !subscription.options.filter(event)) {
        return { success: true, processingTime: 0, retryCount: 0 }
      }

      // Execute handler
      await subscription.handler(event)

      // Update subscription stats
      const processingTime = Date.now() - startTime
      subscription.stats.processed++
      subscription.stats.lastProcessed = new Date()
      subscription.stats.averageProcessingTime = 
        (subscription.stats.averageProcessingTime + processingTime) / 2

      logger.debug('Event processed successfully', {
        action: 'event_processed',
        metadata: { eventType: event.type, eventId: event.id, processingTime }
      })

      return { success: true, processingTime, retryCount: 0 }

    } catch (error) {
      subscription.stats.failed++
      
      logger.error('Event processing failed', {
        action: 'processing_failed',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        metadata: { 
          eventType: event.type, 
          eventId: event.id, 
          errorMessage: error instanceof Error ? error.message : 'Unknown error' 
        }
      })

      // Queue for retry if configured
      if (subscription.options.retryAttempts && subscription.options.retryAttempts > 0) {
        this.queueForRetry(event, subscription.handler, 0)
      } else if (subscription.options.deadLetterQueue) {
        this.addToDeadLetterQueue(event)
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
        processingTime: Date.now() - startTime,
        retryCount: 0
      }
    }
  }

  /**
   * Queue an event for retry
   */
  private queueForRetry(event: BaseEvent, handler: EventHandler, retryCount: number): void {
    this.retryQueue.push({ event, handler, retryCount })
    this.stats.retryEvents++
    
    logger.info('Event queued for retry', {
      action: 'queue_retry',
      metadata: { eventType: event.type, eventId: event.id, retryCount, queueSize: this.retryQueue.length }
    })
  }

  /**
   * Add event to dead letter queue
   */
  private addToDeadLetterQueue(event: BaseEvent): void {
    this.deadLetterQueue.push(event)
    this.stats.deadLetterEvents++
    
    logger.warn('Event added to dead letter queue', {
      action: 'dead_letter',
      metadata: { eventType: event.type, eventId: event.id, deadLetterQueueSize: this.deadLetterQueue.length }
    })
  }

  /**
   * Start the retry processor
   */
  private startRetryProcessor(): void {
    setInterval(() => {
      this.processRetryQueue()
    }, 5000) // Process retry queue every 5 seconds
  }

  /**
   * Process the retry queue
   */
  private async processRetryQueue(): Promise<void> {
    if (this.retryQueue.length === 0) {
      return
    }

    logger.debug('Processing retry queue', {
      action: 'process_retry_queue',
      metadata: { queueSize: this.retryQueue.length }
    })

    const itemsToProcess = this.retryQueue.splice(0, 10) // Process up to 10 items at a time

    for (const item of itemsToProcess) {
      try {
        await item.handler(item.event)
        
        logger.info('Retry successful', {
          action: 'retry_success',
          metadata: { eventType: item.event.type, eventId: item.event.id, retryCount: item.retryCount }
        })
      } catch (error) {
        const newRetryCount = item.retryCount + 1
        
        if (newRetryCount < 3) { // Max 3 retries
          this.queueForRetry(item.event, item.handler, newRetryCount)
        } else {
          this.addToDeadLetterQueue(item.event)
          
          logger.error('Retry exhausted, moving to dead letter queue', {
            action: 'retry_exhausted',
            metadata: { eventType: item.event.type, eventId: item.event.id, finalRetryCount: newRetryCount }
          })
        }
      }
    }
  }

  /**
   * Validate event structure
   */
  private validateEvent(event: BaseEvent): void {
    if (!event.id || !event.type || !event.timestamp || !event.source) {
      throw new Error('Event missing required fields: id, type, timestamp, source')
    }

    if (typeof event.id !== 'string' || event.id.length === 0) {
      throw new Error('Event id must be a non-empty string')
    }

    if (typeof event.type !== 'string' || event.type.length === 0) {
      throw new Error('Event type must be a non-empty string')
    }

    if (!(event.timestamp instanceof Date)) {
      throw new Error('Event timestamp must be a Date object')
    }
  }

  /**
   * Update publishing statistics
   */
  private updatePublishStats(event: BaseEvent): void {
    this.stats.totalEvents++
    this.stats.eventsByType[event.type] = (this.stats.eventsByType[event.type] || 0) + 1
    this.stats.eventsBySource[event.source] = (this.stats.eventsBySource[event.source] || 0) + 1
    
    // applicationMetrics.eventBusEvents.inc() // TODO: Add eventBusEvents to metrics
  }

  /**
   * Record processing time for statistics
   */
  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time)
    
    // Keep only last 1000 measurements
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift()
    }
    
    this.stats.averageProcessingTime = 
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
  }

  /**
   * Get event bus statistics
   */
  getStats(): EventBusStats {
    return { ...this.stats }
  }

  /**
   * Get dead letter queue contents
   */
  getDeadLetterQueue(): BaseEvent[] {
    return [...this.deadLetterQueue]
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): number {
    const count = this.deadLetterQueue.length
    this.deadLetterQueue = []
    this.stats.deadLetterEvents = 0
    
    logger.info('Dead letter queue cleared', {
      action: 'clear_dead_letter_queue',
      metadata: { clearedCount: count }
    })
    
    return count
  }

  /**
   * Get retry queue size
   */
  getRetryQueueSize(): number {
    return this.retryQueue.length
  }

  /**
   * Health check for event bus
   */
  async healthCheck(): Promise<{
    healthy: boolean
    stats: EventBusStats
    issues: string[]
  }> {
    const issues: string[] = []
    
    // Check for excessive dead letter queue
    if (this.deadLetterQueue.length > 100) {
      issues.push('Dead letter queue size is excessive')
    }
    
    // Check for excessive retry queue
    if (this.retryQueue.length > 50) {
      issues.push('Retry queue size is excessive')
    }
    
    // Check error rate
    const errorRate = this.stats.totalEvents > 0 ? 
      this.stats.failedEvents / this.stats.totalEvents : 0
    
    if (errorRate > 0.1) { // 10% error rate threshold
      issues.push('High error rate detected')
    }
    
    return {
      healthy: issues.length === 0,
      stats: this.getStats(),
      issues
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true
    
    logger.info('Event bus shutting down', {
      action: 'shutdown',
      metadata: { pendingRetries: this.retryQueue.length, deadLetterItems: this.deadLetterQueue.length }
    })
    
    // Wait for pending retries to complete (with timeout)
    let retryAttempts = 0
    while (this.retryQueue.length > 0 && retryAttempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      retryAttempts++
    }
    
    // Clear all listeners
    this.removeAllListeners()
    
    logger.info('Event bus shutdown complete', {
      action: 'shutdown_complete',
      metadata: { finalStats: this.getStats() }
    })
  }
}

// Singleton instance
export const eventBus = new EventBus()

// Export event bus for dependency injection
export default eventBus 