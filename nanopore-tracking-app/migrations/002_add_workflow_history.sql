-- Migration: Add workflow history tracking
-- @description: Adds a workflow history table to track status changes and stage transitions
-- @author: system
-- @dependencies: 001_create_sample_tracking
-- @tags: workflow, history, tracking
-- @estimatedDuration: 3000
-- @requiresDowntime: false
-- @backupRequired: false

-- +goose Up
CREATE TABLE IF NOT EXISTS workflow_history (
    id SERIAL PRIMARY KEY,
    sample_id VARCHAR(255) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    previous_stage VARCHAR(50),
    new_stage VARCHAR(50) NOT NULL,
    changed_by VARCHAR(255),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT,
    duration_in_stage INTEGER, -- Duration in previous stage in minutes
    notes TEXT,
    metadata JSONB,
    
    -- Reference to the main sample tracking table
    FOREIGN KEY (sample_id) REFERENCES sample_tracking(sample_id) ON DELETE CASCADE,
    
    CONSTRAINT valid_previous_status CHECK (previous_status IS NULL OR previous_status IN ('submitted', 'prep', 'sequencing', 'analysis', 'completed', 'archived')),
    CONSTRAINT valid_new_status CHECK (new_status IN ('submitted', 'prep', 'sequencing', 'analysis', 'completed', 'archived')),
    CONSTRAINT valid_previous_stage CHECK (previous_stage IS NULL OR previous_stage IN ('intake', 'prep', 'sequencing', 'analysis', 'qc', 'completed', 'archived')),
    CONSTRAINT valid_new_stage CHECK (new_stage IN ('intake', 'prep', 'sequencing', 'analysis', 'qc', 'completed', 'archived'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_history_sample_id ON workflow_history(sample_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_changed_at ON workflow_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_workflow_history_new_status ON workflow_history(new_status);
CREATE INDEX IF NOT EXISTS idx_workflow_history_new_stage ON workflow_history(new_stage);
CREATE INDEX IF NOT EXISTS idx_workflow_history_changed_by ON workflow_history(changed_by);

-- Create function to automatically track workflow changes
CREATE OR REPLACE FUNCTION track_workflow_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert if status or stage actually changed
    IF (OLD.status != NEW.status OR OLD.workflow_stage != NEW.workflow_stage) THEN
        INSERT INTO workflow_history (
            sample_id,
            previous_status,
            new_status,
            previous_stage,
            new_stage,
            changed_by,
            changed_at,
            change_reason,
            duration_in_stage
        ) VALUES (
            NEW.sample_id,
            OLD.status,
            NEW.status,
            OLD.workflow_stage,
            NEW.workflow_stage,
            'system', -- This could be enhanced to track actual user
            CURRENT_TIMESTAMP,
            'Automated workflow tracking',
            CASE 
                WHEN OLD.stage_started_at IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - OLD.stage_started_at))/60
                ELSE NULL
            END
        );
        
        -- Update stage_started_at for the new stage
        NEW.stage_started_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically track workflow changes
CREATE TRIGGER trigger_track_workflow_changes
    BEFORE UPDATE ON sample_tracking
    FOR EACH ROW
    EXECUTE FUNCTION track_workflow_changes();

-- Create view for workflow analytics
CREATE VIEW workflow_analytics AS
SELECT 
    wh.sample_id,
    wh.new_status,
    wh.new_stage,
    wh.changed_at,
    wh.duration_in_stage,
    st.priority,
    st.submitted_by,
    st.assigned_to,
    ROW_NUMBER() OVER (PARTITION BY wh.sample_id ORDER BY wh.changed_at) as stage_sequence
FROM workflow_history wh
JOIN sample_tracking st ON wh.sample_id = st.sample_id
ORDER BY wh.sample_id, wh.changed_at;

-- Insert initial workflow history for existing samples
INSERT INTO workflow_history (sample_id, previous_status, new_status, previous_stage, new_stage, changed_by, change_reason)
SELECT 
    sample_id,
    NULL,
    status,
    NULL,
    workflow_stage,
    'system',
    'Initial migration - existing sample'
FROM sample_tracking;

-- +goose Down
-- Drop view
DROP VIEW IF EXISTS workflow_analytics;

-- Drop trigger and function
DROP TRIGGER IF EXISTS trigger_track_workflow_changes ON sample_tracking;
DROP FUNCTION IF EXISTS track_workflow_changes();

-- Drop indexes
DROP INDEX IF EXISTS idx_workflow_history_sample_id;
DROP INDEX IF EXISTS idx_workflow_history_changed_at;
DROP INDEX IF EXISTS idx_workflow_history_new_status;
DROP INDEX IF EXISTS idx_workflow_history_new_stage;
DROP INDEX IF EXISTS idx_workflow_history_changed_by;

-- Drop table
DROP TABLE IF EXISTS workflow_history; 