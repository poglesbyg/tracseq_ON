import { EventEmitter as NodeEventEmitter } from 'events'
import type { IEventEmitter } from '../interfaces/IEventEmitter'

export class EventEmitter implements IEventEmitter {
  private emitter: NodeEventEmitter

  constructor() {
    this.emitter = new NodeEventEmitter()
  }

  emit(eventType: string, data: any): void {
    this.emitter.emit(eventType, data)
  }

  on(eventType: string, handler: (data: any) => void): void {
    this.emitter.on(eventType, handler)
  }

  off(eventType: string, handler: (data: any) => void): void {
    this.emitter.off(eventType, handler)
  }

  once(eventType: string, handler: (data: any) => void): void {
    this.emitter.once(eventType, handler)
  }

  removeAllListeners(eventType?: string): void {
    this.emitter.removeAllListeners(eventType)
  }

  // Domain-specific events
  emitSampleCreated(sample: any): void {
    this.emit('sample.created', sample)
  }

  emitSampleUpdated(sample: any, changes: Record<string, any>): void {
    this.emit('sample.updated', { sample, changes })
  }

  emitSampleDeleted(sampleId: string): void {
    this.emit('sample.deleted', { sampleId })
  }

  emitSampleAssigned(sample: any, assignedTo: string): void {
    this.emit('sample.assigned', { sample, assignedTo })
  }

  emitStatusChanged(sample: any, oldStatus: string, newStatus: string): void {
    this.emit('sample.status_changed', { sample, oldStatus, newStatus })
  }
} 