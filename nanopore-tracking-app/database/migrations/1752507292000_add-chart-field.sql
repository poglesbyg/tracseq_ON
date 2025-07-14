-- Migration: Add chart field to nanopore samples
-- Adds chart_field column for intake validation

ALTER TABLE nanopore_samples 
ADD COLUMN chart_field VARCHAR(255) NOT NULL DEFAULT '';

-- Create index for chart field lookups
CREATE INDEX idx_nanopore_samples_chart_field ON nanopore_samples(chart_field);

-- Comment for documentation
COMMENT ON COLUMN nanopore_samples.chart_field IS 'Chart field identifier required for intake validation';