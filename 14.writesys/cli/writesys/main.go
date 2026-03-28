package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"writesys/internal/database"
	"writesys/internal/models"
	"writesys/internal/sentence"
)

func main() {
	// Parse flags
	repoPath := flag.String("repo", "", "Path to git repository")
	storyFile := flag.String("file", "", "Story file name (e.g., the-wildfire.manuscript)")
	commitHash := flag.String("commit", "", "Specific commit to process")
	yes := flag.Bool("yes", false, "Skip confirmations")
	flag.Parse()

	ctx := context.Background()

	// Read segmenter version
	segmenterVersion := getSegmenterVersion()
	fmt.Printf("Using segmenter version: %s\n\n", segmenterVersion)

	// Connect to database
	db, err := database.NewDB(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	fmt.Println("WriteSys - Book Annotation System")
	fmt.Println("==================================")
	fmt.Println()

	// Get repository and file paths
	repo := *repoPath
	file := *storyFile

	if repo == "" || file == "" {
		repo, file = promptForManuscript()
	}

	// Normalize repo path (expand ~, convert relative to absolute)
	repo = normalizeRepoPath(repo)

	// Validate repository
	if !isGitRepo(repo) {
		log.Fatalf("Error: %s is not a git repository", repo)
	}

	// Get or create manuscript
	manuscript, err := db.GetManuscript(ctx, repo, file)
	if err != nil {
		log.Fatalf("Failed to get manuscript: %v", err)
	}

	if manuscript == nil {
		fmt.Printf("Creating new manuscript entry...\n")
		manuscript, err = db.CreateManuscript(ctx, repo, file)
		if err != nil {
			log.Fatalf("Failed to create manuscript: %v", err)
		}
		fmt.Printf("✓ Manuscript created (ID: %d)\n\n", manuscript.ManuscriptID)
	} else {
		fmt.Printf("Found existing manuscript (ID: %d)\n\n", manuscript.ManuscriptID)
	}

	// Check for latest migration
	latestMigration, err := db.GetLatestMigration(ctx, manuscript.ManuscriptID)
	if err != nil {
		log.Fatalf("Failed to get latest migration: %v", err)
	}

	if latestMigration == nil {
		fmt.Println("No migrations processed yet. Starting bootstrap...")
		fmt.Println()

		// Bootstrap mode: process the first commit
		if *commitHash == "" {
			*commitHash = getLatestCommitHash(repo, file)
		}

		if !*yes {
			fmt.Printf("Process commit %s? [y/N]: ", *commitHash)
			var response string
			fmt.Scanln(&response)
			if strings.ToLower(response) != "y" {
				fmt.Println("Aborted.")
				return
			}
		}

		if err := processCommit(ctx, db, manuscript, *commitHash, nil, repo, file, segmenterVersion); err != nil {
			log.Fatalf("Failed to process commit: %v", err)
		}

		fmt.Println("\n✓ Bootstrap complete!")
	} else {
		fmt.Printf("Latest migration: %s (segmenter: %s)\n", latestMigration.CommitHash, latestMigration.Segmenter)
		fmt.Printf("  Branch: %s\n", latestMigration.BranchName)
		fmt.Printf("  Sentences: %d\n", latestMigration.SentenceCount)
		fmt.Printf("  Processed: %s\n\n", latestMigration.ProcessedAt.Format("2006-01-02 15:04:05"))

		// Process next commit with migration
		if *commitHash == "" {
			*commitHash = getLatestCommitHash(repo, file)
		}

		// Check if this exact commit+segmenter combination is already processed
		existingMigration, err := db.GetMigrationByCommitAndSegmenter(ctx, manuscript.ManuscriptID, *commitHash, segmenterVersion)
		if err != nil {
			log.Fatalf("Failed to check for existing migration: %v", err)
		}

		if existingMigration != nil {
			fmt.Printf("This commit with segmenter %s is already processed (migration_id: %d).\n", segmenterVersion, existingMigration.MigrationID)
			return
		}

		// Check if commit is same but segmenter version is different (re-segmentation)
		if *commitHash == latestMigration.CommitHash && segmenterVersion != latestMigration.Segmenter {
			fmt.Printf("Re-processing commit %s with new segmenter version (%s -> %s)\n", *commitHash, latestMigration.Segmenter, segmenterVersion)
		}

		if !*yes {
			fmt.Printf("Process commit %s with migration? [y/N]: ", *commitHash)
			var response string
			fmt.Scanln(&response)
			if strings.ToLower(response) != "y" {
				fmt.Println("Aborted.")
				return
			}
		}

		parentMigrationID := latestMigration.MigrationID
		if err := processCommitWithMigration(ctx, db, manuscript, *commitHash, &parentMigrationID, repo, file, segmenterVersion); err != nil {
			log.Fatalf("Failed to process commit: %v", err)
		}

		fmt.Println("\n✓ Migration complete!")
	}
}

func promptForManuscript() (string, string) {
	var repo, file string

	fmt.Print("Repository path: ")
	fmt.Scanln(&repo)

	// Expand ~ to home directory
	if strings.HasPrefix(repo, "~/") {
		home, _ := os.UserHomeDir()
		repo = filepath.Join(home, repo[2:])
	}

	fmt.Print("Story file name: ")
	fmt.Scanln(&file)

	return repo, file
}

// normalizeRepoPath converts relative paths to absolute paths
// and expands ~ to home directory
func normalizeRepoPath(path string) string {
	// Expand ~ to home directory
	if strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			log.Fatalf("Failed to get home directory: %v", err)
		}
		path = filepath.Join(home, path[2:])
	}

	// Convert to absolute path
	absPath, err := filepath.Abs(path)
	if err != nil {
		log.Fatalf("Failed to resolve absolute path for %s: %v", path, err)
	}

	return absPath
}

