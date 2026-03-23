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

	text = strings.ReplaceAll(text, ". ", "."+marker)
	text = strings.ReplaceAll(text, ".\n", "."+marker)
	text = strings.ReplaceAll(text, "! ", "!"+marker)
	text = strings.ReplaceAll(text, "!\n", "!"+marker)
	text = strings.ReplaceAll(text, "? ", "?"+marker)
	text = strings.ReplaceAll(text, "?\n", "?"+marker)

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
