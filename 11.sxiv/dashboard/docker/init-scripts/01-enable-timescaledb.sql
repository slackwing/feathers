-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create a simple test table to verify TimescaleDB is working
CREATE TABLE IF NOT EXISTS health_check (
    time TIMESTAMPTZ NOT NULL,
    status TEXT
);

-- Convert to hypertable (TimescaleDB's time-series optimization)
SELECT create_hypertable('health_check', 'time', if_not_exists => TRUE);

-- Insert a test record
INSERT INTO health_check (time, status) VALUES (NOW(), 'TimescaleDB initialized successfully');