func isGitRepo(path string) bool {
	gitDir := filepath.Join(path, ".git")
	info, err := os.Stat(gitDir)
	return err == nil && info.IsDir()
}

func getSegmenterVersion() string {
	// Try to read VERSION.json from current directory
	versionFile := "VERSION.json"
	data, err := os.ReadFile(versionFile)
	if err != nil {
		// Default to 1.0.0 if file doesn't exist
		return "segman-1.0.0"
	}

	var versionData struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(data, &versionData); err != nil {
		log.Printf("Warning: Failed to parse %s: %v (using default)\n", versionFile, err)
		return "segman-1.0.0"
	}

	if versionData.Version == "" {
		return "segman-1.0.0"
	}

	// Ensure it has the "segman-" prefix
	if !strings.HasPrefix(versionData.Version, "segman-") {
		return "segman-" + versionData.Version
	}

	return versionData.Version
}

func getLatestCommitHash(repo, filePath string) string {
	// Get the latest commit that modified this specific file
	cmd := exec.Command("git", "-C", repo, "log", "-n", "1", "--format=%H", "--", filePath)
	output, err := cmd.Output()
	if err != nil {
		log.Fatalf("Failed to get latest commit for file %s: %v", filePath, err)
	}
	hash := strings.TrimSpace(string(output))
	if hash == "" {
		log.Fatalf("No commits found for file %s", filePath)
	}
	return hash
}

func getBranchName(repo string) string {
	cmd := exec.Command("git", "-C", repo, "rev-parse", "--abbrev-ref", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(output))
}

func getFileContent(repo, commitHash, filePath string) (string, error) {
	cmd := exec.Command("git", "-C", repo, "show", fmt.Sprintf("%s:%s", commitHash, filePath))
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get file content: %w", err)
	}
	return string(output), nil
}

func processCommit(
	ctx context.Context,
	db *database.DB,
	manuscript *models.Manuscript,
	commitHash string,
	parentMigrationID *int,
	repoPath string,
	filePath string,
	segmenterVersion string,
) error {
	fmt.Printf("Processing commit %s...\n", commitHash)

	// Get file content at this commit
	content, err := getFileContent(repoPath, commitHash, filePath)
	if err != nil {
		return fmt.Errorf("failed to get file content: %w", err)
	}

	// Tokenize into sentences
	fmt.Print("  Tokenizing sentences... ")
	tokenizer := sentence.NewTokenizer()
	sentences := tokenizer.SplitIntoSentences(content)
	fmt.Printf("%d sentences found\n", len(sentences))

	// Create migration record first (required by foreign key)
	fmt.Print("  Creating migration record... ")
	branchName := getBranchName(repoPath)

	// Generate sentence IDs temporarily to get count
	var sentenceIDs []string
	for i, sentText := range sentences {
		sentID := sentence.GenerateSentenceID(sentText, i, commitHash)
		sentenceIDs = append(sentenceIDs, sentID)
	}

	migration := &models.Migration{
		ManuscriptID:      manuscript.ManuscriptID,
		CommitHash:        commitHash,
		Segmenter:         segmenterVersion,
		ParentMigrationID: parentMigrationID,
		BranchName:        branchName,
		SentenceCount:     len(sentences),
		AdditionsCount:    len(sentences), // Bootstrap: all are additions
		DeletionsCount:    0,
		ChangesCount:      0,
		SentenceIDArray:   sentenceIDs,
	}

	if err := db.CreateMigration(ctx, migration); err != nil {
		return fmt.Errorf("failed to create migration: %w", err)
	}
	fmt.Printf("Done (migration_id: %d)\n", migration.MigrationID)

	// Generate sentence models with migration_id
	fmt.Print("  Generating sentence models... ")
	var sentenceModels []models.Sentence
	for i, sentText := range sentences {
		sentID := sentence.GenerateSentenceID(sentText, i, commitHash)
		wordCount := sentence.CountWords(sentText)

		sentenceModels = append(sentenceModels, models.Sentence{
			SentenceID:  sentID,
			MigrationID: migration.MigrationID,
			CommitHash:  commitHash,
			Text:        sentText,
			WordCount:   wordCount,
			Ordinal:     i,
		})
	}
	fmt.Println("Done")

	// Now store sentences in database
	fmt.Print("  Storing sentences in database... ")
	if err := db.CreateSentences(ctx, sentenceModels); err != nil {
		return fmt.Errorf("failed to store sentences: %w", err)
	}
	fmt.Println("Done")

	shortHash := commitHash
	if len(commitHash) > 8 {
		shortHash = commitHash[:8]
	}
	fmt.Printf("\n✓ Processed %d sentences from commit %s\n", len(sentences), shortHash)

	return nil
}

