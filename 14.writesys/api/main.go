package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"writesys/internal/database"
	"writesys/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type Server struct {
	router *chi.Mux
	db     *database.DB
}

type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
	Version  string `json:"version"`
}

func main() {
	// Get configuration from environment
	port := getEnv("API_PORT", "5000")
	host := getEnv("API_HOST", "0.0.0.0")

	// Create database connection
	ctx := context.Background()
	db, err := database.NewDB(ctx)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer db.Close()

	log.Println("Successfully connected to database")

	// Create server
	server := NewServer(db)

	// Create HTTP server
	addr := fmt.Sprintf("%s:%s", host, port)
	httpServer := &http.Server{
		Addr:         addr,
		Handler:      server.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Starting WriteSys API server on %s\n", addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v\n", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Graceful shutdown with timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v\n", err)
	}

	log.Println("Server stopped gracefully")
}

func NewServer(db *database.DB) *Server {
	s := &Server{
		router: chi.NewRouter(),
		db:     db,
	}

	// Middleware
	s.router.Use(middleware.RequestID)
	s.router.Use(middleware.RealIP)
	s.router.Use(middleware.Logger)
	s.router.Use(middleware.Recoverer)
	s.router.Use(middleware.Timeout(60 * time.Second))

	// CORS middleware for local development
	s.router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	// Routes
	s.setupRoutes()

	return s
}

