package senseg

import (
	"strings"
)

// Segment splits text into sentences.
// This is a basic, intentionally flawed implementation that will be improved iteratively.
func Segment(text string) []string {
	var sentences []string

	// Very naive approach: split on period followed by space or newline
	// This will fail on abbreviations, ellipsis, etc.
	text = strings.TrimSpace(text)
	if text == "" {
		return sentences
	}

	// Replace sentence endings, keeping the punctuation
	marker := "\x00SENT\x00"
	ellipsisPlaceholder := "\x00ELLIPSIS\x00"

	// Protect ellipsis from being treated as sentence boundaries
	text = strings.ReplaceAll(text, "... ", ellipsisPlaceholder)
	text = strings.ReplaceAll(text, "...", ellipsisPlaceholder[:len(ellipsisPlaceholder)-1]) // ellipsis without space

	// Handle specific multi-character patterns first (most specific to least specific)
	text = strings.ReplaceAll(text, ".\n\n", "."+marker)
	text = strings.ReplaceAll(text, "!\n\n", "!"+marker)
	text = strings.ReplaceAll(text, "?\n\n", "?"+marker)

	// Handle punctuation-based boundaries
	text = strings.ReplaceAll(text, ". ", "."+marker)
	text = strings.ReplaceAll(text, ".\n", "."+marker)
	text = strings.ReplaceAll(text, "! ", "!"+marker)
	text = strings.ReplaceAll(text, "!\n", "!"+marker)
	text = strings.ReplaceAll(text, "? ", "?"+marker)
	text = strings.ReplaceAll(text, "?\n", "?"+marker)

	// Handle double newlines as sentence boundaries (for headings, paragraphs without punctuation)
	text = strings.ReplaceAll(text, "\n\n", marker)

	// Restore ellipsis
	text = strings.ReplaceAll(text, ellipsisPlaceholder, "... ")
	text = strings.ReplaceAll(text, ellipsisPlaceholder[:len(ellipsisPlaceholder)-1], "...")

	// Handle end of text
	if strings.HasSuffix(text, ".") || strings.HasSuffix(text, "!") || strings.HasSuffix(text, "?") {
		text += marker
	}

	// Split on marker
	parts := strings.Split(text, marker)

	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			sentences = append(sentences, part)
		}
	}

	return sentences
}
