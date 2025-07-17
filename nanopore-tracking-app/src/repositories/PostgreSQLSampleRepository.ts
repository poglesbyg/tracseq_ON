import type { Kysely } from 'kysely'
import type { Database } from '../lib/database'
import type { ISampleRepository } from '../services/interfaces/ISampleRepository'
import type { 
  Sample, 
  CreateSampleData, 
  UpdateSampleData, 
  SearchCriteria 
} from '../services/interfaces/ISampleService'

export class PostgreSQLSampleRepository implements ISampleRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(data: CreateSampleData): Promise<Sample> {
    const now = new Date()
    
    const result = await this.db
      .insertInto('nanopore_samples')
      .values({
        id: crypto.randomUUID(),
        sample_name: data.sampleName,
        project_id: data.projectId || null,
        submitter_name: data.submitterName,
        submitter_email: data.submitterEmail,
        lab_name: data.labName || null,
        sample_type: data.sampleType,
        sample_buffer: data.sampleBuffer || null,
        concentration: data.concentration || null,
        volume: data.volume || null,
        total_amount: data.totalAmount || null,
        flow_cell_type: data.flowCellType || null,
        flow_cell_count: data.flowCellCount || 1,
        status: 'submitted',
        priority: data.priority || 'normal',
        assigned_to: data.assignedTo || null,
        library_prep_by: data.libraryPrepBy || null,
        chart_field: data.chartField,
        submitted_at: now,
        created_at: now,
        updated_at: now,
        created_by: '550e8400-e29b-41d4-a716-446655440000', // Demo user UUID from migration
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as Sample
  }

  async update(id: string, data: UpdateSampleData): Promise<Sample> {
    const updateData: any = {
      updated_at: new Date(),
    }

    // Only update fields that are provided
    if (data.sampleName !== undefined) updateData.sample_name = data.sampleName
    if (data.projectId !== undefined) updateData.project_id = data.projectId
    if (data.submitterName !== undefined) updateData.submitter_name = data.submitterName
    if (data.submitterEmail !== undefined) updateData.submitter_email = data.submitterEmail
    if (data.labName !== undefined) updateData.lab_name = data.labName
    if (data.sampleType !== undefined) updateData.sample_type = data.sampleType
    if (data.sampleBuffer !== undefined) updateData.sample_buffer = data.sampleBuffer // TODO: Fix database schema
    if (data.concentration !== undefined) updateData.concentration = data.concentration // TODO: Fix database schema
    if (data.volume !== undefined) updateData.volume = data.volume // TODO: Fix database schema
    if (data.totalAmount !== undefined) updateData.total_amount = data.totalAmount // TODO: Fix database schema
    if (data.flowCellType !== undefined) updateData.flow_cell_type = data.flowCellType // TODO: Fix database schema
    if (data.flowCellCount !== undefined) updateData.flow_cell_count = data.flowCellCount // TODO: Fix database schema
    if (data.status !== undefined) updateData.status = data.status
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.assignedTo !== undefined) updateData.assigned_to = data.assignedTo
    if (data.libraryPrepBy !== undefined) updateData.library_prep_by = data.libraryPrepBy

    // Add timestamps for specific status changes
    if (data.status === 'prep') {
      updateData.started_at = new Date()
    } else if (data.status === 'completed') {
      updateData.completed_at = new Date()
    }

    const result = await this.db
      .updateTable('nanopore_samples')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as Sample
  }

  async findById(id: string): Promise<Sample | null> {
    const result = await this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    return result as Sample || null
  }

  async findAll(): Promise<Sample[]> {
    const results = await this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .orderBy('submitted_at', 'desc')
      .execute()

    return results as Sample[]
  }

  async search(criteria: SearchCriteria): Promise<Sample[]> {
    let query = this.db
      .selectFrom('nanopore_samples')
      .selectAll()

    // Apply search filters
    if (criteria.searchTerm) {
      const searchTerm = `%${criteria.searchTerm.toLowerCase()}%`
      query = query.where((eb) =>
        eb.or([
          eb('sample_name', 'ilike', searchTerm),
          eb('submitter_name', 'ilike', searchTerm),
          eb('lab_name', 'ilike', searchTerm),
          eb('project_id', 'ilike', searchTerm),
        ])
      )
    }

    if (criteria.status) {
      query = query.where('status', '=', criteria.status as any)
    }

    if (criteria.priority) {
      query = query.where('priority', '=', criteria.priority as any)
    }

    if (criteria.assignedTo) {
      query = query.where('assigned_to', '=', criteria.assignedTo)
    }

    if (criteria.createdBy) {
      query = query.where('created_by', '=', criteria.createdBy)
    }

    if (criteria.dateRange) {
      query = query
        .where('submitted_at', '>=', criteria.dateRange.start)
        .where('submitted_at', '<=', criteria.dateRange.end)
    }

    const results = await query
      .orderBy('submitted_at', 'desc')
      .execute()

    return results as Sample[]
  }

  async delete(id: string): Promise<void> {
    await this.db
      .deleteFrom('nanopore_samples')
      .where('id', '=', id)
      .execute()
  }

  async findByStatus(status: string): Promise<Sample[]> {
    const results = await this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('status', '=', status as any)
      .orderBy('submitted_at', 'desc')
      .execute()

    return results as Sample[]
  }

  async findByUser(userId: string): Promise<Sample[]> {
    const results = await this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('created_by', '=', userId)
      .orderBy('submitted_at', 'desc')
      .execute()

    return results as Sample[]
  }

  async findByAssignedTo(assignedTo: string): Promise<Sample[]> {
    const results = await this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('assigned_to', '=', assignedTo)
      .orderBy('submitted_at', 'desc')
      .execute()

    return results as Sample[]
  }

  async updateStatus(id: string, status: string): Promise<Sample> {
    const updateData: any = {
      status,
      updated_at: new Date(),
    }

    // Add timestamps for specific status changes
    if (status === 'prep') {
      updateData.started_at = new Date()
    } else if (status === 'completed') {
      updateData.completed_at = new Date()
    }

    const result = await this.db
      .updateTable('nanopore_samples')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as Sample
  }

  async assign(id: string, assignedTo: string, libraryPrepBy?: string): Promise<Sample> {
    const result = await this.db
      .updateTable('nanopore_samples')
      .set({
        assigned_to: assignedTo,
        library_prep_by: libraryPrepBy || null,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as Sample
  }

  async count(): Promise<number> {
    const result = await this.db
      .selectFrom('nanopore_samples')
      .select((eb) => eb.fn.count('id').as('count'))
      .executeTakeFirst()

    return Number(result?.count || 0)
  }

  async countByStatus(status: string): Promise<number> {
    const result = await this.db
      .selectFrom('nanopore_samples')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('status', '=', status as any)
      .executeTakeFirst()

    return Number(result?.count || 0)
  }

  async countByPriority(priority: string): Promise<number> {
    const result = await this.db
      .selectFrom('nanopore_samples')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('priority', '=', priority as any)
      .executeTakeFirst()

    return Number(result?.count || 0)
  }
} 