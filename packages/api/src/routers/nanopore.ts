import type { JsonValue } from '@app/db/types'
import { z } from 'zod'

import * as fileStorage from '../actions/nanopore/file-storage'
import * as nanoporeGetters from '../actions/nanopore/getters'
import * as nanoporeSetters from '../actions/nanopore/setters'
import * as nanoporeExport from '../actions/nanopore/export'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

// Valid chart fields for intake validation
const VALID_CHART_FIELDS = [
  'HTSF-001', 'HTSF-002', 'HTSF-003', 'HTSF-004', 'HTSF-005',
  'NANO-001', 'NANO-002', 'NANO-003', 'NANO-004', 'NANO-005',
  'SEQ-001', 'SEQ-002', 'SEQ-003', 'SEQ-004', 'SEQ-005'
]

function validateChartField(chartField: string): boolean {
  return VALID_CHART_FIELDS.includes(chartField)
}

const createNanoporeSampleSchema = z.object({
  sampleName: z.string().min(1, 'Sample name is required').max(255),
  projectId: z.string().optional(),
  submitterName: z.string().min(1, 'Submitter name is required').max(255),
  submitterEmail: z.string().email('Invalid email address'),
  labName: z.string().optional(),
  sampleType: z.string().min(1, 'Sample type is required'),
  sampleBuffer: z.string().optional(),
  concentration: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  totalAmount: z.number().positive().optional(),
  flowCellType: z.string().optional(),
  flowCellCount: z.number().int().positive().default(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assignedTo: z.string().optional(),
  libraryPrepBy: z.string().optional(),
  chartField: z.string().min(1, 'Chart field is required for intake validation').max(255),
})

const createNanoporeSampleDetailsSchema = z.object({
  organism: z.string().optional(),
  genomeSize: z.string().optional(),
  expectedReadLength: z.string().optional(),
  libraryPrepKit: z.string().optional(),
  barcodingRequired: z.boolean().default(false),
  barcodeKit: z.string().optional(),
  runTimeHours: z.number().int().positive().optional(),
  basecallingModel: z.string().optional(),
  dataDeliveryMethod: z.string().optional(),
  fileFormat: z.string().optional(),
  analysisRequired: z.boolean().default(false),
  analysisType: z.string().optional(),
  specialInstructions: z.string().optional(),
  internalNotes: z.string().optional(),
})

const updateNanoporeSampleSchema = z.object({
  sampleName: z.string().max(255).optional(),
  projectId: z.string().optional(),
  submitterName: z.string().max(255).optional(),
  submitterEmail: z.string().email().optional(),
  labName: z.string().optional(),
  sampleType: z.string().optional(),
  sampleBuffer: z.string().optional(),
  concentration: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  totalAmount: z.number().positive().optional(),
  flowCellType: z.string().optional(),
  flowCellCount: z.number().int().positive().optional(),
  status: z
    .enum([
      'submitted',
      'prep',
      'sequencing',
      'analysis',
      'completed',
      'archived',
    ])
    .optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedTo: z.string().optional(),
  libraryPrepBy: z.string().optional(),
})

const updateProcessingStepSchema = z.object({
  stepStatus: z
    .enum(['pending', 'in_progress', 'completed', 'failed', 'skipped'])
    .optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
  resultsData: z.any().optional(),
})

export const nanoporeRouter = router({
  // Get all nanopore samples for current user
  getAll: publicProcedure.query(async ({ ctx }) => {
    return await nanoporeGetters.getAllNanoporeSamples(ctx.db)
  }),

  // Get nanopore sample by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return await nanoporeGetters.getNanoporeSampleById(
        ctx.db,
        input.id,
        'demo-user',
      )
    }),

  // Get nanopore sample with details
  getWithDetails: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return await nanoporeGetters.getNanoporeSampleWithDetails(
        ctx.db,
        input.id,
        'demo-user',
      )
    }),

  // Get complete nanopore sample data
  getFull: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return await nanoporeGetters.getNanoporeSampleFull(
        ctx.db,
        input.id,
        'demo-user',
      )
    }),

  // Get recent nanopore samples for dashboard
  getRecent: publicProcedure
    .input(z.object({ limit: z.number().int().positive().max(50).default(10) }))
    .query(async ({ input, ctx }) => {
      return await nanoporeGetters.getRecentNanoporeSamples(
        ctx.db,
        'demo-user',
        input.limit,
      )
    }),

  // Get nanopore samples by status
  getByStatus: publicProcedure
    .input(z.object({ status: z.string() }))
    .query(async ({ input, ctx }) => {
      return await nanoporeGetters.getNanoporeSamplesByStatus(
        ctx.db,
        'demo-user',
        input.status,
      )
    }),

  // Get nanopore samples by priority
  getByPriority: publicProcedure
    .input(z.object({ priority: z.string() }))
    .query(async ({ input, ctx }) => {
      return await nanoporeGetters.getNanoporeSamplesByPriority(
        ctx.db,
        'demo-user',
        input.priority,
      )
    }),

  // Get nanopore samples assigned to team member
  getByAssignee: publicProcedure
    .input(z.object({ assignedTo: z.string() }))
    .query(async ({ input, ctx }) => {
      return await nanoporeGetters.getNanoporeSamplesByAssignee(
        ctx.db,
        input.assignedTo,
      )
    }),

  // Get all nanopore samples (team view)
  getAllSamples: publicProcedure.query(async ({ ctx }) => {
    return await nanoporeGetters.getAllNanoporeSamples(ctx.db)
  }),

  // Get nanopore queue for team dashboard
  getQueue: publicProcedure.query(async ({ ctx }) => {
    return await nanoporeGetters.getNanoporeQueue(ctx.db)
  }),

  // Create new nanopore sample
  create: publicProcedure
    .input(createNanoporeSampleSchema)
    .mutation(async ({ input, ctx }) => {
      // Validate chart field before creating the sample
      if (!validateChartField(input.chartField)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid chart field: ${input.chartField}. Chart field must be part of the intake validation list.`,
        })
      }

      const sampleData: nanoporeSetters.CreateNanoporeSampleInput = {
        ...input,
        createdBy: 'demo-user',
      }
      return await nanoporeSetters.createNanoporeSample(ctx.db, sampleData)
    }),

  // Create nanopore sample with details
  createWithDetails: publicProcedure
    .input(
      z.object({
        sample: createNanoporeSampleSchema,
        details: createNanoporeSampleDetailsSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Validate chart field before creating the sample
      if (!validateChartField(input.sample.chartField)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid chart field: ${input.sample.chartField}. Chart field must be part of the intake validation list.`,
        })
      }

      const sampleData: nanoporeSetters.CreateNanoporeSampleInput = {
        ...input.sample,
        createdBy: 'demo-user',
      }
      return await nanoporeSetters.createCompleteNanoporeSample(
        ctx.db,
        sampleData,
        input.details,
      )
    }),

  // Update nanopore sample
  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateNanoporeSampleSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await nanoporeSetters.updateNanoporeSample(
        ctx.db,
        input.id,
        'demo-user',
        input.data,
      )
    }),

  // Update nanopore sample status
  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum([
          'submitted',
          'prep',
          'sequencing',
          'analysis',
          'completed',
          'archived',
        ]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await nanoporeSetters.updateNanoporeSampleStatus(
        ctx.db,
        input.id,
        'demo-user',
        input.status,
      )
    }),

  // Assign sample to team member
  assign: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        assignedTo: z.string(),
        libraryPrepBy: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await nanoporeSetters.assignNanoporeSample(
        ctx.db,
        input.id,
        input.assignedTo,
        input.libraryPrepBy,
      )
    }),

  // Delete nanopore sample
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return await nanoporeSetters.deleteNanoporeSample(
        ctx.db,
        input.id,
        'demo-user',
      )
    }),

  // Sample details management
  details: router({
    // Create sample details
    create: publicProcedure
      .input(
        z.object({
          sampleId: z.string().uuid(),
          details: createNanoporeSampleDetailsSchema,
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return await nanoporeSetters.createNanoporeSampleDetails(ctx.db, {
          ...input.details,
          sampleId: input.sampleId,
        })
      }),

    // Update sample details
    update: publicProcedure
      .input(
        z.object({
          sampleId: z.string().uuid(),
          details: createNanoporeSampleDetailsSchema.partial(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return await nanoporeSetters.updateNanoporeSampleDetails(
          ctx.db,
          input.sampleId,
          input.details,
        )
      }),
  }),

  // Processing steps management
  steps: router({
    // Get processing steps for a sample
    getBySample: publicProcedure
      .input(z.object({ sampleId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        return await nanoporeGetters.getProcessingSteps(ctx.db, input.sampleId)
      }),

    // Create default processing steps
    createDefault: publicProcedure
      .input(z.object({ sampleId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        return await nanoporeSetters.createDefaultProcessingSteps(
          ctx.db,
          input.sampleId,
        )
      }),

    // Update processing step
    update: publicProcedure
      .input(
        z.object({
          stepId: z.string().uuid(),
          data: updateProcessingStepSchema,
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return await nanoporeSetters.updateProcessingStep(
          ctx.db,
          input.stepId,
          input.data,
        )
      }),

    // Start processing step
    start: publicProcedure
      .input(
        z.object({
          stepId: z.string().uuid(),
          assignedTo: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return await nanoporeSetters.startProcessingStep(
          ctx.db,
          input.stepId,
          input.assignedTo,
        )
      }),

    // Complete processing step
    complete: publicProcedure
      .input(
        z.object({
          stepId: z.string().uuid(),
          notes: z.string().optional(),
          resultsData: z.any().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return await nanoporeSetters.completeProcessingStep(
          ctx.db,
          input.stepId,
          input.notes,
          input.resultsData as JsonValue,
        )
      }),
  }),

  // Attachments management
  attachments: router({
    // Get attachments for a sample
    getBySample: publicProcedure
      .input(z.object({ sampleId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        return await fileStorage.getSampleAttachments(ctx.db, input.sampleId)
      }),

    // Upload file attachment
    upload: publicProcedure
      .input(
        z.object({
          sampleId: z.string().uuid(),
          file: z.object({
            name: z.string().min(1).max(255),
            type: z.string(),
            size: z.number().int().positive(),
            content: z.string(), // Base64 encoded content
          }),
          description: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        // Convert base64 content to ArrayBuffer
        const buffer = Buffer.from(input.file.content, 'base64')
        const arrayBuffer = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        )

        return await fileStorage.uploadFileAttachment(ctx.db, {
          sampleId: input.sampleId,
          file: {
            name: input.file.name,
            type: input.file.type,
            size: input.file.size,
            arrayBuffer,
          },
          description: input.description,
          uploadedBy: 'demo-user',
        })
      }),

    // Get file content for download
    download: publicProcedure
      .input(z.object({ attachmentId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        const { content, attachment } = await fileStorage.getFileContent(
          ctx.db,
          input.attachmentId,
        )

        return {
          content: content.toString('base64'),
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: attachment.fileSizeBytes,
        }
      }),

    // Create attachment (legacy endpoint for manual entries)
    create: publicProcedure
      .input(
        z.object({
          sampleId: z.string().uuid(),
          fileName: z.string().min(1).max(255),
          fileType: z.string().optional(),
          fileSizeBytes: z.number().int().positive().optional(),
          filePath: z.string().optional(),
          description: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return await nanoporeSetters.createAttachment(ctx.db, {
          ...input,
          uploadedBy: 'demo-user',
        })
      }),

    // Delete attachment
    delete: publicProcedure
      .input(z.object({ attachmentId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        return await fileStorage.deleteFileAttachment(
          ctx.db,
          input.attachmentId,
        )
      }),
  }),

  // Export nanopore samples
  export: publicProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        format: z.enum(['csv', 'json']).default('csv'),
        includeAllUsers: z.boolean().default(false),
      }),
    )
    .query(async ({ input, ctx }) => {
      return await nanoporeExport.exportNanoporeSamples(ctx.db, 'demo-user', {
        startDate: input.startDate,
        endDate: input.endDate,
        format: input.format,
        includeAllUsers: input.includeAllUsers,
      })
    }),
})
