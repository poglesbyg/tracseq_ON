import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { getSampleService } from '../../container'
import { handleTRPCProcedureError, withErrorHandling, extractRequestContext } from '../../middleware/errors/TRPCErrorMiddleware'
import { 
  createSampleValidation, 
  updateSampleValidation, 
  assignSampleValidation, 
  updateStatusValidation,
  searchValidation,
  validators 
} from '../../middleware/validation/ValidationRules'

// Valid chart fields for intake validation
const VALID_CHART_FIELDS = [
  'HTSF-001', 'HTSF-002', 'HTSF-003', 'HTSF-004', 'HTSF-005',
  'NANO-001', 'NANO-002', 'NANO-003', 'NANO-004', 'NANO-005',
  'SEQ-001', 'SEQ-002', 'SEQ-003', 'SEQ-004', 'SEQ-005'
]

function validateChartField(chartField: string): boolean {
  return VALID_CHART_FIELDS.includes(chartField) || validators.isValidChartField(chartField)
}

export const nanoporeRouter = router({
  // Get all nanopore samples
  getAll: publicProcedure.query(async ({ ctx }) => {
    try {
      const sampleService = getSampleService()
      return await sampleService.getAllSamples()
    } catch (error) {
      handleTRPCProcedureError(error as Error, extractRequestContext(ctx))
    }
  }),

  // Create new nanopore sample
  create: publicProcedure
    .input(createSampleValidation)
    .mutation(async ({ input, ctx }) => {
      try {
        // Validate chart field before creating the sample
        if (!validateChartField(input.chartField)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Invalid chart field: ${input.chartField}. Chart field must be part of the intake validation list.`,
          })
        }

        const sampleService = getSampleService()
        return await sampleService.createSample({
          sampleName: input.sampleName,
          projectId: input.projectId,
          submitterName: input.submitterName,
          submitterEmail: input.submitterEmail,
          labName: input.labName,
          sampleType: input.sampleType,
          sampleBuffer: input.sampleBuffer,
          concentration: input.concentration,
          volume: input.volume,
          totalAmount: input.totalAmount,
          flowCellType: input.flowCellType,
          flowCellCount: input.flowCellCount,
          priority: input.priority,
          assignedTo: input.assignedTo,
          libraryPrepBy: input.libraryPrepBy,
          chartField: input.chartField,
        })
      } catch (error) {
        handleTRPCProcedureError(error as Error, extractRequestContext(ctx))
      }
    }),

  // Update nanopore sample
  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateSampleValidation,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const sampleService = getSampleService()
        
        // Convert undefined values to omit them from the update
        const updateData: any = {}
        
        if (input.data.sampleName !== undefined) updateData.sampleName = input.data.sampleName
        if (input.data.projectId !== undefined) updateData.projectId = input.data.projectId
        if (input.data.submitterName !== undefined) updateData.submitterName = input.data.submitterName
        if (input.data.submitterEmail !== undefined) updateData.submitterEmail = input.data.submitterEmail
        if (input.data.labName !== undefined) updateData.labName = input.data.labName
        if (input.data.sampleType !== undefined) updateData.sampleType = input.data.sampleType
        if (input.data.sampleBuffer !== undefined) updateData.sampleBuffer = input.data.sampleBuffer
        if (input.data.concentration !== undefined) updateData.concentration = input.data.concentration
        if (input.data.volume !== undefined) updateData.volume = input.data.volume
        if (input.data.totalAmount !== undefined) updateData.totalAmount = input.data.totalAmount
        if (input.data.flowCellType !== undefined) updateData.flowCellType = input.data.flowCellType
        if (input.data.flowCellCount !== undefined) updateData.flowCellCount = input.data.flowCellCount
        if (input.data.status !== undefined) updateData.status = input.data.status
        if (input.data.priority !== undefined) updateData.priority = input.data.priority
        if (input.data.assignedTo !== undefined) updateData.assignedTo = input.data.assignedTo
        if (input.data.libraryPrepBy !== undefined) updateData.libraryPrepBy = input.data.libraryPrepBy
        
        return await sampleService.updateSample(input.id, updateData)
      } catch (error) {
        handleTRPCProcedureError(error as Error, extractRequestContext(ctx))
      }
    }),

  // Assign sample to team member
  assign: publicProcedure
    .input(assignSampleValidation)
    .mutation(async ({ input, ctx }) => {
      try {
        const sampleService = getSampleService()
        return await sampleService.assignSample(input.id, input.assignedTo, input.libraryPrepBy)
      } catch (error) {
        handleTRPCProcedureError(error as Error, extractRequestContext(ctx))
      }
    }),

  // Update sample status
  updateStatus: publicProcedure
    .input(updateStatusValidation)
    .mutation(async ({ input, ctx }) => {
      try {
        const sampleService = getSampleService()
        return await sampleService.updateSampleStatus(input.id, input.status)
      } catch (error) {
        handleTRPCProcedureError(error as Error, extractRequestContext(ctx))
      }
    }),

  // Delete sample
  delete: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input, ctx }) => {
      try {
        const sampleService = getSampleService()
        return await sampleService.deleteSample(input)
      } catch (error) {
        handleTRPCProcedureError(error as Error, extractRequestContext(ctx))
      }
    }),
})
