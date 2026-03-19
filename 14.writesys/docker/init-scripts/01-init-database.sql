-- Basic initialization (no TimescaleDB needed)
CREATE TABLE IF NOT EXISTS health_check (
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT
);

INSERT INTO health_check (status) VALUES ('Database initialized successfully');
