import type {
  NanoporeSample,
  NanoporeSampleDetail,
  NanoporeProcessingStep,
  NanoporeAttachment,
  DB,
} from '@app/db/types'
import type { Selectable, Kysely } from 'kysely'

export interface NanoporeSampleWithDetails extends Selectable<NanoporeSample> {
  details: Selectable<NanoporeSampleDetail> | null
}

export interface NanoporeSampleWithSteps extends Selectable<NanoporeSample> {
  processingSteps: Array<Selectable<NanoporeProcessingStep>>
}

export interface NanoporeSampleFull extends Selectable<NanoporeSample> {
  details: Selectable<NanoporeSampleDetail> | null
  processingSteps: Array<Selectable<NanoporeProcessingStep>>
  attachments: Array<Selectable<NanoporeAttachment>>
}

/**
 * Get all nanopore samples for a user
 */
export async function getUserNanoporeSamples(
  db: Kysely<DB>,
  userId: string,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanoporeSamples')
    .selectAll()
    .where('createdBy', '=', userId)
    .orderBy('submittedAt', 'desc')
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
  return (
    (await db
      .selectFrom('nanoporeSamples')
      .selectAll()
      .where('id', '=', sampleId)
      .where('createdBy', '=', userId)
      .executeTakeFirst()) || null
  )
}

/**
 * Get nanopore sample with details
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
    .selectFrom('nanoporeSampleDetails')
    .selectAll()
    .where('sampleId', '=', sampleId)
    .executeTakeFirst()

  return {
    ...sample,
    details: details ?? null,
  }
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
      .selectFrom('nanoporeSampleDetails')
      .selectAll()
      .where('sampleId', '=', sampleId)
      .executeTakeFirst(),
    db
      .selectFrom('nanoporeProcessingSteps')
      .selectAll()
      .where('sampleId', '=', sampleId)
      .orderBy('createdAt', 'asc')
      .execute(),
    db
      .selectFrom('nanoporeAttachments')
      .selectAll()
      .where('sampleId', '=', sampleId)
      .orderBy('uploadedAt', 'desc')
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
 * Get recent nanopore samples for dashboard
 */
export async function getRecentNanoporeSamples(
  db: Kysely<DB>,
  userId: string,
  limit: number = 10,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanoporeSamples')
    .selectAll()
    .where('createdBy', '=', userId)
    .orderBy('submittedAt', 'desc')
    .limit(limit)
    .execute()
}

/**
 * Get nanopore samples by status
 */
export async function getNanoporeSamplesByStatus(
  db: Kysely<DB>,
  userId: string,
  status: string,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanoporeSamples')
    .selectAll()
    .where('createdBy', '=', userId)
    .where('status', '=', status)
    .orderBy('submittedAt', 'desc')
    .execute()
}

/**
 * Get nanopore samples by priority
 */
export async function getNanoporeSamplesByPriority(
  db: Kysely<DB>,
  userId: string,
  priority: string,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanoporeSamples')
    .selectAll()
    .where('createdBy', '=', userId)
    .where('priority', '=', priority)
    .orderBy('submittedAt', 'desc')
    .execute()
}

/**
 * Get nanopore samples assigned to a specific team member
 */
export async function getNanoporeSamplesByAssignee(
  db: Kysely<DB>,
  assignedTo: string,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanoporeSamples')
    .selectAll()
    .where('assignedTo', '=', assignedTo)
    .orderBy('priority', 'desc')
    .orderBy('submittedAt', 'asc')
    .execute()
}

/**
 * Get all nanopore samples (for team view)
 */
export async function getAllNanoporeSamples(
  db: Kysely<DB>,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanoporeSamples')
    .selectAll()
    .orderBy('submittedAt', 'desc')
    .execute()
}

/**
 * Get nanopore queue for team dashboard
 */
export async function getNanoporeQueue(
  db: Kysely<DB>,
): Promise<Array<NanoporeSampleWithSteps>> {
  const samples = await db
    .selectFrom('nanoporeSamples')
    .selectAll()
    .where('status', 'in', ['submitted', 'prep', 'sequencing', 'analysis'])
    .orderBy('priority', 'desc')
    .orderBy('submittedAt', 'asc')
    .execute()

  const samplesWithSteps = await Promise.all(
    samples.map(async (sample) => {
      const processingSteps = await db
        .selectFrom('nanoporeProcessingSteps')
        .selectAll()
        .where('sampleId', '=', sample.id)
        .orderBy('createdAt', 'asc')
        .execute()

      return {
        ...sample,
        processingSteps,
      }
    }),
  )

  return samplesWithSteps
}

/**
 * Get processing steps for a sample
 */
export async function getProcessingSteps(
  db: Kysely<DB>,
  sampleId: string,
): Promise<Array<Selectable<NanoporeProcessingStep>>> {
  return await db
    .selectFrom('nanoporeProcessingSteps')
    .selectAll()
    .where('sampleId', '=', sampleId)
    .orderBy('createdAt', 'asc')
    .execute()
}

/**
 * Get sample attachments
 */
export async function getSampleAttachments(
  db: Kysely<DB>,
  sampleId: string,
): Promise<Array<Selectable<NanoporeAttachment>>> {
  return await db
    .selectFrom('nanoporeAttachments')
    .selectAll()
    .where('sampleId', '=', sampleId)
    .orderBy('uploadedAt', 'desc')
    .execute()
}

/**
 * Get nanopore samples by date range
 */
export async function getNanoporeSamplesByDateRange(
  db: Kysely<DB>,
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanoporeSamples')
    .selectAll()
    .where('createdBy', '=', userId)
    .where('submittedAt', '>=', startDate)
    .where('submittedAt', '<=', endDate)
    .orderBy('submittedAt', 'desc')
    .execute()
}

/**
 * Get all nanopore samples by date range (for team export)
 */
export async function getAllNanoporeSamplesByDateRange(
  db: Kysely<DB>,
  startDate: Date,
  endDate: Date,
): Promise<Array<Selectable<NanoporeSample>>> {
  return await db
    .selectFrom('nanoporeSamples')
    .selectAll()
    .where('submittedAt', '>=', startDate)
    .where('submittedAt', '<=', endDate)
    .orderBy('submittedAt', 'desc')
    .execute()
}
