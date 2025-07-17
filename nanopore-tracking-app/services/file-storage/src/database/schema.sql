-- File Storage Service Database Schema
-- Creates tables for file management, metadata, and access logging

-- Files table - main file entity
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- File information
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    
    -- Metadata
    description TEXT,
    uploaded_by VARCHAR(255),
    is_public BOOLEAN DEFAULT false,
    tags TEXT[], -- Array of tags
    metadata JSONB, -- Flexible metadata storage
    
    -- Timestamps
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_file_size CHECK (size_bytes > 0),
    CONSTRAINT valid_file_type CHECK (file_type ~ '^[a-zA-Z0-9_-]+$')
);

-- File metadata table - for additional file properties
CREATE TABLE file_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    
    -- Metadata key-value pairs
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(file_id, key)
);

-- File access log table - for tracking file access
CREATE TABLE file_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    
    -- Access information
    user_id VARCHAR(255),
    action VARCHAR(20) NOT NULL CHECK (action IN ('download', 'upload', 'delete', 'view')),
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- File processing queue table - for background processing
CREATE TABLE file_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    
    -- Processing information
    task_type VARCHAR(50) NOT NULL, -- 'thumbnail', 'compress', 'extract_metadata', etc.
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    priority INTEGER DEFAULT 0,
    
    -- Processing details
    options JSONB, -- Processing options
    result JSONB, -- Processing result
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_priority CHECK (priority >= 0)
);

-- File storage statistics table - for monitoring
CREATE TABLE file_storage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Statistics
    total_files BIGINT NOT NULL DEFAULT 0,
    total_size_bytes BIGINT NOT NULL DEFAULT 0,
    average_file_size_bytes BIGINT NOT NULL DEFAULT 0,
    files_by_type JSONB NOT NULL DEFAULT '{}',
    files_by_date JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX idx_files_file_type ON files(file_type);
CREATE INDEX idx_files_is_public ON files(is_public);
CREATE INDEX idx_files_uploaded_at ON files(uploaded_at);
CREATE INDEX idx_files_tags ON files USING GIN(tags);
CREATE INDEX idx_files_metadata ON files USING GIN(metadata);

CREATE INDEX idx_file_metadata_file_id ON file_metadata(file_id);
CREATE INDEX idx_file_metadata_key ON file_metadata(key);

CREATE INDEX idx_file_access_log_file_id ON file_access_log(file_id);
CREATE INDEX idx_file_access_log_user_id ON file_access_log(user_id);
CREATE INDEX idx_file_access_log_action ON file_access_log(action);
CREATE INDEX idx_file_access_log_accessed_at ON file_access_log(accessed_at);

CREATE INDEX idx_file_processing_queue_file_id ON file_processing_queue(file_id);
CREATE INDEX idx_file_processing_queue_status ON file_processing_queue(status);
CREATE INDEX idx_file_processing_queue_priority ON file_processing_queue(priority);
CREATE INDEX idx_file_processing_queue_created_at ON file_processing_queue(created_at);

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_files
    BEFORE UPDATE ON files
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Function to update storage statistics
CREATE OR REPLACE FUNCTION update_storage_stats()
RETURNS void AS $$
BEGIN
    INSERT INTO file_storage_stats (
        total_files,
        total_size_bytes,
        average_file_size_bytes,
        files_by_type,
        files_by_date,
        calculated_at
    )
    SELECT 
        COUNT(*) as total_files,
        COALESCE(SUM(size_bytes), 0) as total_size_bytes,
        COALESCE(AVG(size_bytes), 0) as average_file_size_bytes,
        jsonb_object_agg(file_type, count) as files_by_type,
        jsonb_object_agg(
            DATE(uploaded_at)::text, 
            count
        ) as files_by_date,
        NOW() as calculated_at
    FROM (
        SELECT 
            file_type,
            DATE(uploaded_at) as upload_date,
            COUNT(*) as count
        FROM files 
        GROUP BY file_type, DATE(uploaded_at)
    ) stats;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old access logs
CREATE OR REPLACE FUNCTION cleanup_old_access_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM file_access_log WHERE accessed_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up failed processing tasks
CREATE OR REPLACE FUNCTION cleanup_failed_processing_tasks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM file_processing_queue 
    WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get file statistics
CREATE OR REPLACE FUNCTION get_file_stats()
RETURNS TABLE (
    total_files BIGINT,
    total_size_bytes BIGINT,
    average_file_size_bytes BIGINT,
    files_by_type JSONB,
    files_by_date JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_files,
        COALESCE(SUM(size_bytes), 0)::BIGINT as total_size_bytes,
        COALESCE(AVG(size_bytes), 0)::BIGINT as average_file_size_bytes,
        jsonb_object_agg(file_type, count) as files_by_type,
        jsonb_object_agg(
            DATE(uploaded_at)::text, 
            count
        ) as files_by_date
    FROM (
        SELECT 
            file_type,
            DATE(uploaded_at) as upload_date,
            COUNT(*) as count
        FROM files 
        GROUP BY file_type, DATE(uploaded_at)
    ) stats;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE files IS 'Main table for file storage and metadata';
COMMENT ON TABLE file_metadata IS 'Additional metadata for files as key-value pairs';
COMMENT ON TABLE file_access_log IS 'Audit trail for file access and operations';
COMMENT ON TABLE file_processing_queue IS 'Background processing queue for file operations';
COMMENT ON TABLE file_storage_stats IS 'Storage statistics and monitoring data';

COMMENT ON COLUMN files.original_name IS 'Original filename as uploaded by user';
COMMENT ON COLUMN files.file_name IS 'Generated unique filename for storage';
COMMENT ON COLUMN files.file_type IS 'File extension/type (e.g., pdf, jpg, txt)';
COMMENT ON COLUMN files.mime_type IS 'MIME type of the file';
COMMENT ON COLUMN files.size_bytes IS 'File size in bytes';
COMMENT ON COLUMN files.file_path IS 'Relative path to file in storage';
COMMENT ON COLUMN files.is_public IS 'Whether file is publicly accessible';
COMMENT ON COLUMN files.tags IS 'Array of tags for file categorization';
COMMENT ON COLUMN files.metadata IS 'Flexible JSON metadata storage';
COMMENT ON COLUMN file_access_log.action IS 'Type of access: download, upload, delete, view';