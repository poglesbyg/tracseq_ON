#!/usr/bin/env node
/**
 * Seed script for Nanopore tracking system
 * Populates the database with realistic mock data
 */

const { Pool } = require('pg')

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/monorepo-scaffold'
})

// Mock data
const mockUsers = [
  { id: 'demo-user', email: 'demo@example.com', name: 'Demo User', emailVerified: true, status: 'active' },
  { id: 'jenny-smith', email: 'jenny.smith@unc.edu', name: 'Jenny Smith', emailVerified: true, status: 'active' },
  { id: 'grey-wilson', email: 'grey.wilson@unc.edu', name: 'Grey Wilson', emailVerified: true, status: 'active' },
  { id: 'stephanie-jones', email: 'stephanie.jones@unc.edu', name: 'Stephanie Jones', emailVerified: true, status: 'active' }
]

const mockSamples = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    sampleName: 'HTSF-CJ-001-DNA',
    projectId: 'HTSF--CJ-[CID]',
    submitterName: 'Dr. Corbin Jones',
    submitterEmail: 'corbin.jones@unc.edu',
    labName: 'Jones Lab (UNC)',
    sampleType: 'High molecular weight DNA',
    sampleBuffer: 'TE Buffer',
    concentration: 85.5,
    volume: 25.0,
    totalAmount: 2137.5,
    flowCellType: 'R10.4.1',
    flowCellCount: 1,
    status: 'completed',
    priority: 'high',
    assignedTo: 'Jenny Smith',
    libraryPrepBy: 'jenny-smith',
    submittedAt: "NOW() - INTERVAL '5 days'",
    startedAt: "NOW() - INTERVAL '4 days'",
    completedAt: "NOW() - INTERVAL '1 day'",
    createdBy: 'demo-user'
  },
  {
    id: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
    sampleName: 'HTSF-ML-002-RNA',
    projectId: 'HTSF--ML-[RNA-SEQ]',
    submitterName: 'Dr. Maria Lopez',
    submitterEmail: 'maria.lopez@unc.edu',
    labName: 'Lopez Genomics Lab',
    sampleType: 'Total RNA',
    sampleBuffer: 'RNAse-free water',
    concentration: 45.2,
    volume: 30.0,
    totalAmount: 1356.0,
    flowCellType: 'R9.4.1',
    flowCellCount: 2,
    status: 'sequencing',
    priority: 'normal',
    assignedTo: 'Grey Wilson',
    libraryPrepBy: 'grey-wilson',
    submittedAt: "NOW() - INTERVAL '3 days'",
    startedAt: "NOW() - INTERVAL '2 days'",
    completedAt: null,
    createdBy: 'demo-user'
  },
  {
    id: 'c3d4e5f6-g7h8-9012-cdef-345678901234',
    sampleName: 'HTSF-TB-003-gDNA',
    projectId: 'HTSF--TB-[GENOME]',
    submitterName: 'Dr. Thomas Brown',
    submitterEmail: 'thomas.brown@duke.edu',
    labName: 'Brown Microbiology Lab',
    sampleType: 'Genomic DNA',
    sampleBuffer: 'Tris-EDTA',
    concentration: 120.8,
    volume: 20.0,
    totalAmount: 2416.0,
    flowCellType: 'R10.4.1',
    flowCellCount: 1,
    status: 'prep',
    priority: 'urgent',
    assignedTo: 'Stephanie Jones',
    libraryPrepBy: 'stephanie-jones',
    submittedAt: "NOW() - INTERVAL '2 days'",
    startedAt: "NOW() - INTERVAL '1 day'",
    completedAt: null,
    createdBy: 'demo-user'
  },
  {
    id: 'd4e5f6g7-h8i9-0123-defg-456789012345',
    sampleName: 'HTSF-KW-004-cDNA',
    projectId: 'HTSF--KW-[TRANSCRIPT]',
    submitterName: 'Dr. Karen Williams',
    submitterEmail: 'karen.williams@ncsu.edu',
    labName: 'Williams Plant Biology Lab',
    sampleType: 'cDNA library',
    sampleBuffer: 'TE Buffer',
    concentration: 65.3,
    volume: 35.0,
    totalAmount: 2285.5,
    flowCellType: 'R9.4.1',
    flowCellCount: 1,
    status: 'submitted',
    priority: 'normal',
    assignedTo: null,
    libraryPrepBy: null,
    submittedAt: "NOW() - INTERVAL '1 day'",
    startedAt: null,
    completedAt: null,
    createdBy: 'demo-user'
  },
  {
    id: 'e5f6g7h8-i9j0-1234-efgh-567890123456',
    sampleName: 'HTSF-RD-005-HMW',
    projectId: 'HTSF--RD-[ASSEMBLY]',
    submitterName: 'Dr. Robert Davis',
    submitterEmail: 'robert.davis@unc.edu',
    labName: 'Davis Evolutionary Biology Lab',
    sampleType: 'High molecular weight DNA',
    sampleBuffer: 'Tris-EDTA',
    concentration: 95.7,
    volume: 40.0,
    totalAmount: 3828.0,
    flowCellType: 'R10.4.1',
    flowCellCount: 3,
    status: 'analysis',
    priority: 'high',
    assignedTo: 'Jenny Smith',
    libraryPrepBy: 'jenny-smith',
    submittedAt: "NOW() - INTERVAL '7 days'",
    startedAt: "NOW() - INTERVAL '6 days'",
    completedAt: null,
    createdBy: 'demo-user'
  }
]

