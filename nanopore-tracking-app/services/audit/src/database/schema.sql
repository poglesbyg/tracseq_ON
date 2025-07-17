-- Audit Service Database Schema
-- Creates tables for comprehensive audit logging, event tracking, and monitoring

-- Audit events table - main audit trail
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event information
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id VARCHAR(255),
    user_email VARCHAR(255),
    service VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    
    -- Event details
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    
    -- Classification
    severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'error', 'critical')),
    category VARCHAR(50) NOT NULL DEFAULT 'system' CHECK (category IN ('authentication', 'authorization', 'data_access', 'data_modification', 'system', 'security')),
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_service CHECK (service ~ '^[a-zA-Z0-9_-]+$'),
    CONSTRAINT valid_action CHECK (action ~ '^[a-zA-Z0-9_-]+$'),
    CONSTRAINT valid_resource CHECK (resource ~ '^[a-zA-Z0-9_-]+$')
);

-- Audit logs table - for application logging
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Log information
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level VARCHAR(10) NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
    message TEXT NOT NULL,
    service VARCHAR(100) NOT NULL,
    
    -- Context information
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    details JSONB DEFAULT '{}',
    stack_trace TEXT,
    tags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_service_log CHECK (service ~ '^[a-zA-Z0-9_-]+$')
);

-- User activities table - for user behavior tracking
CREATE TABLE user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User information
    user_id VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Activity information
    action VARCHAR(100) NOT NULL,
    service VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    
    -- Context information
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    duration INTEGER, -- milliseconds
    success BOOLEAN NOT NULL DEFAULT true,
    details JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_service_activity CHECK (service ~ '^[a-zA-Z0-9_-]+$'),
    CONSTRAINT valid_action_activity CHECK (action ~ '^[a-zA-Z0-9_-]+$'),
    CONSTRAINT valid_resource_activity CHECK (resource ~ '^[a-zA-Z0-9_-]+$'),
    CONSTRAINT valid_duration CHECK (duration IS NULL OR duration >= 0)
);

-- Audit reports table - for scheduled and custom reports
CREATE TABLE audit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Report information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('activity', 'security', 'compliance', 'performance', 'custom')),
    
    -- Configuration
    filters JSONB NOT NULL DEFAULT '{}',
    schedule VARCHAR(100), -- cron expression
    recipients TEXT[],
    format VARCHAR(10) NOT NULL DEFAULT 'json' CHECK (format IN ('json', 'csv', 'pdf')),
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_report_name CHECK (name ~ '^[a-zA-Z0-9 _-]+$')
);

-- Audit alerts table - for real-time alerting
CREATE TABLE audit_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Alert information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    condition JSONB NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    service VARCHAR(100) NOT NULL,
    
    -- Configuration
    is_active BOOLEAN NOT NULL DEFAULT true,
    recipients TEXT[] NOT NULL,
    cooldown_minutes INTEGER NOT NULL DEFAULT 60,
    last_triggered TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_alert_name CHECK (name ~ '^[a-zA-Z0-9 _-]+$'),
    CONSTRAINT valid_service_alert CHECK (service ~ '^[a-zA-Z0-9_-]+$'),
    CONSTRAINT valid_cooldown CHECK (cooldown_minutes >= 0)
);

-- Audit alert history table - for tracking triggered alerts
CREATE TABLE audit_alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Alert information
    alert_id UUID NOT NULL REFERENCES audit_alerts(id) ON DELETE CASCADE,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Event data that triggered the alert
    event_data JSONB NOT NULL DEFAULT '{}',
    recipients_notified TEXT[] NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_audit_events_timestamp ON audit_events(timestamp);
CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX idx_audit_events_service ON audit_events(service);
CREATE INDEX idx_audit_events_action ON audit_events(action);
CREATE INDEX idx_audit_events_resource ON audit_events(resource);
CREATE INDEX idx_audit_events_severity ON audit_events(severity);
CREATE INDEX idx_audit_events_category ON audit_events(category);
CREATE INDEX idx_audit_events_session_id ON audit_events(session_id);
CREATE INDEX idx_audit_events_ip_address ON audit_events(ip_address);
CREATE INDEX idx_audit_events_tags ON audit_events USING GIN(tags);
CREATE INDEX idx_audit_events_details ON audit_events USING GIN(details);
CREATE INDEX idx_audit_events_metadata ON audit_events USING GIN(metadata);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_level ON audit_logs(level);
CREATE INDEX idx_audit_logs_service ON audit_logs(service);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX idx_audit_logs_tags ON audit_logs USING GIN(tags);
CREATE INDEX idx_audit_logs_details ON audit_logs USING GIN(details);

