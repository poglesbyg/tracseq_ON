-- Seed data for database

-- Insert demo users first (if not already exists)
INSERT INTO users (id, email, name, email_verified, status, created_at, updated_at) 
VALUES 
  ('demo-user', 'demo@example.com', 'Demo User', true, 'active', NOW(), NOW()),
  ('jenny-smith', 'jenny.smith@unc.edu', 'Jenny Smith', true, 'active', NOW(), NOW()),
  ('grey-wilson', 'grey.wilson@unc.edu', 'Grey Wilson', true, 'active', NOW(), NOW()),
  ('stephanie-jones', 'stephanie.jones@unc.edu', 'Stephanie Jones', true, 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert demo nanopore samples
INSERT INTO nanopore_samples (
  id, sample_name, project_id, submitter_name, submitter_email, lab_name,
  sample_type, sample_buffer, concentration, volume, total_amount,
  flow_cell_type, flow_cell_count, status, priority, assigned_to, library_prep_by,
  submitted_at, started_at, completed_at, created_by
) VALUES 
  -- Sample 1: Recently completed high-priority sample
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'HTSF-CJ-001-DNA',
    'HTSF--CJ-[CID]',
    'Dr. Corbin Jones',
    'corbin.jones@unc.edu',
    'Jones Lab (UNC)',
    'High molecular weight DNA',
    'TE Buffer',
    85.5,
    25.0,
    2137.5,
    'R10.4.1',
    1,
    'completed',
    'high',
    'Jenny Smith',
    'jenny-smith',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '1 day',
    'demo-user'
  ),
  
  -- Sample 2: Currently in sequencing
  (
    'b2c3d4e5-f6g7-8901-bcde-f23456789012',
    'HTSF-ML-002-RNA',
    'HTSF--ML-[RNA-SEQ]',
    'Dr. Maria Lopez',
    'maria.lopez@unc.edu',
    'Lopez Genomics Lab',
    'Total RNA',
    'RNAse-free water',
    45.2,
    30.0,
    1356.0,
    'R9.4.1',
    2,
    'sequencing',
    'normal',
    'Grey Wilson',
    'grey-wilson',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days',
    NULL,
    'demo-user'
  ),
  
  -- Sample 3: In library preparation
  (
    'c3d4e5f6-g7h8-9012-cdef-345678901234',
    'HTSF-TB-003-gDNA',
    'HTSF--TB-[GENOME]',
    'Dr. Thomas Brown',
    'thomas.brown@duke.edu',
    'Brown Microbiology Lab',
    'Genomic DNA',
    'Tris-EDTA',
    120.8,
    20.0,
    2416.0,
    'R10.4.1',
    1,
    'prep',
    'urgent',
    'Stephanie Jones',
    'stephanie-jones',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day',
    NULL,
    'demo-user'
  ),
  
  -- Sample 4: Recently submitted
  (
    'd4e5f6g7-h8i9-0123-defg-456789012345',
    'HTSF-KW-004-cDNA',
    'HTSF--KW-[TRANSCRIPT]',
    'Dr. Karen Williams',
    'karen.williams@ncsu.edu',
    'Williams Plant Biology Lab',
    'cDNA library',
    'TE Buffer',
    65.3,
    35.0,
    2285.5,
    'R9.4.1',
    1,
    'submitted',
    'normal',
    NULL,
    NULL,
    NOW() - INTERVAL '1 day',
    NULL,
    NULL,
    'demo-user'
  ),
  
  -- Sample 5: Large genome project
  (
    'e5f6g7h8-i9j0-1234-efgh-567890123456',
    'HTSF-RD-005-HMW',
    'HTSF--RD-[ASSEMBLY]',
    'Dr. Robert Davis',
    'robert.davis@unc.edu',
    'Davis Evolutionary Biology Lab',
    'High molecular weight DNA',
    'Tris-EDTA',
    95.7,
    40.0,
    3828.0,
    'R10.4.1',
    3,
    'analysis',
    'high',
    'Jenny Smith',
    'jenny-smith',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '6 days',
    NULL,
    'demo-user'
  ),
  
  -- Sample 6: Archived sample
  (
    'f6g7h8i9-j0k1-2345-fghi-678901234567',
    'HTSF-AL-006-DNA',
    'HTSF--AL-[VARIANT]',
    'Dr. Amanda Lee',
    'amanda.lee@unc.edu',
    'Lee Medical Genetics Lab',
    'Genomic DNA',
    'TE Buffer',
    78.4,
    28.0,
    2195.2,
    'R9.4.1',
    1,
    'archived',
    'low',
    'Grey Wilson',
    'grey-wilson',
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '13 days',
    NOW() - INTERVAL '10 days',
    'demo-user'
  );

