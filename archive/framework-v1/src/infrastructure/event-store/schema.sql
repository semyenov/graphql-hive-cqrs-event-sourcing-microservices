-- PostgreSQL Event Store Schema
-- 
-- Optimized for:
-- - High write throughput
-- - Efficient event stream queries
-- - Snapshot storage
-- - Event projections
-- - Partitioning by time

-- ============================================================================
-- Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- Main Events Table (Partitioned by month)
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    global_position BIGSERIAL UNIQUE NOT NULL,
    
    -- Stream identification
    stream_id VARCHAR(255) NOT NULL,
    stream_version INTEGER NOT NULL,
    
    -- Event data
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    event_metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Correlation
    correlation_id UUID,
    causation_id UUID,
    
    -- Constraints
    CONSTRAINT unique_stream_version UNIQUE (stream_id, stream_version)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for the next 12 months
DO $$
DECLARE
    start_date date := date_trunc('month', CURRENT_DATE);
    partition_date date;
    partition_name text;
BEGIN
    FOR i IN 0..11 LOOP
        partition_date := start_date + (i || ' months')::interval;
        partition_name := 'events_' || to_char(partition_date, 'YYYY_MM');
        
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF events
            FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            partition_date,
            partition_date + interval '1 month'
        );
    END LOOP;
END $$;

-- ============================================================================
-- Indexes for Events
-- ============================================================================

-- Primary query patterns
CREATE INDEX idx_events_stream_id ON events (stream_id);
CREATE INDEX idx_events_stream_id_version ON events (stream_id, stream_version);
CREATE INDEX idx_events_global_position ON events (global_position);
CREATE INDEX idx_events_event_type ON events (event_type);
CREATE INDEX idx_events_created_at ON events (created_at);

