import type {
  Experiment,
  Sequence,
  GuideRna,
  OffTargetSite,
  DB,
} from '@app/db/types'
import type { Selectable, Kysely } from 'kysely'

export interface ExperimentWithSequences extends Selectable<Experiment> {
  sequences: Array<Selectable<Sequence>>
}

export interface ExperimentDetails extends Selectable<Experiment> {
  sequences: Array<
    Selectable<Sequence> & {
      guideRnas: Array<
        Selectable<GuideRna> & {
          offTargetSites: Array<Selectable<OffTargetSite>>
        }
      >
    }
  >
}

/**
 * Get all experiments for a user
 */
export async function getUserExperiments(
  db: Kysely<DB>,
  userId: string,
): Promise<Array<Selectable<Experiment>>> {
  return await db
    .selectFrom('experiments')
    .selectAll()
    .where('createdBy', '=', userId)
    .orderBy('createdAt', 'desc')
    .execute()
}

/**
 * Get a specific experiment by ID
 */
export async function getExperimentById(
  db: Kysely<DB>,
  experimentId: string,
  userId: string,
): Promise<Selectable<Experiment> | null> {
  return await db
    .selectFrom('experiments')
    .selectAll()
    .where('id', '=', experimentId)
    .where('createdBy', '=', userId)
    .executeTakeFirst()
    .then((result: Selectable<Experiment> | undefined) => result || null)
}

/**
 * Get experiment with its sequences
 */
export async function getExperimentWithSequences(
  db: Kysely<DB>,
  experimentId: string,
  userId: string,
): Promise<ExperimentWithSequences | null> {
  const experiment = await getExperimentById(db, experimentId, userId)
  if (!experiment) {
    return null
  }

  const sequences = await db
    .selectFrom('sequences')
    .selectAll()
    .where('experimentId', '=', experimentId)
    .orderBy('createdAt', 'asc')
    .execute()

  return {
    ...experiment,
    sequences,
  }
}

/**
 * Get complete experiment details with sequences, guides, and off-targets
 */
export async function getExperimentDetails(
  db: Kysely<DB>,
  experimentId: string,
  userId: string,
): Promise<ExperimentDetails | null> {
  const experiment = await getExperimentById(db, experimentId, userId)
  if (!experiment) {
    return null
  }

  // Get sequences for this experiment
  const sequences = await db
    .selectFrom('sequences')
    .selectAll()
    .where('experimentId', '=', experimentId)
    .orderBy('createdAt', 'asc')
    .execute()

  // Get guide RNAs and off-targets for each sequence
  const sequencesWithGuides = await Promise.all(
    sequences.map(async (sequence: Selectable<Sequence>) => {
      const guideRnas = await db
        .selectFrom('guideRnas')
        .selectAll()
        .where('sequenceId', '=', sequence.id)
        .orderBy('efficiencyScore', 'desc')
        .execute()

      const guidesWithOffTargets = await Promise.all(
        guideRnas.map(async (guide: Selectable<GuideRna>) => {
          const offTargetSites = await db
            .selectFrom('offTargetSites')
            .selectAll()
            .where('guideRnaId', '=', guide.id)
            .orderBy('bindingScore', 'desc')
            .execute()

          return {
            ...guide,
            offTargetSites,
          }
        }),
      )

      return {
        ...sequence,
        guideRnas: guidesWithOffTargets,
      }
    }),
  )

  return {
    ...experiment,
    sequences: sequencesWithGuides,
  }
}

/**
 * Get recent experiments for dashboard
 */
export async function getRecentExperiments(
  db: Kysely<DB>,
  userId: string,
  limit: number = 5,
): Promise<Array<Selectable<Experiment>>> {
  return await db
    .selectFrom('experiments')
    .selectAll()
    .where('createdBy', '=', userId)
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .execute()
}

/**
 * Get experiments by status
 */
export async function getExperimentsByStatus(
  db: Kysely<DB>,
  userId: string,
  status: string,
): Promise<Array<Selectable<Experiment>>> {
  return await db
    .selectFrom('experiments')
    .selectAll()
    .where('createdBy', '=', userId)
    .where('status', '=', status)
    .orderBy('updatedAt', 'desc')
    .execute()
}
