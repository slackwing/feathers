package models

import (
	"time"
)

// Manuscript represents a manuscript being tracked
type Manuscript struct {
	ManuscriptID    int       `json:"manuscript_id"`
	RepoPath        string    `json:"repo_path"`
	StoryFilePath   string    `json:"story_file_path"`
	CreatedAt       time.Time `json:"created_at"`
}

// ProcessedCommit represents a git commit that has been processed
type ProcessedCommit struct {
	CommitHash       string    `json:"commit_hash"`
	ManuscriptID     int       `json:"manuscript_id"`
	ParentCommitHash *string   `json:"parent_commit_hash"`
	BranchName       string    `json:"branch_name"`
	ProcessedAt      time.Time `json:"processed_at"`
	SentenceCount    int       `json:"sentence_count"`
	AdditionsCount   int       `json:"additions_count"`
	DeletionsCount   int       `json:"deletions_count"`
	ChangesCount     int       `json:"changes_count"`
	SentenceIDArray  []string  `json:"sentence_id_array"`
}

// Sentence represents a sentence instance in a specific commit
type Sentence struct {
	SentenceID string    `json:"sentence_id"`
	CommitHash string    `json:"commit_hash"`
	Text       string    `json:"text"`
	WordCount  int       `json:"word_count"`
	Ordinal    int       `json:"ordinal"`
	CreatedAt  time.Time `json:"created_at"`
}

// Annotation represents a user annotation (highlight, tag, or task)
type Annotation struct {
	AnnotationID int        `json:"annotation_id"`
	Type         string     `json:"type"`
	CreatedBy    string     `json:"created_by"`
	CreatedAt    time.Time  `json:"created_at"`
	DeletedAt    *time.Time `json:"deleted_at"`
}

// AnnotationVersion represents a version of an annotation
type AnnotationVersion struct {
	AnnotationID        int                    `json:"annotation_id"`
	Version             int                    `json:"version"`
	SentenceID          string                 `json:"sentence_id"`
	Payload             map[string]interface{} `json:"payload"` // JSONB payload
	SentenceIDHistory   []string               `json:"sentence_id_history"`
	MigrationConfidence *float64               `json:"migration_confidence"`
	OriginSentenceID    string                 `json:"origin_sentence_id"`
	OriginCommitHash    string                 `json:"origin_commit_hash"`
	CreatedAt           time.Time              `json:"created_at"`
	CreatedBy           string                 `json:"created_by"`
}
