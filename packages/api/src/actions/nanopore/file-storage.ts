import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { DB, NanoporeAttachment } from '@app/db/types'
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
  file: {
    name: string
    type: string
    size: number
    arrayBuffer: ArrayBuffer
  }
  description?: string
  uploadedBy: string
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
    const buffer = Buffer.from(input.file.arrayBuffer)
    await fs.writeFile(filePath, buffer)

    // Create database record
    const attachmentData: Insertable<NanoporeAttachment> = {
      sampleId: input.sampleId,
      fileName: input.file.name,
      fileType: getFileExtension(input.file.name),
      fileSizeBytes: BigInt(input.file.size),
      filePath: filePath,
      description: input.description,
      uploadedBy: input.uploadedBy,
    }

    const attachment = await db
      .insertInto('nanoporeAttachments')
      .values(attachmentData)
      .returningAll()
      .executeTakeFirstOrThrow()

    return {
      attachment,
      filePath,
    }
  } catch (_error) {
    // Clean up file if database operation fails
    try {
      await fs.unlink(filePath)
    } catch (_unlinkError) {
      // File might not exist or other error, but we don't need to handle it
    }
    throw _error
  }
}

/**
 * Get all attachments for a nanopore sample
 */
export async function getSampleAttachments(
  db: Kysely<DB>,
  sampleId: string,
): Promise<Selectable<NanoporeAttachment>[]> {
  return await db
    .selectFrom('nanoporeAttachments')
    .selectAll()
    .where('sampleId', '=', sampleId)
    .orderBy('uploadedAt', 'desc')
    .execute()
}

/**
 * Delete a file attachment
 */
export async function deleteFileAttachment(
  db: Kysely<DB>,
  attachmentId: string,
): Promise<void> {
  // Get attachment info first
  const attachment = await db
    .selectFrom('nanoporeAttachments')
    .selectAll()
    .where('id', '=', attachmentId)
    .executeTakeFirst()

  if (!attachment) {
    throw new Error('Attachment not found')
  }

  // Delete file from disk
  try {
    if (attachment.filePath) {
      await fs.unlink(attachment.filePath)
    }
  } catch {
    console.error('Failed to delete file from disk')
    // Continue with database deletion even if file deletion fails
  }

  // Delete database record
  await db
    .deleteFrom('nanoporeAttachments')
    .where('id', '=', attachmentId)
    .execute()
}

/**
 * Get file content for download
 */
export async function getFileContent(
  db: Kysely<DB>,
  attachmentId: string,
): Promise<{ content: Buffer; attachment: Selectable<NanoporeAttachment> }> {
  const attachment = await db
    .selectFrom('nanoporeAttachments')
    .selectAll()
    .where('id', '=', attachmentId)
    .executeTakeFirst()

  if (!attachment || !attachment.filePath) {
    throw new Error('Attachment not found')
  }

  try {
    const content = await fs.readFile(attachment.filePath)
    return { content, attachment }
  } catch (_error) {
    throw new Error('Failed to read file content')
  }
}

/**
 * Ensure upload directory exists
 */
async function ensureUploadDirectory(): Promise<void> {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

/**
 * Sanitize filename for safe storage
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^\d.A-Za-z-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 200) // Limit length
}

/**
 * Get file extension from filename
 */
function getFileExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase().substring(1)
}
