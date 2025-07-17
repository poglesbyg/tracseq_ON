-- Migration: Audit Service Database Schema
-- Creates tables for audit logging, compliance reporting, and retention policies

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compliance reports table
CREATE TABLE compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type VARCHAR(50) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    generated_by UUID NOT NULL,
    data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Retention policies table
CREATE TABLE retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type VARCHAR(50) NOT NULL UNIQUE,
    retention_days INTEGER NOT NULL CHECK (retention_days > 0),
    archive_after_days INTEGER CHECK (archive_after_days IS NULL OR archive_after_days > 0),
    delete_after_days INTEGER CHECK (delete_after_days IS NULL OR delete_after_days > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure logical ordering of retention periods
    CONSTRAINT retention_ordering CHECK (
        (archive_after_days IS NULL OR archive_after_days <= retention_days) AND
        (delete_after_days IS NULL OR delete_after_days >= retention_days)
    )
);

-- Create indexes for performance
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX idx_compliance_reports_type ON compliance_reports(report_type);
CREATE INDEX idx_compliance_reports_period ON compliance_reports(period_start, period_end);
CREATE INDEX idx_compliance_reports_status ON compliance_reports(status);
CREATE INDEX idx_compliance_reports_generated_by ON compliance_reports(generated_by);

CREATE INDEX idx_retention_policies_resource_type ON retention_policies(resource_type);
CREATE INDEX idx_retention_policies_active ON retention_policies(is_active);

-- Create trigger function for automatic timestamp updates
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER set_timestamp_compliance_reports
    BEFORE UPDATE ON compliance_reports
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_retention_policies
    BEFORE UPDATE ON retention_policies
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Insert default retention policies
INSERT INTO retention_policies (resource_type, retention_days, archive_after_days, delete_after_days) VALUES
('audit_logs', 2555, 365, 2555), -- 7 years retention, archive after 1 year
('sample_data', 1825, 365, NULL), -- 5 years retention, archive after 1 year, never delete
('ai_results', 365, 90, 1095), -- 1 year retention, archive after 90 days, delete after 3 years
('backup_metadata', 90, 30, 365), -- 90 days retention, archive after 30 days, delete after 1 year
('compliance_reports', 2555, 365, NULL); -- 7 years retention, archive after 1 year, never delete

-- Comments for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all system activities';
COMMENT ON TABLE compliance_reports IS 'Generated compliance reports for regulatory requirements';
COMMENT ON TABLE retention_policies IS 'Data retention and archival policies by resource type';

COMMENT ON COLUMN audit_logs.event_type IS 'Type of event being audited (e.g., sample.created, user.login)';
COMMENT ON COLUMN audit_logs.details IS 'Additional context and metadata for the audit event';
COMMENT ON COLUMN compliance_reports.data IS 'Report data and findings in JSON format';
COMMENT ON COLUMN retention_policies.retention_days IS 'Number of days to retain data before archival';
COMMENT ON COLUMN retention_policies.archive_after_days IS 'Number of days after which data should be archived';
COMMENT ON COLUMN retention_policies.delete_after_days IS 'Number of days after which data should be deleted'; 