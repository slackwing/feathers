-- Basic initialization (no TimescaleDB needed)
CREATE TABLE IF NOT EXISTS health_check (
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT
);

-- Manuscript tracking
CREATE TABLE IF NOT EXISTS manuscript (
    manuscript_id SERIAL PRIMARY KEY,
    repo_path TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(repo_path, file_path)
);

-- Migration (processed commits with specific segmenter versions)
CREATE TABLE IF NOT EXISTS migration (
    migration_id SERIAL PRIMARY KEY,
    manuscript_id INTEGER NOT NULL REFERENCES manuscript(manuscript_id),
    commit_hash TEXT NOT NULL,
    segmenter TEXT NOT NULL,
    parent_migration_id INTEGER REFERENCES migration(migration_id),
    branch_name TEXT NOT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sentence_count INTEGER NOT NULL DEFAULT 0,
    additions_count INTEGER NOT NULL DEFAULT 0,
    deletions_count INTEGER NOT NULL DEFAULT 0,
    changes_count INTEGER NOT NULL DEFAULT 0,
    sentence_id_array JSONB NOT NULL DEFAULT '[]'::jsonb,
    UNIQUE(manuscript_id, commit_hash, segmenter)
);

-- Sentences
CREATE TABLE IF NOT EXISTS sentence (
    sentence_id TEXT PRIMARY KEY,
    migration_id INTEGER NOT NULL REFERENCES migration(migration_id),
    commit_hash TEXT NOT NULL,
    text TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    ordinal INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sentence_migration ON sentence(migration_id);
CREATE INDEX IF NOT EXISTS idx_sentence_commit ON sentence(commit_hash);

-- Annotations
CREATE TABLE IF NOT EXISTS annotation (
    annotation_id SERIAL PRIMARY KEY,
    sentence_id TEXT NOT NULL REFERENCES sentence(sentence_id),
    user_id TEXT NOT NULL,
    color TEXT NOT NULL CHECK (color IN ('yellow', 'green', 'blue', 'purple', 'red', 'orange')),
    note TEXT,
    priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high')),
    flagged BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(sentence_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_annotation_sentence ON annotation(sentence_id);
CREATE INDEX IF NOT EXISTS idx_annotation_user ON annotation(user_id);
CREATE INDEX IF NOT EXISTS idx_annotation_deleted ON annotation(deleted_at) WHERE deleted_at IS NULL;

-- Annotation versions (for tracking migration history)
CREATE TABLE IF NOT EXISTS annotation_version (
    annotation_id INTEGER NOT NULL REFERENCES annotation(annotation_id),
    version INTEGER NOT NULL,
    sentence_id TEXT NOT NULL,
    color TEXT NOT NULL,
    note TEXT,
    priority TEXT NOT NULL,
    flagged BOOLEAN NOT NULL,
    sentence_id_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    migration_confidence FLOAT,
    origin_sentence_id TEXT NOT NULL,
    origin_migration_id INTEGER REFERENCES migration(migration_id),
    origin_commit_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    PRIMARY KEY (annotation_id, version)
);

-- Tags (many-to-many with annotations)
CREATE TABLE IF NOT EXISTS tag (
    tag_id SERIAL PRIMARY KEY,
    tag_name TEXT NOT NULL,
    migration_id INTEGER NOT NULL REFERENCES migration(migration_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tag_name, migration_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_name ON tag(tag_name);
CREATE INDEX IF NOT EXISTS idx_tag_migration ON tag(migration_id);

-- Annotation-Tag junction table
CREATE TABLE IF NOT EXISTS annotation_tag (
    annotation_id INTEGER NOT NULL REFERENCES annotation(annotation_id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tag(tag_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (annotation_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_annotation_tag_annotation ON annotation_tag(annotation_id);
CREATE INDEX IF NOT EXISTS idx_annotation_tag_tag ON annotation_tag(tag_id);

INSERT INTO health_check (status) VALUES ('Database initialized successfully');