func (s *Server) setupRoutes() {
	// Health check endpoint
	s.router.Get("/health", s.handleHealth)

	// API routes
	s.router.Route("/api", func(r chi.Router) {
		// Migration endpoints
		r.Get("/migrations", s.handleGetMigrations)
		r.Get("/migrations/latest", s.handleGetLatestMigration)
		r.Get("/migrations/{migration_id}/manuscript", s.handleGetManuscriptByMigration)

		// Legacy commit-based endpoints (backward compatible)
		r.Get("/commits", s.handleGetMigrations) // Alias for migrations
		r.Get("/manuscripts/{commit_hash}", s.handleGetManuscript)

		// Annotation endpoints
		r.Get("/annotations/{commit_hash}", s.handleGetAnnotationsByCommit)
		r.Get("/annotations/sentence/{sentence_id}", s.handleGetAnnotationsBySentence)
		r.Post("/annotations", s.handleCreateAnnotation)
		r.Put("/annotations/{annotation_id}", s.handleUpdateAnnotation)
		r.Put("/annotations/{annotation_id}/reorder", s.handleReorderAnnotation)
		r.Delete("/annotations/{annotation_id}", s.handleDeleteAnnotation)

		// Tag endpoints
		r.Get("/annotations/{annotation_id}/tags", s.handleGetTagsForAnnotation)
		r.Post("/annotations/{annotation_id}/tags", s.handleAddTagToAnnotation)
		r.Delete("/annotations/{annotation_id}/tags/{tag_id}", s.handleRemoveTagFromAnnotation)
	})

	// Serve static files (web UI)
	workDir, _ := os.Getwd()
	filesDir := http.Dir(fmt.Sprintf("%s/web", workDir))
	FileServer(s.router, "/", filesDir)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check database connection
	dbStatus := "connected"
	if err := s.db.Pool.Ping(ctx); err != nil {
		dbStatus = fmt.Sprintf("error: %v", err)
	}

	response := HealthResponse{
		Status:   "ok",
		Database: dbStatus,
		Version:  "0.1.0-dev",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GET /api/migrations
// Returns list of migrations for a manuscript
func (s *Server) handleGetMigrations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get manuscript ID from query params
	manuscriptIDStr := r.URL.Query().Get("manuscript_id")
	manuscriptID := 1 // Default to first manuscript
	if manuscriptIDStr != "" {
		var err error
		manuscriptID, err = strconv.Atoi(manuscriptIDStr)
		if err != nil {
			http.Error(w, "Invalid manuscript_id", http.StatusBadRequest)
			return
		}
	}

	migrations, err := s.db.GetMigrations(ctx, manuscriptID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get migrations: %v", err), http.StatusInternalServerError)
		return
	}

	// Convert to simplified response (don't send full sentence_id_array)
	type MigrationInfo struct {
		MigrationID    int       `json:"migration_id"`
		CommitHash     string    `json:"commit_hash"`
		Segmenter      string    `json:"segmenter"`
		BranchName     string    `json:"branch_name"`
		ProcessedAt    time.Time `json:"processed_at"`
		SentenceCount  int       `json:"sentence_count"`
		AdditionsCount int       `json:"additions_count"`
		DeletionsCount int       `json:"deletions_count"`
		ChangesCount   int       `json:"changes_count"`
	}

	migrationInfos := make([]MigrationInfo, len(migrations))
	for i, m := range migrations {
		migrationInfos[i] = MigrationInfo{
			MigrationID:    m.MigrationID,
			CommitHash:     m.CommitHash,
			Segmenter:      m.Segmenter,
			BranchName:     m.BranchName,
			ProcessedAt:    m.ProcessedAt,
			SentenceCount:  m.SentenceCount,
			AdditionsCount: m.AdditionsCount,
			DeletionsCount: m.DeletionsCount,
			ChangesCount:   m.ChangesCount,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"migrations": migrationInfos,
	})
}

// GET /api/migrations/latest
// Returns the latest migration for a manuscript
func (s *Server) handleGetLatestMigration(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get manuscript ID from query params
	manuscriptIDStr := r.URL.Query().Get("manuscript_id")
	manuscriptID := 1 // Default to first manuscript
	if manuscriptIDStr != "" {
		var err error
		manuscriptID, err = strconv.Atoi(manuscriptIDStr)
		if err != nil {
			http.Error(w, "Invalid manuscript_id", http.StatusBadRequest)
			return
		}
	}

	migration, err := s.db.GetLatestMigration(ctx, manuscriptID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get latest migration: %v", err), http.StatusInternalServerError)
		return
	}

	if migration == nil {
		http.Error(w, "No migrations found", http.StatusNotFound)
		return
	}

	// Return simplified response
	type MigrationInfo struct {
		MigrationID    int       `json:"migration_id"`
		CommitHash     string    `json:"commit_hash"`
		Segmenter      string    `json:"segmenter"`
		BranchName     string    `json:"branch_name"`
		ProcessedAt    time.Time `json:"processed_at"`
		SentenceCount  int       `json:"sentence_count"`
		AdditionsCount int       `json:"additions_count"`
		DeletionsCount int       `json:"deletions_count"`
		ChangesCount   int       `json:"changes_count"`
	}

	migrationInfo := MigrationInfo{
		MigrationID:    migration.MigrationID,
		CommitHash:     migration.CommitHash,
		Segmenter:      migration.Segmenter,
		BranchName:     migration.BranchName,
		ProcessedAt:    migration.ProcessedAt,
		SentenceCount:  migration.SentenceCount,
		AdditionsCount: migration.AdditionsCount,
		DeletionsCount: migration.DeletionsCount,
		ChangesCount:   migration.ChangesCount,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(migrationInfo)
}

// API Response types
type ManuscriptResponse struct {
	Markdown    string             `json:"markdown"`
	Sentences   []SentenceInfo     `json:"sentences"`
	Annotations []models.Annotation `json:"annotations"`
}

type SentenceInfo struct {
	ID        string `json:"id"`
	Text      string `json:"text"`
	WordCount int    `json:"wordCount"`
}

type CreateAnnotationRequest struct {
	SentenceID string  `json:"sentence_id"`
	Color      string  `json:"color"`
	Note       *string `json:"note"`
	Priority   string  `json:"priority"`
	Flagged    bool    `json:"flagged"`
}

type UpdateAnnotationRequest struct {
	SentenceID string  `json:"sentence_id"`
	Color      string  `json:"color"`
	Note       *string `json:"note"`
	Priority   string  `json:"priority"`
	Flagged    bool    `json:"flagged"`
}

// Helper function to get manuscript file from git
func getFileFromGit(repoPath, commitHash, filePath string) (string, error) {
	cmd := exec.Command("git", "-C", repoPath, "show", fmt.Sprintf("%s:%s", commitHash, filePath))
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get file from git: %w", err)
	}
	return string(output), nil
}

// GET /api/migrations/:migration_id/manuscript
// Returns markdown content, sentence list, and annotations for a migration
func (s *Server) handleGetManuscriptByMigration(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	migrationIDStr := chi.URLParam(r, "migration_id")
	migrationID, err := strconv.Atoi(migrationIDStr)
	if err != nil {
		http.Error(w, "Invalid migration_id", http.StatusBadRequest)
		return
	}

	// Get migration info
	migration, err := s.db.GetMigrationByID(ctx, migrationID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get migration: %v", err), http.StatusInternalServerError)
		return
	}
	if migration == nil {
		http.Error(w, "Migration not found", http.StatusNotFound)
		return
	}

	// Get manuscript metadata
	repoPath := r.URL.Query().Get("repo")
	filePath := r.URL.Query().Get("file")
	if repoPath == "" || filePath == "" {
		http.Error(w, "Missing repo or file query parameters", http.StatusBadRequest)
		return
	}

	// Get markdown content from git using commit hash from migration
	markdown, err := getFileFromGit(repoPath, migration.CommitHash, filePath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get file from git: %v", err), http.StatusInternalServerError)
		return
	}

	// Get sentences from database by migration_id
	sentences, err := s.db.GetSentencesByMigration(ctx, migrationID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get sentences: %v", err), http.StatusInternalServerError)
		return
	}

	// Convert to sentence info
	sentenceInfos := make([]SentenceInfo, len(sentences))
	for i, s := range sentences {
		sentenceInfos[i] = SentenceInfo{
			ID:        s.SentenceID,
			Text:      s.Text,
			WordCount: s.WordCount,
		}
	}

	// Get annotations for this commit (still using commit_hash for now)
	annotations, err := s.db.GetAnnotationsByCommit(ctx, migration.CommitHash)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get annotations: %v", err), http.StatusInternalServerError)
		return
	}

	response := ManuscriptResponse{
		Markdown:    markdown,
		Sentences:   sentenceInfos,
		Annotations: annotations,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GET /api/manuscripts/:commit_hash (legacy endpoint for backward compatibility)
// Returns markdown content, sentence list, and annotations
func (s *Server) handleGetManuscript(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	commitHash := chi.URLParam(r, "commit_hash")

	// Get manuscript info from database
	// For now, we'll assume repo_path and file_path from query params or config
	// TODO: Store manuscript metadata in session or config
	repoPath := r.URL.Query().Get("repo")
	filePath := r.URL.Query().Get("file")

	if repoPath == "" || filePath == "" {
		http.Error(w, "Missing repo or file query parameters", http.StatusBadRequest)
		return
	}

	// Get markdown content from git
	markdown, err := getFileFromGit(repoPath, commitHash, filePath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get file from git: %v", err), http.StatusInternalServerError)
		return
	}

	// Get sentences from database
	sentences, err := s.db.GetSentencesByCommit(ctx, commitHash)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get sentences: %v", err), http.StatusInternalServerError)
		return
	}

	// Convert to sentence info
	sentenceInfos := make([]SentenceInfo, len(sentences))
	for i, s := range sentences {
		sentenceInfos[i] = SentenceInfo{
			ID:        s.SentenceID,
			Text:      s.Text,
			WordCount: s.WordCount,
		}
	}

	// Get annotations
	annotations, err := s.db.GetAnnotationsByCommit(ctx, commitHash)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get annotations: %v", err), http.StatusInternalServerError)
		return
	}

	response := ManuscriptResponse{
		Markdown:    markdown,
		Sentences:   sentenceInfos,
		Annotations: annotations,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GET /api/annotations/:commit_hash
// Returns all annotations for a commit
func (s *Server) handleGetAnnotationsByCommit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	commitHash := chi.URLParam(r, "commit_hash")

	annotations, err := s.db.GetAnnotationsByCommit(ctx, commitHash)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get annotations: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"annotations": annotations,
	})
}

