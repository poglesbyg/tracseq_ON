-- Migration: Nanopore Sample Tracking Schema
-- Creates tables for Oxford Nanopore sequencing sample management

-- Nanopore samples table - main tracking entity
CREATE TABLE nanopore_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic sample information
    sample_name VARCHAR(255) NOT NULL,
    project_id VARCHAR(100), -- Service Project ID from iLab
    submitter_name VARCHAR(255) NOT NULL,
    submitter_email VARCHAR(255) NOT NULL,
    lab_name VARCHAR(255),
    
    -- Sample details
    sample_type VARCHAR(50) NOT NULL, -- DNA, RNA, etc.
    sample_buffer VARCHAR(100), -- Buffer type
    concentration DECIMAL(10,3), -- ng/μL
    volume DECIMAL(10,2), -- μL
    total_amount DECIMAL(10,3), -- ng (calculated)
    
    -- Flow cell selection
    flow_cell_type VARCHAR(50), -- R9.4.1, R10.4.1, etc.
    flow_cell_count INTEGER DEFAULT 1,
    
    -- Processing status
    status VARCHAR(20) DEFAULT 'submitted', -- submitted, prep, sequencing, analysis, completed, archived
    priority VARCHAR(10) DEFAULT 'normal', -- low, normal, high, urgent
    
    -- Assignment and tracking
    assigned_to VARCHAR(255), -- Staff member assigned
    library_prep_by VARCHAR(255), -- Grey, Stephanie, Jenny, etc.
    
    -- Timestamps
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- User tracking
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('submitted', 'prep', 'sequencing', 'analysis', 'completed', 'archived')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CONSTRAINT valid_concentration CHECK (concentration IS NULL OR concentration > 0),
    CONSTRAINT valid_volume CHECK (volume IS NULL OR volume > 0)
);

-- Sample details table - additional form fields and metadata
CREATE TABLE nanopore_sample_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id UUID NOT NULL REFERENCES nanopore_samples(id) ON DELETE CASCADE,
    
    -- Detailed sample information
    organism VARCHAR(100),
    genome_size VARCHAR(50), -- e.g., "3.2 Gb", "Small (< 1 Gb)"
    expected_read_length VARCHAR(50), -- e.g., "Long (> 10 kb)", "Ultra-long (> 100 kb)"
    
    -- Library preparation details
    library_prep_kit VARCHAR(100), -- SQK-LSK114, etc.
    barcoding_required BOOLEAN DEFAULT false,
    barcode_kit VARCHAR(100),
    
    -- Sequencing parameters
    run_time_hours INTEGER, -- Expected sequencing time
    basecalling_model VARCHAR(100), -- Guppy model version
    
    -- Data delivery preferences
    data_delivery_method VARCHAR(50), -- download, cloud, physical
    file_format VARCHAR(50), -- FASTQ, FAST5, POD5
    analysis_required BOOLEAN DEFAULT false,
    analysis_type VARCHAR(100), -- Assembly, variant calling, etc.
    
    -- Quality metrics (filled during processing)
    qc_passed BOOLEAN,
    qc_notes TEXT,
    
    -- Additional metadata
    special_instructions TEXT,
    internal_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Processing steps table - tracks workflow progression
CREATE TABLE nanopore_processing_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id UUID NOT NULL REFERENCES nanopore_samples(id) ON DELETE CASCADE,
    
    -- Step information
    step_name VARCHAR(100) NOT NULL, -- "Library Prep", "QC Check", "Sequencing", etc.
    step_status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, failed, skipped
    
    -- Personnel and timing
    assigned_to VARCHAR(255),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_duration_hours INTEGER,
    
    -- Step details
    notes TEXT,
    results_data JSONB, -- Flexible storage for step-specific data
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_step_status CHECK (step_status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped'))
);

-- File attachments table - for storing related documents
CREATE TABLE nanopore_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id UUID NOT NULL REFERENCES nanopore_samples(id) ON DELETE CASCADE,
    
    -- File information
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50), -- pdf, xlsx, txt, etc.
    file_size_bytes BIGINT,
    file_path VARCHAR(500), -- Storage path or URL
    
    -- Metadata
    description TEXT,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_nanopore_samples_status ON nanopore_samples(status);
CREATE INDEX idx_nanopore_samples_priority ON nanopore_samples(priority);
CREATE INDEX idx_nanopore_samples_assigned_to ON nanopore_samples(assigned_to);
CREATE INDEX idx_nanopore_samples_created_by ON nanopore_samples(created_by);
CREATE INDEX idx_nanopore_samples_submitted_at ON nanopore_samples(submitted_at);

CREATE INDEX idx_nanopore_sample_details_sample_id ON nanopore_sample_details(sample_id);
CREATE INDEX idx_nanopore_processing_steps_sample_id ON nanopore_processing_steps(sample_id);
CREATE INDEX idx_nanopore_processing_steps_status ON nanopore_processing_steps(step_status);
CREATE INDEX idx_nanopore_attachments_sample_id ON nanopore_attachments(sample_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER set_timestamp_nanopore_samples
    BEFORE UPDATE ON nanopore_samples
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_nanopore_sample_details
    BEFORE UPDATE ON nanopore_sample_details
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_nanopore_processing_steps
    BEFORE UPDATE ON nanopore_processing_steps
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Comments for documentation
COMMENT ON TABLE nanopore_samples IS 'Main table for tracking Oxford Nanopore sequencing samples';
COMMENT ON TABLE nanopore_sample_details IS 'Extended details and metadata for Nanopore samples';
COMMENT ON TABLE nanopore_processing_steps IS 'Workflow steps and progress tracking';
COMMENT ON TABLE nanopore_attachments IS 'File attachments related to samples';

COMMENT ON COLUMN nanopore_samples.status IS 'Current processing status of the sample';
COMMENT ON COLUMN nanopore_samples.priority IS 'Processing priority level';
COMMENT ON COLUMN nanopore_samples.assigned_to IS 'Staff member currently responsible for the sample';
COMMENT ON COLUMN nanopore_sample_details.analysis_required IS 'Whether bioinformatics analysis is requested';
COMMENT ON COLUMN nanopore_processing_steps.results_data IS 'Flexible JSONB storage for step-specific results and metrics';