func processCommitWithMigration(
	ctx context.Context,
	db *database.DB,
	manuscript *models.Manuscript,
	commitHash string,
	parentMigrationID *int,
	repoPath string,
	filePath string,
	segmenterVersion string,
) error {
	fmt.Printf("Processing commit %s with migration...\n", commitHash)

	// Get old sentences from parent migration
	fmt.Print("  Loading sentences from parent migration... ")
	oldSentences, err := db.GetSentencesByMigration(ctx, *parentMigrationID)
	if err != nil {
		return fmt.Errorf("failed to get old sentences: %w", err)
	}
	fmt.Printf("%d sentences\n", len(oldSentences))

	// Build map of old sentences
	oldSentenceMap := make(map[string]string)
	for _, s := range oldSentences {
		oldSentenceMap[s.SentenceID] = s.Text
	}

	// Get file content at new commit
	content, err := getFileContent(repoPath, commitHash, filePath)
	if err != nil {
		return fmt.Errorf("failed to get file content: %w", err)
	}

	// Tokenize new sentences
	fmt.Print("  Tokenizing new sentences... ")
	tokenizer := sentence.NewTokenizer()
	newSentenceTexts := tokenizer.SplitIntoSentences(content)
	fmt.Printf("%d sentences found\n", len(newSentenceTexts))

	// Generate IDs for new sentences (first pass to get IDs for diff)
	fmt.Print("  Generating sentence IDs... ")
	var newSentenceIDs []string
	newSentenceMap := make(map[string]string)

	for i, sentText := range newSentenceTexts {
		sentID := sentence.GenerateSentenceID(sentText, i, commitHash)
		newSentenceIDs = append(newSentenceIDs, sentID)
		newSentenceMap[sentID] = sentText
	}
	fmt.Println("Done")

	// Compute diff
	fmt.Print("  Computing sentence diff... ")
	diff := sentence.ComputeSentenceDiff(oldSentenceMap, newSentenceMap)
	fmt.Printf("Added: %d, Deleted: %d, Unchanged: %d\n",
		len(diff.Added), len(diff.Deleted), len(diff.Unchanged))

	// Compute migration map
	fmt.Print("  Computing migration mappings... ")
	migrations := sentence.ComputeMigrationMap(diff)
	fmt.Println("Done")

	// Build mapping from old sentence ID to new sentence ID
	migrationMap := make(map[string]string)
	confidenceMap := make(map[string]float64)
	for _, m := range migrations {
		if m.NewSentenceID != "" {
			migrationMap[m.OldSentenceID] = m.NewSentenceID
			confidenceMap[m.OldSentenceID] = m.Similarity
		}
	}

	// Display migration summary
	fmt.Println("\n  Migration Summary:")
	matchTypeCounts := make(map[string]int)
	for _, m := range migrations {
		matchTypeCounts[m.MatchType]++
	}
	for matchType, count := range matchTypeCounts {
		fmt.Printf("    %s: %d\n", matchType, count)
	}

	// Display a few examples of interesting migrations
	fmt.Println("\n  Sample Migrations:")
	sampleCount := 0
	for _, m := range migrations {
		if m.MatchType != "exact" && sampleCount < 3 {
			fmt.Printf("    [%s, %.2f] %s\n", m.MatchType, m.Similarity, m.OldSentenceID)
			fmt.Printf("      Old: %s\n", truncate(m.OldText, 60))
			if m.NewText != "" {
				fmt.Printf("      New: %s\n", truncate(m.NewText, 60))
			}
			sampleCount++
		}
	}

	// Create migration record
	fmt.Print("\n  Creating migration record... ")
	branchName := getBranchName(repoPath)
	migration := &models.Migration{
		ManuscriptID:      manuscript.ManuscriptID,
		CommitHash:        commitHash,
		Segmenter:         segmenterVersion,
		ParentMigrationID: parentMigrationID,
		BranchName:        branchName,
		SentenceCount:     len(newSentenceTexts),
		AdditionsCount:    len(diff.Added),
		DeletionsCount:    len(diff.Deleted),
		ChangesCount:      len(diff.Deleted), // Changes = sentences that needed migration
		SentenceIDArray:   newSentenceIDs,
	}

	if err := db.CreateMigration(ctx, migration); err != nil {
		return fmt.Errorf("failed to create migration: %w", err)
	}
	fmt.Printf("Done (migration_id: %d)\n", migration.MigrationID)

	// Generate sentence models with migration_id
	fmt.Print("  Generating sentence models... ")
	var newSentenceModels []models.Sentence
	for i, sentText := range newSentenceTexts {
		sentID := sentence.GenerateSentenceID(sentText, i, commitHash)
		wordCount := sentence.CountWords(sentText)

		newSentenceModels = append(newSentenceModels, models.Sentence{
			SentenceID:  sentID,
			MigrationID: migration.MigrationID,
			CommitHash:  commitHash,
			Text:        sentText,
			WordCount:   wordCount,
			Ordinal:     i,
		})
	}
	fmt.Println("Done")

	// Store new sentences
	fmt.Print("  Storing new sentences in database... ")
	if err := db.CreateSentences(ctx, newSentenceModels); err != nil {
		return fmt.Errorf("failed to store sentences: %w", err)
	}
	fmt.Println("Done")

	// Migrate annotations
	fmt.Print("  Migrating annotations... ")
	annotationsMigrated := 0
	annotationsFailed := 0

	// Get all annotations from old sentences
	for oldSentenceID, newSentenceID := range migrationMap {
		annotations, err := db.GetActiveAnnotationsForSentence(ctx, oldSentenceID)
		if err != nil {
			fmt.Printf("\n    Warning: Failed to get annotations for %s: %v\n", oldSentenceID, err)
			continue
		}

		for _, annotation := range annotations {
			// Get latest version
			latestVersion, err := db.GetLatestAnnotationVersion(ctx, annotation.AnnotationID)
			if err != nil {
				fmt.Printf("\n    Warning: Failed to get version for annotation %d: %v\n", annotation.AnnotationID, err)
				annotationsFailed++
				continue
			}

			// Create updated annotation pointing to new sentence
			confidence := confidenceMap[oldSentenceID]
			updatedAnnotation := &models.Annotation{
				SentenceID: newSentenceID,
				Color:      latestVersion.Color,
				Note:       latestVersion.Note,
				Priority:   latestVersion.Priority,
				Flagged:    latestVersion.Flagged,
			}

			newVersion := &models.AnnotationVersion{
				SentenceID:          newSentenceID,
				Color:               latestVersion.Color,
				Note:                latestVersion.Note,
				Priority:            latestVersion.Priority,
				Flagged:             latestVersion.Flagged,
				MigrationConfidence: &confidence,
			}

			if err := db.UpdateAnnotation(ctx, annotation.AnnotationID, updatedAnnotation, newVersion); err != nil {
				fmt.Printf("\n    Warning: Failed to migrate annotation %d: %v\n", annotation.AnnotationID, err)
				annotationsFailed++
			} else {
				annotationsMigrated++
			}
		}
	}

	if annotationsMigrated > 0 || annotationsFailed > 0 {
		fmt.Printf("Migrated %d annotations", annotationsMigrated)
		if annotationsFailed > 0 {
			fmt.Printf(" (%d failed)", annotationsFailed)
		}
		fmt.Println()
	} else {
		fmt.Println("No annotations to migrate")
	}

	shortHash := commitHash
	if len(commitHash) > 8 {
		shortHash = commitHash[:8]
	}
	fmt.Printf("\n✓ Processed %d sentences from commit %s\n", len(newSentenceTexts), shortHash)
	fmt.Printf("  Added: %d, Deleted: %d, Changed: %d\n",
		migration.AdditionsCount,
		migration.DeletionsCount,
		migration.ChangesCount)
	if annotationsMigrated > 0 {
		fmt.Printf("  Annotations Migrated: %d\n", annotationsMigrated)
	}

	return nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
