-- Migration: Config Service Database Schema
-- Creates tables for application configuration, feature flags, and configuration history

-- Application configurations table
CREATE TABLE application_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT NOT NULL,
    environment VARCHAR(20) NOT NULL CHECK (environment IN ('development', 'staging', 'production', 'test')),
    is_encrypted BOOLEAN NOT NULL DEFAULT false,
    is_sensitive BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique config keys per environment
    UNIQUE(config_key, environment)
);

-- Feature flags table
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    environment VARCHAR(20) NOT NULL CHECK (environment IN ('development', 'staging', 'production', 'test')),
    rollout_percentage INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    conditions JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique flag names per environment
    UNIQUE(flag_name, environment)
);

-- Configuration history table
CREATE TABLE config_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    changed_by UUID NOT NULL,
    change_reason TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_application_configs_key ON application_configs(config_key);
CREATE INDEX idx_application_configs_environment ON application_configs(environment);
CREATE INDEX idx_application_configs_sensitive ON application_configs(is_sensitive);
CREATE INDEX idx_application_configs_created_at ON application_configs(created_at);

CREATE INDEX idx_feature_flags_name ON feature_flags(flag_name);
CREATE INDEX idx_feature_flags_environment ON feature_flags(environment);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(is_enabled);
CREATE INDEX idx_feature_flags_rollout ON feature_flags(rollout_percentage);

CREATE INDEX idx_config_history_key ON config_history(config_key);
CREATE INDEX idx_config_history_changed_by ON config_history(changed_by);
CREATE INDEX idx_config_history_timestamp ON config_history(timestamp);

-- Create trigger function for automatic timestamp updates
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER set_timestamp_application_configs
    BEFORE UPDATE ON application_configs
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_feature_flags
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Trigger to log configuration changes
CREATE OR REPLACE FUNCTION log_config_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO config_history (config_key, old_value, new_value, changed_by, change_reason)
  VALUES (
    NEW.config_key,
    OLD.config_value,
    NEW.config_value,
    '550e8400-e29b-41d4-a716-446655440000', -- System user UUID
    'Configuration updated'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_config_changes
    AFTER UPDATE ON application_configs
    FOR EACH ROW
    WHEN (OLD.config_value IS DISTINCT FROM NEW.config_value)
    EXECUTE PROCEDURE log_config_change();

-- Insert default application configurations
INSERT INTO application_configs (config_key, config_value, environment, is_sensitive, description) VALUES
-- Database configurations
('database.max_connections', '20', 'production', false, 'Maximum database connections per service'),
('database.connection_timeout', '10000', 'production', false, 'Database connection timeout in milliseconds'),
('database.idle_timeout', '30000', 'production', false, 'Database idle timeout in milliseconds'),

-- AI service configurations
('ai.ollama_host', 'http://localhost:11434', 'production', false, 'Ollama AI service host URL'),
('ai.default_model', 'llama2', 'production', false, 'Default AI model for processing'),
('ai.max_processing_time', '300000', 'production', false, 'Maximum AI processing time in milliseconds'),
('ai.confidence_threshold', '0.7', 'production', false, 'Minimum confidence threshold for AI results'),

-- Backup configurations
('backup.retention_days', '30', 'production', false, 'Default backup retention period in days'),
('backup.compression_enabled', 'true', 'production', false, 'Enable backup compression'),
('backup.encryption_enabled', 'true', 'production', false, 'Enable backup encryption'),
('backup.max_parallel_jobs', '3', 'production', false, 'Maximum parallel backup jobs'),

-- Security configurations
('security.session_timeout', '3600', 'production', false, 'Session timeout in seconds'),
('security.max_login_attempts', '5', 'production', false, 'Maximum login attempts before lockout'),
('security.lockout_duration', '900', 'production', false, 'Account lockout duration in seconds'),

-- Application configurations
('app.max_file_size', '10485760', 'production', false, 'Maximum file upload size in bytes (10MB)'),
('app.supported_file_types', 'pdf,xlsx,csv,txt', 'production', false, 'Supported file types for upload'),
('app.default_priority', 'normal', 'production', false, 'Default sample priority'),

-- Monitoring configurations
('monitoring.metrics_enabled', 'true', 'production', false, 'Enable metrics collection'),
('monitoring.health_check_interval', '30', 'production', false, 'Health check interval in seconds'),
('monitoring.alert_threshold', '0.8', 'production', false, 'Alert threshold for resource usage');

-- Insert default feature flags
INSERT INTO feature_flags (flag_name, is_enabled, environment, rollout_percentage, description) VALUES
('ai_processing_enabled', true, 'production', 100, 'Enable AI-powered PDF processing'),
('rag_enhancement', false, 'production', 0, 'Enable RAG system for enhanced data extraction'),
('advanced_analytics', false, 'production', 10, 'Enable advanced analytics dashboard'),
('real_time_notifications', true, 'production', 100, 'Enable real-time notifications'),
('backup_encryption', true, 'production', 100, 'Enable backup encryption by default'),
('audit_detailed_logging', true, 'production', 100, 'Enable detailed audit logging'),
('performance_monitoring', true, 'production', 100, 'Enable performance monitoring'),
('experimental_features', false, 'production', 0, 'Enable experimental features for testing');

-- Comments for documentation
COMMENT ON TABLE application_configs IS 'Application configuration settings by environment';
COMMENT ON TABLE feature_flags IS 'Feature flags for gradual rollout and A/B testing';
COMMENT ON TABLE config_history IS 'Historical record of configuration changes';

COMMENT ON COLUMN application_configs.is_encrypted IS 'Whether the config value is encrypted at rest';
COMMENT ON COLUMN application_configs.is_sensitive IS 'Whether the config contains sensitive information';
COMMENT ON COLUMN feature_flags.rollout_percentage IS 'Percentage of users who see this feature (0-100)';
COMMENT ON COLUMN feature_flags.conditions IS 'Additional conditions for feature flag evaluation';
COMMENT ON COLUMN config_history.change_reason IS 'Reason for the configuration change'; 