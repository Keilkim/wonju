-- Dog Rehabilitation Dashboard Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dog_id VARCHAR(255) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    metrics_summary JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analysis results table (time-series data)
CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    keypoints_json JSONB,
    joint_angles JSONB,
    gait_metrics JSONB,
    confidence FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dogs table (optional, for managing multiple dogs)
CREATE TABLE IF NOT EXISTS dogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    breed VARCHAR(255),
    age_months INTEGER,
    weight_kg FLOAT,
    condition_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_sessions_dog_id ON sessions(dog_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_results_session_id ON analysis_results(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_timestamp ON analysis_results(timestamp);

-- Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE dogs ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for demo purposes
-- In production, implement proper authentication policies
CREATE POLICY "Allow public access to sessions" ON sessions
    FOR ALL USING (true);

CREATE POLICY "Allow public access to analysis_results" ON analysis_results
    FOR ALL USING (true);

CREATE POLICY "Allow public access to dogs" ON dogs
    FOR ALL USING (true);

-- Function to calculate session statistics
CREATE OR REPLACE FUNCTION calculate_session_stats(session_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'avg_symmetry', AVG((gait_metrics->>'symmetry')::float),
        'avg_smoothness', AVG((gait_metrics->>'smoothness')::float),
        'avg_speed', AVG((gait_metrics->>'speed')::float),
        'avg_cadence', AVG((gait_metrics->>'cadence')::float),
        'frame_count', COUNT(*)
    ) INTO result
    FROM analysis_results
    WHERE session_id = session_uuid;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update metrics_summary when session ends
CREATE OR REPLACE FUNCTION update_session_summary()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
        NEW.metrics_summary = calculate_session_stats(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_summary
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_summary();
