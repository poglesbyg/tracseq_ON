-- Migration: CRISPR Design Studio Schema
-- Creates tables for sequences, experiments, guide RNAs, and off-target analysis

-- Experiments table - tracks user CRISPR design projects
CREATE TABLE experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_organism VARCHAR(100),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Experiment metadata
    experiment_type VARCHAR(50) DEFAULT 'knockout', -- knockout, knockin, screening
    status VARCHAR(20) DEFAULT 'draft' -- draft, analyzing, completed, archived
);

-- Sequences table - stores input DNA sequences for analysis
CREATE TABLE sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sequence TEXT NOT NULL, -- The actual DNA sequence
    sequence_type VARCHAR(20) DEFAULT 'genomic', -- genomic, cdna, custom
    organism VARCHAR(100),
    chromosome VARCHAR(10),
    start_position BIGINT,
    end_position BIGINT,
    strand CHAR(1) CHECK (strand IN ('+', '-')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Validation constraints
    CONSTRAINT valid_sequence CHECK (sequence ~ '^[ATCGN]+$'),
    CONSTRAINT valid_positions CHECK (start_position IS NULL OR end_position IS NULL OR start_position <= end_position)
);

-- Guide RNAs table - stores designed guide RNAs with scoring data
CREATE TABLE guide_rnas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    guide_sequence VARCHAR(23) NOT NULL, -- 20bp guide + PAM
    pam_sequence VARCHAR(8) NOT NULL,
    target_position INTEGER NOT NULL, -- Position in the target sequence
    strand CHAR(1) NOT NULL CHECK (strand IN ('+', '-')),
    
    -- Scoring metrics
    efficiency_score DECIMAL(5,4), -- 0.0000 to 1.0000
    specificity_score DECIMAL(5,4),
    on_target_score DECIMAL(5,4),
    gc_content DECIMAL(5,2),
    
    -- Additional metadata
    algorithm_used VARCHAR(50), -- Which algorithm generated this guide
    algorithm_version VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Validation
    CONSTRAINT valid_guide_sequence CHECK (guide_sequence ~ '^[ATCG]+$'),
    CONSTRAINT valid_pam CHECK (pam_sequence ~ '^[ATCG]+$'),
    CONSTRAINT valid_scores CHECK (
        (efficiency_score IS NULL OR efficiency_score BETWEEN 0 AND 1) AND
        (specificity_score IS NULL OR specificity_score BETWEEN 0 AND 1) AND
        (on_target_score IS NULL OR on_target_score BETWEEN 0 AND 1) AND
        (gc_content IS NULL OR gc_content BETWEEN 0 AND 100)
    )
);

-- Off-target sites table - predicted off-target binding sites
CREATE TABLE off_target_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_rna_id UUID NOT NULL REFERENCES guide_rnas(id) ON DELETE CASCADE,
    chromosome VARCHAR(10),
    position BIGINT,
    strand CHAR(1) CHECK (strand IN ('+', '-')),
    sequence VARCHAR(23) NOT NULL,
    mismatch_count INTEGER NOT NULL DEFAULT 0,
    mismatch_positions INTEGER[], -- Array of mismatch positions
    
    -- Risk scoring
    binding_score DECIMAL(5,4), -- Predicted binding affinity
    cutting_score DECIMAL(5,4), -- Predicted cutting probability
    annotation VARCHAR(500), -- Gene/feature information
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Validation
    CONSTRAINT valid_off_target_sequence CHECK (sequence ~ '^[ATCG]+$'),
    CONSTRAINT valid_off_target_scores CHECK (
        (binding_score IS NULL OR binding_score BETWEEN 0 AND 1) AND
        (cutting_score IS NULL OR cutting_score BETWEEN 0 AND 1)
    )
);

-- Analysis results table - stores computational analysis results
CREATE TABLE analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL, -- guide_design, off_target_analysis, efficiency_prediction
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed
    
    -- Results data
    results_data JSONB, -- Flexible storage for analysis results
    error_message TEXT,
    
    -- Metadata
    algorithm_used VARCHAR(50),
    parameters JSONB, -- Algorithm parameters used
    computation_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_experiments_created_by ON experiments(created_by);
CREATE INDEX idx_experiments_status ON experiments(status);

CREATE INDEX idx_sequences_experiment_id ON sequences(experiment_id);
CREATE INDEX idx_sequences_organism ON sequences(organism);

CREATE INDEX idx_guide_rnas_sequence_id ON guide_rnas(sequence_id);
CREATE INDEX idx_guide_rnas_efficiency_score ON guide_rnas(efficiency_score DESC);
CREATE INDEX idx_guide_rnas_specificity_score ON guide_rnas(specificity_score DESC);

CREATE INDEX idx_off_target_sites_guide_rna_id ON off_target_sites(guide_rna_id);
CREATE INDEX idx_off_target_sites_binding_score ON off_target_sites(binding_score DESC);
CREATE INDEX idx_off_target_sites_chromosome_position ON off_target_sites(chromosome, position);

CREATE INDEX idx_analysis_results_experiment_id ON analysis_results(experiment_id);
CREATE INDEX idx_analysis_results_status ON analysis_results(status);
CREATE INDEX idx_analysis_results_analysis_type ON analysis_results(analysis_type);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_experiments_updated_at BEFORE UPDATE ON experiments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Down Migration
