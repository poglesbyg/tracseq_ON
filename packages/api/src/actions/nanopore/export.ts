import type { DB, NanoporeSample } from '@app/db/types'
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
  mimeType: string
}

/**
 * Export nanopore samples to CSV format
 */
export async function exportNanoporeSamples(
  db: Kysely<DB>,
  userId: string,
  options: ExportOptions,
): Promise<ExportResult> {
  const samples = options.includeAllUsers
    ? await getAllNanoporeSamplesByDateRange(db, options.startDate, options.endDate)
    : await getNanoporeSamplesByDateRange(db, userId, options.startDate, options.endDate)

  if (options.format === 'json') {
    return {
      data: JSON.stringify(samples, null, 2),
      filename: `nanopore_samples_${formatDateForFilename(options.startDate)}_to_${formatDateForFilename(options.endDate)}.json`,
      mimeType: 'application/json',
    }
  }

  // CSV format
  const csvData = generateCSV(samples)
  return {
    data: csvData,
    filename: `nanopore_samples_${formatDateForFilename(options.startDate)}_to_${formatDateForFilename(options.endDate)}.csv`,
    mimeType: 'text/csv',
  }
}

/**
 * Generate CSV string from nanopore samples
 */
function generateCSV(samples: Array<Selectable<NanoporeSample>>): string {
  const headers = [
    'Sample ID',
    'Sample Name',
    'Lab Name',
    'Submitter Name',
    'Submitter Email',
    'Project ID',
    'Sample Type',
    'Status',
    'Priority',
    'Assigned To',
    'Library Prep By',
    'Submitted At',
    'Created At',
    'Updated At',
    'Started At',
    'Completed At',
  ]

  const csvRows = [headers.join(',')]

  for (const sample of samples) {
    const row = [
      sample.id,
      sample.sampleName || '',
      sample.labName || '',
      sample.submitterName || '',
      sample.submitterEmail || '',
      sample.projectId || '',
      sample.sampleType || '',
      sample.status || '',
      sample.priority || '',
      sample.assignedTo || '',
      sample.libraryPrepBy || '',
      sample.submittedAt ? new Date(sample.submittedAt).toISOString() : '',
      sample.createdAt ? new Date(sample.createdAt).toISOString() : '',
      sample.updatedAt ? new Date(sample.updatedAt).toISOString() : '',
      sample.startedAt ? new Date(sample.startedAt).toISOString() : '',
      sample.completedAt ? new Date(sample.completedAt).toISOString() : '',
    ]

    // Escape values that contain commas or quotes
    const escapedRow = row.map(value => {
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    })

    csvRows.push(escapedRow.join(','))
  }

  return csvRows.join('\n')
}

/**
 * Format date for filename (YYYY-MM-DD)
 */
function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0]
}