import type { ISampleRepository } from '../services/interfaces/ISampleRepository'
import type { 
  Sample, 
  CreateSampleData, 
  UpdateSampleData, 
  SearchCriteria 
} from '../services/interfaces/ISampleService'
import { samplesDb } from '../lib/database/service-databases'
import { getComponentLogger } from '../lib/logging/StructuredLogger'

const logger = getComponentLogger('SamplesRepository')

export class SamplesRepository implements ISampleRepository {
  private get db() {
    return samplesDb()
  }

  async create(data: CreateSampleData): Promise<Sample> {
    logger.info('Creating sample in samples database', {
      action: 'create_sample',
      metadata: { sampleName: data.sampleName }
    })

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
        created_by: '550e8400-e29b-41d4-a716-446655440000', // Demo user UUID
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    logger.info('Sample created successfully', {
      action: 'sample_created',
      metadata: { sampleId: result.id, sampleName: result.sample_name }
    })

    return result as Sample
  }

  async update(id: string, data: UpdateSampleData): Promise<Sample> {
    logger.info('Updating sample in samples database', {
      action: 'update_sample',
      metadata: { sampleId: id }
    })

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
    if (data.sampleBuffer !== undefined) updateData.sample_buffer = data.sampleBuffer
    if (data.concentration !== undefined) updateData.concentration = data.concentration
    if (data.volume !== undefined) updateData.volume = data.volume
    if (data.totalAmount !== undefined) updateData.total_amount = data.totalAmount
    if (data.flowCellType !== undefined) updateData.flow_cell_type = data.flowCellType
    if (data.flowCellCount !== undefined) updateData.flow_cell_count = data.flowCellCount
    if (data.status !== undefined) updateData.status = data.status
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.assignedTo !== undefined) updateData.assigned_to = data.assignedTo
    if (data.libraryPrepBy !== undefined) updateData.library_prep_by = data.libraryPrepBy
    // chartField is not part of UpdateSampleData interface

    const result = await this.db
      .updateTable('nanopore_samples')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    logger.info('Sample updated successfully', {
      action: 'sample_updated',
      metadata: { sampleId: id }
    })

