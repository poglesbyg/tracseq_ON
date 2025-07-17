import type { DB, NanoporeSample } from '../../db/types'
import type { Kysely, Selectable } from 'kysely'
import { getAllNanoporeSamplesByDateRange, getNanoporeSamplesByDateRange } from './getters'

export interface ExportOptions {
  startDate: Date
  endDate: Date
  format: 'csv' | 'json'
  includeAllUsers?: boolean
}

export interface ExportResult {
  data: string
  filename: string
  contentType: string
}

/**
 * Export nanopore samples to CSV or JSON format
 */
export async function exportNanoporeSamples(
  db: Kysely<DB>,
  options: ExportOptions,
  userId?: string,
): Promise<ExportResult> {
  // Get samples based on whether to include all users or just current user
  const samples = options.includeAllUsers
    ? await getAllNanoporeSamplesByDateRange(db, options.startDate, options.endDate)
    : await getNanoporeSamplesByDateRange(db, options.startDate, options.endDate)

  const timestamp = new Date().toISOString().split('T')[0]
  
  if (options.format === 'csv') {
    return {
      data: convertToCSV(samples),
      filename: `nanopore-samples-${timestamp}.csv`,
      contentType: 'text/csv',
    }
  } else {
    return {
      data: JSON.stringify(samples, null, 2),
      filename: `nanopore-samples-${timestamp}.json`,
      contentType: 'application/json',
    }
  }
}

/**
 * Convert samples to CSV format
 */
function convertToCSV(samples: Array<Selectable<NanoporeSample>>): string {
  if (samples.length === 0) {
    return 'No data available'
  }

  const headers = [
    'ID',
    'Sample Name',
    'Project ID',
    'Submitter Name',
    'Submitter Email',
    'Lab Name',
    'Sample Type',
    'Sample Buffer',
    'Concentration',
    'Volume',
    'Total Amount',
    'Flow Cell Type',
    'Flow Cell Count',
    'Status',
    'Priority',
    'Assigned To',
    'Library Prep By',
    'Submitted At',
    'Started At',
    'Completed At',
    'Created At',
    'Updated At',
  ]

  const csvRows = [headers.join(',')]

  for (const sample of samples) {
    const row = [
      sample.id,
      escapeCSVField(sample.sample_name),
      escapeCSVField(sample.project_id || ''),
      escapeCSVField(sample.submitter_name),
      escapeCSVField(sample.submitter_email),
      escapeCSVField(sample.lab_name || ''),
      escapeCSVField(sample.sample_type),
      escapeCSVField(sample.sample_buffer || ''),
      sample.concentration || '',
      sample.volume || '',
      sample.total_amount || '',
      escapeCSVField(sample.flow_cell_type || ''),
      sample.flow_cell_count || '',
      sample.status,
      sample.priority,
      escapeCSVField(sample.assigned_to || ''),
      escapeCSVField(sample.library_prep_by || ''),
      formatDate(sample.submitted_at),
      formatDate(sample.started_at),
      formatDate(sample.completed_at),
      formatDate(sample.created_at),
      formatDate(sample.updated_at),
    ]
    csvRows.push(row.join(','))
  }

  return csvRows.join('\n')
}

/**
 * Escape CSV field to handle commas and quotes
 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

/**
 * Format date for CSV export
 */
function formatDate(date: Date | string | null): string {
  if (!date) return ''
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toISOString()
}

/**
 * Get export statistics
 */
export async function getExportStats(
  db: Kysely<DB>,
  options: ExportOptions,
  userId?: string,
): Promise<{
  totalSamples: number
  statusBreakdown: Record<string, number>
  priorityBreakdown: Record<string, number>
  dateRange: { start: Date; end: Date }
}> {
  const samples = options.includeAllUsers
    ? await getAllNanoporeSamplesByDateRange(db, options.startDate, options.endDate)
    : await getNanoporeSamplesByDateRange(db, options.startDate, options.endDate)

  const statusBreakdown: Record<string, number> = {}
  const priorityBreakdown: Record<string, number> = {}

  for (const sample of samples) {
    // Status breakdown
    statusBreakdown[sample.status] = (statusBreakdown[sample.status] || 0) + 1
    
    // Priority breakdown
    priorityBreakdown[sample.priority] = (priorityBreakdown[sample.priority] || 0) + 1
  }

  return {
    totalSamples: samples.length,
    statusBreakdown,
    priorityBreakdown,
    dateRange: {
      start: options.startDate,
      end: options.endDate,
    },
  }
}

/**
 * Validate export options
 */
export function validateExportOptions(options: ExportOptions): string[] {
  const errors: string[] = []

  if (!options.startDate) {
    errors.push('Start date is required')
  }

  if (!options.endDate) {
    errors.push('End date is required')
  }

  if (options.startDate && options.endDate && options.startDate > options.endDate) {
    errors.push('Start date must be before end date')
  }

  if (!['csv', 'json'].includes(options.format)) {
    errors.push('Format must be either "csv" or "json"')
  }

  return errors
}