async function seedDatabase() {
  const client = await pool.connect()
  
  try {
    console.log('🌱 Starting database seeding...')
    
    // Begin transaction
    await client.query('BEGIN')
    
    // Insert users
    console.log('📝 Inserting users...')
    for (const user of mockUsers) {
      await client.query(`
        INSERT INTO users (id, email, name, email_verified, status, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [user.id, user.email, user.name, user.emailVerified, user.status])
    }
    
    // Insert nanopore samples
    console.log('🧬 Inserting nanopore samples...')
    for (const sample of mockSamples) {
      const submittedAt = sample.submittedAt === null ? null : sample.submittedAt.replace(/'/g, '')
      const startedAt = sample.startedAt === null ? null : sample.startedAt.replace(/'/g, '')
      const completedAt = sample.completedAt === null ? null : sample.completedAt.replace(/'/g, '')
      
      await client.query(`
        INSERT INTO nanopore_samples (
          id, sample_name, project_id, submitter_name, submitter_email, lab_name,
          sample_type, sample_buffer, concentration, volume, total_amount,
          flow_cell_type, flow_cell_count, status, priority, assigned_to, library_prep_by,
          submitted_at, started_at, completed_at, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
          ${submittedAt ? submittedAt : 'NULL'}, 
          ${startedAt ? startedAt : 'NULL'}, 
          ${completedAt ? completedAt : 'NULL'}, 
          $18, NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `, [
        sample.id, sample.sampleName, sample.projectId, sample.submitterName, 
        sample.submitterEmail, sample.labName, sample.sampleType, sample.sampleBuffer,
        sample.concentration, sample.volume, sample.totalAmount, sample.flowCellType,
        sample.flowCellCount, sample.status, sample.priority, sample.assignedTo,
        sample.libraryPrepBy, sample.createdBy
      ])
    }
    
    // Insert sample details
    console.log('📊 Inserting sample details...')
    const sampleDetails = [
      {
        sampleId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        organism: 'Drosophila melanogaster',
        genomeSize: 'Small (< 1 Gb)',
        expectedReadLength: 'Long (> 10 kb)',
        libraryPrepKit: 'SQK-LSK114',
        barcodingRequired: false,
        runTimeHours: 24,
        basecallingModel: 'dna_r10.4.1_e8.2_400bps_hac',
        dataDeliveryMethod: 'Cloud storage',
        fileFormat: 'FASTQ + POD5',
        analysisRequired: true,
        analysisType: 'De novo genome assembly',
        qcPassed: true,
        qcNotes: 'Excellent DNA quality, A260/A280 = 1.85',
        specialInstructions: 'High priority for publication deadline',
        internalNotes: 'Completed successfully, data delivered to iLab'
      },
      {
        sampleId: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
        organism: 'Homo sapiens',
        genomeSize: 'Large (> 3 Gb)',
        expectedReadLength: 'Long (> 10 kb)',
        libraryPrepKit: 'SQK-RNA002',
        barcodingRequired: true,
        barcodeKit: 'EXP-NBD196',
        runTimeHours: 48,
        basecallingModel: 'rna_r9.4.1_e8.2_260bps_hac',
        dataDeliveryMethod: 'Download portal',
        fileFormat: 'FASTQ',
        analysisRequired: true,
        analysisType: 'Differential expression analysis',
        qcPassed: true,
        qcNotes: 'RIN = 8.5, good RNA integrity',
        specialInstructions: 'Dual flow cells for increased throughput',
        internalNotes: 'Currently sequencing on MinION Mk1C'
      },
      {
        sampleId: 'c3d4e5f6-g7h8-9012-cdef-345678901234',
        organism: 'Escherichia coli',
        genomeSize: 'Small (< 1 Gb)',
        expectedReadLength: 'Ultra-long (> 100 kb)',
        libraryPrepKit: 'SQK-LSK114',
        barcodingRequired: false,
        runTimeHours: 12,
        basecallingModel: 'dna_r10.4.1_e8.2_400bps_sup',
        dataDeliveryMethod: 'Cloud storage',
        fileFormat: 'FASTQ + FAST5',
        analysisRequired: true,
        analysisType: 'Variant calling and annotation',
        qcPassed: null,
        qcNotes: null,
        specialInstructions: 'URGENT: Required for grant submission',
        internalNotes: 'Library prep in progress, excellent DNA quality'
      }
    ]
    
    for (const detail of sampleDetails) {
      await client.query(`
        INSERT INTO nanopore_sample_details (
          sample_id, organism, genome_size, expected_read_length, library_prep_kit,
          barcoding_required, barcode_kit, run_time_hours, basecalling_model,
          data_delivery_method, file_format, analysis_required, analysis_type,
          qc_passed, qc_notes, special_instructions, internal_notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
        )
        ON CONFLICT (sample_id) DO NOTHING
      `, [
        detail.sampleId, detail.organism, detail.genomeSize, detail.expectedReadLength,
        detail.libraryPrepKit, detail.barcodingRequired, detail.barcodeKit, detail.runTimeHours,
        detail.basecallingModel, detail.dataDeliveryMethod, detail.fileFormat,
        detail.analysisRequired, detail.analysisType, detail.qcPassed, detail.qcNotes,
        detail.specialInstructions, detail.internalNotes
      ])
    }
    
    // Insert some processing steps
    console.log('⚙️  Inserting processing steps...')
    const processingSteps = [
      {
        sampleId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        stepName: 'Sample QC',
        stepStatus: 'completed',
        assignedTo: 'Jenny Smith',
        notes: 'Qubit: 85.5 ng/μL, TapeStation: HMW DNA profile excellent',
        resultsData: JSON.stringify({qubit_concentration: 85.5, tapestation_profile: 'excellent', a260_a280: 1.85})
      },
      {
        sampleId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        stepName: 'Library Preparation',
        stepStatus: 'completed',
        assignedTo: 'Jenny Smith',
        notes: 'SQK-LSK114 protocol followed, final library concentration 12.3 ng/μL',
        resultsData: JSON.stringify({library_concentration: 12.3, protocol: 'SQK-LSK114', yield: 'excellent'})
      },
      {
        sampleId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        stepName: 'Sequencing',
        stepStatus: 'completed',
        assignedTo: 'Jenny Smith',
        notes: '24-hour run completed, 8.5 Gb total output',
        resultsData: JSON.stringify({total_output_gb: 8.5, n50: 25000, mean_read_length: 18500, total_reads: 459000})
      },
      {
        sampleId: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
        stepName: 'Sample QC',
        stepStatus: 'completed',
        assignedTo: 'Grey Wilson',
        notes: 'RNA integrity excellent, RIN = 8.5',
        resultsData: JSON.stringify({rin_score: 8.5, concentration: 45.2, quality: 'excellent'})
      },
      {
        sampleId: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
        stepName: 'Sequencing',
        stepStatus: 'in_progress',
        assignedTo: 'Grey Wilson',
        notes: '48-hour run in progress, currently 18 hours elapsed',
        resultsData: JSON.stringify({elapsed_hours: 18, current_output_gb: 4.2, estimated_total_gb: 12.5})
      },
      {
        sampleId: 'c3d4e5f6-g7h8-9012-cdef-345678901234',
        stepName: 'Sample QC',
        stepStatus: 'completed',
        assignedTo: 'Stephanie Jones',
        notes: 'Excellent HMW DNA, perfect for ultra-long reads',
        resultsData: JSON.stringify({concentration: 120.8, fragment_size: '> 100kb', purity: 'excellent'})
      },
      {
        sampleId: 'c3d4e5f6-g7h8-9012-cdef-345678901234',
        stepName: 'Library Preparation',
        stepStatus: 'in_progress',
        assignedTo: 'Stephanie Jones',
        notes: 'SQK-LSK114 prep in progress, currently at adapter ligation step',
        resultsData: JSON.stringify({current_step: 'adapter_ligation', estimated_completion: '2 hours'})
      }
    ]
    
    for (const step of processingSteps) {
      await client.query(`
        INSERT INTO nanopore_processing_steps (
          sample_id, step_name, step_status, assigned_to, notes, results_data, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT DO NOTHING
      `, [
        step.sampleId, step.stepName, step.stepStatus, step.assignedTo, step.notes, step.resultsData
      ])
    }
    
    // Commit transaction
    await client.query('COMMIT')
    
    console.log('✅ Database seeding completed successfully!')
    console.log('📊 Seeded data:')
    console.log(`   - ${mockUsers.length} users`)
    console.log(`   - ${mockSamples.length} nanopore samples`)
    console.log(`   - ${sampleDetails.length} sample detail records`)
    console.log(`   - ${processingSteps.length} processing steps`)
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error seeding database:', error)
    throw error
  } finally {
    client.release()
  }
}

// Run the seeding
seedDatabase()
  .then(() => {
    console.log('🎉 Seeding complete! You can now view the data in your application.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error)
    process.exit(1)
  }) 