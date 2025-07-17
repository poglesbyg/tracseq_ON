import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { DB, NanoporeAttachment } from '../../db/types'
import type { Kysely } from 'kysely'
import type { Selectable, Insertable } from 'kysely'

// File storage configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/nanopore'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf']

export interface FileUploadResult {
  attachment: Selectable<NanoporeAttachment>
  filePath: string
}

export interface UploadFileInput {
  sampleId: string
  file: File
  description?: string
  uploadedBy?: string
}

/**
 * Upload and store a file attachment for a nanopore sample
 */
export async function uploadFileAttachment(
  db: Kysely<DB>,
  input: UploadFileInput,
): Promise<FileUploadResult> {
  // Validate file type
  if (!ALLOWED_TYPES.includes(input.file.type)) {
    throw new Error(
      `File type ${input.file.type} is not allowed. Only PDF files are supported.`,
    )
  }

  // Validate file size
  if (input.file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size ${input.file.size} exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`,
    )
  }

  // Ensure upload directory exists
  await ensureUploadDirectory()

  // Generate unique filename
  const timestamp = Date.now()
  const sanitizedName = sanitizeFileName(input.file.name)
  const fileName = `${timestamp}_${sanitizedName}`
  const filePath = path.join(UPLOAD_DIR, fileName)

  try {
    // Save file to disk
    const buffer = Buffer.from(await input.file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    // Create database record
    const attachmentData: Insertable<NanoporeAttachment> = {
      sample_id: input.sampleId,
      file_name: input.file.name,
      file_type: getFileExtension(input.file.name),
      file_size_bytes: BigInt(input.file.size),
      file_path: filePath,
      description: input.description || null,
      uploaded_by: input.uploadedBy || null,
      uploaded_at: new Date().toISOString(),
    }

    const attachment = await db
      .insertInto('nanopore_attachments')
      .values(attachmentData)
      .returningAll()
      .executeTakeFirstOrThrow()

    return {
      attachment,
      filePath,
    }
  } catch (error) {
    // Clean up file if database operation fails
    try {
      await fs.unlink(filePath)
    } catch {
      // File might not exist or other error, but we don't need to handle it
    }
    throw error
  }
}

/**
 * Get file attachment by ID
 */
export async function getFileAttachment(
  db: Kysely<DB>,
  attachmentId: string,
): Promise<Selectable<NanoporeAttachment> | null> {
  return await db
    .selectFrom('nanopore_attachments')
    .selectAll()
    .where('id', '=', attachmentId)
    .executeTakeFirst() || null
}

/**
 * Delete file attachment
 */
export async function deleteFileAttachment(
  db: Kysely<DB>,
  attachmentId: string,
): Promise<void> {
  // Get attachment to find file path
  const attachment = await getFileAttachment(db, attachmentId)
  
  if (attachment && attachment.file_path) {
    try {
      await fs.unlink(attachment.file_path)
    } catch {
      // File might not exist, continue with database deletion
    }
  }

  // Delete from database
  await db
    .deleteFrom('nanopore_attachments')
    .where('id', '=', attachmentId)
    .execute()
}

/**
 * Get all attachments for a sample
 */
export async function getSampleAttachments(
  db: Kysely<DB>,
  sampleId: string,
): Promise<Array<Selectable<NanoporeAttachment>>> {
  return await db
    .selectFrom('nanopore_attachments')
    .selectAll()
    .where('sample_id', '=', sampleId)
    .orderBy('uploaded_at', 'desc')
    .execute()
}

/**
 * Read file content
 */
export async function readFileContent(filePath: string): Promise<Buffer> {
  return await fs.readFile(filePath)
}

/**
 * Ensure upload directory exists
 */
async function ensureUploadDirectory(): Promise<void> {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
}

/**
 * Get file extension from filename
 */
function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot > 0 ? fileName.substring(lastDot + 1).toLowerCase() : ''
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Get file stats
 */
export async function getFileStats(filePath: string): Promise<{
  size: number
  created: Date
  modified: Date
}> {
  const stats = await fs.stat(filePath)
  return {
    size: stats.size,
    created: stats.birthtime,
    modified: stats.mtime,
  }
}