CREATE INDEX idx_user_activities_timestamp ON user_activities(timestamp);
CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_user_email ON user_activities(user_email);
CREATE INDEX idx_user_activities_service ON user_activities(service);
CREATE INDEX idx_user_activities_action ON user_activities(action);
CREATE INDEX idx_user_activities_resource ON user_activities(resource);
CREATE INDEX idx_user_activities_session_id ON user_activities(session_id);
CREATE INDEX idx_user_activities_success ON user_activities(success);
CREATE INDEX idx_user_activities_details ON user_activities USING GIN(details);

CREATE INDEX idx_audit_reports_type ON audit_reports(type);
CREATE INDEX idx_audit_reports_is_active ON audit_reports(is_active);
CREATE INDEX idx_audit_reports_next_run ON audit_reports(next_run);
CREATE INDEX idx_audit_reports_filters ON audit_reports USING GIN(filters);

CREATE INDEX idx_audit_alerts_service ON audit_alerts(service);
CREATE INDEX idx_audit_alerts_severity ON audit_alerts(severity);
CREATE INDEX idx_audit_alerts_is_active ON audit_alerts(is_active);
CREATE INDEX idx_audit_alerts_condition ON audit_alerts USING GIN(condition);

CREATE INDEX idx_audit_alert_history_alert_id ON audit_alert_history(alert_id);
CREATE INDEX idx_audit_alert_history_triggered_at ON audit_alert_history(triggered_at);

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_audit_reports
    BEFORE UPDATE ON audit_reports
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_audit_alerts
    BEFORE UPDATE ON audit_alerts
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Function to clean up old audit data
CREATE OR REPLACE FUNCTION cleanup_old_audit_data(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_events INTEGER;
    deleted_logs INTEGER;
    deleted_activities INTEGER;
    deleted_alert_history INTEGER;
BEGIN
    -- Clean up old audit events
    DELETE FROM audit_events WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
    GET DIAGNOSTICS deleted_events = ROW_COUNT;
    
    -- Clean up old audit logs
    DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
    GET DIAGNOSTICS deleted_logs = ROW_COUNT;
    
    -- Clean up old user activities
    DELETE FROM user_activities WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
    GET DIAGNOSTICS deleted_activities = ROW_COUNT;
    
    -- Clean up old alert history
    DELETE FROM audit_alert_history WHERE triggered_at < NOW() - INTERVAL '1 day' * retention_days;
    GET DIAGNOSTICS deleted_alert_history = ROW_COUNT;
    
    RETURN deleted_events + deleted_logs + deleted_activities + deleted_alert_history;
END;
$$ LANGUAGE plpgsql;

-- Function to get audit statistics
CREATE OR REPLACE FUNCTION get_audit_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    total_events BIGINT,
    events_by_service JSONB,
    events_by_category JSONB,
    events_by_severity JSONB,
    events_by_date JSONB,
    top_users JSONB,
    top_actions JSONB,
    top_resources JSONB,
    error_rate DECIMAL,
    avg_response_time DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_events,
        jsonb_object_agg(service, count) as events_by_service,
        jsonb_object_agg(category, count) as events_by_category,
        jsonb_object_agg(severity, count) as events_by_severity,
        jsonb_object_agg(DATE(timestamp)::text, count) as events_by_date,
        jsonb_agg(
            jsonb_build_object(
                'userId', user_id,
                'userEmail', user_email,
                'count', count
            )
        ) as top_users,
        jsonb_agg(
            jsonb_build_object(
                'action', action,
                'count', count
            )
        ) as top_actions,
        jsonb_agg(
            jsonb_build_object(
                'resource', resource,
                'count', count
            )
        ) as top_resources,
        (COUNT(*) FILTER (WHERE severity = 'error' OR severity = 'critical')::DECIMAL / COUNT(*)::DECIMAL * 100) as error_rate,
        AVG(EXTRACT(EPOCH FROM (created_at - timestamp)) * 1000)::DECIMAL as avg_response_time
    FROM (
        SELECT 
            service,
            category,
            severity,
            user_id,
            user_email,
            action,
            resource,
            DATE(timestamp) as date,
            COUNT(*) as count
        FROM audit_events 
        WHERE timestamp >= NOW() - INTERVAL '1 day' * days_back
        GROUP BY service, category, severity, user_id, user_email, action, resource, DATE(timestamp)
    ) stats;
END;
$$ LANGUAGE plpgsql;

-- Function to get activity metrics
CREATE OR REPLACE FUNCTION get_activity_metrics(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    total_activities BIGINT,
    activities_by_service JSONB,
    activities_by_user JSONB,
    activities_by_date JSONB,
    success_rate DECIMAL,
    avg_duration DECIMAL,
    top_actions JSONB,
    top_resources JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_activities,
        jsonb_object_agg(service, count) as activities_by_service,
        jsonb_object_agg(user_email, count) as activities_by_user,
        jsonb_object_agg(DATE(timestamp)::text, count) as activities_by_date,
        (COUNT(*) FILTER (WHERE success = true)::DECIMAL / COUNT(*)::DECIMAL * 100) as success_rate,
        AVG(duration)::DECIMAL as avg_duration,
        jsonb_agg(
            jsonb_build_object(
                'action', action,
                'count', count
            )
        ) as top_actions,
        jsonb_agg(
            jsonb_build_object(
                'resource', resource,
                'count', count
            )
        ) as top_resources
    FROM (
        SELECT 
            service,
            user_email,
            action,
            resource,
            DATE(timestamp) as date,
            COUNT(*) as count
        FROM user_activities 
        WHERE timestamp >= NOW() - INTERVAL '1 day' * days_back
        GROUP BY service, user_email, action, resource, DATE(timestamp)
    ) stats;
END;
$$ LANGUAGE plpgsql;

-- Function to check alert conditions
CREATE OR REPLACE FUNCTION check_alert_conditions()
RETURNS TABLE (
    alert_id UUID,
    alert_name VARCHAR,
    alert_severity VARCHAR,
    alert_recipients TEXT[],
    event_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        aa.id as alert_id,
        aa.name as alert_name,
        aa.severity as alert_severity,
        aa.recipients as alert_recipients,
        COUNT(*) as event_count
    FROM audit_alerts aa
    CROSS JOIN LATERAL (
        SELECT 1
        FROM audit_events ae
        WHERE ae.timestamp >= NOW() - INTERVAL '1 hour'
        AND (
            (aa.condition->>'field' = 'service' AND ae.service = aa.condition->>'value')
            OR (aa.condition->>'field' = 'action' AND ae.action = aa.condition->>'value')
            OR (aa.condition->>'field' = 'severity' AND ae.severity = aa.condition->>'value')
            OR (aa.condition->>'field' = 'category' AND ae.category = aa.condition->>'value')
        )
    ) events
    WHERE aa.is_active = true
    AND (aa.last_triggered IS NULL OR aa.last_triggered < NOW() - INTERVAL '1 minute' * aa.cooldown_minutes)
    GROUP BY aa.id, aa.name, aa.severity, aa.recipients;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE audit_events IS 'Main audit trail for all system events';
COMMENT ON TABLE audit_logs IS 'Application logs with structured data';
COMMENT ON TABLE user_activities IS 'User behavior and activity tracking';
COMMENT ON TABLE audit_reports IS 'Scheduled and custom audit reports';
COMMENT ON TABLE audit_alerts IS 'Real-time alerting configuration';
COMMENT ON TABLE audit_alert_history IS 'History of triggered alerts';

COMMENT ON COLUMN audit_events.severity IS 'Event severity level: info, warn, error, critical';
COMMENT ON COLUMN audit_events.category IS 'Event category for classification';
COMMENT ON COLUMN audit_events.details IS 'Structured event details in JSON format';
COMMENT ON COLUMN audit_events.metadata IS 'Additional metadata for the event';
COMMENT ON COLUMN audit_logs.level IS 'Log level: info, warn, error, debug';
COMMENT ON COLUMN user_activities.duration IS 'Activity duration in milliseconds';
COMMENT ON COLUMN user_activities.success IS 'Whether the activity was successful';
COMMENT ON COLUMN audit_reports.schedule IS 'Cron expression for scheduled reports';
COMMENT ON COLUMN audit_alerts.condition IS 'Alert condition in JSON format';
COMMENT ON COLUMN audit_alerts.cooldown_minutes IS 'Minimum minutes between alert triggers';