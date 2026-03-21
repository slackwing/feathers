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

// cleanSentenceBoundaries removes leading punctuation but keeps trailing punctuation
// This ensures cleaner highlighting boundaries in the UI
// Exceptions: Keeps quotes (", ') as they might start quoted sentences
func cleanSentenceBoundaries(text string) string {
	trimmed := strings.TrimSpace(text)

	// Remove leading punctuation (but NOT letters, numbers, quotes, or opening brackets)
	// Common sentence-joining punctuation: . , ; : ! ? —
	// Exception: Keep quotes (", ', ", ', „) as sentences can start with quotes
	for len(trimmed) > 0 {
		firstRune := rune(trimmed[0])
		// Check if it's punctuation that shouldn't start a sentence
		// Skip quote characters (using Unicode code points for curly quotes)
		if firstRune == '"' || firstRune == '\'' || firstRune == '\u201c' || // "
			firstRune == '\u201d' || firstRune == '\u2018' || firstRune == '\u2019' || // ' '
			firstRune == '\u201e' { // „
			// Keep quotes at start
			break
		}
		if firstRune == '.' || firstRune == ',' || firstRune == ';' ||
			firstRune == ':' || firstRune == '!' || firstRune == '?' ||
			firstRune == '—' || firstRune == '-' {
			trimmed = trimmed[1:]
			trimmed = strings.TrimLeftFunc(trimmed, unicode.IsSpace)
		} else {
			break
		}
	}

	return trimmed
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

		// Clean boundaries: remove leading punctuation, keep trailing
		cleaned := cleanSentenceBoundaries(sentText)

		if cleaned != "" {
			result = append(result, cleaned)
		}
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
