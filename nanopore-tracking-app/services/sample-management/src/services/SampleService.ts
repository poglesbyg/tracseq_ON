import { SampleRepository } from '../repositories/SampleRepository'
import { 
  Sample, 
  CreateSampleInput, 
  UpdateSampleInput, 
  SampleFilters, 
  SampleSearchResult,
  SampleStatus,
  SamplePriority,
  createSampleSchema,
  updateSampleSchema,
  sampleFiltersSchema
} from '../types/sample'
import { z } from 'zod'

export class SampleService {
  constructor(private sampleRepository: SampleRepository) {}

  /**
   * Create a new sample with validation
   */
  async createSample(input: CreateSampleInput): Promise<Sample> {
    // Validate input
    const validatedInput = createSampleSchema.parse(input)

    // Validate chart field
    const isValidChartField = await this.sampleRepository.validateChartField(validatedInput.chartField)
    if (!isValidChartField) {
      throw new Error(`Invalid chart field: ${validatedInput.chartField}`)
    }

    // Check for duplicate sample name
    const existingSamples = await this.sampleRepository.getAllSamples({
      sampleName: validatedInput.sampleName
    })
    
    if (existingSamples.length > 0) {
      throw new Error(`Sample with name "${validatedInput.sampleName}" already exists`)
    }

    // Create the sample
    const sample = await this.sampleRepository.createSample(validatedInput)
    
    return sample
  }

  /**
   * Get all samples with optional filtering
   */
  async getAllSamples(filters?: SampleFilters): Promise<Sample[]> {
    // Validate filters if provided
    if (filters) {
      sampleFiltersSchema.parse(filters)
    }

    return await this.sampleRepository.getAllSamples(filters)
  }

  /**
   * Search samples with pagination
   */
  async searchSamples(
    filters: SampleFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<SampleSearchResult> {
    // Validate filters
    sampleFiltersSchema.parse(filters)

    // Validate pagination parameters
    if (page < 1) {
      throw new Error('Page must be greater than 0')
    }

    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100')
    }

    return await this.sampleRepository.searchSamples(filters, page, limit)
  }

  /**
   * Get sample by ID
   */
  async getSampleById(id: string): Promise<Sample | null> {
    // Validate UUID format
    if (!this.isValidUUID(id)) {
      throw new Error('Invalid sample ID format')
    }

    return await this.sampleRepository.getSampleById(id)
  }

  /**
   * Update sample with validation
   */
  async updateSample(id: string, input: UpdateSampleInput): Promise<Sample | null> {
    // Validate UUID format
    if (!this.isValidUUID(id)) {
      throw new Error('Invalid sample ID format')
    }

    // Validate input
    const validatedInput = updateSampleSchema.parse(input)

    // Check if sample exists
    const existingSample = await this.sampleRepository.getSampleById(id)
    if (!existingSample) {
      throw new Error(`Sample with ID ${id} not found`)
    }

    // Validate chart field if provided
    if (validatedInput.chartField) {
      const isValidChartField = await this.sampleRepository.validateChartField(validatedInput.chartField)
      if (!isValidChartField) {
        throw new Error(`Invalid chart field: ${validatedInput.chartField}`)
      }
    }

    // Check for duplicate sample name if provided
    if (validatedInput.sampleName && validatedInput.sampleName !== existingSample.sampleName) {
      const existingSamples = await this.sampleRepository.getAllSamples({
        sampleName: validatedInput.sampleName
      })
      
      if (existingSamples.length > 0) {
        throw new Error(`Sample with name "${validatedInput.sampleName}" already exists`)
      }
    }

    // Validate status transitions
    if (validatedInput.status) {
      this.validateStatusTransition(existingSample.status, validatedInput.status)
    }

    // Update the sample
    const updatedSample = await this.sampleRepository.updateSample(id, validatedInput)
    
    if (!updatedSample) {
      throw new Error(`Failed to update sample with ID ${id}`)
    }

    return updatedSample
  }

  /**
   * Delete sample
   */
  async deleteSample(id: string): Promise<boolean> {
    // Validate UUID format
    if (!this.isValidUUID(id)) {
      throw new Error('Invalid sample ID format')
    }

    // Check if sample exists
    const existingSample = await this.sampleRepository.getSampleById(id)
    if (!existingSample) {
      throw new Error(`Sample with ID ${id} not found`)
    }

    // Prevent deletion of samples in progress
    if (existingSample.status === SampleStatus.IN_PROGRESS) {
      throw new Error('Cannot delete sample that is currently in progress')
    }

    return await this.sampleRepository.deleteSample(id)
  }