-- Insert sample details
INSERT INTO nanopore_sample_details (
  sample_id, organism, genome_size, expected_read_length, library_prep_kit,
  barcoding_required, barcode_kit, run_time_hours, basecalling_model,
  data_delivery_method, file_format, analysis_required, analysis_type,
  qc_passed, qc_notes, special_instructions, internal_notes
) VALUES 
  -- Details for Sample 1
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Drosophila melanogaster',
    'Small (< 1 Gb)',
    'Long (> 10 kb)',
    'SQK-LSK114',
    false,
    NULL,
    24,
    'dna_r10.4.1_e8.2_400bps_hac',
    'Cloud storage',
    'FASTQ + POD5',
    true,
    'De novo genome assembly',
    true,
    'Excellent DNA quality, A260/A280 = 1.85',
    'High priority for publication deadline',
    'Completed successfully, data delivered to iLab'
  ),
  
  -- Details for Sample 2
  (
    'b2c3d4e5-f6g7-8901-bcde-f23456789012',
    'Homo sapiens',
    'Large (> 3 Gb)',
    'Long (> 10 kb)',
    'SQK-RNA002',
    true,
    'EXP-NBD196',
    48,
    'rna_r9.4.1_e8.2_260bps_hac',
    'Download portal',
    'FASTQ',
    true,
    'Differential expression analysis',
    true,
    'RIN = 8.5, good RNA integrity',
    'Dual flow cells for increased throughput',
    'Currently sequencing on MinION Mk1C'
  ),
  
  -- Details for Sample 3
  (
    'c3d4e5f6-g7h8-9012-cdef-345678901234',
    'Escherichia coli',
    'Small (< 1 Gb)',
    'Ultra-long (> 100 kb)',
    'SQK-LSK114',
    false,
    NULL,
    12,
    'dna_r10.4.1_e8.2_400bps_sup',
    'Cloud storage',
    'FASTQ + FAST5',
    true,
    'Variant calling and annotation',
    NULL,
    NULL,
    'URGENT: Required for grant submission',
    'Library prep in progress, excellent DNA quality'
  ),
  
  -- Details for Sample 4
  (
    'd4e5f6g7-h8i9-0123-defg-456789012345',
    'Arabidopsis thaliana',
    'Small (< 1 Gb)',
    'Long (> 10 kb)',
    'SQK-LSK114',
    false,
    NULL,
    24,
    'dna_r10.4.1_e8.2_400bps_hac',
    'Download portal',
    'FASTQ',
    false,
    NULL,
    NULL,
    NULL,
    'Standard processing, no rush',
    'Awaiting assignment to technician'
  ),
  
  -- Details for Sample 5
  (
    'e5f6g7h8-i9j0-1234-efgh-567890123456',
    'Caenorhabditis elegans',
    'Small (< 1 Gb)',
    'Ultra-long (> 100 kb)',
    'SQK-LSK114',
    true,
    'EXP-NBD196',
    72,
    'dna_r10.4.1_e8.2_400bps_sup',
    'Cloud storage',
    'FASTQ + POD5 + FAST5',
    true,
    'Chromosome-level assembly',
    true,
    'Excellent HMW DNA, average fragment size > 50kb',
    'Triple flow cell run for maximum coverage',
    'Data analysis in progress, preliminary results look excellent'
  ),
  
  -- Details for Sample 6
  (
    'f6g7h8i9-j0k1-2345-fghi-678901234567',
    'Homo sapiens',
    'Large (> 3 Gb)',
    'Long (> 10 kb)',
    'SQK-LSK109',
    false,
    NULL,
    36,
    'dna_r9.4.1_e8.2_260bps_hac',
    'Physical drive',
    'FASTQ',
    true,
    'Structural variant detection',
    true,
    'Good quality DNA, some fragmentation observed',
    'Legacy sample for comparison study',
    'Archived after successful completion, data backed up to long-term storage'
  );

