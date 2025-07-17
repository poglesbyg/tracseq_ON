import { Kysely } from 'kysely'
import { SampleManagementDatabase } from '../database/schema'
import { 
  Sample, 
  CreateSampleInput, 
  UpdateSampleInput, 
  SampleFilters, 
  SampleSearchResult,
  SampleStatus,
  SamplePriority,
  SampleType,
  FlowCellType
} from '../types/sample'

export class SampleRepository {
  constructor(private db: Kysely<SampleManagementDatabase>) {}

  /**
   * Create a new sample
   */
  async createSample(input: CreateSampleInput): Promise<Sample> {
    const [sample] = await this.db
      .insertInto('samples')
      .values({
        sample_name: input.sampleName,
        project_id: input.projectId,
        submitter_name: input.submitterName,
        submitter_email: input.submitterEmail,
        lab_name: input.labName,
        sample_type: input.sampleType,
        sample_buffer: input.sampleBuffer,
        concentration: input.concentration,
        volume: input.volume,
        total_amount: input.totalAmount,
        flow_cell_type: input.flowCellType,
        flow_cell_count: input.flowCellCount,
        status: SampleStatus.SUBMITTED,
        priority: input.priority,
        assigned_to: input.assignedTo,
        library_prep_by: input.libraryPrepBy,
        chart_field: input.chartField
      })
      .returning('*')
      .execute()

    // Add initial workflow history entry
    await this.db
      .insertInto('workflow_history')
      .values({
        sample_id: sample.id,
        status: SampleStatus.SUBMITTED,
        assigned_to: input.assignedTo,
        notes: 'Sample created'
      })
      .execute()

    return this.mapDatabaseSampleToSample(sample)
  }

  /**
   * Get all samples with optional filtering
   */
  async getAllSamples(filters?: SampleFilters): Promise<Sample[]> {
    let query = this.db.selectFrom('samples').selectAll()

    if (filters) {
      query = this.applyFilters(query, filters)
    }

    const samples = await query
      .orderBy('created_at', 'desc')
      .execute()

    return samples.map(this.mapDatabaseSampleToSample)
  }

