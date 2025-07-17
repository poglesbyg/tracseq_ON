import type {
  NanoporeSample,
  NanoporeSampleDetail,
  NanoporeProcessingStep,
  NanoporeAttachment,
  DB,
  JsonValue,
} from '../../db/types'
import type { Selectable, Insertable, Updateable, Kysely, Transaction } from 'kysely'

// Input types for creating new records
export interface CreateNanoporeSampleInput extends Insertable<NanoporeSample> {}
export interface CreateNanoporeSampleDetailInput extends Insertable<NanoporeSampleDetail> {}
export interface CreateNanoporeProcessingStepInput extends Insertable<NanoporeProcessingStep> {}
export interface CreateNanoporeAttachmentInput extends Insertable<NanoporeAttachment> {}

// Input types for updating existing records
export interface UpdateNanoporeSampleInput extends Updateable<NanoporeSample> {}
export interface UpdateNanoporeSampleDetailInput extends Updateable<NanoporeSampleDetail> {}
export interface UpdateNanoporeProcessingStepInput extends Updateable<NanoporeProcessingStep> {}

/**
 * Create a new nanopore sample
 */
export async function createNanoporeSample(
  db: Kysely<DB>,
  sampleData: CreateNanoporeSampleInput,
): Promise<Selectable<NanoporeSample>> {
  const now = new Date().toISOString()
  
  return await db
    .insertInto('nanopore_samples')
    .values({
      ...sampleData,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Create a new nanopore sample with details
 */
export async function createNanoporeSampleWithDetails(
  db: Kysely<DB>,
  sampleData: CreateNanoporeSampleInput,
  detailsData: CreateNanoporeSampleDetailInput,
): Promise<{ sample: Selectable<NanoporeSample>; details: Selectable<NanoporeSampleDetail> }> {
  const now = new Date().toISOString()
  
  const sample = await db
    .insertInto('nanopore_samples')
    .values({
      ...sampleData,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  const details = await db
    .insertInto('nanopore_sample_details')
    .values({
      ...detailsData,
      sample_id: sample.id,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return { sample, details }
}

/**
 * Update an existing nanopore sample
 */
export async function updateNanoporeSample(
  db: Kysely<DB>,
  sampleId: string,
  updateData: UpdateNanoporeSampleInput,
): Promise<Selectable<NanoporeSample>> {
  const now = new Date().toISOString()
  
  const finalUpdateData = {
    ...updateData,
    updated_at: now,
  }

  return await db
    .updateTable('nanopore_samples')
    .set(finalUpdateData)
    .where('id', '=', sampleId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Update sample status
 */
export async function updateSampleStatus(
  db: Kysely<DB>,
  sampleId: string,
  status: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived',
): Promise<Selectable<NanoporeSample>> {
  const now = new Date().toISOString()
  
  return await db
    .updateTable('nanopore_samples')
    .set({
      status,
      updated_at: now,
    })
    .where('id', '=', sampleId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Assign sample to team member
 */
export async function assignSample(
  db: Kysely<DB>,
  sampleId: string,
  assignedTo: string,
  libraryPrepBy?: string,
): Promise<Selectable<NanoporeSample>> {
  const now = new Date().toISOString()
  
  const updateData: any = {
    assigned_to: assignedTo,
    updated_at: now,
  }

  if (libraryPrepBy) {
    updateData.library_prep_by = libraryPrepBy
  }

  return await db
    .updateTable('nanopore_samples')
    .set(updateData)
    .where('id', '=', sampleId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Create sample details
 */
export async function createNanoporeSampleDetails(
  db: Kysely<DB>,
  detailsData: CreateNanoporeSampleDetailInput,
): Promise<Selectable<NanoporeSampleDetail>> {
  const now = new Date().toISOString()
  
  return await db
    .insertInto('nanopore_sample_details')
    .values({
      ...detailsData,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Update sample details
 */
export async function updateNanoporeSampleDetails(
  db: Kysely<DB>,
  sampleId: string,
  updateData: UpdateNanoporeSampleDetailInput,
): Promise<Selectable<NanoporeSampleDetail>> {
  const now = new Date().toISOString()
  
  return await db
    .updateTable('nanopore_sample_details')
    .set({
      ...updateData,
      updated_at: now,
    })
    .where('sample_id', '=', sampleId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Create processing step
 */
export async function createProcessingStep(
  db: Kysely<DB>,
  stepData: CreateNanoporeProcessingStepInput,
): Promise<Selectable<NanoporeProcessingStep>> {
  const now = new Date().toISOString()
  
  return await db
    .insertInto('nanopore_processing_steps')
    .values({
      ...stepData,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Update processing step
 */
export async function updateProcessingStep(
  db: Kysely<DB>,
  stepId: string,
  updateData: UpdateNanoporeProcessingStepInput,
): Promise<Selectable<NanoporeProcessingStep>> {
  const now = new Date().toISOString()
  
  return await db
    .updateTable('nanopore_processing_steps')
    .set({
      ...updateData,
      updated_at: now,
    })
    .where('id', '=', stepId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Create default processing steps for a sample
 */
export async function createDefaultProcessingSteps(
  db: Kysely<DB>,
  sampleId: string,
): Promise<Array<Selectable<NanoporeProcessingStep>>> {
  const now = new Date().toISOString()
  
  const defaultSteps = [
    {
      sample_id: sampleId,
      step_name: 'Sample QC',
      step_status: 'pending' as const,
      estimated_duration_hours: 1,
      created_at: now,
      updated_at: now,
    },
    {
      sample_id: sampleId,
      step_name: 'Library Preparation',
      step_status: 'pending' as const,
      estimated_duration_hours: 4,
      created_at: now,
      updated_at: now,
    },
    {
      sample_id: sampleId,
      step_name: 'Library QC',
      step_status: 'pending' as const,
      estimated_duration_hours: 1,
      created_at: now,
      updated_at: now,
    },
    {
      sample_id: sampleId,
      step_name: 'Sequencing Setup',
      step_status: 'pending' as const,
      estimated_duration_hours: 1,
      created_at: now,
      updated_at: now,
    },
    {
      sample_id: sampleId,
      step_name: 'Sequencing Run',
      step_status: 'pending' as const,
      estimated_duration_hours: 48,
      created_at: now,
      updated_at: now,
    },
    {
      sample_id: sampleId,
      step_name: 'Basecalling',
      step_status: 'pending' as const,
      estimated_duration_hours: 2,
      created_at: now,
      updated_at: now,
    },
    {
      sample_id: sampleId,
      step_name: 'Quality Assessment',
      step_status: 'pending' as const,
      estimated_duration_hours: 1,
      created_at: now,
      updated_at: now,
    },
    {
      sample_id: sampleId,
      step_name: 'Data Delivery',
      step_status: 'pending' as const,
      estimated_duration_hours: 1,
      created_at: now,
      updated_at: now,
    },
  ]

  return await db
    .insertInto('nanopore_processing_steps')
    .values(defaultSteps)
    .returningAll()
    .execute()
}

/**
 * Complete processing step
 */
export async function completeProcessingStep(
  db: Kysely<DB>,
  stepId: string,
  resultsData?: JsonValue,
): Promise<Selectable<NanoporeProcessingStep>> {
  const now = new Date().toISOString()
  
  const updateData: any = {
    step_status: 'completed',
    completed_at: now,
    updated_at: now,
  }

  if (resultsData) {
    updateData.results_data = resultsData
  }

  return await db
    .updateTable('nanopore_processing_steps')
    .set(updateData)
    .where('id', '=', stepId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Start processing step
 */
export async function startProcessingStep(
  db: Kysely<DB>,
  stepId: string,
): Promise<Selectable<NanoporeProcessingStep>> {
  const now = new Date().toISOString()
  
  const updateData = {
    step_status: 'in_progress' as const,
    started_at: now,
    updated_at: now,
  }

  return await db
    .updateTable('nanopore_processing_steps')
    .set(updateData)
    .where('id', '=', stepId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Create file attachment
 */
export async function createAttachment(
  db: Kysely<DB>,
  attachmentData: CreateNanoporeAttachmentInput,
): Promise<Selectable<NanoporeAttachment>> {
  const now = new Date().toISOString()
  
  return await db
    .insertInto('nanopore_attachments')
    .values({
      ...attachmentData,
      created_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Delete file attachment
 */
export async function deleteAttachment(
  db: Kysely<DB>,
  attachmentId: string,
): Promise<void> {
  await db
    .deleteFrom('nanopore_attachments')
    .where('id', '=', attachmentId)
    .execute()
}

/**
 * Create complete nanopore sample with all related data
 */
export async function createCompleteSample(
  db: Kysely<DB>,
  sampleData: CreateNanoporeSampleInput,
  detailsData: CreateNanoporeSampleDetailInput,
): Promise<{
  sample: Selectable<NanoporeSample>
  details: Selectable<NanoporeSampleDetail>
  processingSteps: Array<Selectable<NanoporeProcessingStep>>
}> {
  return await db.transaction().execute(async (trx: Transaction<DB>) => {
    const now = new Date().toISOString()
    
    // Create sample
    const sample = await trx
      .insertInto('nanopore_samples')
      .values({
        ...sampleData,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    // Create details
    const details = await trx
      .insertInto('nanopore_sample_details')
      .values({
        ...detailsData,
        sample_id: sample.id,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    // Create default processing steps
    const defaultSteps = [
      {
        sample_id: sample.id,
        step_name: 'Sample QC',
        step_status: 'pending' as const,
        estimated_duration_hours: 1,
        created_at: now,
        updated_at: now,
      },
      {
        sample_id: sample.id,
        step_name: 'Library Preparation',
        step_status: 'pending' as const,
        estimated_duration_hours: 4,
        created_at: now,
        updated_at: now,
      },
      {
        sample_id: sample.id,
        step_name: 'Library QC',
        step_status: 'pending' as const,
        estimated_duration_hours: 1,
        created_at: now,
        updated_at: now,
      },
      {
        sample_id: sample.id,
        step_name: 'Sequencing Setup',
        step_status: 'pending' as const,
        estimated_duration_hours: 1,
        created_at: now,
        updated_at: now,
      },
      {
        sample_id: sample.id,
        step_name: 'Sequencing Run',
        step_status: 'pending' as const,
        estimated_duration_hours: 48,
        created_at: now,
        updated_at: now,
      },
      {
        sample_id: sample.id,
        step_name: 'Basecalling',
        step_status: 'pending' as const,
        estimated_duration_hours: 2,
        created_at: now,
        updated_at: now,
      },
      {
        sample_id: sample.id,
        step_name: 'Quality Assessment',
        step_status: 'pending' as const,
        estimated_duration_hours: 1,
        created_at: now,
        updated_at: now,
      },
      {
        sample_id: sample.id,
        step_name: 'Data Delivery',
        step_status: 'pending' as const,
        estimated_duration_hours: 1,
        created_at: now,
        updated_at: now,
      },
    ]

    const processingSteps = await trx
      .insertInto('nanopore_processing_steps')
      .values(defaultSteps)
      .returningAll()
      .execute()

    return {
      sample,
      details,
      processingSteps,
    }
  })
}

/**
 * Delete nanopore sample and all related data
 */
export async function deleteNanoporeSample(
  db: Kysely<DB>,
  sampleId: string,
): Promise<void> {
  await db.transaction().execute(async (trx: Transaction<DB>) => {
    // Delete attachments first
    await trx
      .deleteFrom('nanopore_attachments')
      .where('sample_id', '=', sampleId)
      .execute()

    // Delete processing steps
    await trx
      .deleteFrom('nanopore_processing_steps')
      .where('sample_id', '=', sampleId)
      .execute()

    // Delete sample details
    await trx
      .deleteFrom('nanopore_sample_details')
      .where('sample_id', '=', sampleId)
      .execute()

    // Delete sample
    await trx
      .deleteFrom('nanopore_samples')
      .where('id', '=', sampleId)
      .execute()
  })
}