-- Correlation indexes
CREATE INDEX idx_events_correlation_id ON events (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_events_causation_id ON events (causation_id) WHERE causation_id IS NOT NULL;

-- JSONB indexes for event data queries
CREATE INDEX idx_events_data ON events USING GIN (event_data);
CREATE INDEX idx_events_metadata ON events USING GIN (event_metadata);

-- ============================================================================
-- Stream Metadata Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS streams (
    stream_id VARCHAR(255) PRIMARY KEY,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Optimistic locking
    row_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_streams_updated_at ON streams (updated_at);
CREATE INDEX idx_streams_metadata ON streams USING GIN (metadata);

-- ============================================================================
-- Snapshots Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS snapshots (
    aggregate_id VARCHAR(255) PRIMARY KEY,
    aggregate_version INTEGER NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Keep only latest snapshot per aggregate
    CONSTRAINT unique_aggregate_snapshot UNIQUE (aggregate_id)
);

CREATE INDEX idx_snapshots_version ON snapshots (aggregate_version);
CREATE INDEX idx_snapshots_created_at ON snapshots (created_at);

-- ============================================================================
-- Projections Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS projections (
    projection_name VARCHAR(255) PRIMARY KEY,
    last_position BIGINT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    state JSONB,
    is_running BOOLEAN DEFAULT FALSE,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_projections_last_updated ON projections (last_updated);
CREATE INDEX idx_projections_is_running ON projections (is_running);

-- ============================================================================
-- Event Subscriptions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_name VARCHAR(255) UNIQUE NOT NULL,
    stream_id VARCHAR(255),
    last_position BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_subscriptions_name ON subscriptions (subscription_name);
CREATE INDEX idx_subscriptions_stream_id ON subscriptions (stream_id) WHERE stream_id IS NOT NULL;
CREATE INDEX idx_subscriptions_is_active ON subscriptions (is_active);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for streams table
CREATE TRIGGER update_streams_updated_at
    BEFORE UPDATE ON streams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for subscriptions table
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to notify on new events
CREATE OR REPLACE FUNCTION notify_new_event()
RETURNS TRIGGER AS $$
DECLARE
    channel TEXT;
    payload TEXT;
BEGIN
    -- Notify on global channel
    channel := 'events_all';
    payload := row_to_json(NEW)::text;
    PERFORM pg_notify(channel, payload);
    
    -- Notify on stream-specific channel
    channel := 'events_stream_' || NEW.stream_id;
    PERFORM pg_notify(channel, payload);
    
    -- Notify on event type channel
    channel := 'events_type_' || NEW.event_type;
    PERFORM pg_notify(channel, payload);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for event notifications
CREATE TRIGGER notify_event_insert
    AFTER INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_event();

-- ============================================================================
-- Optimistic Concurrency Control
-- ============================================================================

-- Function to check and update stream version
CREATE OR REPLACE FUNCTION append_events_optimistic(
    p_stream_id VARCHAR(255),
    p_expected_version INTEGER,
    p_events JSONB[]
) RETURNS INTEGER AS $$
DECLARE
    v_current_version INTEGER;
    v_new_version INTEGER;
    v_event JSONB;
BEGIN
    -- Lock the stream row
    SELECT version INTO v_current_version
    FROM streams
    WHERE stream_id = p_stream_id
    FOR UPDATE;
    
    -- If stream doesn't exist, create it
    IF NOT FOUND THEN
        INSERT INTO streams (stream_id, version)
        VALUES (p_stream_id, 0);
        v_current_version := 0;
    END IF;
    
    -- Check expected version
    IF p_expected_version IS NOT NULL AND v_current_version != p_expected_version THEN
        RAISE EXCEPTION 'Concurrency conflict: expected version %, actual %', 
            p_expected_version, v_current_version;
    END IF;
    
    -- Insert events
    v_new_version := v_current_version;
    FOREACH v_event IN ARRAY p_events
    LOOP
        v_new_version := v_new_version + 1;
        
        INSERT INTO events (
            stream_id,
            stream_version,
            event_type,
            event_data,
            event_metadata,
            correlation_id,
            causation_id
        ) VALUES (
            p_stream_id,
            v_new_version,
            v_event->>'type',
            v_event->'data',
            v_event->'metadata',
            (v_event->>'correlation_id')::UUID,
            (v_event->>'causation_id')::UUID
        );
    END LOOP;
    
    -- Update stream version
    UPDATE streams
    SET version = v_new_version,
        row_version = row_version + 1
    WHERE stream_id = p_stream_id;
    
    RETURN v_new_version;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Maintenance Functions
-- ============================================================================

-- Function to create future partitions
CREATE OR REPLACE FUNCTION create_monthly_partitions(months_ahead INTEGER DEFAULT 3)
RETURNS void AS $$
DECLARE
    start_date date;
    partition_date date;
    partition_name text;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE);
    
    FOR i IN 1..months_ahead LOOP
        partition_date := start_date + (i || ' months')::interval;
        partition_name := 'events_' || to_char(partition_date, 'YYYY_MM');
        
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF events
            FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            partition_date,
            partition_date + interval '1 month'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to drop old partitions
CREATE OR REPLACE FUNCTION drop_old_partitions(months_to_keep INTEGER DEFAULT 12)
RETURNS void AS $$
DECLARE
    cutoff_date date;
    partition_name text;
BEGIN
    cutoff_date := date_trunc('month', CURRENT_DATE - (months_to_keep || ' months')::interval);
    
    FOR partition_name IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE 'events_%'
        AND tablename < 'events_' || to_char(cutoff_date, 'YYYY_MM')
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I', partition_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- View for recent events
CREATE OR REPLACE VIEW recent_events AS
SELECT 
    e.*,
    s.metadata as stream_metadata
FROM events e
LEFT JOIN streams s ON e.stream_id = s.stream_id
WHERE e.created_at > NOW() - INTERVAL '24 hours'
ORDER BY e.global_position DESC;

-- View for stream statistics
CREATE OR REPLACE VIEW stream_statistics AS
SELECT 
    s.stream_id,
    s.version,
    s.created_at,
    s.updated_at,
    COUNT(e.id) as event_count,
    MAX(e.created_at) as last_event_at,
    pg_size_pretty(SUM(pg_column_size(e.*))) as total_size
FROM streams s
LEFT JOIN events e ON s.stream_id = e.stream_id
GROUP BY s.stream_id, s.version, s.created_at, s.updated_at;

-- ============================================================================
-- Permissions (adjust as needed)
-- ============================================================================

-- Create read-only role
CREATE ROLE eventstore_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO eventstore_reader;

-- Create write role
CREATE ROLE eventstore_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO eventstore_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eventstore_writer;

-- Create admin role
CREATE ROLE eventstore_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO eventstore_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO eventstore_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO eventstore_admin;