import { Kysely, sql } from 'kysely'

// Database schema for AI Processing Service
export interface AIProcessingDatabase {
  processing_jobs: ProcessingJobTable
  extracted_data: ExtractedDataTable
  vector_embeddings: VectorEmbeddingTable
  processing_templates: ProcessingTemplateTable
  validation_rules: ValidationRuleTable
}

// Processing jobs table
export interface ProcessingJobTable {
  id: string
  sample_id?: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  processing_type: string
  status: string
  progress: number
  result?: string // JSON string
  error?: string
  metadata?: string // JSON string
  created_at: Date
  updated_at: Date
  started_at?: Date
  completed_at?: Date
}

// Extracted data table
export interface ExtractedDataTable {
  id: string
  job_id: string
  field_name: string
  field_value: string
  confidence: number
  confidence_level: string
  source: string
  page_number?: number
  bounding_box?: string // JSON string
  validation_errors?: string // JSON string
  created_at: Date
  updated_at: Date
}

// Vector embeddings table
export interface VectorEmbeddingTable {
  id: string
  job_id: string
  content: string
  embedding: number[] // Vector as array
  metadata?: string // JSON string
  created_at: Date
  updated_at: Date
}

// Processing templates table
export interface ProcessingTemplateTable {
  id: string
  name: string
  description?: string
  processing_type: string
  template_config: string // JSON string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

// Validation rules table
export interface ValidationRuleTable {
  id: string
  template_id: string
  field_name: string
  required: boolean
  field_type: string
  min_length?: number
  max_length?: number
  min_value?: number
  max_value?: number
  pattern?: string
  allowed_values?: string // JSON string
  custom_validation?: string
  created_at: Date
  updated_at: Date
}

// Migration function
export async function migrateAIProcessingDatabase(db: Kysely<AIProcessingDatabase>): Promise<void> {
  // Create processing jobs table
  await db.schema
    .createTable('processing_jobs')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('sample_id', 'uuid')
    .addColumn('file_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('file_path', 'varchar(500)', (col) => col.notNull())
    .addColumn('file_size', 'bigint', (col) => col.notNull())
    .addColumn('mime_type', 'varchar(100)', (col) => col.notNull())
    .addColumn('processing_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('status', 'varchar(50)', (col) => col.notNull().defaultTo('pending'))
    .addColumn('progress', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('result', 'jsonb')
    .addColumn('error', 'text')
    .addColumn('metadata', 'jsonb')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('started_at', 'timestamp')
    .addColumn('completed_at', 'timestamp')
    .execute()

  // Create extracted data table
  await db.schema
    .createTable('extracted_data')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('job_id', 'uuid', (col) => col.notNull().references('processing_jobs.id').onDelete('cascade'))
    .addColumn('field_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('field_value', 'text', (col) => col.notNull())
    .addColumn('confidence', 'decimal(3,2)', (col) => col.notNull())
    .addColumn('confidence_level', 'varchar(20)', (col) => col.notNull())
    .addColumn('source', 'varchar(100)', (col) => col.notNull())
    .addColumn('page_number', 'integer')
    .addColumn('bounding_box', 'jsonb')
    .addColumn('validation_errors', 'jsonb')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Create vector embeddings table
  await db.schema
    .createTable('vector_embeddings')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('job_id', 'uuid', (col) => col.notNull().references('processing_jobs.id').onDelete('cascade'))
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('embedding', 'vector(1536)', (col) => col.notNull()) // OpenAI embedding dimension
    .addColumn('metadata', 'jsonb')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Create processing templates table
  await db.schema
    .createTable('processing_templates')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('description', 'text')
    .addColumn('processing_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('template_config', 'jsonb', (col) => col.notNull())
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Create validation rules table
  await db.schema
    .createTable('validation_rules')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('template_id', 'uuid', (col) => col.notNull().references('processing_templates.id').onDelete('cascade'))
    .addColumn('field_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('required', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('field_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('min_length', 'integer')
    .addColumn('max_length', 'integer')
    .addColumn('min_value', 'decimal(10,2)')
    .addColumn('max_value', 'decimal(10,2)')
    .addColumn('pattern', 'varchar(500)')
    .addColumn('allowed_values', 'jsonb')
    .addColumn('custom_validation', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Insert default processing templates
  const defaultTemplates = [
    {
      name: 'nanopore_sample_form',
      description: 'Default template for nanopore sample form processing',
      processing_type: 'pdf_extraction',
      template_config: JSON.stringify({
        fields: [
          'sample_name',
          'project_id',
          'submitter_name',
          'submitter_email',
          'lab_name',
          'sample_type',
          'sample_buffer',
          'concentration',
          'volume',
          'total_amount',
          'flow_cell_type',
          'flow_cell_count',
          'priority',
          'chart_field'
        ],
        extractionPrompt: 'Extract the following fields from this nanopore sample form:',
        confidenceThreshold: 0.7
      })
    },
    {
      name: 'ai_extraction_template',
      description: 'Template for AI-powered text extraction',
      processing_type: 'ai_extraction',
      template_config: JSON.stringify({
        model: 'llama2',
        maxTokens: 1000,
        temperature: 0.1,
        systemPrompt: 'You are an expert at extracting structured data from scientific documents.'
      })
    }
  ]

  for (const template of defaultTemplates) {
    await db
      .insertInto('processing_templates')
      .values({
        name: template.name,
        description: template.description,
        processing_type: template.processing_type,
        template_config: template.template_config,
        is_active: true
      })
      .onConflict((oc) => oc.column('name').doNothing())
      .execute()
  }

  // Insert default validation rules for nanopore sample form
  const nanoporeTemplate = await db
    .selectFrom('processing_templates')
    .select('id')
    .where('name', '=', 'nanopore_sample_form')
    .executeTakeFirst()

  if (nanoporeTemplate) {
    const defaultRules = [
      { field_name: 'sample_name', required: true, field_type: 'string', min_length: 1, max_length: 255 },
      { field_name: 'project_id', required: true, field_type: 'string', min_length: 1, max_length: 255 },
      { field_name: 'submitter_name', required: true, field_type: 'string', min_length: 1, max_length: 255 },
      { field_name: 'submitter_email', required: true, field_type: 'email' },
      { field_name: 'lab_name', required: true, field_type: 'string', min_length: 1, max_length: 255 },
      { field_name: 'sample_type', required: true, field_type: 'string', allowed_values: ['dna', 'rna', 'protein', 'other'] },
      { field_name: 'concentration', required: true, field_type: 'number', min_value: 0 },
      { field_name: 'volume', required: true, field_type: 'number', min_value: 0 },
      { field_name: 'total_amount', required: true, field_type: 'number', min_value: 0 },
      { field_name: 'flow_cell_count', required: true, field_type: 'number', min_value: 1 }
    ]

    for (const rule of defaultRules) {
      await db
        .insertInto('validation_rules')
        .values({
          template_id: nanoporeTemplate.id,
          field_name: rule.field_name,
          required: rule.required,
          field_type: rule.field_type,
          min_length: rule.min_length,
          max_length: rule.max_length,
          min_value: rule.min_value,
          max_value: rule.max_value,
          allowed_values: rule.allowed_values ? JSON.stringify(rule.allowed_values) : undefined
        })
        .onConflict((oc) => oc.columns(['template_id', 'field_name']).doNothing())
        .execute()
    }
  }

  // Create indexes for better performance
  await db.schema
    .createIndex('processing_jobs_status_idx')
    .ifNotExists()
    .on('processing_jobs')
    .column('status')
    .execute()

  await db.schema
    .createIndex('processing_jobs_sample_id_idx')
    .ifNotExists()
    .on('processing_jobs')
    .column('sample_id')
    .execute()

  await db.schema
    .createIndex('processing_jobs_created_at_idx')
    .ifNotExists()
    .on('processing_jobs')
    .column('created_at')
    .execute()

  await db.schema
    .createIndex('extracted_data_job_id_idx')
    .ifNotExists()
    .on('extracted_data')
    .column('job_id')
    .execute()

  await db.schema
    .createIndex('extracted_data_field_name_idx')
    .ifNotExists()
    .on('extracted_data')
    .column('field_name')
    .execute()

  await db.schema
    .createIndex('vector_embeddings_job_id_idx')
    .ifNotExists()
    .on('vector_embeddings')
    .column('job_id')
    .execute()

  await db.schema
    .createIndex('processing_templates_name_idx')
    .ifNotExists()
    .on('processing_templates')
    .column('name')
    .execute()

  await db.schema
    .createIndex('validation_rules_template_id_idx')
    .ifNotExists()
    .on('validation_rules')
    .column('template_id')
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
    .createTrigger('processing_jobs_updated_at_trigger')
    .ifNotExists()
    .on('processing_jobs')
    .beforeUpdate()
    .execute(sql`update_updated_at_column()`)
    .execute()

  await db.schema
    .createTrigger('extracted_data_updated_at_trigger')
    .ifNotExists()
    .on('extracted_data')
    .beforeUpdate()
    .execute(sql`update_updated_at_column()`)
    .execute()

  await db.schema
    .createTrigger('vector_embeddings_updated_at_trigger')
    .ifNotExists()
    .on('vector_embeddings')
    .beforeUpdate()
    .execute(sql`update_updated_at_column()`)
    .execute()

  await db.schema
    .createTrigger('processing_templates_updated_at_trigger')
    .ifNotExists()
    .on('processing_templates')
    .beforeUpdate()
    .execute(sql`update_updated_at_column()`)
    .execute()

  await db.schema
    .createTrigger('validation_rules_updated_at_trigger')
    .ifNotExists()
    .on('validation_rules')
    .beforeUpdate()
    .execute(sql`update_updated_at_column()`)
    .execute()
}