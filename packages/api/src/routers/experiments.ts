import { z } from 'zod'

import * as experimentGetters from '../actions/experiments/getters'
import * as experimentSetters from '../actions/experiments/setters'
import { router, protectedProcedure } from '../trpc'

const createExperimentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  targetOrganism: z.string().optional(),
  experimentType: z
    .enum(['knockout', 'knockin', 'screening'])
    .default('knockout'),
})

const updateExperimentSchema = z.object({
  name: z.string().max(255).optional(),
  description: z.string().optional(),
  targetOrganism: z.string().optional(),
  experimentType: z.enum(['knockout', 'knockin', 'screening']).optional(),
  status: z.enum(['draft', 'analyzing', 'completed', 'archived']).optional(),
})

const createSequenceSchema = z.object({
  experimentId: z.string().uuid(),
  name: z.string().min(1).max(255),
  sequence: z.string().regex(/^[acgnt]+$/i, 'Invalid DNA sequence'),
  sequenceType: z.enum(['genomic', 'cdna', 'custom']).default('genomic'),
  organism: z.string().optional(),
  chromosome: z.string().optional(),
  startPosition: z.number().int().positive().optional(),
  endPosition: z.number().int().positive().optional(),
  strand: z.enum(['+', '-']).optional(),
})

const saveGuideRnaSchema = z.object({
  sequenceId: z.string().uuid(),
  guideSequence: z.string().regex(/^[ACGT]+$/, 'Invalid guide sequence'),
  pamSequence: z.string().regex(/^[ACGT]+$/, 'Invalid PAM sequence'),
  targetPosition: z.number().int(),
  strand: z.enum(['+', '-']),
  efficiencyScore: z.number().min(0).max(1).optional(),
  specificityScore: z.number().min(0).max(1).optional(),
  onTargetScore: z.number().min(0).max(1).optional(),
  gcContent: z.number().min(0).max(100).optional(),
  algorithmUsed: z.string().optional(),
  algorithmVersion: z.string().optional(),
})

const saveOffTargetSiteSchema = z.object({
  guideRnaId: z.string().uuid(),
  chromosome: z.string().optional(),
  position: z.number().int().optional(),
  strand: z.enum(['+', '-']).optional(),
  sequence: z.string().regex(/^[ACGT]+$/, 'Invalid sequence'),
  mismatchCount: z.number().int().min(0).default(0),
  mismatchPositions: z.array(z.number().int()).optional(),
  bindingScore: z.number().min(0).max(1).optional(),
  cuttingScore: z.number().min(0).max(1).optional(),
  annotation: z.string().optional(),
})

export const experimentsRouter = router({
  // Get all experiments for current user
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return await experimentGetters.getUserExperiments(ctx.db, ctx.user.id)
  }),

  // Get experiment by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return await experimentGetters.getExperimentById(
        ctx.db,
        input.id,
        ctx.user.id,
      )
    }),

  // Get experiment with sequences
  getWithSequences: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return await experimentGetters.getExperimentWithSequences(
        ctx.db,
        input.id,
        ctx.user.id,
      )
    }),

  // Get complete experiment details
  getDetails: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return await experimentGetters.getExperimentDetails(
        ctx.db,
        input.id,
        ctx.user.id,
      )
    }),

  // Get recent experiments for dashboard
  getRecent: protectedProcedure
    .input(z.object({ limit: z.number().int().positive().max(20).default(5) }))
    .query(async ({ input, ctx }) => {
      return await experimentGetters.getRecentExperiments(
        ctx.db,
        ctx.user.id,
        input.limit,
      )
    }),

  // Get experiments by status
  getByStatus: protectedProcedure
    .input(z.object({ status: z.string() }))
    .query(async ({ input, ctx }) => {
      return await experimentGetters.getExperimentsByStatus(
        ctx.db,
        ctx.user.id,
        input.status,
      )
    }),

  // Create new experiment
  create: protectedProcedure
    .input(createExperimentSchema)
    .mutation(async ({ input, ctx }) => {
      const experimentData: experimentSetters.CreateExperimentInput = {
        ...input,
        createdBy: ctx.user.id,
      }
      return await experimentSetters.createExperiment(ctx.db, experimentData)
    }),

  // Update experiment
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateExperimentSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await experimentSetters.updateExperiment(
        ctx.db,
        input.id,
        ctx.user.id,
        input.data,
      )
    }),

  // Delete experiment
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return await experimentSetters.deleteExperiment(
        ctx.db,
        input.id,
        ctx.user.id,
      )
    }),

  // Update experiment status
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['draft', 'analyzing', 'completed', 'archived']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await experimentSetters.updateExperimentStatus(
        ctx.db,
        input.id,
        ctx.user.id,
        input.status,
      )
    }),

  // Sequence management
  sequences: router({
    // Create sequence
    create: protectedProcedure
      .input(createSequenceSchema)
      .mutation(async ({ input, ctx }) => {
        return await experimentSetters.createSequence(ctx.db, input)
      }),

    // Update sequence
    update: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          data: createSequenceSchema.partial(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return await experimentSetters.updateSequence(
          ctx.db,
          input.id,
          input.data,
        )
      }),

    // Delete sequence
    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        return await experimentSetters.deleteSequence(ctx.db, input.id)
      }),
  }),

  // Guide RNA management
  guideRnas: router({
    // Save multiple guide RNAs
    saveBatch: protectedProcedure
      .input(
        z.object({
          guideRnas: z.array(saveGuideRnaSchema),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return await experimentSetters.saveGuideRnas(ctx.db, input.guideRnas)
      }),

    // Update guide RNA
    update: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          data: saveGuideRnaSchema.partial(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return await experimentSetters.updateGuideRna(
          ctx.db,
          input.id,
          input.data,
        )
      }),
  }),

  // Off-target sites management
  offTargetSites: router({
    // Save multiple off-target sites
    saveBatch: protectedProcedure
      .input(
        z.object({
          offTargetSites: z.array(saveOffTargetSiteSchema),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return await experimentSetters.saveOffTargetSites(
          ctx.db,
          input.offTargetSites,
        )
      }),
  }),

  // Complete workflow - save sequence, guides, and off-targets
  saveCompleteData: protectedProcedure
    .input(
      z.object({
        experimentId: z.string().uuid(),
        sequence: createSequenceSchema.omit({ experimentId: true }),
        guideRnas: z.array(saveGuideRnaSchema.omit({ sequenceId: true })),
        offTargetSites: z.record(
          z.string(),
          z.array(saveOffTargetSiteSchema.omit({ guideRnaId: true })),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const sequenceData = {
        ...input.sequence,
        experimentId: input.experimentId,
      }

      return await experimentSetters.saveCompleteExperimentData(
        ctx.db,
        input.experimentId,
        sequenceData,
        input.guideRnas,
        input.offTargetSites,
      )
    }),
})
