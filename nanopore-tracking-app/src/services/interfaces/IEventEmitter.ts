export interface DomainEvent {
  type: string
  timestamp: Date
  data: Record<string, any>
  aggregateId: string
  aggregateType: string
  version: number
}

export interface IEventEmitter {
  emit(eventType: string, data: any): void
  on(eventType: string, handler: (data: any) => void): void
  off(eventType: string, handler: (data: any) => void): void
  once(eventType: string, handler: (data: any) => void): void
  removeAllListeners(eventType?: string): void
  
  // Domain-specific events
  emitSampleCreated(sample: any): void
  emitSampleUpdated(sample: any, changes: Record<string, any>): void
  emitSampleDeleted(sampleId: string): void
  emitSampleAssigned(sample: any, assignedTo: string): void
  emitStatusChanged(sample: any, oldStatus: string, newStatus: string): void
} 