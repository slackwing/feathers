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

// GetLatestProcessedCommit gets the most recent processed commit for a manuscript
func (db *DB) GetLatestProcessedCommit(ctx context.Context, manuscriptID int) (*models.ProcessedCommit, error) {
	query := `
		SELECT commit_hash, manuscript_id, parent_commit_hash, branch_name,
		       processed_at, sentence_count, additions_count, deletions_count,
		       changes_count, sentence_id_array
		FROM processed_commit
		WHERE manuscript_id = $1
		ORDER BY processed_at DESC
		LIMIT 1
	`

	var pc models.ProcessedCommit
	var sentenceIDArrayJSON []byte

	err := db.Pool.QueryRow(ctx, query, manuscriptID).Scan(
		&pc.CommitHash,
		&pc.ManuscriptID,
		&pc.ParentCommitHash,
		&pc.BranchName,
		&pc.ProcessedAt,
		&pc.SentenceCount,
		&pc.AdditionsCount,
		&pc.DeletionsCount,
		&pc.ChangesCount,
		&sentenceIDArrayJSON,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get latest processed commit: %w", err)
	}

	// Parse JSONB array
	if err := json.Unmarshal(sentenceIDArrayJSON, &pc.SentenceIDArray); err != nil {
		return nil, fmt.Errorf("failed to parse sentence_id_array: %w", err)
	}

	return &pc, nil
}

// GetProcessedCommits gets all processed commits for a manuscript, ordered by most recent first
func (db *DB) GetProcessedCommits(ctx context.Context, manuscriptID int) ([]models.ProcessedCommit, error) {
	query := `
		SELECT commit_hash, manuscript_id, parent_commit_hash, branch_name,
		       processed_at, sentence_count, additions_count, deletions_count,
		       changes_count, sentence_id_array
		FROM processed_commit
		WHERE manuscript_id = $1
		ORDER BY processed_at DESC
	`

	rows, err := db.Pool.Query(ctx, query, manuscriptID)
	if err != nil {
		return nil, fmt.Errorf("failed to get processed commits: %w", err)
	}
	defer rows.Close()

	var commits []models.ProcessedCommit
	for rows.Next() {
		var pc models.ProcessedCommit
		var sentenceIDArrayJSON []byte

		err := rows.Scan(
			&pc.CommitHash,
			&pc.ManuscriptID,
			&pc.ParentCommitHash,
			&pc.BranchName,
			&pc.ProcessedAt,
			&pc.SentenceCount,
			&pc.AdditionsCount,
			&pc.DeletionsCount,
			&pc.ChangesCount,
			&sentenceIDArrayJSON,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan processed commit: %w", err)
		}

		// Parse JSONB array
		if err := json.Unmarshal(sentenceIDArrayJSON, &pc.SentenceIDArray); err != nil {
			return nil, fmt.Errorf("failed to parse sentence_id_array: %w", err)
		}

		commits = append(commits, pc)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating processed commits: %w", err)
	}

	return commits, nil
}

// CreateProcessedCommit creates a new processed commit record
func (db *DB) CreateProcessedCommit(ctx context.Context, pc *models.ProcessedCommit) error {
	// Convert sentence ID array to JSON
	sentenceIDArrayJSON, err := json.Marshal(pc.SentenceIDArray)
	if err != nil {
		return fmt.Errorf("failed to marshal sentence_id_array: %w", err)
	}

	query := `
		INSERT INTO processed_commit (
			commit_hash, manuscript_id, parent_commit_hash, branch_name,
			sentence_count, additions_count, deletions_count, changes_count,
			sentence_id_array
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err = db.Pool.Exec(ctx, query,
		pc.CommitHash,
		pc.ManuscriptID,
		pc.ParentCommitHash,
		pc.BranchName,
		pc.SentenceCount,
		pc.AdditionsCount,
		pc.DeletionsCount,
		pc.ChangesCount,
		sentenceIDArrayJSON,
	)
	if err != nil {
		return fmt.Errorf("failed to create processed commit: %w", err)
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
		INSERT INTO sentence (sentence_id, commit_hash, text, word_count, ordinal)
		VALUES ($1, $2, $3, $4, $5)
	`

	for _, s := range sentences {
		_, err := tx.Exec(ctx, query,
			s.SentenceID,
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

// GetSentencesByCommit retrieves all sentences for a given commit
func (db *DB) GetSentencesByCommit(ctx context.Context, commitHash string) ([]models.Sentence, error) {
	query := `
		SELECT sentence_id, commit_hash, text, word_count, ordinal, created_at
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

	// Get commit_hash for this sentence (for origin_commit_hash)
	var commitHash string
	query_commit := `SELECT commit_hash FROM sentence WHERE sentence_id = $1 LIMIT 1`
	if err := tx.QueryRow(ctx, query_commit, version.SentenceID).Scan(&commitHash); err != nil {
		return fmt.Errorf("failed to get commit hash for sentence: %w", err)
	}

	// Empty array for sentence_id_history
	historyJSON, _ := json.Marshal([]string{})

	query2 := `
		INSERT INTO annotation_version (
			annotation_id, version, sentence_id, payload, migration_confidence,
			origin_sentence_id, origin_commit_hash, sentence_id_history, created_by
		)
		VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at
	`
	err = tx.QueryRow(ctx, query2,
		annotation.AnnotationID,
		version.SentenceID,
		payloadJSON,
		version.MigrationConfidence,
		version.SentenceID,    // origin_sentence_id = same as sentence_id for first version
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
	query1 := `
		SELECT
			COALESCE(MAX(version), 0),
			MIN(origin_sentence_id),
			MIN(origin_commit_hash),
			MIN(created_by)
		FROM annotation_version
		WHERE annotation_id = $1
	`
	if err := db.Pool.QueryRow(ctx, query1, annotationID).Scan(&maxVersion, &originSentenceID, &originCommitHash, &createdBy); err != nil {
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
			origin_sentence_id, origin_commit_hash, sentence_id_history, created_by
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at
	`
	err = db.Pool.QueryRow(ctx, query2,
		annotationID,
		maxVersion+1,
		version.SentenceID,
		payloadJSON,
		version.MigrationConfidence,
		originSentenceID,  // Keep original
		originCommitHash,  // Keep original
		newHistoryJSON,
		createdBy,
	).Scan(&version.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create annotation version: %w", err)
	}

	version.AnnotationID = annotationID
	version.Version = maxVersion + 1
	version.OriginSentenceID = originSentenceID
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
			origin_sentence_id, origin_commit_hash, created_at, created_by
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
