import { Kysely } from 'kysely'
import { AIProcessingDatabase } from '../database/schema'
import { ProcessingJob, ProcessingStatus, ProcessingType } from '../types/processing'

export class ProcessingJobRepository {
  constructor(private db: Kysely<AIProcessingDatabase>) {}

  /**
   * Create a new processing job
   */
  async createJob(job: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcessingJob> {
    const [createdJob] = await this.db
      .insertInto('processing_jobs')
      .values({
        sample_id: job.sampleId,
        file_name: job.fileName,
        file_path: job.filePath,
        file_size: job.fileSize,
        mime_type: job.mimeType,
        processing_type: job.processingType,
        status: job.status,
        progress: job.progress,
        result: job.result ? JSON.stringify(job.result) : undefined,
        error: job.error,
        metadata: job.metadata ? JSON.stringify(job.metadata) : undefined,
        started_at: job.startedAt,
        completed_at: job.completedAt
      })
      .returning('*')
      .execute()

    return this.mapDatabaseJobToJob(createdJob)
  }

  /**
   * Get job by ID
   */
  async getJobById(id: string): Promise<ProcessingJob | null> {
    const job = await this.db
      .selectFrom('processing_jobs')
      .select('*')
      .where('id', '=', id)
      .executeTakeFirst()

    return job ? this.mapDatabaseJobToJob(job) : null
  }

  /**
   * Get jobs by sample ID
   */
  async getJobsBySampleId(sampleId: string): Promise<ProcessingJob[]> {
    const jobs = await this.db
      .selectFrom('processing_jobs')
      .select('*')
      .where('sample_id', '=', sampleId)
      .orderBy('created_at', 'desc')
      .execute()

    return jobs.map(job => this.mapDatabaseJobToJob(job))
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: ProcessingStatus): Promise<ProcessingJob[]> {
    const jobs = await this.db
      .selectFrom('processing_jobs')
      .select('*')
      .where('status', '=', status)
      .orderBy('created_at', 'desc')
      .execute()

    return jobs.map(job => this.mapDatabaseJobToJob(job))
  }

  /**
   * Get jobs by processing type
   */
  async getJobsByType(type: ProcessingType): Promise<ProcessingJob[]> {
    const jobs = await this.db
      .selectFrom('processing_jobs')
      .select('*')
      .where('processing_type', '=', type)
      .orderBy('created_at', 'desc')
      .execute()

    return jobs.map(job => this.mapDatabaseJobToJob(job))
  }

  /**
   * Get all jobs with pagination
   */
  async getAllJobs(limit: number = 50, offset: number = 0): Promise<ProcessingJob[]> {
    const jobs = await this.db
      .selectFrom('processing_jobs')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute()

    return jobs.map(job => this.mapDatabaseJobToJob(job))
  }

  /**
   * Update job status
   */
  async updateJobStatus(id: string, status: ProcessingStatus, progress?: number): Promise<boolean> {
    const updateData: any = { status }
    
    if (progress !== undefined) {
      updateData.progress = progress
    }

    if (status === ProcessingStatus.PROCESSING) {
      updateData.started_at = new Date()
    } else if (status === ProcessingStatus.COMPLETED || status === ProcessingStatus.FAILED) {
      updateData.completed_at = new Date()
    }

    const result = await this.db
      .updateTable('processing_jobs')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    return result.numUpdatedRows > 0
  }

  /**
   * Update job result
   */
  async updateJobResult(id: string, result: any): Promise<boolean> {
    const result = await this.db
      .updateTable('processing_jobs')
      .set({
        result: JSON.stringify(result),
        status: ProcessingStatus.COMPLETED,
        progress: 100,
        completed_at: new Date()
      })
      .where('id', '=', id)
      .execute()

    return result.numUpdatedRows > 0
  }

  /**
   * Update job error
   */
  async updateJobError(id: string, error: string): Promise<boolean> {
    const result = await this.db
      .updateTable('processing_jobs')
      .set({
        error,
        status: ProcessingStatus.FAILED,
        completed_at: new Date()
      })
      .where('id', '=', id)
      .execute()

    return result.numUpdatedRows > 0
  }

  /**
   * Update job progress
   */
  async updateJobProgress(id: string, progress: number): Promise<boolean> {
    const result = await this.db
      .updateTable('processing_jobs')
      .set({ progress })
      .where('id', '=', id)
      .execute()

    return result.numUpdatedRows > 0
  }

  /**
   * Delete job by ID
   */
  async deleteJob(id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('processing_jobs')
      .where('id', '=', id)
      .execute()

    return result.numDeletedRows > 0
  }

  /**
   * Get job statistics
   */
  async getJobStatistics(): Promise<{
    totalJobs: number
    jobsByStatus: Record<string, number>
    jobsByType: Record<string, number>
    recentJobs: number
    averageProcessingTime: number
  }> {
    // Get total jobs count
    const totalJobsResult = await this.db
      .selectFrom('processing_jobs')
      .select(this.db.fn.count('id').as('count'))
      .executeTakeFirst()

    const totalJobs = Number(totalJobsResult?.count || 0)

    // Get jobs by status
    const jobsByStatusResult = await this.db
      .selectFrom('processing_jobs')
      .select(['status', this.db.fn.count('id').as('count')])
      .groupBy('status')
      .execute()

    const jobsByStatus: Record<string, number> = {}
    for (const row of jobsByStatusResult) {
      jobsByStatus[row.status] = Number(row.count)
    }

    // Get jobs by type
    const jobsByTypeResult = await this.db
      .selectFrom('processing_jobs')
      .select(['processing_type', this.db.fn.count('id').as('count')])
      .groupBy('processing_type')
      .execute()

    const jobsByType: Record<string, number> = {}
    for (const row of jobsByTypeResult) {
      jobsByType[row.processing_type] = Number(row.count)
    }

    // Get recent jobs (last 7 days)
    const recentJobsResult = await this.db
      .selectFrom('processing_jobs')
      .select(this.db.fn.count('id').as('count'))
      .where('created_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .executeTakeFirst()

    const recentJobs = Number(recentJobsResult?.count || 0)

    // Calculate average processing time for completed jobs
    const avgProcessingTimeResult = await this.db
      .selectFrom('processing_jobs')
      .select(
        this.db.fn.avg(
          this.db.fn.extract('epoch', this.db.ref('completed_at')).minus(
            this.db.fn.extract('epoch', this.db.ref('started_at'))
          )
        ).as('avg_time')
      )
      .where('status', '=', ProcessingStatus.COMPLETED)
      .where('started_at', 'is not', null)
      .where('completed_at', 'is not', null)
      .executeTakeFirst()

    const averageProcessingTime = Number(avgProcessingTimeResult?.avg_time || 0)

    return {
      totalJobs,
      jobsByStatus,
      jobsByType,
      recentJobs,
      averageProcessingTime
    }
  }

  /**
   * Get pending jobs for processing
   */
  async getPendingJobs(limit: number = 10): Promise<ProcessingJob[]> {
    const jobs = await this.db
      .selectFrom('processing_jobs')
      .select('*')
      .where('status', '=', ProcessingStatus.PENDING)
      .orderBy('created_at', 'asc')
      .limit(limit)
      .execute()

    return jobs.map(job => this.mapDatabaseJobToJob(job))
  }

  /**
   * Get stuck jobs (processing for too long)
   */
  async getStuckJobs(timeoutMinutes: number = 30): Promise<ProcessingJob[]> {
    const timeoutDate = new Date(Date.now() - timeoutMinutes * 60 * 1000)
    
    const jobs = await this.db
      .selectFrom('processing_jobs')
      .select('*')
      .where('status', '=', ProcessingStatus.PROCESSING)
      .where('started_at', '<', timeoutDate)
      .orderBy('started_at', 'asc')
      .execute()

    return jobs.map(job => this.mapDatabaseJobToJob(job))
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
    
    const result = await this.db
      .deleteFrom('processing_jobs')
      .where('status', 'in', [ProcessingStatus.COMPLETED, ProcessingStatus.FAILED])
      .where('created_at', '<', cutoffDate)
      .execute()

    return Number(result.numDeletedRows)
  }

  /**
   * Map database job to ProcessingJob type
   */
  private mapDatabaseJobToJob(dbJob: any): ProcessingJob {
    return {
      id: dbJob.id,
      sampleId: dbJob.sample_id,
      fileName: dbJob.file_name,
      filePath: dbJob.file_path,
      fileSize: dbJob.file_size,
      mimeType: dbJob.mime_type,
      processingType: dbJob.processing_type as ProcessingType,
      status: dbJob.status as ProcessingStatus,
      progress: dbJob.progress,
      result: dbJob.result ? JSON.parse(dbJob.result) : undefined,
      error: dbJob.error,
      metadata: dbJob.metadata ? JSON.parse(dbJob.metadata) : undefined,
      createdAt: new Date(dbJob.created_at),
      updatedAt: new Date(dbJob.updated_at),
      startedAt: dbJob.started_at ? new Date(dbJob.started_at) : undefined,
      completedAt: dbJob.completed_at ? new Date(dbJob.completed_at) : undefined
    }
  }
}