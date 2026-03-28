package database

import (
	"context"
	"encoding/json"
	"fmt"

	"writesys/internal/models"

	"github.com/jackc/pgx/v5"
)

// CreateManuscript creates a new manuscript record
func (db *DB) CreateManuscript(ctx context.Context, repoPath, storyFilePath string) (*models.Manuscript, error) {
	query := `
		INSERT INTO manuscript (repo_path, story_file_path)
		VALUES ($1, $2)
		ON CONFLICT (repo_path, story_file_path) DO UPDATE
			SET repo_path = EXCLUDED.repo_path
		RETURNING manuscript_id, repo_path, story_file_path, created_at
	`

	var m models.Manuscript
	err := db.Pool.QueryRow(ctx, query, repoPath, storyFilePath).Scan(
		&m.ManuscriptID,
		&m.RepoPath,
		&m.StoryFilePath,
		&m.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create manuscript: %w", err)
	}

	return &m, nil
}

// GetManuscript retrieves a manuscript by repo and file path
func (db *DB) GetManuscript(ctx context.Context, repoPath, storyFilePath string) (*models.Manuscript, error) {
	query := `
		SELECT manuscript_id, repo_path, story_file_path, created_at
		FROM manuscript
		WHERE repo_path = $1 AND story_file_path = $2
	`

	var m models.Manuscript
	err := db.Pool.QueryRow(ctx, query, repoPath, storyFilePath).Scan(
		&m.ManuscriptID,
		&m.RepoPath,
		&m.StoryFilePath,
		&m.CreatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get manuscript: %w", err)
	}

	return &m, nil
}

// GetLatestMigration gets the most recent migration for a manuscript
func (db *DB) GetLatestMigration(ctx context.Context, manuscriptID int) (*models.Migration, error) {
	query := `
		SELECT migration_id, manuscript_id, commit_hash, segmenter,
		       parent_migration_id, branch_name, processed_at, sentence_count,
		       additions_count, deletions_count, changes_count, sentence_id_array
		FROM migration
		WHERE manuscript_id = $1
		ORDER BY processed_at DESC
		LIMIT 1
	`

	var m models.Migration
	var sentenceIDArrayJSON []byte

	err := db.Pool.QueryRow(ctx, query, manuscriptID).Scan(
		&m.MigrationID,
		&m.ManuscriptID,
		&m.CommitHash,
		&m.Segmenter,
		&m.ParentMigrationID,
		&m.BranchName,
		&m.ProcessedAt,
		&m.SentenceCount,
		&m.AdditionsCount,
		&m.DeletionsCount,
		&m.ChangesCount,
		&sentenceIDArrayJSON,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get latest migration: %w", err)
	}

	// Parse JSONB array
	if err := json.Unmarshal(sentenceIDArrayJSON, &m.SentenceIDArray); err != nil {
		return nil, fmt.Errorf("failed to parse sentence_id_array: %w", err)
	}

	return &m, nil
}

// GetMigrations gets all migrations for a manuscript, ordered by most recent first
func (db *DB) GetMigrations(ctx context.Context, manuscriptID int) ([]models.Migration, error) {
	query := `
		SELECT migration_id, manuscript_id, commit_hash, segmenter,
		       parent_migration_id, branch_name, processed_at, sentence_count,
		       additions_count, deletions_count, changes_count, sentence_id_array
		FROM migration
		WHERE manuscript_id = $1
		ORDER BY processed_at DESC
	`

	rows, err := db.Pool.Query(ctx, query, manuscriptID)
	if err != nil {
		return nil, fmt.Errorf("failed to get migrations: %w", err)
	}
	defer rows.Close()

	var migrations []models.Migration
	for rows.Next() {
		var m models.Migration
		var sentenceIDArrayJSON []byte

		err := rows.Scan(
			&m.MigrationID,
			&m.ManuscriptID,
			&m.CommitHash,
			&m.Segmenter,
			&m.ParentMigrationID,
			&m.BranchName,
			&m.ProcessedAt,
			&m.SentenceCount,
			&m.AdditionsCount,
			&m.DeletionsCount,
			&m.ChangesCount,
			&sentenceIDArrayJSON,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan migration: %w", err)
		}

		// Parse JSONB array
		if err := json.Unmarshal(sentenceIDArrayJSON, &m.SentenceIDArray); err != nil {
			return nil, fmt.Errorf("failed to parse sentence_id_array: %w", err)
		}

		migrations = append(migrations, m)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating migrations: %w", err)
	}

	return migrations, nil
}

