import type {
  NanoporeSample,
  NanoporeSampleDetail,
  NanoporeProcessingStep,
  NanoporeAttachment,
  DB,
  JsonValue,
} from '@app/db/types'
import type { Selectable, Insertable, Updateable, Kysely } from 'kysely'

export interface CreateNanoporeSampleInput extends Insertable<NanoporeSample> {}
export interface CreateNanoporeSampleDetailInput
  extends Insertable<NanoporeSampleDetail> {}
export interface CreateNanoporeProcessingStepInput
  extends Insertable<NanoporeProcessingStep> {}
export interface CreateNanoporeAttachmentInput
  extends Insertable<NanoporeAttachment> {}

export interface UpdateNanoporeSampleInput extends Updateable<NanoporeSample> {}
export interface UpdateNanoporeSampleDetailInput
  extends Updateable<NanoporeSampleDetail> {}
export interface UpdateNanoporeProcessingStepInput
  extends Updateable<NanoporeProcessingStep> {}

/**
 * Create a new nanopore sample
 */
export async function createNanoporeSample(
  db: Kysely<DB>,
  sampleData: CreateNanoporeSampleInput,
): Promise<Selectable<NanoporeSample>> {
  return await db
    .insertInto('nanoporeSamples')
    .values(sampleData)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Create nanopore sample with details in a transaction
 */
export async function createNanoporeSampleWithDetails(
  db: Kysely<DB>,
  sampleData: CreateNanoporeSampleInput,
  detailsData: Omit<CreateNanoporeSampleDetailInput, 'sampleId'>,
): Promise<{
  sample: Selectable<NanoporeSample>
  details: Selectable<NanoporeSampleDetail>
}> {
  return await db.transaction().execute(async (trx) => {
    const sample = await trx
      .insertInto('nanoporeSamples')
      .values(sampleData)
      .returningAll()
      .executeTakeFirstOrThrow()

    const details = await trx
      .insertInto('nanoporeSampleDetails')
      .values({
        ...detailsData,
        sampleId: sample.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return { sample, details }
  })
}

/**
 * Update nanopore sample
 */
export async function updateNanoporeSample(
  db: Kysely<DB>,
  sampleId: string,
  userId: string,
  updateData: UpdateNanoporeSampleInput,
): Promise<Selectable<NanoporeSample>> {
  return await db
    .updateTable('nanoporeSamples')
    .set(updateData)
    .where('id', '=', sampleId)
    .where('createdBy', '=', userId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Update nanopore sample status
 */
export async function updateNanoporeSampleStatus(
  db: Kysely<DB>,
  sampleId: string,
  userId: string,
  status: string,
): Promise<Selectable<NanoporeSample>> {
  const updateData: UpdateNanoporeSampleInput = {
    status,
    ...(status === 'prep' && { startedAt: new Date() }),
    ...(status === 'completed' && { completedAt: new Date() }),
  }

  return await db
    .updateTable('nanoporeSamples')
    .set(updateData)
    .where('id', '=', sampleId)
    .where('createdBy', '=', userId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Assign nanopore sample to team member
 */
export async function assignNanoporeSample(
  db: Kysely<DB>,
  sampleId: string,
  assignedTo: string,
  libraryPrepBy?: string,
): Promise<Selectable<NanoporeSample>> {
  const updateData: UpdateNanoporeSampleInput = {
    assignedTo,
    ...(libraryPrepBy && { libraryPrepBy }),
  }

  return await db
    .updateTable('nanoporeSamples')
    .set(updateData)
    .where('id', '=', sampleId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Delete nanopore sample
 */
export async function deleteNanoporeSample(
  db: Kysely<DB>,
  sampleId: string,
  userId: string,
): Promise<void> {
  await db
    .deleteFrom('nanoporeSamples')
    .where('id', '=', sampleId)
    .where('createdBy', '=', userId)
    .execute()
}

/**
 * Create sample details
 */
export async function createNanoporeSampleDetails(
  db: Kysely<DB>,
  detailsData: CreateNanoporeSampleDetailInput,
): Promise<Selectable<NanoporeSampleDetail>> {
  return await db
    .insertInto('nanoporeSampleDetails')
    .values(detailsData)
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
  return await db
    .updateTable('nanoporeSampleDetails')
    .set(updateData)
    .where('sampleId', '=', sampleId)
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
  return await db
    .insertInto('nanoporeProcessingSteps')
    .values(stepData)
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
  return await db
    .updateTable('nanoporeProcessingSteps')
    .set(updateData)
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
  const defaultSteps = [
    {
      sampleId,
      stepName: 'Sample QC',
      stepStatus: 'pending' as const,
      estimatedDurationHours: 1,
    },
    {
      sampleId,
      stepName: 'Library Preparation',
      stepStatus: 'pending' as const,
      estimatedDurationHours: 4,
    },
    {
      sampleId,
      stepName: 'Library QC',
      stepStatus: 'pending' as const,
      estimatedDurationHours: 1,
    },
    {
      sampleId,
      stepName: 'Sequencing Setup',
      stepStatus: 'pending' as const,
      estimatedDurationHours: 1,
    },
    {
      sampleId,
      stepName: 'Sequencing Run',
      stepStatus: 'pending' as const,
      estimatedDurationHours: 48,
    },
    {
      sampleId,
      stepName: 'Basecalling',
      stepStatus: 'pending' as const,
      estimatedDurationHours: 2,
    },
    {
      sampleId,
      stepName: 'Quality Assessment',
      stepStatus: 'pending' as const,
      estimatedDurationHours: 1,
    },
    {
      sampleId,
      stepName: 'Data Delivery',
      stepStatus: 'pending' as const,
      estimatedDurationHours: 1,
    },
  ]

  return await db
    .insertInto('nanoporeProcessingSteps')
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
  notes?: string,
  resultsData?: JsonValue,
): Promise<Selectable<NanoporeProcessingStep>> {
  const updateData: UpdateNanoporeProcessingStepInput = {
    stepStatus: 'completed',
    completedAt: new Date(),
  }

  if (notes) {
    updateData.notes = notes
  }
  if (resultsData) {
    updateData.resultsData = resultsData
  }

  return await db
    .updateTable('nanoporeProcessingSteps')
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
  assignedTo?: string,
): Promise<Selectable<NanoporeProcessingStep>> {
  const updateData: UpdateNanoporeProcessingStepInput = {
    stepStatus: 'in_progress',
    startedAt: new Date(),
    ...(assignedTo && { assignedTo }),
  }

  return await db
    .updateTable('nanoporeProcessingSteps')
    .set(updateData)
    .where('id', '=', stepId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Create attachment
 */
export async function createAttachment(
  db: Kysely<DB>,
  attachmentData: CreateNanoporeAttachmentInput,
): Promise<Selectable<NanoporeAttachment>> {
  return await db
    .insertInto('nanoporeAttachments')
    .values(attachmentData)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Delete attachment
 */
export async function deleteAttachment(
  db: Kysely<DB>,
  attachmentId: string,
): Promise<void> {
  await db
    .deleteFrom('nanoporeAttachments')
    .where('id', '=', attachmentId)
    .execute()
}

/**
 * Complete sample workflow - create sample with details and default steps
 */
export async function createCompleteNanoporeSample(
  db: Kysely<DB>,
  sampleData: CreateNanoporeSampleInput,
  detailsData: Omit<CreateNanoporeSampleDetailInput, 'sampleId'>,
): Promise<{
  sample: Selectable<NanoporeSample>
  details: Selectable<NanoporeSampleDetail>
  processingSteps: Array<Selectable<NanoporeProcessingStep>>
}> {
  return await db.transaction().execute(async (trx) => {
    // Create the sample
    const sample = await trx
      .insertInto('nanoporeSamples')
      .values(sampleData)
      .returningAll()
      .executeTakeFirstOrThrow()

    // Create sample details
    const details = await trx
      .insertInto('nanoporeSampleDetails')
      .values({
        ...detailsData,
        sampleId: sample.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    // Create default processing steps
    const defaultSteps = [
      {
        sampleId: sample.id,
        stepName: 'Sample QC',
        stepStatus: 'pending' as const,
        estimatedDurationHours: 1,
      },
      {
        sampleId: sample.id,
        stepName: 'Library Preparation',
        stepStatus: 'pending' as const,
        estimatedDurationHours: 4,
      },
      {
        sampleId: sample.id,
        stepName: 'Library QC',
        stepStatus: 'pending' as const,
        estimatedDurationHours: 1,
      },
      {
        sampleId: sample.id,
        stepName: 'Sequencing Setup',
        stepStatus: 'pending' as const,
        estimatedDurationHours: 1,
      },
      {
        sampleId: sample.id,
        stepName: 'Sequencing Run',
        stepStatus: 'pending' as const,
        estimatedDurationHours: 48,
      },
      {
        sampleId: sample.id,
        stepName: 'Basecalling',
        stepStatus: 'pending' as const,
        estimatedDurationHours: 2,
      },
      {
        sampleId: sample.id,
        stepName: 'Quality Assessment',
        stepStatus: 'pending' as const,
        estimatedDurationHours: 1,
      },
      {
        sampleId: sample.id,
        stepName: 'Data Delivery',
        stepStatus: 'pending' as const,
        estimatedDurationHours: 1,
      },
    ]

    const processingSteps = await trx
      .insertInto('nanoporeProcessingSteps')
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
