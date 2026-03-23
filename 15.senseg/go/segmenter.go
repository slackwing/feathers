package senseg

import (
	"fmt"
	"regexp"
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
	quotePlaceholderBase := "\x00QUOTE%d\x00"

	// Protect quoted text from being split
	// Handle all types of quotes: curly quotes (U+201C/U+201D), straight quotes (U+0022)
	// Use a greedy match to get the longest quoted section
	allQuotesRegex := regexp.MustCompile(`[\x{201C}\x{201D}"]+[^\x{201C}\x{201D}"]*[\x{201C}\x{201D}"]+`)
	quotedTexts := allQuotesRegex.FindAllString(text, -1)
	for i, qt := range quotedTexts {
		placeholder := fmt.Sprintf(quotePlaceholderBase, i)
		text = strings.Replace(text, qt, placeholder, 1)
	}

	// Handle sentence boundaries after quoted text ending with punctuation
	// This allows dialogue like "Hello?" on its own line to be a separate sentence
	for i, qt := range quotedTexts {
		if len(qt) < 2 {
			continue
		}
		// Check if quote ends with sentence-ending punctuation before the closing quote
		// Check for patterns like ."  !"  ?"
		if strings.HasSuffix(qt, ".\"") || strings.HasSuffix(qt, "!\"") || strings.HasSuffix(qt, "?\"") ||
			strings.HasSuffix(qt, ".\u201D") || strings.HasSuffix(qt, "!\u201D") || strings.HasSuffix(qt, "?\u201D") {
			placeholder := fmt.Sprintf(quotePlaceholderBase, i)
			// Add marker after placeholder when followed by newline or space
			text = strings.ReplaceAll(text, placeholder+"\n", placeholder+marker)
			text = strings.ReplaceAll(text, placeholder+" ", placeholder+marker)
		}
	}

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
			// Restore quoted text
			for i, qt := range quotedTexts {
				placeholder := fmt.Sprintf(quotePlaceholderBase, i)
				part = strings.ReplaceAll(part, placeholder, qt)
			}
			sentences = append(sentences, part)
		}
	}

	return sentences
}
