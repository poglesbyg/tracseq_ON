// Database types generated from PostgreSQL schema
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'

export interface Database {
  users: UsersTable
  nanopore_samples: NanoporeSamplesTable
  nanopore_sample_details: NanoporeSampleDetailsTable
  nanopore_processing_steps: NanoporeProcessingStepsTable
  nanopore_attachments: NanoporeAttachmentsTable
}

export interface UsersTable {
  id: Generated<string>
  email: string
  name: string
  role: 'user' | 'admin' | 'staff'
  created_at: ColumnType<Date, string | undefined, never>
  updated_at: ColumnType<Date, string | undefined, never>
}

export interface NanoporeSamplesTable {
  id: Generated<string>
  sample_name: string
  project_id: string | null
  submitter_name: string
  submitter_email: string
  lab_name: string | null
  sample_type: string
  sample_buffer: string | null
  concentration: number | null
  volume: number | null
  total_amount: number | null
  flow_cell_type: string | null
  flow_cell_count: number | null
  status: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assigned_to: string | null
  library_prep_by: string | null
  submitted_at: ColumnType<Date, string | undefined, never>
  started_at: ColumnType<Date, string | undefined, never>
  completed_at: ColumnType<Date, string | undefined, never>
  created_at: ColumnType<Date, string | undefined, never>
  updated_at: ColumnType<Date, string | undefined, never>
  created_by: string
}

export interface NanoporeSampleDetailsTable {
  id: Generated<string>
  sample_id: string
  organism: string | null
  genome_size: string | null
  expected_read_length: string | null
  library_prep_kit: string | null
  barcoding_required: boolean | null
  barcode_kit: string | null
  run_time_hours: number | null
  basecalling_model: string | null
  data_delivery_method: string | null
  file_format: string | null
  analysis_required: boolean | null
  analysis_type: string | null
  qc_passed: boolean | null
  qc_notes: string | null
  special_instructions: string | null
  internal_notes: string | null
  created_at: ColumnType<Date, string | undefined, never>
  updated_at: ColumnType<Date, string | undefined, never>
}

export interface NanoporeProcessingStepsTable {
  id: Generated<string>
  sample_id: string
  step_name: string
  step_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  assigned_to: string | null
  started_at: ColumnType<Date, string | undefined, never>
  completed_at: ColumnType<Date, string | undefined, never>
  estimated_duration_hours: number | null
  notes: string | null
  results_data: any | null // JSONB type
  created_at: ColumnType<Date, string | undefined, never>
  updated_at: ColumnType<Date, string | undefined, never>
}

export interface NanoporeAttachmentsTable {
  id: Generated<string>
  sample_id: string
  file_name: string
  file_type: string | null
  file_size_bytes: bigint | null
  file_path: string | null
  description: string | null
  uploaded_by: string | null
  uploaded_at: ColumnType<Date, string | undefined, never>
  created_at: ColumnType<Date, string | undefined, never>
}

// Convenience types for use in application code
export type User = Selectable<UsersTable>
export type NewUser = Insertable<UsersTable>
export type UpdateUser = Updateable<UsersTable>

export type NanoporeSample = Selectable<NanoporeSamplesTable>
export type NewNanoporeSample = Insertable<NanoporeSamplesTable>
export type UpdateNanoporeSample = Updateable<NanoporeSamplesTable>

export type NanoporeSampleDetail = Selectable<NanoporeSampleDetailsTable>
export type NewNanoporeSampleDetail = Insertable<NanoporeSampleDetailsTable>
export type UpdateNanoporeSampleDetail = Updateable<NanoporeSampleDetailsTable>

export type NanoporeProcessingStep = Selectable<NanoporeProcessingStepsTable>
export type NewNanoporeProcessingStep = Insertable<NanoporeProcessingStepsTable>
export type UpdateNanoporeProcessingStep = Updateable<NanoporeProcessingStepsTable>

export type NanoporeAttachment = Selectable<NanoporeAttachmentsTable>
export type NewNanoporeAttachment = Insertable<NanoporeAttachmentsTable>
export type UpdateNanoporeAttachment = Updateable<NanoporeAttachmentsTable>

// Re-export Database as DB for compatibility
export type DB = Database

// JSON value type for JSONB columns
export type JsonValue = any 