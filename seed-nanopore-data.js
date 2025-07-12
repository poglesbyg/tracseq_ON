#!/usr/bin/env node

import { Pool } from 'pg'
import { randomUUID } from 'crypto'

// Docker PostgreSQL connection string
const DATABASE_URL = 'postgresql://crispr_user:crispr_password@localhost:5432/crispr_db'

const pool = new Pool({
  connectionString: DATABASE_URL,
})

// Generate a proper UUID for created_by field
const DEMO_USER_ID = randomUUID()

console.log('🔄 Starting nanopore sample seeding...')
console.log('📊 Using DATABASE_URL:', DATABASE_URL)
console.log('👤 Demo user ID:', DEMO_USER_ID)

const sampleData = [
  {
    sampleName: 'Drosophila_Genome_01',
    organism: 'Drosophila melanogaster',
    genomeSize: '140MB',
    libraryType: 'Genomic DNA',
    flowCellType: 'R10.4.1',
    priority: 'high',
    status: 'completed',
    submissionDate: '2024-12-15',
    expectedCompletionDate: '2024-12-20',
    notes: 'High-quality genomic DNA for chromosome assembly project',
    contactInfo: 'dr.smith@university.edu',
    analysisRequirements: 'De novo assembly, structural variant calling',
    sampleBuffer: 'TE Buffer (10mM Tris, 1mM EDTA, pH 8.0)',
    concentration: '50 ng/µL',
    volume: '100 µL',
    purity260280: 1.85,
    purity260230: 2.1,
    processingSteps: [
      {
        stepName: 'Sample QC',
        status: 'completed',
        startTime: '2024-12-15T09:00:00Z',
        endTime: '2024-12-15T10:30:00Z',
        results: { qcScore: 95, notes: 'Excellent DNA quality' }
      },
      {
        stepName: 'Library Preparation',
        status: 'completed', 
        startTime: '2024-12-15T11:00:00Z',
        endTime: '2024-12-15T14:00:00Z',
        results: { libraryConc: '2.5 ng/µL', fragmentSize: '20kb average' }
      },
      {
        stepName: 'Sequencing',
        status: 'completed',
        startTime: '2024-12-16T08:00:00Z', 
        endTime: '2024-12-18T20:00:00Z',
        results: { totalBases: '15.2 Gb', n50: '45kb', coverage: '108x' }
      }
    ]
  },
  {
    sampleName: 'E_coli_Strain_K12',
    organism: 'Escherichia coli K-12',
    genomeSize: '4.6MB',
    libraryType: 'Genomic DNA',
    flowCellType: 'R9.4.1',
    priority: 'medium',
    status: 'sequencing',
    submissionDate: '2024-12-18',
    expectedCompletionDate: '2024-12-22',
    notes: 'Reference strain for comparative genomics study',
    contactInfo: 'lab.manager@research.org',
    analysisRequirements: 'Reference assembly, plasmid detection',
    sampleBuffer: 'Nuclease-free water',
    concentration: '75 ng/µL',
    volume: '50 µL',
    purity260280: 1.92,
    purity260230: 2.3,
    processingSteps: [
      {
        stepName: 'Sample QC',
        status: 'completed',
        startTime: '2024-12-18T10:00:00Z',
        endTime: '2024-12-18T11:00:00Z',
        results: { qcScore: 88, notes: 'Good quality, slight protein contamination' }
      },
      {
        stepName: 'Library Preparation',
        status: 'completed',
        startTime: '2024-12-18T13:00:00Z',
        endTime: '2024-12-18T16:30:00Z',
        results: { libraryConc: '3.2 ng/µL', fragmentSize: '15kb average' }
      },
      {
        stepName: 'Sequencing',
        status: 'in_progress',
        startTime: '2024-12-19T09:00:00Z',
        endTime: null,
        results: { estimatedCompletion: '85%', currentCoverage: '420x' }
      }
    ]
  },
  {
    sampleName: 'Human_Cell_Line_HeLa',
    organism: 'Homo sapiens (HeLa cells)',
    genomeSize: '3.2GB',
    libraryType: 'Genomic DNA',
    flowCellType: 'R10.4.1',
    priority: 'high',
    status: 'prep',
    submissionDate: '2024-12-20',
    expectedCompletionDate: '2024-12-28',
    notes: 'Cancer cell line for structural variant analysis',
    contactInfo: 'oncology.lab@hospital.edu',
    analysisRequirements: 'SV calling, CNV analysis, methylation',
    sampleBuffer: 'TE Buffer (10mM Tris, 1mM EDTA, pH 8.0)',
    concentration: '30 ng/µL',
    volume: '200 µL',
    purity260280: 1.78,
    purity260230: 1.95,
    processingSteps: [
      {
        stepName: 'Sample QC',
        status: 'completed',
        startTime: '2024-12-20T14:00:00Z',
        endTime: '2024-12-20T15:30:00Z',
        results: { qcScore: 82, notes: 'Acceptable quality, some RNA contamination' }
      },
      {
        stepName: 'Library Preparation',
        status: 'in_progress',
        startTime: '2024-12-21T09:00:00Z',
        endTime: null,
        results: { progress: '60%', estimatedCompletion: '2024-12-21T15:00:00Z' }
      }
    ]
  },
  {
    sampleName: 'Arabidopsis_Col0_Leaf',
    organism: 'Arabidopsis thaliana (Col-0)',
    genomeSize: '125MB',
    libraryType: 'Genomic DNA',
    flowCellType: 'R9.4.1',
    priority: 'low',
    status: 'submitted',
    submissionDate: '2024-12-22',
    expectedCompletionDate: '2025-01-05',
    notes: 'Plant genomics study - leaf tissue extraction',
    contactInfo: 'plant.genomics@agri.university.edu',
    analysisRequirements: 'Genome assembly, gene annotation',
    sampleBuffer: 'CTAB extraction buffer',
    concentration: '45 ng/µL',
    volume: '80 µL',
    purity260280: 1.88,
    purity260230: 2.0,
    processingSteps: [
      {
        stepName: 'Sample QC',
        status: 'pending',
        startTime: null,
        endTime: null,
        results: {}
      }
    ]
  },
  {
    sampleName: 'C_elegans_N2_Whole',
    organism: 'Caenorhabditis elegans (N2)',
    genomeSize: '100MB',
    libraryType: 'Genomic DNA',
    flowCellType: 'R10.4.1',
    priority: 'medium',
    status: 'analysis',
    submissionDate: '2024-12-10',
    expectedCompletionDate: '2024-12-25',
    notes: 'Nematode reference genome sequencing',
    contactInfo: 'nematode.lab@biology.edu',
    analysisRequirements: 'Reference assembly, variant calling',
    sampleBuffer: 'Proteinase K lysis buffer',
    concentration: '60 ng/µL',
    volume: '120 µL',
    purity260280: 1.91,
    purity260230: 2.2,
    processingSteps: [
      {
        stepName: 'Sample QC',
        status: 'completed',
        startTime: '2024-12-10T08:00:00Z',
        endTime: '2024-12-10T09:30:00Z',
        results: { qcScore: 93, notes: 'Excellent DNA integrity' }
      },
      {
        stepName: 'Library Preparation',
        status: 'completed',
        startTime: '2024-12-10T10:00:00Z',
        endTime: '2024-12-10T13:00:00Z',
        results: { libraryConc: '2.8 ng/µL', fragmentSize: '25kb average' }
      },
      {
        stepName: 'Sequencing',
        status: 'completed',
        startTime: '2024-12-11T09:00:00Z',
        endTime: '2024-12-14T18:00:00Z',
        results: { totalBases: '8.5 Gb', n50: '38kb', coverage: '85x' }
      },
      {
        stepName: 'Analysis',
        status: 'in_progress',
        startTime: '2024-12-15T10:00:00Z',
        endTime: null,
        results: { progress: '75%', contigsAssembled: 156 }
      }
    ]
  },
  {
    sampleName: 'Mouse_Brain_Tissue_B6',
    organism: 'Mus musculus (C57BL/6)',
    genomeSize: '2.7GB',
    libraryType: 'Genomic DNA',
    flowCellType: 'R10.4.1',
    priority: 'high',
    status: 'archived',
    submissionDate: '2024-11-28',
    expectedCompletionDate: '2024-12-15',
    notes: 'Neuroscience study - brain tissue DNA extraction',
    contactInfo: 'neuro.genomics@med.university.edu',
    analysisRequirements: 'Epigenetic analysis, structural variants',
    sampleBuffer: 'DNAzol reagent',
    concentration: '25 ng/µL',
    volume: '150 µL',
    purity260280: 1.82,
    purity260230: 1.98,
    processingSteps: [
      {
        stepName: 'Sample QC',
        status: 'completed',
        startTime: '2024-11-28T11:00:00Z',
        endTime: '2024-11-28T12:30:00Z',
        results: { qcScore: 79, notes: 'Moderate quality, some degradation' }
      },
      {
        stepName: 'Library Preparation',
        status: 'completed',
        startTime: '2024-11-29T09:00:00Z',
        endTime: '2024-11-29T14:00:00Z',
        results: { libraryConc: '1.8 ng/µL', fragmentSize: '18kb average' }
      },
      {
        stepName: 'Sequencing',
        status: 'completed',
        startTime: '2024-11-30T10:00:00Z',
        endTime: '2024-12-05T16:00:00Z',
        results: { totalBases: '45.2 Gb', n50: '28kb', coverage: '16.7x' }
      },
      {
        stepName: 'Analysis',
        status: 'completed',
        startTime: '2024-12-06T09:00:00Z',
        endTime: '2024-12-12T17:00:00Z',
        results: { finalAssembly: 'Complete', annotatedGenes: 22847 }
      },
      {
        stepName: 'Archive',
        status: 'completed',
        startTime: '2024-12-13T10:00:00Z',
        endTime: '2024-12-13T11:00:00Z',
        results: { archiveLocation: 'Cold storage vault A-7', backupVerified: true }
      }
    ]
  }
]