  /**
   * Search samples with pagination
   */
  async searchSamples(
    filters: SampleFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<SampleSearchResult> {
    const offset = (page - 1) * limit

    // Build base query
    let query = this.db.selectFrom('samples').selectAll()

    // Apply filters
    query = this.applyFilters(query, filters)

    // Get total count
    const countQuery = this.db
      .selectFrom('samples')
      .select(this.db.fn.count('id').as('count'))

    const countResult = await this.applyFilters(countQuery, filters).executeTakeFirst()
    const total = Number(countResult?.count || 0)

    // Get paginated results
    const samples = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute()

    return {
      samples: samples.map(this.mapDatabaseSampleToSample),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }

  /**
   * Get sample by ID
   */
  async getSampleById(id: string): Promise<Sample | null> {
    const sample = await this.db
      .selectFrom('samples')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    return sample ? this.mapDatabaseSampleToSample(sample) : null
  }

  /**
   * Update sample
   */
  async updateSample(id: string, input: UpdateSampleInput): Promise<Sample | null> {
    const updateData: any = {}

    // Map input fields to database fields
    if (input.sampleName !== undefined) updateData.sample_name = input.sampleName
    if (input.projectId !== undefined) updateData.project_id = input.projectId
    if (input.submitterName !== undefined) updateData.submitter_name = input.submitterName
    if (input.submitterEmail !== undefined) updateData.submitter_email = input.submitterEmail
    if (input.labName !== undefined) updateData.lab_name = input.labName
    if (input.sampleType !== undefined) updateData.sample_type = input.sampleType
    if (input.sampleBuffer !== undefined) updateData.sample_buffer = input.sampleBuffer
    if (input.concentration !== undefined) updateData.concentration = input.concentration
    if (input.volume !== undefined) updateData.volume = input.volume
    if (input.totalAmount !== undefined) updateData.total_amount = input.totalAmount
    if (input.flowCellType !== undefined) updateData.flow_cell_type = input.flowCellType
    if (input.flowCellCount !== undefined) updateData.flow_cell_count = input.flowCellCount
    if (input.status !== undefined) updateData.status = input.status
    if (input.priority !== undefined) updateData.priority = input.priority
    if (input.assignedTo !== undefined) updateData.assigned_to = input.assignedTo
    if (input.libraryPrepBy !== undefined) updateData.library_prep_by = input.libraryPrepBy

    const [sample] = await this.db
      .updateTable('samples')
      .set(updateData)
      .where('id', '=', id)
      .returning('*')
      .execute()

    if (!sample) {
      return null
    }

    // Add workflow history entry for status changes
    if (input.status) {
      await this.db
        .insertInto('workflow_history')
        .values({
          sample_id: id,
          status: input.status,
          assigned_to: input.assignedTo,
          notes: `Status updated to ${input.status}`
        })
        .execute()
    }

    return this.mapDatabaseSampleToSample(sample)
  }

  /**
   * Delete sample
   */
  async deleteSample(id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('samples')
      .where('id', '=', id)
      .execute()

    return result.length > 0
  }

  /**
   * Assign sample to team member
   */
  async assignSample(id: string, assignedTo: string, libraryPrepBy?: string): Promise<Sample | null> {
    const [sample] = await this.db
      .updateTable('samples')
      .set({
        assigned_to: assignedTo,
        library_prep_by: libraryPrepBy,
        status: SampleStatus.ASSIGNED
      })
      .where('id', '=', id)
      .returning('*')
      .execute()

    if (!sample) {
      return null
    }

    // Add assignment record
    await this.db
      .insertInto('sample_assignments')
      .values({
        sample_id: id,
        assigned_to: assignedTo,
        assigned_by: 'system', // TODO: Get from auth context
        status: 'active',
        notes: 'Sample assigned'
      })
      .execute()

    // Add workflow history entry
    await this.db
      .insertInto('workflow_history')
      .values({
        sample_id: id,
        status: SampleStatus.ASSIGNED,
        assigned_to: assignedTo,
        notes: `Sample assigned to ${assignedTo}`
      })
      .execute()

    return this.mapDatabaseSampleToSample(sample)
  }

  /**
   * Update sample status
   */
  async updateSampleStatus(id: string, status: SampleStatus): Promise<Sample | null> {
    const [sample] = await this.db
      .updateTable('samples')
      .set({ status })
      .where('id', '=', id)
      .returning('*')
      .execute()

    if (!sample) {
      return null
    }

    // Add workflow history entry
    await this.db
      .insertInto('workflow_history')
      .values({
        sample_id: id,
        status,
        notes: `Status updated to ${status}`
      })
      .execute()

    return this.mapDatabaseSampleToSample(sample)
  }

  /**
   * Get workflow history for a sample
   */
  async getWorkflowHistory(sampleId: string): Promise<any[]> {
    return await this.db
      .selectFrom('workflow_history')
      .selectAll()
      .where('sample_id', '=', sampleId)
      .orderBy('created_at', 'desc')
      .execute()
  }

  /**
   * Get samples by status
   */
  async getSamplesByStatus(status: SampleStatus): Promise<Sample[]> {
    const samples = await this.db
      .selectFrom('samples')
      .selectAll()
      .where('status', '=', status)
      .orderBy('created_at', 'desc')
      .execute()

    return samples.map(this.mapDatabaseSampleToSample)
  }

  /**
   * Get samples by priority
   */
  async getSamplesByPriority(priority: SamplePriority): Promise<Sample[]> {
    const samples = await this.db
      .selectFrom('samples')
      .selectAll()
      .where('priority', '=', priority)
      .orderBy('created_at', 'desc')
      .execute()

    return samples.map(this.mapDatabaseSampleToSample)
  }

  /**
   * Get samples assigned to a team member
   */
  async getSamplesByAssignee(assignedTo: string): Promise<Sample[]> {
    const samples = await this.db
      .selectFrom('samples')
      .selectAll()
      .where('assigned_to', '=', assignedTo)
      .orderBy('created_at', 'desc')
      .execute()

    return samples.map(this.mapDatabaseSampleToSample)
  }

  /**
   * Validate chart field
   */
  async validateChartField(chartField: string): Promise<boolean> {
    const result = await this.db
      .selectFrom('chart_fields')
      .select('chart_field')
      .where('chart_field', '=', chartField)
      .where('is_active', '=', true)
      .executeTakeFirst()

    return !!result
  }

  /**
   * Get all active chart fields
   */
  async getActiveChartFields(): Promise<string[]> {
    const results = await this.db
      .selectFrom('chart_fields')
      .select('chart_field')
      .where('is_active', '=', true)
      .orderBy('chart_field')
      .execute()

    return results.map(row => row.chart_field)
  }

  /**
   * Apply filters to query
   */
  private applyFilters(query: any, filters: SampleFilters): any {
    if (filters.status && filters.status.length > 0) {
      query = query.where('status', 'in', filters.status)
    }

    if (filters.priority && filters.priority.length > 0) {
      query = query.where('priority', 'in', filters.priority)
    }

    if (filters.assignedTo) {
      query = query.where('assigned_to', '=', filters.assignedTo)
    }

    if (filters.submitterEmail) {
      query = query.where('submitter_email', '=', filters.submitterEmail)
    }

    if (filters.labName) {
      query = query.where('lab_name', '=', filters.labName)
    }

    if (filters.sampleType && filters.sampleType.length > 0) {
      query = query.where('sample_type', 'in', filters.sampleType)
    }

    if (filters.flowCellType && filters.flowCellType.length > 0) {
      query = query.where('flow_cell_type', 'in', filters.flowCellType)
    }

    if (filters.chartField) {
      query = query.where('chart_field', '=', filters.chartField)
    }

    if (filters.dateFrom) {
      query = query.where('created_at', '>=', filters.dateFrom)
    }

    if (filters.dateTo) {
      query = query.where('created_at', '<=', filters.dateTo)
    }

    return query
  }

  /**
   * Map database sample to Sample interface
   */
  private mapDatabaseSampleToSample(dbSample: any): Sample {
    return {
      id: dbSample.id,
      sampleName: dbSample.sample_name,
      projectId: dbSample.project_id,
      submitterName: dbSample.submitter_name,
      submitterEmail: dbSample.submitter_email,
      labName: dbSample.lab_name,
      sampleType: dbSample.sample_type as SampleType,
      sampleBuffer: dbSample.sample_buffer,
      concentration: Number(dbSample.concentration),
      volume: Number(dbSample.volume),
      totalAmount: Number(dbSample.total_amount),
      flowCellType: dbSample.flow_cell_type as FlowCellType,
      flowCellCount: dbSample.flow_cell_count,
      status: dbSample.status as SampleStatus,
      priority: dbSample.priority as SamplePriority,
      assignedTo: dbSample.assigned_to,
      libraryPrepBy: dbSample.library_prep_by,
      chartField: dbSample.chart_field,
      createdAt: new Date(dbSample.created_at),
      updatedAt: new Date(dbSample.updated_at)
    }
  }
}