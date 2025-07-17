-- Migration: Create sample tracking table
-- @description: Creates the main sample tracking table for nanopore sequencing samples
-- @author: system
-- @dependencies: 
-- @tags: core, samples, tracking
-- @estimatedDuration: 5000
-- @requiresDowntime: false
-- @backupRequired: true

-- +goose Up
CREATE TABLE IF NOT EXISTS sample_tracking (
    id SERIAL PRIMARY KEY,
    sample_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'submitted',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_by VARCHAR(255),
    assigned_to VARCHAR(255),
    notes TEXT,
    metadata JSONB,
    
    -- Workflow tracking
    workflow_stage VARCHAR(50) NOT NULL DEFAULT 'intake',
    stage_started_at TIMESTAMP,
    estimated_completion TIMESTAMP,
    
    -- Quality control
    qc_passed BOOLEAN DEFAULT false,
    qc_notes TEXT,
    qc_performed_by VARCHAR(255),
    qc_performed_at TIMESTAMP,
    
    -- File tracking
    input_files TEXT[],
    output_files TEXT[],
    
    -- Processing metrics
    processing_time_minutes INTEGER,
    data_size_mb INTEGER,
    read_count INTEGER,
    quality_score DECIMAL(4,2),
    
    CONSTRAINT valid_status CHECK (status IN ('submitted', 'prep', 'sequencing', 'analysis', 'completed', 'archived')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CONSTRAINT valid_workflow_stage CHECK (workflow_stage IN ('intake', 'prep', 'sequencing', 'analysis', 'qc', 'completed', 'archived'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sample_tracking_status ON sample_tracking(status);
CREATE INDEX IF NOT EXISTS idx_sample_tracking_priority ON sample_tracking(priority);
CREATE INDEX IF NOT EXISTS idx_sample_tracking_workflow_stage ON sample_tracking(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_sample_tracking_created_at ON sample_tracking(created_at);
CREATE INDEX IF NOT EXISTS idx_sample_tracking_updated_at ON sample_tracking(updated_at);
CREATE INDEX IF NOT EXISTS idx_sample_tracking_assigned_to ON sample_tracking(assigned_to);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sample_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sample_tracking_updated_at
    BEFORE UPDATE ON sample_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_sample_tracking_updated_at();

-- Insert sample data for testing
INSERT INTO sample_tracking (sample_id, status, priority, submitted_by, notes, workflow_stage) VALUES
('NANO_001', 'submitted', 'normal', 'researcher1', 'Initial sample for testing', 'intake'),
('NANO_002', 'prep', 'high', 'researcher2', 'High priority sample', 'prep'),
('NANO_003', 'sequencing', 'normal', 'researcher1', 'Standard sequencing sample', 'sequencing');

-- +goose Down
-- Drop trigger and function
DROP TRIGGER IF EXISTS trigger_sample_tracking_updated_at ON sample_tracking;
DROP FUNCTION IF EXISTS update_sample_tracking_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_sample_tracking_status;
DROP INDEX IF EXISTS idx_sample_tracking_priority;
DROP INDEX IF EXISTS idx_sample_tracking_workflow_stage;
DROP INDEX IF EXISTS idx_sample_tracking_created_at;
DROP INDEX IF EXISTS idx_sample_tracking_updated_at;
DROP INDEX IF EXISTS idx_sample_tracking_assigned_to;

-- Drop table
DROP TABLE IF EXISTS sample_tracking; 