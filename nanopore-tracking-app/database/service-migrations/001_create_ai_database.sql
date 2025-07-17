-- Migration: AI Service Database Schema
-- Creates tables for AI processing, extraction results, and model performance

-- AI extraction results table
CREATE TABLE ai_extraction_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id UUID NOT NULL, -- Reference to sample in samples database
    file_name VARCHAR(255) NOT NULL,
    extraction_method VARCHAR(20) NOT NULL CHECK (extraction_method IN ('llm', 'pattern', 'hybrid', 'rag')),
    extracted_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    processing_time_ms INTEGER NOT NULL,
    issues TEXT[] DEFAULT '{}',
    rag_insights JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI processing jobs table
CREATE TABLE ai_processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('pdf_extraction', 'data_validation', 'enhancement')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    input_data JSONB NOT NULL,
    output_data JSONB,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI model performance tracking
CREATE TABLE ai_model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    accuracy_score DECIMAL(5,4) NOT NULL CHECK (accuracy_score >= 0 AND accuracy_score <= 1),
    processing_time_ms INTEGER NOT NULL,
    sample_count INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_ai_extraction_results_sample_id ON ai_extraction_results(sample_id);
CREATE INDEX idx_ai_extraction_results_method ON ai_extraction_results(extraction_method);
CREATE INDEX idx_ai_extraction_results_confidence ON ai_extraction_results(confidence_score);
CREATE INDEX idx_ai_extraction_results_created_at ON ai_extraction_results(created_at);

CREATE INDEX idx_ai_processing_jobs_status ON ai_processing_jobs(status);
CREATE INDEX idx_ai_processing_jobs_type ON ai_processing_jobs(job_type);
CREATE INDEX idx_ai_processing_jobs_created_at ON ai_processing_jobs(created_at);

CREATE INDEX idx_ai_model_performance_model ON ai_model_performance(model_name);
CREATE INDEX idx_ai_model_performance_task ON ai_model_performance(task_type);
CREATE INDEX idx_ai_model_performance_timestamp ON ai_model_performance(timestamp);

-- Create trigger function for automatic timestamp updates
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER set_timestamp_ai_extraction_results
    BEFORE UPDATE ON ai_extraction_results
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_ai_processing_jobs
    BEFORE UPDATE ON ai_processing_jobs
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Comments for documentation
COMMENT ON TABLE ai_extraction_results IS 'Results from AI-powered PDF extraction and data processing';
COMMENT ON TABLE ai_processing_jobs IS 'Queue and tracking for AI processing jobs';
COMMENT ON TABLE ai_model_performance IS 'Performance metrics for AI models';

COMMENT ON COLUMN ai_extraction_results.confidence_score IS 'Confidence score from 0.0 to 1.0';
COMMENT ON COLUMN ai_extraction_results.extraction_method IS 'Method used for extraction: llm, pattern, hybrid, or rag';
COMMENT ON COLUMN ai_extraction_results.rag_insights IS 'RAG system insights and recommendations';
COMMENT ON COLUMN ai_processing_jobs.job_type IS 'Type of AI processing job';
COMMENT ON COLUMN ai_model_performance.accuracy_score IS 'Model accuracy score from 0.0 to 1.0'; 