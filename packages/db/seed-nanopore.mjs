#!/usr/bin/env node

import { randomUUID } from 'crypto'
import { setupDb } from './src/db.ts'

// Docker PostgreSQL connection string
const DATABASE_URL = 'postgresql://crispr_user:crispr_password@localhost:5432/crispr_db'

const db = setupDb(DATABASE_URL)

console.log('🔄 Starting nanopore sample seeding...')
console.log('📊 Using DATABASE_URL:', DATABASE_URL)

const sampleData = [
  {
    // Main sample table fields
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
    priority: 'high',
    status: 'completed',
    assignedTo: 'Jenny Smith',
    libraryPrepBy: 'jenny-smith',
    
    // Sample details fields
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
    qcNotes: 'Excellent DNA quality, high molecular weight confirmed',
    specialInstructions: 'High priority for publication deadline',
    internalNotes: 'Completed successfully, data delivered to iLab',
    
    // Processing steps
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
    priority: 'normal',
    status: 'sequencing',
    assignedTo: 'Grey Wilson',
    libraryPrepBy: 'grey-wilson',
    
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
    qcNotes: 'Good RNA integrity, RIN score 8.5',
    specialInstructions: 'Dual flow cells for increased throughput',
    internalNotes: 'Currently sequencing on MinION Mk1C',
    
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
    priority: 'urgent',
    status: 'prep',
    assignedTo: 'Stephanie Jones',
    libraryPrepBy: 'stephanie-jones',
    
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
    qcPassed: true,
    qcNotes: 'Excellent DNA purity and concentration',
    specialInstructions: 'URGENT: Required for grant submission',
    internalNotes: 'Library prep in progress, excellent DNA quality',
    
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
    priority: 'normal',
    status: 'submitted',
    assignedTo: null,
    libraryPrepBy: null,
    
    organism: 'Arabidopsis thaliana',
    genomeSize: 'Small (< 1 Gb)',
    expectedReadLength: 'Long (> 10 kb)',
    libraryPrepKit: 'SQK-LSK114',
    barcodingRequired: false,
    runTimeHours: 24,
    basecallingModel: 'dna_r10.4.1_e8.2_400bps_hac',
    dataDeliveryMethod: 'Download portal',
    fileFormat: 'FASTQ',
    analysisRequired: false,
    qcPassed: null,
    qcNotes: null,
    specialInstructions: 'Standard processing, no rush',
    internalNotes: 'Awaiting assignment to technician',
    
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
    priority: 'high',
    status: 'analysis',
    assignedTo: 'Jenny Smith',
    libraryPrepBy: 'jenny-smith',
    
    organism: 'Caenorhabditis elegans',
    genomeSize: 'Small (< 1 Gb)',
    expectedReadLength: 'Ultra-long (> 100 kb)',
    libraryPrepKit: 'SQK-LSK114',
    barcodingRequired: true,
    barcodeKit: 'EXP-NBD196',
    runTimeHours: 72,
    basecallingModel: 'dna_r10.4.1_e8.2_400bps_sup',
    dataDeliveryMethod: 'Cloud storage',
    fileFormat: 'FASTQ + POD5 + FAST5',
    analysisRequired: true,
    analysisType: 'Chromosome-level assembly',
    qcPassed: true,
    qcNotes: 'Exceptional DNA quality, ultra-high molecular weight',
    specialInstructions: 'Triple flow cell run for maximum coverage',
    internalNotes: 'Data analysis in progress, preliminary results look excellent',
    
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
    sampleName: 'HTSF-JS-006-Plasmid',
    projectId: 'HTSF--JS-[PLASMID]',
    submitterName: 'Dr. Jennifer Smith',
    submitterEmail: 'jennifer.smith@unc.edu',
    labName: 'Smith Molecular Biology Lab',
    sampleType: 'Plasmid DNA',
    sampleBuffer: 'TE Buffer',
    concentration: 150.2,
    volume: 15.0,
    totalAmount: 2253.0,
    flowCellType: 'R10.4.1',
    flowCellCount: 1,
    priority: 'high',
    status: 'archived',
    assignedTo: 'Grey Wilson',
    libraryPrepBy: 'grey-wilson',
    
    organism: 'Mus musculus',
    genomeSize: 'Large (> 3 Gb)',
    expectedReadLength: 'Long (> 10 kb)',
    libraryPrepKit: 'SQK-LSK114',
    barcodingRequired: false,
    runTimeHours: 18,
    basecallingModel: 'dna_r10.4.1_e8.2_400bps_hac',
    dataDeliveryMethod: 'Cloud storage',
    fileFormat: 'FASTQ + POD5',
    analysisRequired: true,
    analysisType: 'Plasmid verification and annotation',
    qcPassed: true,
    qcNotes: 'High purity plasmid DNA, supercoiled confirmation',
    specialInstructions: 'Verify plasmid integrity and insert sequence',
    internalNotes: 'Analysis completed, plasmid sequence verified',
    
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
  try {
    console.log('🧹 Cleaning existing data...')
    
    // Clean up existing data in correct order
    await db.deleteFrom('nanoporeAttachments').execute()
    await db.deleteFrom('nanoporeProcessingSteps').execute()
    await db.deleteFrom('nanoporeSampleDetails').execute()
    await db.deleteFrom('nanoporeSamples').execute()
    
    console.log('✅ Existing data cleaned')
    
    // Create a demo user first
    console.log('👤 Creating demo user...')
    const demoUser = await db
      .insertInto('users')
      .values({
        name: 'Demo User',
        email: 'demo@tracseq.com',
        emailVerified: true,
        status: 'active'
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    
    const DEMO_USER_ID = demoUser.id
    console.log('✅ Demo user created with ID:', DEMO_USER_ID)
    
    for (const sample of sampleData) {
      console.log(`📝 Creating sample: ${sample.sampleName}`)
      
      // Insert main sample record
      const sampleResult = await db
        .insertInto('nanoporeSamples')
        .values({
          sampleName: sample.sampleName,
          projectId: sample.projectId,
          submitterName: sample.submitterName,
          submitterEmail: sample.submitterEmail,
          labName: sample.labName,
          sampleType: sample.sampleType,
          sampleBuffer: sample.sampleBuffer,
          concentration: sample.concentration,
          volume: sample.volume,
          totalAmount: sample.totalAmount,
          flowCellType: sample.flowCellType,
          flowCellCount: sample.flowCellCount,
          priority: sample.priority,
          status: sample.status,
          assignedTo: sample.assignedTo,
          libraryPrepBy: sample.libraryPrepBy,
          createdBy: DEMO_USER_ID
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      
      const sampleId = sampleResult.id
      
      // Insert sample details
      await db
        .insertInto('nanoporeSampleDetails')
        .values({
          sampleId: sampleId,
          organism: sample.organism,
          genomeSize: sample.genomeSize,
          expectedReadLength: sample.expectedReadLength,
          libraryPrepKit: sample.libraryPrepKit,
          barcodingRequired: sample.barcodingRequired,
          barcodeKit: sample.barcodeKit || null,
          runTimeHours: sample.runTimeHours,
          basecallingModel: sample.basecallingModel,
          dataDeliveryMethod: sample.dataDeliveryMethod,
          fileFormat: sample.fileFormat,
          analysisRequired: sample.analysisRequired,
          analysisType: sample.analysisType || null,
          qcPassed: sample.qcPassed,
          qcNotes: sample.qcNotes,
          specialInstructions: sample.specialInstructions,
          internalNotes: sample.internalNotes
        })
        .execute()
      
      // Insert processing steps
      for (const step of sample.processingSteps) {
        await db
          .insertInto('nanoporeProcessingSteps')
          .values({
            sampleId: sampleId,
            stepName: step.stepName,
            status: step.status,
            startTime: step.startTime ? new Date(step.startTime) : null,
            endTime: step.endTime ? new Date(step.endTime) : null,
            results: step.results,
            createdBy: DEMO_USER_ID,
            updatedBy: DEMO_USER_ID
          })
          .execute()
      }
      
      console.log(`✅ Sample ${sample.sampleName} created successfully`)
    }
    
    console.log('🎉 All nanopore samples seeded successfully!')
    
    // Verify the data
    const countResult = await db
      .selectFrom('nanoporeSamples')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst()
    
    console.log(`📊 Total samples in database: ${countResult?.count}`)
    
  } catch (error) {
    console.error('❌ Error seeding data:', error)
    throw error
  }
}

async function main() {
  try {
    await seedData()
  } catch (error) {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  } finally {
    // Close database connection
    await db.destroy()
  }
}

main() 