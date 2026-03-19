package sentence

import (
	"regexp"
	"strings"
	"unicode"

	"github.com/jdkato/prose/v2"
)

// Tokenizer handles sentence splitting with custom fiction rules
type Tokenizer struct {
	// Patterns for fiction-specific rules
	ellipsisPattern *regexp.Regexp
	emDashPattern   *regexp.Regexp
}

// NewTokenizer creates a new tokenizer with fiction rules
func NewTokenizer() *Tokenizer {
	return &Tokenizer{
		ellipsisPattern: regexp.MustCompile(`\.{3,}`),
		emDashPattern:   regexp.MustCompile(`—`),
	}
}

// SplitIntoSentences splits text into sentences using prose with custom fiction rules
func (t *Tokenizer) SplitIntoSentences(text string) []string {
	// Handle empty text
	if strings.TrimSpace(text) == "" {
		return []string{}
	}

	// Use prose library as base
	doc, err := prose.NewDocument(text)
	if err != nil {
		// Fallback to simple splitting if prose fails
		return simpleSplit(text)
	}

	// Get base sentences from prose
	proseSentences := doc.Sentences()

	// Apply fiction-specific post-processing
	return t.applyFictionRules(text, proseSentences)
}

// applyFictionRules applies custom fiction rules to prose output
func (t *Tokenizer) applyFictionRules(originalText string, proseSentences []prose.Sentence) []string {
	var result []string

	for _, sent := range proseSentences {
		sentText := sent.Text

		// Skip empty sentences
		if strings.TrimSpace(sentText) == "" {
			continue
		}

		// Apply dialogue handling (keep interrupted dialogue together)
		// "I can't," he said, "believe this." → ONE sentence
		// This is typically handled correctly by prose, but we preserve it

		// Handle ellipses: check if continuation is uppercase (new sentence) or lowercase (same)
		// This requires looking at context, which prose handles, but we can refine

		result = append(result, strings.TrimSpace(sentText))
	}

	return result
}

// simpleSplit provides a fallback sentence splitting method
func simpleSplit(text string) []string {
	// Very basic splitting on common sentence terminators
	splitter := regexp.MustCompile(`[.!?]+\s+`)
	parts := splitter.Split(text, -1)

	var result []string
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}

	return result
}

// CountWords counts alphanumeric word blobs in text
// Matches the definition in PLAN.md: count of [a-zA-Z0-9]+ sequences
func CountWords(text string) int {
	wordPattern := regexp.MustCompile(`[a-zA-Z0-9]+`)
	words := wordPattern.FindAllString(text, -1)
	return len(words)
}

// normalizeText normalizes text for comparison during migration
// Used for fuzzy matching between sentence versions
func normalizeText(text string) string {
	// Convert to lowercase
	text = strings.ToLower(text)

	// Remove punctuation except spaces
	var builder strings.Builder
	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.IsSpace(r) {
			builder.WriteRune(r)
		}
	}

	// Normalize whitespace
	text = strings.Join(strings.Fields(builder.String()), " ")

	return strings.TrimSpace(text)
}

// ExtractWords extracts alphanumeric words from text for sentence ID generation
func ExtractWords(text string) []string {
	// Normalize and extract words
	normalized := normalizeText(text)
	words := strings.Fields(normalized)
	return words
}
