import type {
  NanoporeSample,
  NanoporeSampleDetail,
  NanoporeProcessingStep,
  NanoporeAttachment,
  DB,
} from '../../db/types'
import type { Selectable, Kysely, ExpressionBuilder } from 'kysely'

export interface NanoporeSampleWithDetails extends Selectable<NanoporeSample> {
  details: Selectable<NanoporeSampleDetail> | null
}

export interface NanoporeSampleFull extends Selectable<NanoporeSample> {
  details: Selectable<NanoporeSampleDetail> | null
  processingSteps: Array<Selectable<NanoporeProcessingStep>>
  attachments: Array<Selectable<NanoporeAttachment>>
}

/**
 * Get all nanopore samples
 */
export async function getAllNanoporeSamples(
  db: Kysely<DB>,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanopore_samples')
    .selectAll()
    .orderBy('submitted_at', 'desc')
    .execute()
}

/**
 * Get nanopore sample by ID
 */
export async function getNanoporeSampleById(
  db: Kysely<DB>,
  sampleId: string,
  userId: string,
): Promise<Selectable<NanoporeSample> | null> {
  return await db
    .selectFrom('nanopore_samples')
    .selectAll()
    .where('id', '=', sampleId)
    .where('created_by', '=', userId)
    .executeTakeFirst() || null
}

/**
 * Get nanopore sample by ID for any user (admin function)
 */
export async function getNanoporeSampleByIdAdmin(
  db: Kysely<DB>,
  sampleId: string,
): Promise<Selectable<NanoporeSample> | null> {
  return await db
    .selectFrom('nanopore_samples')
    .selectAll()
    .where('id', '=', sampleId)
    .executeTakeFirst() || null
}

/**
 * Get nanopore samples by status
 */
export async function getNanoporeSamplesByStatus(
  db: Kysely<DB>,
  status: string,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanopore_samples')
    .selectAll()
    .where('status', '=', status)
    .orderBy('submitted_at', 'desc')
    .execute()
}

/**
 * Get nanopore samples by priority
 */
export async function getNanoporeSamplesByPriority(
  db: Kysely<DB>,
  priority: string,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanopore_samples')
    .selectAll()
    .where('priority', '=', priority)
    .orderBy('submitted_at', 'desc')
    .execute()
}

/**
 * Get complete nanopore sample with all related data
 */
export async function getNanoporeSampleFull(
  db: Kysely<DB>,
  sampleId: string,
  userId: string,
): Promise<NanoporeSampleFull | null> {
  const sample = await getNanoporeSampleById(db, sampleId, userId)
  if (!sample) {
    return null
  }

  const [details, processingSteps, attachments] = await Promise.all([
    db
      .selectFrom('nanopore_sample_details')
      .selectAll()
      .where('sample_id', '=', sampleId)
      .executeTakeFirst(),
    db
      .selectFrom('nanopore_processing_steps')
      .selectAll()
      .where('sample_id', '=', sampleId)
      .orderBy('created_at', 'asc')
      .execute(),
    db
      .selectFrom('nanopore_attachments')
      .selectAll()
      .where('sample_id', '=', sampleId)
      .orderBy('uploaded_at', 'desc')
      .execute(),
  ])

  return {
    ...sample,
    details: details || null,
    processingSteps,
    attachments,
  }
}

/**
 * Get nanopore sample with details only
 */
export async function getNanoporeSampleWithDetails(
  db: Kysely<DB>,
  sampleId: string,
  userId: string,
): Promise<NanoporeSampleWithDetails | null> {
  const sample = await getNanoporeSampleById(db, sampleId, userId)
  if (!sample) {
    return null
  }

  const details = await db
    .selectFrom('nanopore_sample_details')
    .selectAll()
    .where('sample_id', '=', sampleId)
    .executeTakeFirst()

  return {
    ...sample,
    details: details || null,
  }
}

/**
 * Get all nanopore samples with their details
 */
export async function getAllNanoporeSamplesWithDetails(
  db: Kysely<DB>,
): Promise<Array<NanoporeSampleWithDetails>> {
  const samples = await getAllNanoporeSamples(db)
  
  const samplesWithDetails = await Promise.all(
    samples.map(async (sample) => {
      const details = await db
        .selectFrom('nanopore_sample_details')
        .selectAll()
        .where('sample_id', '=', sample.id)
        .executeTakeFirst()

      return {
        ...sample,
        details: details || null,
      }
    })
  )

  return samplesWithDetails
}

/**
 * Search nanopore samples
 */
export async function searchNanoporeSamples(
  db: Kysely<DB>,
  searchTerm: string,
  userId?: string,
): Promise<Array<Selectable<NanoporeSample>>> {
  let query = db
    .selectFrom('nanopore_samples')
    .selectAll()
    .where((eb: ExpressionBuilder<DB, 'nanopore_samples'>) => eb.or([
      eb('sample_name', 'ilike', `%${searchTerm}%`),
      eb('submitter_name', 'ilike', `%${searchTerm}%`),
      eb('submitter_email', 'ilike', `%${searchTerm}%`),
      eb('lab_name', 'ilike', `%${searchTerm}%`),
    ]))

  if (userId) {
    query = query.where('created_by', '=', userId)
  }

  return await query
    .orderBy('submitted_at', 'desc')
    .execute()
}

/**
 * Get nanopore samples assigned to a specific user
 */
export async function getNanoporeSamplesAssignedTo(
  db: Kysely<DB>,
  assignedTo: string,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanopore_samples')
    .selectAll()
    .where('assigned_to', '=', assignedTo)
    .orderBy('submitted_at', 'desc')
    .execute()
}

/**
 * Get processing steps for a sample
 */
export async function getProcessingStepsForSample(
  db: Kysely<DB>,
  sampleId: string,
): Promise<Array<Selectable<NanoporeProcessingStep>>> {
  return await db
    .selectFrom('nanopore_processing_steps')
    .selectAll()
    .where('sample_id', '=', sampleId)
    .orderBy('created_at', 'asc')
    .execute()
}

/**
 * Get attachments for a sample
 */
export async function getAttachmentsForSample(
  db: Kysely<DB>,
  sampleId: string,
): Promise<Array<Selectable<NanoporeAttachment>>> {
  return await db
    .selectFrom('nanopore_attachments')
    .selectAll()
    .where('sample_id', '=', sampleId)
    .orderBy('uploaded_at', 'desc')
    .execute()
}

/**
 * Get nanopore samples by user
 */
export async function getNanoporeSamplesByUser(
  db: Kysely<DB>,
  userId: string,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanopore_samples')
    .selectAll()
    .where('created_by', '=', userId)
    .orderBy('submitted_at', 'desc')
    .execute()
}

/**
 * Get nanopore samples by date range
 */
export async function getNanoporeSamplesByDateRange(
  db: Kysely<DB>,
  startDate: Date,
  endDate: Date,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanopore_samples')
    .selectAll()
    .where('submitted_at', '>=', startDate.toISOString())
    .where('submitted_at', '<=', endDate.toISOString())
    .orderBy('submitted_at', 'desc')
    .execute()
}

/**
 * Get all nanopore samples by date range (admin function)
 */
export async function getAllNanoporeSamplesByDateRange(
  db: Kysely<DB>,
  startDate: Date,
  endDate: Date,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanopore_samples')
    .selectAll()
    .where('submitted_at', '>=', startDate.toISOString())
    .where('submitted_at', '<=', endDate.toISOString())
    .orderBy('submitted_at', 'desc')
    .execute()
}