// GET /api/annotations/sentence/:sentence_id
// Returns annotations for a specific sentence
func (s *Server) handleGetAnnotationsBySentence(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	sentenceID := chi.URLParam(r, "sentence_id")

	annotations, err := s.db.GetAnnotationsBySentence(ctx, sentenceID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get annotations: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"annotations": annotations,
	})
}

// POST /api/annotations
// Creates a new annotation
func (s *Server) handleCreateAnnotation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req CreateAnnotationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Color == "" || req.SentenceID == "" {
		http.Error(w, "Missing required fields: color, sentence_id", http.StatusBadRequest)
		return
	}

	// Set default priority if empty
	priority := req.Priority
	if priority == "" {
		priority = "none"
	}

	// Create annotation
	annotation := &models.Annotation{
		SentenceID: req.SentenceID,
		UserID:     "andrew", // Phase 1: hardcoded user
		Color:      req.Color,
		Note:       req.Note,
		Priority:   priority,
		Flagged:    req.Flagged,
	}

	version := &models.AnnotationVersion{
		MigrationConfidence: nil, // First version, no migration
	}

	if err := s.db.CreateAnnotation(ctx, annotation, version); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create annotation: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"annotation_id": annotation.AnnotationID,
		"version":       version.Version,
	})
}

// PUT /api/annotations/:annotation_id
// Updates an annotation (creates new version)
func (s *Server) handleUpdateAnnotation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	annotationIDStr := chi.URLParam(r, "annotation_id")
	annotationID, err := strconv.Atoi(annotationIDStr)
	if err != nil {
		http.Error(w, "Invalid annotation_id", http.StatusBadRequest)
		return
	}

	var req UpdateAnnotationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.SentenceID == "" || req.Color == "" {
		http.Error(w, "Missing required fields: sentence_id, color", http.StatusBadRequest)
		return
	}

	// Set default priority if empty
	priority := req.Priority
	if priority == "" {
		priority = "none"
	}

	annotation := &models.Annotation{
		SentenceID: req.SentenceID,
		Color:      req.Color,
		Note:       req.Note,
		Priority:   priority,
		Flagged:    req.Flagged,
	}

	version := &models.AnnotationVersion{
		MigrationConfidence: nil, // Manual edit, no migration
	}

	if err := s.db.UpdateAnnotation(ctx, annotationID, annotation, version); err != nil {
		http.Error(w, fmt.Sprintf("Failed to update annotation: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"annotation_id": version.AnnotationID,
		"version":       version.Version,
	})
}