// CreateMigration creates a new migration record and returns the migration_id
func (db *DB) CreateMigration(ctx context.Context, m *models.Migration) error {
	// Convert sentence ID array to JSON
	sentenceIDArrayJSON, err := json.Marshal(m.SentenceIDArray)
	if err != nil {
		return fmt.Errorf("failed to marshal sentence_id_array: %w", err)
	}

	query := `
		INSERT INTO migration (
			manuscript_id, commit_hash, segmenter, parent_migration_id,
			branch_name, sentence_count, additions_count, deletions_count,
			changes_count, sentence_id_array
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING migration_id, processed_at
	`

	err = db.Pool.QueryRow(ctx, query,
		m.ManuscriptID,
		m.CommitHash,
		m.Segmenter,
		m.ParentMigrationID,
		m.BranchName,
		m.SentenceCount,
		m.AdditionsCount,
		m.DeletionsCount,
		m.ChangesCount,
		sentenceIDArrayJSON,
	).Scan(&m.MigrationID, &m.ProcessedAt)
	if err != nil {
		return fmt.Errorf("failed to create migration: %w", err)
	}

	return nil
}

// CreateSentences creates multiple sentence records in a transaction
func (db *DB) CreateSentences(ctx context.Context, sentences []models.Sentence) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	query := `
		INSERT INTO sentence (sentence_id, migration_id, commit_hash, text, word_count, ordinal)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	for _, s := range sentences {
		_, err := tx.Exec(ctx, query,
			s.SentenceID,
			s.MigrationID,
			s.CommitHash,
			s.Text,
			s.WordCount,
			s.Ordinal,
		)
		if err != nil {
			return fmt.Errorf("failed to insert sentence %s: %w", s.SentenceID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetMigrationByID retrieves a migration by its ID
func (db *DB) GetMigrationByID(ctx context.Context, migrationID int) (*models.Migration, error) {
	query := `
		SELECT migration_id, manuscript_id, commit_hash, segmenter,
		       parent_migration_id, branch_name, processed_at, sentence_count,
		       additions_count, deletions_count, changes_count, sentence_id_array
		FROM migration
		WHERE migration_id = $1
	`

	var m models.Migration
	var sentenceIDArrayJSON []byte

	err := db.Pool.QueryRow(ctx, query, migrationID).Scan(
		&m.MigrationID,
		&m.ManuscriptID,
		&m.CommitHash,
		&m.Segmenter,
		&m.ParentMigrationID,
		&m.BranchName,
		&m.ProcessedAt,
		&m.SentenceCount,
		&m.AdditionsCount,
		&m.DeletionsCount,
		&m.ChangesCount,
		&sentenceIDArrayJSON,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get migration by ID: %w", err)
	}

	// Parse JSONB array
	if err := json.Unmarshal(sentenceIDArrayJSON, &m.SentenceIDArray); err != nil {
		return nil, fmt.Errorf("failed to parse sentence_id_array: %w", err)
	}

	return &m, nil
}

// GetMigrationByCommitAndSegmenter retrieves a migration by commit hash and segmenter version
func (db *DB) GetMigrationByCommitAndSegmenter(ctx context.Context, manuscriptID int, commitHash, segmenter string) (*models.Migration, error) {
	query := `
		SELECT migration_id, manuscript_id, commit_hash, segmenter,
		       parent_migration_id, branch_name, processed_at, sentence_count,
		       additions_count, deletions_count, changes_count, sentence_id_array
		FROM migration
		WHERE manuscript_id = $1 AND commit_hash = $2 AND segmenter = $3
	`

	var m models.Migration
	var sentenceIDArrayJSON []byte

	err := db.Pool.QueryRow(ctx, query, manuscriptID, commitHash, segmenter).Scan(
		&m.MigrationID,
		&m.ManuscriptID,
		&m.CommitHash,
		&m.Segmenter,
		&m.ParentMigrationID,
		&m.BranchName,
		&m.ProcessedAt,
		&m.SentenceCount,
		&m.AdditionsCount,
		&m.DeletionsCount,
		&m.ChangesCount,
		&sentenceIDArrayJSON,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get migration by commit and segmenter: %w", err)
	}

	// Parse JSONB array
	if err := json.Unmarshal(sentenceIDArrayJSON, &m.SentenceIDArray); err != nil {
		return nil, fmt.Errorf("failed to parse sentence_id_array: %w", err)
	}

	return &m, nil
}

// GetSentencesByMigration retrieves all sentences for a given migration_id
func (db *DB) GetSentencesByMigration(ctx context.Context, migrationID int) ([]models.Sentence, error) {
	query := `
		SELECT sentence_id, migration_id, commit_hash, text, word_count, ordinal, created_at
		FROM sentence
		WHERE migration_id = $1
		ORDER BY ordinal
	`

	rows, err := db.Pool.Query(ctx, query, migrationID)
	if err != nil {
		return nil, fmt.Errorf("failed to query sentences: %w", err)
	}
	defer rows.Close()

	var sentences []models.Sentence
	for rows.Next() {
		var s models.Sentence
		err := rows.Scan(
			&s.SentenceID,
			&s.MigrationID,
			&s.CommitHash,
			&s.Text,
			&s.WordCount,
			&s.Ordinal,
			&s.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan sentence: %w", err)
		}
		sentences = append(sentences, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating sentences: %w", err)
	}

	return sentences, nil
}

// GetSentencesByCommit retrieves all sentences for a given commit hash (for backward compatibility)
func (db *DB) GetSentencesByCommit(ctx context.Context, commitHash string) ([]models.Sentence, error) {
	query := `
		SELECT sentence_id, migration_id, commit_hash, text, word_count, ordinal, created_at
		FROM sentence
		WHERE commit_hash = $1
		ORDER BY ordinal
	`

	rows, err := db.Pool.Query(ctx, query, commitHash)
	if err != nil {
		return nil, fmt.Errorf("failed to query sentences: %w", err)
	}
	defer rows.Close()

	var sentences []models.Sentence
	for rows.Next() {
		var s models.Sentence
		err := rows.Scan(
			&s.SentenceID,
			&s.MigrationID,
			&s.CommitHash,
			&s.Text,
			&s.WordCount,
			&s.Ordinal,
			&s.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan sentence: %w", err)
		}
		sentences = append(sentences, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating sentences: %w", err)
	}

	return sentences, nil
}

// GetAnnotationsByCommit retrieves all active annotations for sentences in a commit
func (db *DB) GetAnnotationsByCommit(ctx context.Context, commitHash string) ([]models.Annotation, error) {
	query := `
		SELECT a.annotation_id, a.type, a.created_by, a.created_at, a.deleted_at
		FROM annotation a
		JOIN annotation_version av ON a.annotation_id = av.annotation_id
		JOIN sentence s ON av.sentence_id = s.sentence_id
		WHERE s.commit_hash = $1
		  AND a.deleted_at IS NULL
		  AND av.version = (
			SELECT MAX(version)
			FROM annotation_version
			WHERE annotation_id = a.annotation_id
		  )
		ORDER BY s.ordinal, a.created_at
	`

	rows, err := db.Pool.Query(ctx, query, commitHash)
	if err != nil {
		return nil, fmt.Errorf("failed to query annotations by commit: %w", err)
	}
	defer rows.Close()

	var annotations []models.Annotation
	for rows.Next() {
		var a models.Annotation
		err := rows.Scan(
			&a.AnnotationID,
			&a.Type,
			&a.CreatedBy,
			&a.CreatedAt,
			&a.DeletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan annotation: %w", err)
		}
		annotations = append(annotations, a)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating annotations: %w", err)
	}

	return annotations, nil
}

// GetAnnotationsBySentence retrieves all active annotations for a specific sentence
func (db *DB) GetAnnotationsBySentence(ctx context.Context, sentenceID string) ([]models.Annotation, error) {
	query := `
		SELECT a.annotation_id, a.type, a.created_by, a.created_at, a.deleted_at
		FROM annotation a
		JOIN annotation_version av ON a.annotation_id = av.annotation_id
		WHERE av.sentence_id = $1
		  AND a.deleted_at IS NULL
		  AND av.version = (
			SELECT MAX(version)
			FROM annotation_version
			WHERE annotation_id = a.annotation_id
		  )
		ORDER BY a.created_at
	`

	rows, err := db.Pool.Query(ctx, query, sentenceID)
	if err != nil {
		return nil, fmt.Errorf("failed to query annotations by sentence: %w", err)
	}
	defer rows.Close()

	var annotations []models.Annotation
	for rows.Next() {
		var a models.Annotation
		err := rows.Scan(
			&a.AnnotationID,
			&a.Type,
			&a.CreatedBy,
			&a.CreatedAt,
			&a.DeletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan annotation: %w", err)
		}
		annotations = append(annotations, a)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating annotations: %w", err)
	}

	return annotations, nil
}

// CreateAnnotation creates a new annotation with its first version
func (db *DB) CreateAnnotation(ctx context.Context, annotation *models.Annotation, version *models.AnnotationVersion) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Create annotation record
	query1 := `
		INSERT INTO annotation (type, created_by)
		VALUES ($1, $2)
		RETURNING annotation_id, created_at
	`
	err = tx.QueryRow(ctx, query1, annotation.Type, annotation.CreatedBy).Scan(
		&annotation.AnnotationID,
		&annotation.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create annotation: %w", err)
	}

	// Create first version
	payloadJSON, err := json.Marshal(version.Payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Get commit_hash and migration_id for this sentence (for origin_commit_hash and origin_migration_id)
	var commitHash string
	var migrationID int
	query_commit := `SELECT commit_hash, migration_id FROM sentence WHERE sentence_id = $1 LIMIT 1`
	if err := tx.QueryRow(ctx, query_commit, version.SentenceID).Scan(&commitHash, &migrationID); err != nil {
		return fmt.Errorf("failed to get commit hash and migration_id for sentence: %w", err)
	}

	// Empty array for sentence_id_history
	historyJSON, _ := json.Marshal([]string{})

	query2 := `
		INSERT INTO annotation_version (
			annotation_id, version, sentence_id, payload, migration_confidence,
			origin_sentence_id, origin_migration_id, origin_commit_hash, sentence_id_history, created_by
		)
		VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at
	`
	err = tx.QueryRow(ctx, query2,
		annotation.AnnotationID,
		version.SentenceID,
		payloadJSON,
		version.MigrationConfidence,
		version.SentenceID,    // origin_sentence_id = same as sentence_id for first version
		migrationID,          // origin_migration_id from sentence
		commitHash,           // origin_commit_hash from sentence
		historyJSON,          // empty history for first version
		annotation.CreatedBy,
	).Scan(&version.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create annotation version: %w", err)
	}

	version.AnnotationID = annotation.AnnotationID
	version.Version = 1
	version.OriginSentenceID = version.SentenceID
	version.OriginMigrationID = &migrationID
	version.OriginCommitHash = commitHash

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// UpdateAnnotation creates a new version of an existing annotation
func (db *DB) UpdateAnnotation(ctx context.Context, annotationID int, version *models.AnnotationVersion) error {
	// Get current max version and origin info
	var maxVersion int
	var originSentenceID, originCommitHash, createdBy string
	var originMigrationID *int
	query1 := `
		SELECT
			COALESCE(MAX(version), 0),
			MIN(origin_sentence_id),
			MIN(origin_migration_id),
			MIN(origin_commit_hash),
			MIN(created_by)
		FROM annotation_version
		WHERE annotation_id = $1
	`
	if err := db.Pool.QueryRow(ctx, query1, annotationID).Scan(&maxVersion, &originSentenceID, &originMigrationID, &originCommitHash, &createdBy); err != nil {
		return fmt.Errorf("failed to get version info: %w", err)
	}

	// Get current sentence_id_history from latest version
	var historyJSON []byte
	query_history := `
		SELECT sentence_id_history
		FROM annotation_version
		WHERE annotation_id = $1 AND version = $2
	`
	if err := db.Pool.QueryRow(ctx, query_history, annotationID, maxVersion).Scan(&historyJSON); err != nil {
		return fmt.Errorf("failed to get sentence history: %w", err)
	}

	// Unmarshal, append new sentence_id, re-marshal
	var history []string
	json.Unmarshal(historyJSON, &history)
	history = append(history, version.SentenceID)
	newHistoryJSON, _ := json.Marshal(history)

	// Create new version
	payloadJSON, err := json.Marshal(version.Payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	query2 := `
		INSERT INTO annotation_version (
			annotation_id, version, sentence_id, payload, migration_confidence,
			origin_sentence_id, origin_migration_id, origin_commit_hash, sentence_id_history, created_by
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at
	`
	err = db.Pool.QueryRow(ctx, query2,
		annotationID,
		maxVersion+1,
		version.SentenceID,
		payloadJSON,
		version.MigrationConfidence,
		originSentenceID,     // Keep original
		originMigrationID,    // Keep original
		originCommitHash,     // Keep original
		newHistoryJSON,
		createdBy,
	).Scan(&version.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create annotation version: %w", err)
	}

	version.AnnotationID = annotationID
	version.Version = maxVersion + 1
	version.OriginSentenceID = originSentenceID
	version.OriginMigrationID = originMigrationID
	version.OriginCommitHash = originCommitHash

	return nil
}

// SoftDeleteAnnotation marks an annotation as deleted
func (db *DB) SoftDeleteAnnotation(ctx context.Context, annotationID int) error {
	query := `
		UPDATE annotation
		SET deleted_at = NOW()
		WHERE annotation_id = $1
		  AND deleted_at IS NULL
	`
	result, err := db.Pool.Exec(ctx, query, annotationID)
	if err != nil {
		return fmt.Errorf("failed to soft delete annotation: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("annotation not found or already deleted")
	}

	return nil
}

// GetLatestAnnotationVersion retrieves the latest version of an annotation
func (db *DB) GetLatestAnnotationVersion(ctx context.Context, annotationID int) (*models.AnnotationVersion, error) {
	query := `
		SELECT
			annotation_id, version, sentence_id, payload,
			sentence_id_history, migration_confidence,
			origin_sentence_id, origin_migration_id, origin_commit_hash, created_at, created_by
		FROM annotation_version
		WHERE annotation_id = $1
		ORDER BY version DESC
		LIMIT 1
	`

	var av models.AnnotationVersion
	var payloadJSON []byte
	var historyJSON []byte

	err := db.Pool.QueryRow(ctx, query, annotationID).Scan(
		&av.AnnotationID,
		&av.Version,
		&av.SentenceID,
		&payloadJSON,
		&historyJSON,
		&av.MigrationConfidence,
		&av.OriginSentenceID,
		&av.OriginMigrationID,
		&av.OriginCommitHash,
		&av.CreatedAt,
		&av.CreatedBy,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get annotation version: %w", err)
	}

	// Unmarshal JSON fields
	if err := json.Unmarshal(payloadJSON, &av.Payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
	}
	if err := json.Unmarshal(historyJSON, &av.SentenceIDHistory); err != nil {
		return nil, fmt.Errorf("failed to unmarshal history: %w", err)
	}

	return &av, nil
}

// GetActiveAnnotationsForSentence retrieves all active annotations for a sentence
func (db *DB) GetActiveAnnotationsForSentence(ctx context.Context, sentenceID string) ([]models.Annotation, error) {
	query := `
		SELECT DISTINCT a.annotation_id, a.type, a.created_by, a.created_at, a.deleted_at
		FROM annotation a
		JOIN annotation_version av ON a.annotation_id = av.annotation_id
		WHERE av.sentence_id = $1
		  AND a.deleted_at IS NULL
		  AND av.version = (
			SELECT MAX(version)
			FROM annotation_version
			WHERE annotation_id = a.annotation_id
		  )
	`

	rows, err := db.Pool.Query(ctx, query, sentenceID)
	if err != nil {
		return nil, fmt.Errorf("failed to query annotations: %w", err)
	}
	defer rows.Close()

	var annotations []models.Annotation
	for rows.Next() {
		var a models.Annotation
		err := rows.Scan(
			&a.AnnotationID,
			&a.Type,
			&a.CreatedBy,
			&a.CreatedAt,
			&a.DeletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan annotation: %w", err)
		}
		annotations = append(annotations, a)
	}

	return annotations, nil
}