-- Insert processing steps for each sample
INSERT INTO nanopore_processing_steps (
  sample_id, step_name, step_status, assigned_to, started_at, completed_at,
  estimated_duration_hours, notes, results_data
) VALUES 
  -- Processing steps for Sample 1 (completed)
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sample QC', 'completed', 'Jenny Smith', NOW() - INTERVAL '4 days 8 hours', NOW() - INTERVAL '4 days 6 hours', 2, 'Qubit: 85.5 ng/μL, TapeStation: HMW DNA profile excellent', '{"qubit_concentration": 85.5, "tapestation_profile": "excellent", "a260_a280": 1.85}'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Library Preparation', 'completed', 'Jenny Smith', NOW() - INTERVAL '4 days 6 hours', NOW() - INTERVAL '4 days 2 hours', 4, 'SQK-LSK114 protocol followed, final library concentration 12.3 ng/μL', '{"library_concentration": 12.3, "protocol": "SQK-LSK114", "yield": "excellent"}'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Flow Cell QC', 'completed', 'Jenny Smith', NOW() - INTERVAL '4 days 2 hours', NOW() - INTERVAL '4 days 1 hour', 1, 'Flow cell R10.4.1 - 2,847 active pores', '{"active_pores": 2847, "flow_cell_id": "PAO12345", "qc_passed": true}'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sequencing', 'completed', 'Jenny Smith', NOW() - INTERVAL '4 days 1 hour', NOW() - INTERVAL '1 day 1 hour', 24, '24-hour run completed, 8.5 Gb total output', '{"total_output_gb": 8.5, "n50": 25000, "mean_read_length": 18500, "total_reads": 459000}'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Basecalling', 'completed', 'Auto', NOW() - INTERVAL '1 day 1 hour', NOW() - INTERVAL '1 day', 1, 'HAC basecalling completed, Q20+ = 92.3%', '{"q20_percent": 92.3, "basecaller": "dorado", "model": "dna_r10.4.1_e8.2_400bps_hac"}'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Data Delivery', 'completed', 'System', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 0, 'Files uploaded to iLab portal, user notified', '{"files_delivered": ["fastq_pass.tar.gz", "sequencing_summary.txt", "run_report.html"]}'),
  
  -- Processing steps for Sample 2 (in sequencing)
  ('b2c3d4e5-f6g7-8901-bcde-f23456789012', 'Sample QC', 'completed', 'Grey Wilson', NOW() - INTERVAL '2 days 8 hours', NOW() - INTERVAL '2 days 6 hours', 2, 'RNA integrity excellent, RIN = 8.5', '{"rin_score": 8.5, "concentration": 45.2, "quality": "excellent"}'),
  ('b2c3d4e5-f6g7-8901-bcde-f23456789012', 'Library Preparation', 'completed', 'Grey Wilson', NOW() - INTERVAL '2 days 6 hours', NOW() - INTERVAL '2 days 2 hours', 4, 'SQK-RNA002 direct RNA sequencing prep', '{"library_concentration": 8.7, "protocol": "SQK-RNA002", "barcode_kit": "EXP-NBD196"}'),
  ('b2c3d4e5-f6g7-8901-bcde-f23456789012', 'Flow Cell QC', 'completed', 'Grey Wilson', NOW() - INTERVAL '2 days 2 hours', NOW() - INTERVAL '2 days 1 hour', 1, 'Dual flow cells loaded, FC1: 2,654 pores, FC2: 2,721 pores', '{"flow_cell_1_pores": 2654, "flow_cell_2_pores": 2721, "total_pores": 5375}'),
  ('b2c3d4e5-f6g7-8901-bcde-f23456789012', 'Sequencing', 'in_progress', 'Grey Wilson', NOW() - INTERVAL '2 days 1 hour', NULL, 48, '48-hour run in progress, currently 18 hours elapsed', '{"elapsed_hours": 18, "current_output_gb": 4.2, "estimated_total_gb": 12.5}'),
  ('b2c3d4e5-f6g7-8901-bcde-f23456789012', 'Basecalling', 'pending', NULL, NULL, NULL, 2, NULL, NULL),
  ('b2c3d4e5-f6g7-8901-bcde-f23456789012', 'Data Delivery', 'pending', NULL, NULL, NULL, 1, NULL, NULL),
  
  -- Processing steps for Sample 3 (in prep)
  ('c3d4e5f6-g7h8-9012-cdef-345678901234', 'Sample QC', 'completed', 'Stephanie Jones', NOW() - INTERVAL '1 day 6 hours', NOW() - INTERVAL '1 day 4 hours', 2, 'Excellent HMW DNA, perfect for ultra-long reads', '{"concentration": 120.8, "fragment_size": "> 100kb", "purity": "excellent"}'),
  ('c3d4e5f6-g7h8-9012-cdef-345678901234', 'Library Preparation', 'in_progress', 'Stephanie Jones', NOW() - INTERVAL '1 day 4 hours', NULL, 4, 'SQK-LSK114 prep in progress, currently at adapter ligation step', '{"current_step": "adapter_ligation", "estimated_completion": "2 hours"}'),
  ('c3d4e5f6-g7h8-9012-cdef-345678901234', 'Flow Cell QC', 'pending', 'Stephanie Jones', NULL, NULL, 1, NULL, NULL),
  ('c3d4e5f6-g7h8-9012-cdef-345678901234', 'Sequencing', 'pending', 'Stephanie Jones', NULL, NULL, 12, NULL, NULL),
  ('c3d4e5f6-g7h8-9012-cdef-345678901234', 'Basecalling', 'pending', NULL, NULL, NULL, 1, NULL, NULL),
  ('c3d4e5f6-g7h8-9012-cdef-345678901234', 'Data Delivery', 'pending', NULL, NULL, NULL, 1, NULL, NULL),
  
  -- Processing steps for Sample 4 (submitted)
  ('d4e5f6g7-h8i9-0123-defg-456789012345', 'Sample QC', 'pending', NULL, NULL, NULL, 2, NULL, NULL),
  ('d4e5f6g7-h8i9-0123-defg-456789012345', 'Library Preparation', 'pending', NULL, NULL, NULL, 4, NULL, NULL),
  ('d4e5f6g7-h8i9-0123-defg-456789012345', 'Flow Cell QC', 'pending', NULL, NULL, NULL, 1, NULL, NULL),
  ('d4e5f6g7-h8i9-0123-defg-456789012345', 'Sequencing', 'pending', NULL, NULL, NULL, 24, NULL, NULL),
  ('d4e5f6g7-h8i9-0123-defg-456789012345', 'Basecalling', 'pending', NULL, NULL, NULL, 2, NULL, NULL),
  ('d4e5f6g7-h8i9-0123-defg-456789012345', 'Data Delivery', 'pending', NULL, NULL, NULL, 1, NULL, NULL),
  
  -- Processing steps for Sample 5 (in analysis)
  ('e5f6g7h8-i9j0-1234-efgh-567890123456', 'Sample QC', 'completed', 'Jenny Smith', NOW() - INTERVAL '6 days 8 hours', NOW() - INTERVAL '6 days 6 hours', 2, 'Outstanding HMW DNA quality, perfect for chromosome-level assembly', '{"concentration": 95.7, "fragment_size": "> 50kb", "purity": "outstanding"}'),
  ('e5f6g7h8-i9j0-1234-efgh-567890123456', 'Library Preparation', 'completed', 'Jenny Smith', NOW() - INTERVAL '6 days 6 hours', NOW() - INTERVAL '6 days 2 hours', 4, 'Triple library prep for 3 flow cells, barcoded', '{"libraries_prepared": 3, "barcode_kit": "EXP-NBD196", "concentrations": [15.2, 14.8, 15.5]}'),
  ('e5f6g7h8-i9j0-1234-efgh-567890123456', 'Flow Cell QC', 'completed', 'Jenny Smith', NOW() - INTERVAL '6 days 2 hours', NOW() - INTERVAL '6 days 1 hour', 1, 'All 3 flow cells passed QC with >2,500 active pores each', '{"flow_cell_1_pores": 2654, "flow_cell_2_pores": 2721, "flow_cell_3_pores": 2598}'),
  ('e5f6g7h8-i9j0-1234-efgh-567890123456', 'Sequencing', 'completed', 'Jenny Smith', NOW() - INTERVAL '6 days 1 hour', NOW() - INTERVAL '3 days 1 hour', 72, '72-hour run completed across 3 flow cells, 28.7 Gb total output', '{"total_output_gb": 28.7, "n50": 45000, "mean_read_length": 32000, "total_reads": 896000}'),
  ('e5f6g7h8-i9j0-1234-efgh-567890123456', 'Basecalling', 'completed', 'Auto', NOW() - INTERVAL '3 days 1 hour', NOW() - INTERVAL '3 days', 1, 'SUP basecalling completed, Q20+ = 94.7%', '{"q20_percent": 94.7, "basecaller": "dorado", "model": "dna_r10.4.1_e8.2_400bps_sup"}'),
  ('e5f6g7h8-i9j0-1234-efgh-567890123456', 'Data Analysis', 'in_progress', 'Bioinformatics Team', NOW() - INTERVAL '3 days', NULL, 48, 'Chromosome-level assembly in progress using Flye + Medaka', '{"assembly_status": "scaffolding", "estimated_completion": "24 hours", "current_contigs": 847}'),
  
  -- Processing steps for Sample 6 (archived)
  ('f6g7h8i9-j0k1-2345-fghi-678901234567', 'Sample QC', 'completed', 'Grey Wilson', NOW() - INTERVAL '13 days 8 hours', NOW() - INTERVAL '13 days 6 hours', 2, 'Good quality DNA with some fragmentation', '{"concentration": 78.4, "fragment_size": "10-50kb", "purity": "good"}'),
  ('f6g7h8i9-j0k1-2345-fghi-678901234567', 'Library Preparation', 'completed', 'Grey Wilson', NOW() - INTERVAL '13 days 6 hours', NOW() - INTERVAL '13 days 2 hours', 4, 'SQK-LSK109 protocol (legacy kit)', '{"library_concentration": 9.8, "protocol": "SQK-LSK109", "yield": "good"}'),
  ('f6g7h8i9-j0k1-2345-fghi-678901234567', 'Flow Cell QC', 'completed', 'Grey Wilson', NOW() - INTERVAL '13 days 2 hours', NOW() - INTERVAL '13 days 1 hour', 1, 'R9.4.1 flow cell - 2,234 active pores', '{"active_pores": 2234, "flow_cell_id": "PAD98765", "qc_passed": true}'),
  ('f6g7h8i9-j0k1-2345-fghi-678901234567', 'Sequencing', 'completed', 'Grey Wilson', NOW() - INTERVAL '13 days 1 hour', NOW() - INTERVAL '11 days 1 hour', 36, '36-hour run completed, 6.2 Gb total output', '{"total_output_gb": 6.2, "n50": 12000, "mean_read_length": 8500, "total_reads": 729000}'),
  ('f6g7h8i9-j0k1-2345-fghi-678901234567', 'Basecalling', 'completed', 'Auto', NOW() - INTERVAL '11 days 1 hour', NOW() - INTERVAL '11 days', 1, 'HAC basecalling completed, Q20+ = 89.1%', '{"q20_percent": 89.1, "basecaller": "guppy", "model": "dna_r9.4.1_e8.2_260bps_hac"}'),
  ('f6g7h8i9-j0k1-2345-fghi-678901234567', 'Data Analysis', 'completed', 'Bioinformatics Team', NOW() - INTERVAL '11 days', NOW() - INTERVAL '10 days', 24, 'Structural variant analysis completed', '{"variants_detected": 1247, "large_svs": 89, "analysis_complete": true}'),
  ('f6g7h8i9-j0k1-2345-fghi-678901234567', 'Data Delivery', 'completed', 'System', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', 0, 'Data delivered to physical drive and archived', '{"delivery_method": "physical_drive", "archived": true}');

-- Insert some file attachments
INSERT INTO nanopore_attachments (
  sample_id, file_name, file_type, file_size_bytes, file_path, description, uploaded_by
) VALUES 
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'HTSF-CJ-001-submission-form.pdf', 'pdf', 245760, '/attachments/samples/a1b2c3d4-e5f6-7890-abcd-ef1234567890/submission-form.pdf', 'Original submission form from iLab', 'demo-user'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'run-report-PAO12345.html', 'html', 1024000, '/attachments/samples/a1b2c3d4-e5f6-7890-abcd-ef1234567890/run-report.html', 'MinKNOW run report', 'jenny-smith'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'assembly-stats.txt', 'txt', 8192, '/attachments/samples/a1b2c3d4-e5f6-7890-abcd-ef1234567890/assembly-stats.txt', 'Final assembly statistics', 'demo-user'),
  
  ('b2c3d4e5-f6g7-8901-bcde-f23456789012', 'HTSF-ML-002-submission-form.pdf', 'pdf', 198432, '/attachments/samples/b2c3d4e5-f6g7-8901-bcde-f23456789012/submission-form.pdf', 'RNA-seq submission form', 'demo-user'),
  ('b2c3d4e5-f6g7-8901-bcde-f23456789012', 'bioanalyzer-rna-profile.pdf', 'pdf', 512000, '/attachments/samples/b2c3d4e5-f6g7-8901-bcde-f23456789012/bioanalyzer-profile.pdf', 'RNA quality assessment', 'grey-wilson'),
  
  ('c3d4e5f6-g7h8-9012-cdef-345678901234', 'HTSF-TB-003-submission-form.pdf', 'pdf', 223456, '/attachments/samples/c3d4e5f6-g7h8-9012-cdef-345678901234/submission-form.pdf', 'Urgent genome sequencing request', 'demo-user'),
  ('c3d4e5f6-g7h8-9012-cdef-345678901234', 'dna-quality-check.xlsx', 'xlsx', 45678, '/attachments/samples/c3d4e5f6-g7h8-9012-cdef-345678901234/quality-check.xlsx', 'Qubit and TapeStation results', 'stephanie-jones'),
  
  ('e5f6g7h8-i9j0-1234-efgh-567890123456', 'HTSF-RD-005-submission-form.pdf', 'pdf', 267890, '/attachments/samples/e5f6g7h8-i9j0-1234-efgh-567890123456/submission-form.pdf', 'Chromosome-level assembly project', 'demo-user'),
  ('e5f6g7h8-i9j0-1234-efgh-567890123456', 'preliminary-assembly-report.pdf', 'pdf', 1536000, '/attachments/samples/e5f6g7h8-i9j0-1234-efgh-567890123456/assembly-report.pdf', 'Preliminary assembly results', 'demo-user'),
  
  ('f6g7h8i9-j0k1-2345-fghi-678901234567', 'HTSF-AL-006-submission-form.pdf', 'pdf', 189234, '/attachments/samples/f6g7h8i9-j0k1-2345-fghi-678901234567/submission-form.pdf', 'Medical genetics variant calling project', 'demo-user'),
  ('f6g7h8i9-j0k1-2345-fghi-678901234567', 'structural-variants-report.vcf', 'vcf', 2048000, '/attachments/samples/f6g7h8i9-j0k1-2345-fghi-678901234567/variants.vcf', 'Final structural variant calls', 'demo-user');