// DELETE /api/annotations/:annotation_id
// Soft deletes an annotation
func (s *Server) handleDeleteAnnotation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	annotationIDStr := chi.URLParam(r, "annotation_id")
	annotationID, err := strconv.Atoi(annotationIDStr)
	if err != nil {
		http.Error(w, "Invalid annotation_id", http.StatusBadRequest)
		return
	}

	if err := s.db.SoftDeleteAnnotation(ctx, annotationID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			http.Error(w, "Annotation not found", http.StatusNotFound)
		} else {
			http.Error(w, fmt.Sprintf("Failed to delete annotation: %v", err), http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GET /api/annotations/:annotation_id/tags
// Returns all tags for a specific annotation
func (s *Server) handleGetTagsForAnnotation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	annotationIDStr := chi.URLParam(r, "annotation_id")
	annotationID, err := strconv.Atoi(annotationIDStr)
	if err != nil {
		http.Error(w, "Invalid annotation_id", http.StatusBadRequest)
		return
	}

	tags, err := s.db.GetTagsForAnnotation(ctx, annotationID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get tags: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tags": tags,
	})
}

// POST /api/annotations/:annotation_id/tags
// Adds a tag to an annotation
func (s *Server) handleAddTagToAnnotation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	annotationIDStr := chi.URLParam(r, "annotation_id")
	annotationID, err := strconv.Atoi(annotationIDStr)
	if err != nil {
		http.Error(w, "Invalid annotation_id", http.StatusBadRequest)
		return
	}

	var req struct {
		TagName     string `json:"tag_name"`
		MigrationID int    `json:"migration_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.TagName == "" || req.MigrationID == 0 {
		http.Error(w, "Missing required fields: tag_name, migration_id", http.StatusBadRequest)
		return
	}

	if err := s.db.AddTagToAnnotation(ctx, annotationID, req.TagName, req.MigrationID); err != nil {
		http.Error(w, fmt.Sprintf("Failed to add tag: %v", err), http.StatusInternalServerError)
		return
	}

	// Get all tags for the annotation to return
	tags, err := s.db.GetTagsForAnnotation(ctx, annotationID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get tags: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tags": tags,
	})
}

// DELETE /api/annotations/:annotation_id/tags/:tag_id
// Removes a tag from an annotation
func (s *Server) handleRemoveTagFromAnnotation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	annotationIDStr := chi.URLParam(r, "annotation_id")
	tagIDStr := chi.URLParam(r, "tag_id")

	annotationID, err := strconv.Atoi(annotationIDStr)
	if err != nil {
		http.Error(w, "Invalid annotation_id", http.StatusBadRequest)
		return
	}

	tagID, err := strconv.Atoi(tagIDStr)
	if err != nil {
		http.Error(w, "Invalid tag_id", http.StatusBadRequest)
		return
	}

	if err := s.db.RemoveTagFromAnnotation(ctx, annotationID, tagID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			http.Error(w, "Tag not found on annotation", http.StatusNotFound)
		} else {
			http.Error(w, fmt.Sprintf("Failed to remove tag: %v", err), http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// FileServer conveniently sets up a http.FileServer handler to serve
// static files from a http.FileSystem.
func FileServer(r chi.Router, path string, root http.FileSystem) {
	if path != "/" && path[len(path)-1] != '/' {
		r.Get(path, http.RedirectHandler(path+"/", http.StatusMovedPermanently).ServeHTTP)
		path += "/"
	}
	path += "*"

	r.Get(path, func(w http.ResponseWriter, r *http.Request) {
		rctx := chi.RouteContext(r.Context())
		pathPrefix := strings.TrimSuffix(rctx.RoutePattern(), "/*")
		fs := http.StripPrefix(pathPrefix, http.FileServer(root))
		fs.ServeHTTP(w, r)
	})
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// ReorderAnnotationRequest is the request payload for reordering an annotation
type ReorderAnnotationRequest struct {
	SentenceID string `json:"sentence_id"`
	NewIndex   int    `json:"new_index"`
}

// PUT /api/annotations/:annotation_id/reorder
// Reorders an annotation to a new position
func (s *Server) handleReorderAnnotation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	annotationIDStr := chi.URLParam(r, "annotation_id")
	annotationID, err := strconv.Atoi(annotationIDStr)
	if err != nil {
		http.Error(w, "Invalid annotation_id", http.StatusBadRequest)
		return
	}

	var req ReorderAnnotationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.SentenceID == "" {
		http.Error(w, "Missing required field: sentence_id", http.StatusBadRequest)
		return
	}

	if req.NewIndex < 0 {
		http.Error(w, "Invalid new_index: must be >= 0", http.StatusBadRequest)
		return
	}

	// Reorder the annotation
	if err := s.db.ReorderAnnotation(ctx, annotationID, req.SentenceID, req.NewIndex); err != nil {
		log.Printf("Failed to reorder annotation: %v", err)
		http.Error(w, fmt.Sprintf("Failed to reorder annotation: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Annotation reordered successfully"})
}
