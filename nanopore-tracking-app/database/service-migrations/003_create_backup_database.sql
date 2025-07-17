-- Migration: Backup Service Database Schema
-- Creates tables for backup job management, scheduling, and metadata tracking

-- Backup jobs table
CREATE TABLE backup_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(20) NOT NULL CHECK (job_type IN ('full', 'incremental', 'differential')),
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'running', 'completed', 'failed')),
    source_database VARCHAR(100) NOT NULL,
    backup_location VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    compression_enabled BOOLEAN NOT NULL DEFAULT true,
    encryption_enabled BOOLEAN NOT NULL DEFAULT false,
    checksum VARCHAR(64), -- SHA-256 hash
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backup schedules table
CREATE TABLE backup_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    cron_expression VARCHAR(100) NOT NULL,
    backup_type VARCHAR(20) NOT NULL CHECK (backup_type IN ('full', 'incremental', 'differential')),
    retention_days INTEGER NOT NULL CHECK (retention_days > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backup metadata table
CREATE TABLE backup_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_job_id UUID NOT NULL REFERENCES backup_jobs(id) ON DELETE CASCADE,
    table_name VARCHAR(100) NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0,
    file_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_backup_jobs_status ON backup_jobs(status);
CREATE INDEX idx_backup_jobs_type ON backup_jobs(job_type);
CREATE INDEX idx_backup_jobs_source_db ON backup_jobs(source_database);
CREATE INDEX idx_backup_jobs_created_at ON backup_jobs(created_at);
CREATE INDEX idx_backup_jobs_completed_at ON backup_jobs(completed_at);

CREATE INDEX idx_backup_schedules_name ON backup_schedules(name);
CREATE INDEX idx_backup_schedules_active ON backup_schedules(is_active);
CREATE INDEX idx_backup_schedules_next_run ON backup_schedules(next_run);
CREATE INDEX idx_backup_schedules_type ON backup_schedules(backup_type);

CREATE INDEX idx_backup_metadata_job_id ON backup_metadata(backup_job_id);
CREATE INDEX idx_backup_metadata_table ON backup_metadata(table_name);

-- Create trigger function for automatic timestamp updates
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER set_timestamp_backup_jobs
    BEFORE UPDATE ON backup_jobs
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_backup_schedules
    BEFORE UPDATE ON backup_schedules
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Insert default backup schedules
INSERT INTO backup_schedules (name, cron_expression, backup_type, retention_days) VALUES
('daily_full_backup', '0 2 * * *', 'full', 7), -- Daily full backup at 2 AM, keep for 7 days
('weekly_archive', '0 3 * * 0', 'full', 30), -- Weekly full backup on Sunday at 3 AM, keep for 30 days
('monthly_archive', '0 4 1 * *', 'full', 365), -- Monthly full backup on 1st at 4 AM, keep for 1 year
('hourly_incremental', '0 * * * *', 'incremental', 1); -- Hourly incremental backup, keep for 1 day

-- Comments for documentation
COMMENT ON TABLE backup_jobs IS 'Individual backup job execution records';
COMMENT ON TABLE backup_schedules IS 'Automated backup schedule definitions';
COMMENT ON TABLE backup_metadata IS 'Detailed metadata for backup job contents';

COMMENT ON COLUMN backup_jobs.job_type IS 'Type of backup: full, incremental, or differential';
COMMENT ON COLUMN backup_jobs.checksum IS 'SHA-256 checksum of the backup file for integrity verification';
COMMENT ON COLUMN backup_schedules.cron_expression IS 'Cron expression defining the backup schedule';
COMMENT ON COLUMN backup_schedules.retention_days IS 'Number of days to retain backups created by this schedule';
COMMENT ON COLUMN backup_metadata.record_count IS 'Number of records backed up from this table'; 