  /**
   * Assign sample to team member
   */
  async assignSample(id: string, assignedTo: string, libraryPrepBy?: string): Promise<Sample | null> {
    // Validate UUID format
    if (!this.isValidUUID(id)) {
      throw new Error('Invalid sample ID format')
    }

    // Validate assignedTo
    if (!assignedTo || assignedTo.trim().length === 0) {
      throw new Error('Assigned to field is required')
    }

    // Check if sample exists
    const existingSample = await this.sampleRepository.getSampleById(id)
    if (!existingSample) {
      throw new Error(`Sample with ID ${id} not found`)
    }

    // Check if sample is already assigned
    if (existingSample.assignedTo === assignedTo) {
      throw new Error(`Sample is already assigned to ${assignedTo}`)
    }

    // Assign the sample
    const updatedSample = await this.sampleRepository.assignSample(id, assignedTo, libraryPrepBy)
    
    if (!updatedSample) {
      throw new Error(`Failed to assign sample with ID ${id}`)
    }

    return updatedSample
  }

  /**
   * Update sample status
   */
  async updateSampleStatus(id: string, status: SampleStatus): Promise<Sample | null> {
    // Validate UUID format
    if (!this.isValidUUID(id)) {
      throw new Error('Invalid sample ID format')
    }

    // Check if sample exists
    const existingSample = await this.sampleRepository.getSampleById(id)
    if (!existingSample) {
      throw new Error(`Sample with ID ${id} not found`)
    }

    // Validate status transition
    this.validateStatusTransition(existingSample.status, status)

    // Update the status
    const updatedSample = await this.sampleRepository.updateSampleStatus(id, status)
    
    if (!updatedSample) {
      throw new Error(`Failed to update status for sample with ID ${id}`)
    }

    return updatedSample
  }

  /**
   * Get workflow history for a sample
   */
  async getWorkflowHistory(sampleId: string): Promise<any[]> {
    // Validate UUID format
    if (!this.isValidUUID(sampleId)) {
      throw new Error('Invalid sample ID format')
    }

    // Check if sample exists
    const existingSample = await this.sampleRepository.getSampleById(sampleId)
    if (!existingSample) {
      throw new Error(`Sample with ID ${sampleId} not found`)
    }

    return await this.sampleRepository.getWorkflowHistory(sampleId)
  }

  /**
   * Get samples by status
   */
  async getSamplesByStatus(status: SampleStatus): Promise<Sample[]> {
    return await this.sampleRepository.getSamplesByStatus(status)
  }

  /**
   * Get samples by priority
   */
  async getSamplesByPriority(priority: SamplePriority): Promise<Sample[]> {
    return await this.sampleRepository.getSamplesByPriority(priority)
  }

  /**
   * Get samples assigned to a team member
   */
  async getSamplesByAssignee(assignedTo: string): Promise<Sample[]> {
    if (!assignedTo || assignedTo.trim().length === 0) {
      throw new Error('Assigned to field is required')
    }

    return await this.sampleRepository.getSamplesByAssignee(assignedTo)
  }

  /**
   * Get all active chart fields
   */
  async getActiveChartFields(): Promise<string[]> {
    return await this.sampleRepository.getActiveChartFields()
  }

  /**
   * Validate chart field
   */
  async validateChartField(chartField: string): Promise<boolean> {
    return await this.sampleRepository.validateChartField(chartField)
  }

  /**
   * Get sample statistics
   */
  async getSampleStatistics(): Promise<{
    totalSamples: number
    samplesByStatus: Record<string, number>
    samplesByPriority: Record<string, number>
    recentSamples: number
  }> {
    const allSamples = await this.sampleRepository.getAllSamples()
    
    const totalSamples = allSamples.length
    const samplesByStatus: Record<string, number> = {}
    const samplesByPriority: Record<string, number> = {}
    
    // Calculate samples by status
    for (const sample of allSamples) {
      samplesByStatus[sample.status] = (samplesByStatus[sample.status] || 0) + 1
      samplesByPriority[sample.priority] = (samplesByPriority[sample.priority] || 0) + 1
    }

    // Calculate recent samples (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentSamples = allSamples.filter(sample => sample.createdAt >= sevenDaysAgo).length

    return {
      totalSamples,
      samplesByStatus,
      samplesByPriority,
      recentSamples
    }
  }

  /**
   * Validate UUID format
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  /**
   * Validate status transitions
   */
  private validateStatusTransition(currentStatus: SampleStatus, newStatus: SampleStatus): void {
    const validTransitions: Record<SampleStatus, SampleStatus[]> = {
      [SampleStatus.SUBMITTED]: [SampleStatus.ASSIGNED, SampleStatus.CANCELLED],
      [SampleStatus.ASSIGNED]: [SampleStatus.IN_PROGRESS, SampleStatus.CANCELLED],
      [SampleStatus.IN_PROGRESS]: [SampleStatus.COMPLETED, SampleStatus.FAILED, SampleStatus.CANCELLED],
      [SampleStatus.COMPLETED]: [], // No further transitions
      [SampleStatus.FAILED]: [SampleStatus.IN_PROGRESS], // Can retry
      [SampleStatus.CANCELLED]: [] // No further transitions
    }

    const allowedTransitions = validTransitions[currentStatus]
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`)
    }
  }
}