    return result as Sample
  }

  async findById(id: string): Promise<Sample | null> {
    const result = await this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    return result ? (result as Sample) : null
  }

  async findAll(): Promise<Sample[]> {
    const results = await this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute()

    return results as Sample[]
  }

  async search(criteria: SearchCriteria): Promise<Sample[]> {
    let query = this.db
      .selectFrom('nanopore_samples')
      .selectAll()

    if (criteria.status) {
      query = query.where('status', '=', criteria.status as any)
    }

    if (criteria.priority) {
      query = query.where('priority', '=', criteria.priority as any)
    }

    if (criteria.assignedTo) {
      query = query.where('assigned_to', '=', criteria.assignedTo)
    }

    if (criteria.searchTerm) {
      query = query.where((eb) => 
        eb.or([
          eb('sample_name', 'ilike', `%${criteria.searchTerm}%`),
          eb('submitter_name', 'ilike', `%${criteria.searchTerm}%`)
        ])
      )
    }

    if (criteria.dateRange) {
      query = query.where('created_at', '>=', criteria.dateRange.start)
      query = query.where('created_at', '<=', criteria.dateRange.end)
    }

    // Default ordering
    query = query.orderBy('created_at', 'desc')

    const results = await query.execute()
    return results as Sample[]
  }

  async delete(id: string): Promise<void> {
    logger.info('Deleting sample from samples database', {
      action: 'delete_sample',
      metadata: { sampleId: id }
    })

    await this.db
      .deleteFrom('nanopore_samples')
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    logger.info('Sample deleted successfully', {
      action: 'sample_deleted',
      metadata: { sampleId: id }
    })
  }

  async count(): Promise<number> {
    const result = await this.db
      .selectFrom('nanopore_samples')
      .select((eb) => eb.fn.count('id').as('count'))
      .executeTakeFirst()

    return Number(result?.count || 0)
  }

  async findByStatus(status: string): Promise<Sample[]> {
    const results = await this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('status', '=', status as any)
      .orderBy('created_at', 'desc')
      .execute()

    return results as Sample[]
  }

  async findByUser(userId: string): Promise<Sample[]> {
    const results = await this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('created_by', '=', userId)
      .orderBy('created_at', 'desc')
      .execute()

    return results as Sample[]
  }

  async findByAssignedTo(assignedTo: string): Promise<Sample[]> {
    const results = await this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('assigned_to', '=', assignedTo)
      .orderBy('created_at', 'desc')
      .execute()

    return results as Sample[]
  }

  async updateStatus(id: string, status: string): Promise<Sample> {
    logger.info('Updating sample status', {
      action: 'update_status',
      metadata: { sampleId: id, status }
    })

    const result = await this.db
      .updateTable('nanopore_samples')
      .set({ 
        status: status as any,
        updated_at: new Date()
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as Sample
  }

  async assign(id: string, assignedTo: string, libraryPrepBy?: string): Promise<Sample> {
    logger.info('Assigning sample', {
      action: 'assign_sample',
      metadata: { sampleId: id, assignedTo, libraryPrepBy }
    })

    const result = await this.db
      .updateTable('nanopore_samples')
      .set({ 
        assigned_to: assignedTo,
        library_prep_by: libraryPrepBy || null,
        updated_at: new Date()
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as Sample
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

  // Sample details operations
  async createSampleDetails(sampleId: string, details: any): Promise<any> {
    logger.info('Creating sample details', {
      action: 'create_sample_details',
      metadata: { sampleId }
    })

    const result = await this.db
      .insertInto('nanopore_sample_details')
      .values({
        id: crypto.randomUUID(),
        sample_id: sampleId,
        organism: details.organism || null,
        genome_size: details.genomeSize || null,
        expected_read_length: details.expectedReadLength || null,
        library_prep_kit: details.libraryPrepKit || null,
        barcoding_required: details.barcodingRequired || false,
        barcode_kit: details.barcodeKit || null,
        run_time_hours: details.runTimeHours || null,
        basecalling_model: details.basecallingModel || null,
        special_instructions: details.specialInstructions || null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return result
  }

  async getSampleDetails(sampleId: string): Promise<any> {
    const result = await this.db
      .selectFrom('nanopore_sample_details')
      .selectAll()
      .where('sample_id', '=', sampleId)
      .executeTakeFirst()

    return result || null
  }

  // Processing steps operations
  async createProcessingStep(sampleId: string, step: any): Promise<any> {
    logger.info('Creating processing step', {
      action: 'create_processing_step',
      metadata: { sampleId, stepName: step.stepName }
    })

    const result = await this.db
      .insertInto('nanopore_processing_steps')
      .values({
        id: crypto.randomUUID(),
        sample_id: sampleId,
        step_name: step.stepName,
        step_status: step.stepStatus || 'pending',
        assigned_to: step.assignedTo || null,
        started_at: step.startedAt || null,
        completed_at: step.completedAt || null,
        estimated_duration_hours: step.estimatedDurationHours || null,
        notes: step.notes || null,
        results_data: step.resultsData || null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return result
  }

  async getProcessingSteps(sampleId: string): Promise<any[]> {
    const results = await this.db
      .selectFrom('nanopore_processing_steps')
      .selectAll()
      .where('sample_id', '=', sampleId)
      .orderBy('created_at', 'asc')
      .execute()

    return results
  }

  async updateProcessingStep(stepId: string, updates: any): Promise<any> {
    const updateData: any = {
      updated_at: new Date(),
    }

    if (updates.stepStatus !== undefined) updateData.step_status = updates.stepStatus
    if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo
    if (updates.startedAt !== undefined) updateData.started_at = updates.startedAt
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt
    if (updates.notes !== undefined) updateData.notes = updates.notes
    if (updates.resultsData !== undefined) updateData.results_data = updates.resultsData

    const result = await this.db
      .updateTable('nanopore_processing_steps')
      .set(updateData)
      .where('id', '=', stepId)
      .returningAll()
      .executeTakeFirstOrThrow()

    return result
  }

  // Attachments operations
  async createAttachment(sampleId: string, attachment: any): Promise<any> {
    logger.info('Creating attachment', {
      action: 'create_attachment',
      metadata: { sampleId, fileName: attachment.fileName }
    })

    const result = await this.db
      .insertInto('nanopore_attachments')
      .values({
        id: crypto.randomUUID(),
        sample_id: sampleId,
        file_name: attachment.fileName,
        file_type: attachment.fileType || null,
        file_size_bytes: attachment.fileSizeBytes || null,
        file_path: attachment.filePath || null,
        description: attachment.description || null,
        uploaded_by: attachment.uploadedBy || null,
        uploaded_at: new Date(),
        created_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return result
  }

  async getAttachments(sampleId: string): Promise<any[]> {
    const results = await this.db
      .selectFrom('nanopore_attachments')
      .selectAll()
      .where('sample_id', '=', sampleId)
      .orderBy('created_at', 'desc')
      .execute()

    return results
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    await this.db
      .deleteFrom('nanopore_attachments')
      .where('id', '=', attachmentId)
      .executeTakeFirstOrThrow()
  }
} 