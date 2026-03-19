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
		r.Get("/manuscripts/{commit_hash}", s.handleGetManuscript)
		r.Get("/annotations/{commit_hash}", s.handleGetAnnotationsByCommit)
		r.Get("/annotations/sentence/{sentence_id}", s.handleGetAnnotationsBySentence)
		r.Post("/annotations", s.handleCreateAnnotation)
		r.Put("/annotations/{annotation_id}", s.handleUpdateAnnotation)
		r.Delete("/annotations/{annotation_id}", s.handleDeleteAnnotation)
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

// API Response types
type ManuscriptResponse struct {
	Markdown    string             `json:"markdown"`
	Sentences   []SentenceInfo     `json:"sentences"`
	Annotations []models.Annotation `json:"annotations"`
}

type SentenceInfo struct {
	ID        string `json:"id"`
	WordCount int    `json:"wordCount"`
}

type CreateAnnotationRequest struct {
	Type       string                 `json:"type"`
	SentenceID string                 `json:"sentence_id"`
	Payload    map[string]interface{} `json:"payload"`
}

type UpdateAnnotationRequest struct {
	SentenceID string                 `json:"sentence_id"`
	Payload    map[string]interface{} `json:"payload"`
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

// GET /api/manuscripts/:commit_hash
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
	if req.Type == "" || req.SentenceID == "" {
		http.Error(w, "Missing required fields: type, sentence_id", http.StatusBadRequest)
		return
	}

	// Create annotation
	annotation := &models.Annotation{
		Type:      req.Type,
		CreatedBy: "andrew", // Phase 1: hardcoded user
	}

	version := &models.AnnotationVersion{
		SentenceID:          req.SentenceID,
		Payload:             req.Payload,
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
	if req.SentenceID == "" {
		http.Error(w, "Missing required field: sentence_id", http.StatusBadRequest)
		return
	}

	version := &models.AnnotationVersion{
		SentenceID:          req.SentenceID,
		Payload:             req.Payload,
		MigrationConfidence: nil, // Manual edit, no migration
	}

	if err := s.db.UpdateAnnotation(ctx, annotationID, version); err != nil {
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
