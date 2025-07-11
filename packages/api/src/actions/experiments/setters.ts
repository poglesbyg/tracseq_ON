import type {
  Experiment,
  Sequence,
  GuideRna,
  OffTargetSite,
  AnalysisResult,
  DB,
} from '@app/db/types'
import type { Insertable, Updateable, Selectable, Kysely } from 'kysely'

export type CreateExperimentInput = Omit<
  Insertable<Experiment>,
  'id' | 'createdAt' | 'updatedAt'
>
export type UpdateExperimentInput = Updateable<Experiment>
export type CreateSequenceInput = Omit<Insertable<Sequence>, 'id' | 'createdAt'>
export type CreateGuideRnaInput = Omit<Insertable<GuideRna>, 'id' | 'createdAt'>
export type CreateOffTargetSiteInput = Omit<
  Insertable<OffTargetSite>,
  'id' | 'createdAt'
>

/**
 * Create a new experiment
 */
export async function createExperiment(
  db: Kysely<DB>,
  experimentData: CreateExperimentInput,
): Promise<Selectable<Experiment>> {
  return await db
    .insertInto('experiments')
    .values(experimentData)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Update an existing experiment
 */
export async function updateExperiment(
  db: Kysely<DB>,
  experimentId: string,
  userId: string,
  updateData: UpdateExperimentInput,
): Promise<Selectable<Experiment> | null> {
  const result = await db
    .updateTable('experiments')
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where('id', '=', experimentId)
    .where('createdBy', '=', userId)
    .returningAll()
    .executeTakeFirst()

  return result || null
}

/**
 * Delete an experiment and all associated data
 */
export async function deleteExperiment(
  db: Kysely<DB>,
  experimentId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom('experiments')
    .where('id', '=', experimentId)
    .where('createdBy', '=', userId)
    .execute()

  return result.length > 0 && Number(result[0].numDeletedRows) > 0
}

/**
 * Add a sequence to an experiment
 */
export async function createSequence(
  db: Kysely<DB>,
  sequenceData: CreateSequenceInput,
): Promise<Selectable<Sequence>> {
  return await db
    .insertInto('sequences')
    .values(sequenceData)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Update a sequence
 */
export async function updateSequence(
  db: Kysely<DB>,
  sequenceId: string,
  updateData: Updateable<Sequence>,
): Promise<Selectable<Sequence> | null> {
  const result = await db
    .updateTable('sequences')
    .set(updateData)
    .where('id', '=', sequenceId)
    .returningAll()
    .executeTakeFirst()

  return result || null
}

/**
 * Delete a sequence and all associated guide RNAs
 */
export async function deleteSequence(
  db: Kysely<DB>,
  sequenceId: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom('sequences')
    .where('id', '=', sequenceId)
    .execute()

  return result.length > 0 && Number(result[0].numDeletedRows) > 0
}

/**
 * Save guide RNAs for a sequence (batch insert)
 */
export async function saveGuideRnas(
  db: Kysely<DB>,
  guideRnas: CreateGuideRnaInput[],
): Promise<Array<Selectable<GuideRna>>> {
  if (guideRnas.length === 0) {
    return []
  }

  return await db
    .insertInto('guideRnas')
    .values(guideRnas)
    .returningAll()
    .execute()
}

/**
 * Update a guide RNA
 */
export async function updateGuideRna(
  db: Kysely<DB>,
  guideRnaId: string,
  updateData: Updateable<GuideRna>,
): Promise<Selectable<GuideRna> | null> {
  const result = await db
    .updateTable('guideRnas')
    .set(updateData)
    .where('id', '=', guideRnaId)
    .returningAll()
    .executeTakeFirst()

  return result || null
}

/**
 * Save off-target sites for guide RNAs (batch insert)
 */
export async function saveOffTargetSites(
  db: Kysely<DB>,
  offTargetSites: CreateOffTargetSiteInput[],
): Promise<Array<Selectable<OffTargetSite>>> {
  if (offTargetSites.length === 0) {
    return []
  }

  return await db
    .insertInto('offTargetSites')
    .values(offTargetSites)
    .returningAll()
    .execute()
}

/**
 * Save analysis results
 */
export async function saveAnalysisResult(
  db: Kysely<DB>,
  analysisData: Insertable<AnalysisResult>,
): Promise<Selectable<AnalysisResult>> {
  return await db
    .insertInto('analysisResults')
    .values(analysisData)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Update experiment status
 */
export async function updateExperimentStatus(
  db: Kysely<DB>,
  experimentId: string,
  userId: string,
  status: string,
): Promise<Selectable<Experiment> | null> {
  return await updateExperiment(db, experimentId, userId, { status })
}

/**
 * Complete experiment design workflow (transaction)
 * Saves sequence, guide RNAs, and off-target sites in a single transaction
 */
export async function saveCompleteExperimentData(
  db: Kysely<DB>,
  experimentId: string,
  sequenceData: CreateSequenceInput,
  guideRnasData: Omit<CreateGuideRnaInput, 'sequenceId'>[],
  offTargetSitesData: Record<
    string,
    Omit<CreateOffTargetSiteInput, 'guideRnaId'>[]
  >,
): Promise<{
  sequence: Selectable<Sequence>
  guideRnas: Array<Selectable<GuideRna>>
  offTargetSites: Array<Selectable<OffTargetSite>>
}> {
  return await db.transaction().execute(async (trx) => {
    // 1. Create the sequence
    const sequence = await trx
      .insertInto('sequences')
      .values(sequenceData)
      .returningAll()
      .executeTakeFirstOrThrow()

    // 2. Create guide RNAs
    const guideRnasWithSequenceId = guideRnasData.map((guide) => ({
      ...guide,
      sequenceId: sequence.id,
    }))

    const guideRnas = await trx
      .insertInto('guideRnas')
      .values(guideRnasWithSequenceId)
      .returningAll()
      .execute()

    // 3. Create off-target sites for each guide RNA
    const allOffTargetSites: Array<Selectable<OffTargetSite>> = []

    for (const guideRna of guideRnas) {
      const guideSequence = guideRna.guideSequence
      const offTargetsForThisGuide = offTargetSitesData[guideSequence] || []

      if (offTargetsForThisGuide.length > 0) {
        const offTargetsWithGuideId = offTargetsForThisGuide.map(
          (offTarget) => ({
            ...offTarget,
            guideRnaId: guideRna.id,
          }),
        )

        const savedOffTargets = await trx
          .insertInto('offTargetSites')
          .values(offTargetsWithGuideId)
          .returningAll()
          .execute()

        allOffTargetSites.push(...savedOffTargets)
      }
    }

    return {
      sequence,
      guideRnas,
      offTargetSites: allOffTargetSites,
    }
  })
}