async function seedData() {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    console.log('🧹 Cleaning existing data...')
    
    // Clean up existing data in correct order
    await client.query('DELETE FROM nanopore_attachments')
    await client.query('DELETE FROM nanopore_processing_steps')
    await client.query('DELETE FROM nanopore_sample_details')
    await client.query('DELETE FROM nanopore_samples')
    
    console.log('✅ Existing data cleaned')
    
    for (const sample of sampleData) {
      console.log(`📝 Creating sample: ${sample.sampleName}`)
      
      // Insert main sample record
      const sampleResult = await client.query(`
        INSERT INTO nanopore_samples (
          sample_name, organism, genome_size, library_type, flow_cell_type,
          priority, status, submission_date, expected_completion_date,
          notes, contact_info, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [
        sample.sampleName,
        sample.organism,
        sample.genomeSize,
        sample.libraryType,
        sample.flowCellType,
        sample.priority,
        sample.status,
        sample.submissionDate,
        sample.expectedCompletionDate,
        sample.notes,
        sample.contactInfo,
        DEMO_USER_ID,
        DEMO_USER_ID
      ])
      
      const sampleId = sampleResult.rows[0].id
      
      // Insert sample details
      await client.query(`
        INSERT INTO nanopore_sample_details (
          sample_id, analysis_requirements, sample_buffer, concentration,
          volume, purity_260_280, purity_260_230, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        sampleId,
        sample.analysisRequirements,
        sample.sampleBuffer,
        sample.concentration,
        sample.volume,
        sample.purity260280,
        sample.purity260230,
        DEMO_USER_ID,
        DEMO_USER_ID
      ])
      
      // Insert processing steps
      for (const step of sample.processingSteps) {
        await client.query(`
          INSERT INTO nanopore_processing_steps (
            sample_id, step_name, status, start_time, end_time, results, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          sampleId,
          step.stepName,
          step.status,
          step.startTime,
          step.endTime,
          JSON.stringify(step.results),
          DEMO_USER_ID,
          DEMO_USER_ID
        ])
      }
      
      console.log(`✅ Sample ${sample.sampleName} created successfully`)
    }
    
    await client.query('COMMIT')
    console.log('🎉 All nanopore samples seeded successfully!')
    
    // Verify the data
    const countResult = await client.query('SELECT COUNT(*) FROM nanopore_samples')
    console.log(`📊 Total samples in database: ${countResult.rows[0].count}`)
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error seeding data:', error)
    throw error
  } finally {
    client.release()
  }
}

async function main() {
  try {
    await seedData()
  } catch (error) {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main() 