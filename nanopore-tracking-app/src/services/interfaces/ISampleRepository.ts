import type { Sample, CreateSampleData, UpdateSampleData, SearchCriteria } from './ISampleService'

export interface ISampleRepository {
  create(data: CreateSampleData): Promise<Sample>
  update(id: string, data: UpdateSampleData): Promise<Sample>
  findById(id: string): Promise<Sample | null>
  findAll(): Promise<Sample[]>
  search(criteria: SearchCriteria): Promise<Sample[]>
  delete(id: string): Promise<void>
  findByStatus(status: string): Promise<Sample[]>
  findByUser(userId: string): Promise<Sample[]>
  findByAssignedTo(assignedTo: string): Promise<Sample[]>
  updateStatus(id: string, status: string): Promise<Sample>
  assign(id: string, assignedTo: string, libraryPrepBy?: string): Promise<Sample>
  count(): Promise<number>
  countByStatus(status: string): Promise<number>
  countByPriority(priority: string): Promise<number>
} 