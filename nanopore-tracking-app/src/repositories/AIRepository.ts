import { aiDb } from '../lib/database/service-databases'
import { getComponentLogger } from '../lib/logging/StructuredLogger'

const logger = getComponentLogger('AIRepository')

export interface AIExtractionResult {
  id: string
  sample_id: string
  file_name: string
  extraction_method: 'llm' | 'pattern' | 'hybrid' | 'rag'
  extracted_data: Record<string, any>
  confidence_score: number
  processing_time_ms: number
  issues: string[]
  rag_insights: Record<string, any> | null
  created_at: Date
  updated_at: Date
}

export interface AIProcessingJob {
  id: string
  job_type: 'pdf_extraction' | 'data_validation' | 'enhancement'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  input_data: Record<string, any>
  output_data: Record<string, any> | null
  error_message: string | null
  started_at: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface AIModelPerformance {
  id: string
  model_name: string
  task_type: string
  accuracy_score: number
  processing_time_ms: number
  sample_count: number
  timestamp: Date
  created_at: Date
}

export class AIRepository {
  private get db() {
    return aiDb()
  }

  // Extraction Results Operations
  async createExtractionResult(data: {
    sampleId: string
    fileName: string
    extractionMethod: 'llm' | 'pattern' | 'hybrid' | 'rag'
    extractedData: Record<string, any>
    confidenceScore: number
    processingTimeMs: number
    issues?: string[]
    ragInsights?: Record<string, any>
  }): Promise<AIExtractionResult> {
    logger.info('Creating AI extraction result', {
      action: 'create_extraction_result',
      metadata: { sampleId: data.sampleId, method: data.extractionMethod }
    })

    const result = await this.db
      .insertInto('ai_extraction_results')
      .values({
        id: crypto.randomUUID(),
        sample_id: data.sampleId,
        file_name: data.fileName,
        extraction_method: data.extractionMethod,
        extracted_data: data.extractedData,
        confidence_score: data.confidenceScore,
        processing_time_ms: data.processingTimeMs,
        issues: data.issues || [],
        rag_insights: data.ragInsights || null,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as AIExtractionResult
  }

  async getExtractionResultsBySample(sampleId: string): Promise<AIExtractionResult[]> {
    const results = await this.db
      .selectFrom('ai_extraction_results')
      .selectAll()
      .where('sample_id', '=', sampleId)
      .orderBy('created_at', 'desc')
      .execute()

    return results as AIExtractionResult[]
  }

  async getExtractionResultsByMethod(method: 'llm' | 'pattern' | 'hybrid' | 'rag'): Promise<AIExtractionResult[]> {
    const results = await this.db
      .selectFrom('ai_extraction_results')
      .selectAll()
      .where('extraction_method', '=', method)
      .orderBy('created_at', 'desc')
      .execute()

    return results as AIExtractionResult[]
  }

  async getExtractionResultsWithLowConfidence(threshold: number = 0.7): Promise<AIExtractionResult[]> {
    const results = await this.db
      .selectFrom('ai_extraction_results')
      .selectAll()
      .where('confidence_score', '<', threshold)
      .orderBy('confidence_score', 'asc')
      .execute()

    return results as AIExtractionResult[]
  }

  // Processing Jobs Operations
  async createProcessingJob(data: {
    jobType: 'pdf_extraction' | 'data_validation' | 'enhancement'
    inputData: Record<string, any>
  }): Promise<AIProcessingJob> {
    logger.info('Creating AI processing job', {
      action: 'create_processing_job',
      metadata: { jobType: data.jobType }
    })

    const result = await this.db
      .insertInto('ai_processing_jobs')
      .values({
        id: crypto.randomUUID(),
        job_type: data.jobType,
        status: 'pending',
        input_data: data.inputData,
        output_data: null,
        error_message: null,
        started_at: null,
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as AIProcessingJob
  }

  async updateProcessingJob(id: string, updates: {
    status?: 'pending' | 'processing' | 'completed' | 'failed'
    outputData?: Record<string, any>
    errorMessage?: string
    startedAt?: Date
    completedAt?: Date
  }): Promise<AIProcessingJob> {
    logger.info('Updating AI processing job', {
      action: 'update_processing_job',
      metadata: { jobId: id, status: updates.status }
    })

    const updateData: any = {
      updated_at: new Date()
    }

    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.outputData !== undefined) updateData.output_data = updates.outputData
    if (updates.errorMessage !== undefined) updateData.error_message = updates.errorMessage
    if (updates.startedAt !== undefined) updateData.started_at = updates.startedAt
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt

    const result = await this.db
      .updateTable('ai_processing_jobs')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as AIProcessingJob
  }

  async getProcessingJobsByStatus(status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<AIProcessingJob[]> {
    const results = await this.db
      .selectFrom('ai_processing_jobs')
      .selectAll()
      .where('status', '=', status)
      .orderBy('created_at', 'asc')
      .execute()

    return results as AIProcessingJob[]
  }

  async getPendingJobs(): Promise<AIProcessingJob[]> {
    return this.getProcessingJobsByStatus('pending')
  }

  async getProcessingJobById(id: string): Promise<AIProcessingJob | null> {
    const result = await this.db
      .selectFrom('ai_processing_jobs')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    return result ? (result as AIProcessingJob) : null
  }

  // Model Performance Operations
  async recordModelPerformance(data: {
    modelName: string
    taskType: string
    accuracyScore: number
    processingTimeMs: number
    sampleCount: number
  }): Promise<AIModelPerformance> {
    logger.info('Recording model performance', {
      action: 'record_performance',
      metadata: { modelName: data.modelName, taskType: data.taskType }
    })

    const result = await this.db
      .insertInto('ai_model_performance')
      .values({
        id: crypto.randomUUID(),
        model_name: data.modelName,
        task_type: data.taskType,
        accuracy_score: data.accuracyScore,
        processing_time_ms: data.processingTimeMs,
        sample_count: data.sampleCount,
        timestamp: new Date(),
        created_at: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return result as AIModelPerformance
  }

  async getModelPerformanceHistory(modelName: string, taskType?: string): Promise<AIModelPerformance[]> {
    let query = this.db
      .selectFrom('ai_model_performance')
      .selectAll()
      .where('model_name', '=', modelName)

    if (taskType) {
      query = query.where('task_type', '=', taskType)
    }

    const results = await query
      .orderBy('timestamp', 'desc')
      .execute()

    return results as AIModelPerformance[]
  }

  async getAverageModelPerformance(modelName: string, taskType: string): Promise<{
    averageAccuracy: number
    averageProcessingTime: number
    totalSamples: number
  }> {
    const result = await this.db
      .selectFrom('ai_model_performance')
      .select((eb) => [
        eb.fn.avg('accuracy_score').as('avg_accuracy'),
        eb.fn.avg('processing_time_ms').as('avg_processing_time'),
        eb.fn.sum('sample_count').as('total_samples')
      ])
      .where('model_name', '=', modelName)
      .where('task_type', '=', taskType)
      .executeTakeFirst()

    return {
      averageAccuracy: Number(result?.avg_accuracy || 0),
      averageProcessingTime: Number(result?.avg_processing_time || 0),
      totalSamples: Number(result?.total_samples || 0)
    }
  }

  // Analytics and Reporting
  async getExtractionStatistics(): Promise<{
    totalExtractions: number
    averageConfidence: number
    methodDistribution: Record<string, number>
    averageProcessingTime: number
  }> {
    const totalResult = await this.db
      .selectFrom('ai_extraction_results')
      .select((eb) => [
        eb.fn.count('id').as('total'),
        eb.fn.avg('confidence_score').as('avg_confidence'),
        eb.fn.avg('processing_time_ms').as('avg_processing_time')
      ])
      .executeTakeFirst()

    const methodResults = await this.db
      .selectFrom('ai_extraction_results')
      .select(['extraction_method', (eb) => eb.fn.count('id').as('count')])
      .groupBy('extraction_method')
      .execute()

    const methodDistribution: Record<string, number> = {}
    methodResults.forEach(row => {
      methodDistribution[row.extraction_method] = Number(row.count)
    })

    return {
      totalExtractions: Number(totalResult?.total || 0),
      averageConfidence: Number(totalResult?.avg_confidence || 0),
      averageProcessingTime: Number(totalResult?.avg_processing_time || 0),
      methodDistribution
    }
  }

  async getJobStatistics(): Promise<{
    totalJobs: number
    statusDistribution: Record<string, number>
    averageProcessingTime: number
  }> {
    const totalResult = await this.db
      .selectFrom('ai_processing_jobs')
      .select((eb) => [
        eb.fn.count('id').as('total')
      ])
      .executeTakeFirst()

    const statusResults = await this.db
      .selectFrom('ai_processing_jobs')
      .select(['status', (eb) => eb.fn.count('id').as('count')])
      .groupBy('status')
      .execute()

    const statusDistribution: Record<string, number> = {}
    statusResults.forEach(row => {
      statusDistribution[row.status] = Number(row.count)
    })

    return {
      totalJobs: Number(totalResult?.total || 0),
      statusDistribution,
      averageProcessingTime: 0 // Simplified for now
    }
  }
} 