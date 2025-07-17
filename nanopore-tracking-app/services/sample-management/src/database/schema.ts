import { Kysely, sql } from 'kysely'

// Database schema for Sample Management Service
export interface SampleManagementDatabase {
  samples: SampleTable
  workflow_history: WorkflowHistoryTable
  sample_assignments: SampleAssignmentTable
  chart_fields: ChartFieldTable
}

// Sample table
export interface SampleTable {
  id: string
  sample_name: string
  project_id: string
  submitter_name: string
  submitter_email: string
  lab_name: string
  sample_type: string
  sample_buffer: string
  concentration: number
  volume: number
  total_amount: number
  flow_cell_type: string
  flow_cell_count: number
  status: string
  priority: string
  assigned_to?: string
  library_prep_by?: string
  chart_field: string
  created_at: Date
  updated_at: Date
}

// Workflow history table
export interface WorkflowHistoryTable {
  id: string
  sample_id: string
  status: string
  assigned_to?: string
  notes?: string
  created_at: Date
  created_by?: string
}

// Sample assignments table
export interface SampleAssignmentTable {
  id: string
  sample_id: string
  assigned_to: string
  assigned_by: string
  assigned_at: Date
  status: string
  notes?: string
}

// Chart field table for validation
export interface ChartFieldTable {
  id: string
  chart_field: string
  description?: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

// Migration function
export async function migrateSampleManagementDatabase(db: Kysely<SampleManagementDatabase>): Promise<void> {
  // Create samples table
  await db.schema
    .createTable('samples')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('sample_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('project_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('submitter_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('submitter_email', 'varchar(255)', (col) => col.notNull())
    .addColumn('lab_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('sample_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('sample_buffer', 'varchar(255)', (col) => col.notNull())
    .addColumn('concentration', 'decimal(10,2)', (col) => col.notNull())
    .addColumn('volume', 'decimal(10,2)', (col) => col.notNull())
    .addColumn('total_amount', 'decimal(10,2)', (col) => col.notNull())
    .addColumn('flow_cell_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('flow_cell_count', 'integer', (col) => col.notNull())
    .addColumn('status', 'varchar(50)', (col) => col.notNull().defaultTo('submitted'))
    .addColumn('priority', 'varchar(50)', (col) => col.notNull().defaultTo('medium'))
    .addColumn('assigned_to', 'varchar(255)')
    .addColumn('library_prep_by', 'varchar(255)')
    .addColumn('chart_field', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Create workflow history table
  await db.schema
    .createTable('workflow_history')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('sample_id', 'uuid', (col) => col.notNull().references('samples.id').onDelete('cascade'))
    .addColumn('status', 'varchar(50)', (col) => col.notNull())
    .addColumn('assigned_to', 'varchar(255)')
    .addColumn('notes', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('created_by', 'varchar(255)')
    .execute()

  // Create sample assignments table
  await db.schema
    .createTable('sample_assignments')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('sample_id', 'uuid', (col) => col.notNull().references('samples.id').onDelete('cascade'))
    .addColumn('assigned_to', 'varchar(255)', (col) => col.notNull())
    .addColumn('assigned_by', 'varchar(255)', (col) => col.notNull())
    .addColumn('assigned_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('status', 'varchar(50)', (col) => col.notNull().defaultTo('active'))
    .addColumn('notes', 'text')
    .execute()

  // Create chart fields table
  await db.schema
    .createTable('chart_fields')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('chart_field', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('description', 'text')
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Insert default chart fields
  const defaultChartFields = [
    'HTSF-001', 'HTSF-002', 'HTSF-003', 'HTSF-004', 'HTSF-005',
    'NANO-001', 'NANO-002', 'NANO-003', 'NANO-004', 'NANO-005',
    'SEQ-001', 'SEQ-002', 'SEQ-003', 'SEQ-004', 'SEQ-005'
  ]

  for (const chartField of defaultChartFields) {
    await db
      .insertInto('chart_fields')
      .values({
        chart_field: chartField,
        description: `Default chart field: ${chartField}`,
        is_active: true
      })
      .onConflict((oc) => oc.column('chart_field').doNothing())
      .execute()
  }

  // Create indexes for better performance
  await db.schema
    .createIndex('samples_status_idx')
    .ifNotExists()
    .on('samples')
    .column('status')
    .execute()

  await db.schema
    .createIndex('samples_priority_idx')
    .ifNotExists()
    .on('samples')
    .column('priority')
    .execute()

  await db.schema
    .createIndex('samples_assigned_to_idx')
    .ifNotExists()
    .on('samples')
    .column('assigned_to')
    .execute()

  await db.schema
    .createIndex('samples_submitter_email_idx')
    .ifNotExists()
    .on('samples')
    .column('submitter_email')
    .execute()

  await db.schema
    .createIndex('samples_lab_name_idx')
    .ifNotExists()
    .on('samples')
    .column('lab_name')
    .execute()

  await db.schema
    .createIndex('samples_chart_field_idx')
    .ifNotExists()
    .on('samples')
    .column('chart_field')
    .execute()

  await db.schema
    .createIndex('samples_created_at_idx')
    .ifNotExists()
    .on('samples')
    .column('created_at')
    .execute()

  await db.schema
    .createIndex('workflow_history_sample_id_idx')
    .ifNotExists()
    .on('workflow_history')
    .column('sample_id')
    .execute()

  await db.schema
    .createIndex('workflow_history_created_at_idx')
    .ifNotExists()
    .on('workflow_history')
    .column('created_at')
    .execute()

  await db.schema
    .createIndex('sample_assignments_sample_id_idx')
    .ifNotExists()
    .on('sample_assignments')
    .column('sample_id')
    .execute()

  await db.schema
    .createIndex('sample_assignments_assigned_to_idx')
    .ifNotExists()
    .on('sample_assignments')
    .column('assigned_to')
    .execute()

  // Create updated_at trigger function
  await db.schema
    .createFunction('update_updated_at_column')
    .ifNotExists()
    .returns('trigger')
    .language('plpgsql')
    .as(sql`
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
    `)
    .execute()

  // Create triggers for updated_at
  await db.schema
    .createTrigger('samples_updated_at_trigger')
    .ifNotExists()
    .on('samples')
    .beforeUpdate()
    .execute(sql`update_updated_at_column()`)
    .execute()

  await db.schema
    .createTrigger('chart_fields_updated_at_trigger')
    .ifNotExists()
    .on('chart_fields')
    .beforeUpdate()
    .execute(sql`update_updated_at_column()`)
    .execute()
}