package senseg

import (
	"fmt"
	"os"
	"strings"
	"unicode"
)

// nestedRegion represents a nested structure (quotes, parens, brackets, italics)
type nestedRegion struct {
	start int
	end   int
	typ   rune // '(', '[', '"', '*'
}

// boundaryMark represents a position where we should split sentences
type boundaryMark struct {
	pos    int
	reason string // for debugging
}

// Segment splits text into sentences using a 3-phase architecture:
// Phase 1: Mark all nested structures (quotes, parens, brackets, italics)
// Phase 2: Mark sentence boundaries (respecting nested regions)
// Phase 3: Split at boundaries and return sentences
func Segment(text string) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return []string{}
	}

	runes := []rune(text)

	// PHASE 1: Mark all nested structures
	regions := markNestedRegions(runes)

	// PHASE 2: Mark sentence boundaries
	boundaries := markBoundaries(runes, regions)

	// DEBUG: Enable with DEBUG_SENSEG=1
	if os.Getenv("DEBUG_SENSEG") == "1" {
		fmt.Printf("\n=== DEBUG ===\n")
		fmt.Printf("Text: %q\n", string(runes))
		fmt.Printf("Regions: %+v\n", regions)
		fmt.Printf("Boundaries: %+v\n", boundaries)
		fmt.Printf("=============\n\n")
	}

	// PHASE 3: Split at boundaries
	result := splitAtBoundaries(runes, boundaries)

	// DEBUG: Show result
	if os.Getenv("DEBUG_SENSEG") == "1" {
		fmt.Printf("Result: %d sentences\n", len(result))
		for i, s := range result {
			fmt.Printf("  [%d]: %q\n", i, s)
		}
		fmt.Printf("\n")
	}

	return result
}

// markNestedRegions finds all nested structures in the text (1 level only)
func markNestedRegions(runes []rune) []nestedRegion {
	var regions []nestedRegion

	// Find all types of nested structures
	regions = append(regions, findQuotes(runes)...)
	regions = append(regions, findParentheses(runes)...)
	regions = append(regions, findBrackets(runes)...)
	regions = append(regions, findItalics(runes)...)

	return regions
}

// findQuotes finds all quoted text (both straight and curly quotes)
func findQuotes(runes []rune) []nestedRegion {
	var regions []nestedRegion
	var start int = -1

	for i, r := range runes {
		// Handle curly quotes specifically
		if r == '\u201C' { // Left curly quote - always opens
			if start == -1 {
				start = i
			}
		} else if r == '\u201D' { // Right curly quote - always closes
			if start != -1 {
				regions = append(regions, nestedRegion{start: start, end: i, typ: '"'})
				start = -1
			}
		} else if r == '"' { // Straight quote - toggle
			if start == -1 {
				start = i // Open quote
			} else {
				regions = append(regions, nestedRegion{start: start, end: i, typ: '"'})
				start = -1 // Close quote
			}
		}
	}

	// Handle unclosed quote at end
	if start != -1 {
		regions = append(regions, nestedRegion{start: start, end: len(runes) - 1, typ: '"'})
	}

	return regions
}

// findParentheses finds all parenthetical text
func findParentheses(runes []rune) []nestedRegion {
	var regions []nestedRegion
	var start int = -1

	for i, r := range runes {
		if r == '(' && start == -1 {
			start = i
		} else if r == ')' && start != -1 {
			regions = append(regions, nestedRegion{start: start, end: i, typ: '('})
			start = -1
		}
	}

	return regions
}

// findBrackets finds all editorial brackets
func findBrackets(runes []rune) []nestedRegion {
	var regions []nestedRegion
	var start int = -1

	for i, r := range runes {
		if r == '[' && start == -1 {
			start = i
		} else if r == ']' && start != -1 {
			regions = append(regions, nestedRegion{start: start, end: i, typ: '['})
			start = -1
		}
	}

	return regions
}

// findItalics finds all italicized text (marked with asterisks)
func findItalics(runes []rune) []nestedRegion {
	var regions []nestedRegion
	var start int = -1

	for i, r := range runes {
		if r == '*' {
			if start == -1 {
				start = i
			} else {
				regions = append(regions, nestedRegion{start: start, end: i, typ: '*'})
				start = -1
			}
		}
	}

	return regions
}

// markBoundaries identifies all positions where sentences should split
func markBoundaries(runes []rune, regions []nestedRegion) []boundaryMark {
	var boundaries []boundaryMark

	// Helper: check if position is inside a nested region
	insideNested := func(pos int) bool {
		for _, r := range regions {
			if pos > r.start && pos < r.end {
				return true
			}
		}
		return false
	}

	// RULE 1: Editorial brackets always create boundaries
	for _, region := range regions {
		if region.typ == '[' {
			// Boundary before bracket
			if region.start > 0 {
				boundaries = append(boundaries, boundaryMark{pos: region.start, reason: "before bracket"})
			}
			// Boundary after bracket
			if region.end < len(runes)-1 {
				boundaries = append(boundaries, boundaryMark{pos: region.end + 1, reason: "after bracket"})
			}
		}
	}

	// RULE 2: Standalone parentheticals with sentence-ending punctuation
	for _, region := range regions {
		if region.typ == '(' {
			// Check if preceded by sentence-ending punctuation (skip whitespace)
			hasPrecedingPunct := false
			for i := region.start - 1; i >= 0; i-- {
				if runes[i] == ' ' || runes[i] == '\t' || runes[i] == '\n' {
					continue // Skip whitespace
				}
				if runes[i] == '.' || runes[i] == '!' || runes[i] == '?' {
					hasPrecedingPunct = true
				}
				break // Stop at first non-whitespace
			}

			// Check if contains sentence-ending punctuation
			hasInternalPunct := false
			for i := region.start + 1; i < region.end; i++ {
				if runes[i] == '.' || runes[i] == '!' || runes[i] == '?' {
					hasInternalPunct = true
					break
				}
			}

			// If both conditions met, it's a standalone parenthetical
			if hasPrecedingPunct && hasInternalPunct {
				boundaries = append(boundaries, boundaryMark{pos: region.start, reason: "standalone paren"})
				if region.end < len(runes)-1 {
					boundaries = append(boundaries, boundaryMark{pos: region.end + 1, reason: "after standalone paren"})
				}
			}
		}
	}

	// RULE 3: Standalone dialogue (newline + tab + quote)
	for _, region := range regions {
		if region.typ == '"' {
			// Check if quote starts after \n\t or \n
			if region.start >= 2 && runes[region.start-2] == '\n' && runes[region.start-1] == '\t' {
				// Check if preceded by attribution (verb + comma before newline)
				hasAttributionBefore := false
				verbs := []string{"said", "asked", "replied", "stammered", "shouted", "whispered",
					"muttered", "continued", "added", "explained"}

				// Look backwards from the newline to find comma and verb
				for i := region.start - 3; i >= 0; i-- {
					if runes[i] == '\n' {
						break // Hit previous paragraph
					}
					if runes[i] == ',' {
						// Found comma, check if preceded by attribution verb
						textBefore := string(runes[:i])
						for _, verb := range verbs {
							if strings.HasSuffix(textBefore, " "+verb) || strings.HasSuffix(textBefore, "\t"+verb) {
								hasAttributionBefore = true
								break
							}
						}
						break
					}
				}

				// Debug attribution detection
				if os.Getenv("DEBUG_SENSEG") == "1" && region.start >= 2 {
					contextStart := region.start - 40
					if contextStart < 0 {
						contextStart = 0
					}
					fmt.Printf("  Quote at %d, checking attribution: hasAttr=%v, context=%q\n",
						region.start, hasAttributionBefore, string(runes[contextStart:region.start]))
				}

				// Only create standalone dialogue boundary if NO attribution before
				if !hasAttributionBefore {
					boundaries = append(boundaries, boundaryMark{pos: region.start - 2, reason: "before standalone dialogue"})

					// Find end of attribution (if any)
					attribEnd := findAttributionEnd(runes, region.end+1)
					if attribEnd > region.end+1 {
						boundaries = append(boundaries, boundaryMark{pos: attribEnd, reason: "after dialogue+attribution"})
					} else if region.end < len(runes)-1 {
						boundaries = append(boundaries, boundaryMark{pos: region.end + 1, reason: "after standalone dialogue"})
					}
				}
			} else if region.start >= 1 && runes[region.start-1] == '\n' {
				boundaries = append(boundaries, boundaryMark{pos: region.start - 1, reason: "before standalone dialogue"})

				attribEnd := findAttributionEnd(runes, region.end+1)
				if attribEnd > region.end+1 {
					boundaries = append(boundaries, boundaryMark{pos: attribEnd, reason: "after dialogue+attribution"})
				} else if region.end < len(runes)-1 {
					boundaries = append(boundaries, boundaryMark{pos: region.end + 1, reason: "after standalone dialogue"})
				}
			}
		}
	}

	// RULE 4: Quote and italics endings, quote-to-quote transitions
	for i, region := range regions {
		if region.typ == '"' || region.typ == '*' {
			// Check if region ends with sentence-ending punctuation
			if region.end > region.start {
				charBeforeClosing := runes[region.end-1]
				if charBeforeClosing == '.' || charBeforeClosing == '!' || charBeforeClosing == '?' {
					// Region ends with punctuation - check what follows
					if region.end+1 < len(runes) {
						// Skip whitespace after region
						j := region.end + 1
						for j < len(runes) && (runes[j] == ' ' || runes[j] == '\t') {
							j++
						}

						// Check if followed by attribution (pronoun + verb)
						hasAttribution := false
						if region.typ == '"' && j < len(runes) {
							remaining := string(runes[j:])
							pronouns := []string{"I", "he", "she", "they", "we", "you"}
							verbs := []string{"said", "asked", "replied", "stammered", "shouted", "whispered",
								"muttered", "continued", "added", "explained"}

							for _, pronoun := range pronouns {
								for _, verb := range verbs {
									pattern := pronoun + " " + verb
									if strings.HasPrefix(remaining, pattern) {
										hasAttribution = true
										break
									}
								}
								if hasAttribution {
									break
								}
							}
						}

						// If followed by capital letter or newline (and no attribution), create boundary
						if !hasAttribution && j < len(runes) && (unicode.IsUpper(runes[j]) || runes[j] == '\n') {
							var reason string
							if region.typ == '"' {
								reason = "after quote with punct"
							} else {
								reason = "after italics with punct"
							}
							boundaries = append(boundaries, boundaryMark{pos: region.end + 1, reason: reason})
						}
					}
				}
			}

			// Check for quote-to-quote transitions
			if region.typ == '"' && i < len(regions)-1 && regions[i+1].typ == '"' {
				// Check if there's only whitespace/newlines between quotes
				onlyWhitespace := true
				for j := region.end + 1; j < regions[i+1].start; j++ {
					if runes[j] != ' ' && runes[j] != '\n' && runes[j] != '\t' {
						onlyWhitespace = false
						break
					}
				}
				if onlyWhitespace {
					boundaries = append(boundaries, boundaryMark{pos: region.end + 1, reason: "quote-to-quote"})
				}
			}
		}
	}

	// RULE 5: Standard sentence-ending punctuation (. ! ?)
	for i := 0; i < len(runes); i++ {
		r := runes[i]

		// Skip if inside nested region
		if insideNested(i) {
			continue
		}

		// Check for sentence-ending punctuation
		if r == '.' || r == '!' || r == '?' {
			// Look ahead to see if this is a real boundary
			if i+1 < len(runes) {
				next := runes[i+1]

				// Space or newline after punctuation
				if next == ' ' || next == '\n' {
					// Check if followed by capital letter (skip asterisks, quotes, brackets)
					j := i + 1
					for j < len(runes) && (runes[j] == ' ' || runes[j] == '\t' || runes[j] == '\n' ||
						runes[j] == '*' || runes[j] == '"' || runes[j] == '\u201C' || runes[j] == '[') {
						j++
					}

					if j < len(runes) && unicode.IsUpper(runes[j]) {
						boundaries = append(boundaries, boundaryMark{pos: i + 1, reason: "standard punct"})
					}
				}
			} else {
				// End of text
				boundaries = append(boundaries, boundaryMark{pos: i + 1, reason: "end of text"})
			}
		}
	}

	// RULE 6: Ellipsis followed by capital letter
	for i := 0; i < len(runes)-3; i++ {
		if insideNested(i) {
			continue
		}

		// Check for "... " or "..." at end
		if runes[i] == '.' && runes[i+1] == '.' && runes[i+2] == '.' {
			var nextCharPos int
			if i+3 < len(runes) && runes[i+3] == ' ' {
				nextCharPos = i + 4
			} else if i+3 >= len(runes) {
				// Ellipsis at end of text
				boundaries = append(boundaries, boundaryMark{pos: i + 3, reason: "ellipsis at end"})
				continue
			} else {
				continue
			}

			// Skip asterisks, quotes, brackets
			for nextCharPos < len(runes) && (runes[nextCharPos] == ' ' || runes[nextCharPos] == '*' ||
				runes[nextCharPos] == '"' || runes[nextCharPos] == '\u201C') {
				nextCharPos++
			}

			// Check if followed by capital letter
			if nextCharPos < len(runes) && unicode.IsUpper(runes[nextCharPos]) {
				boundaries = append(boundaries, boundaryMark{pos: i + 4, reason: "ellipsis+capital"})
			}
		}
	}

	// RULE 7: Paragraph breaks (double newlines or newline+tab)
	for i := 0; i < len(runes)-1; i++ {
		if runes[i] == '\n' && runes[i+1] == '\n' {
			boundaries = append(boundaries, boundaryMark{pos: i + 1, reason: "paragraph break"})
		} else if runes[i] == '\n' && runes[i+1] == '\t' {
			// Check if this is not the start of standalone dialogue (tab+quote)
			isDialogue := false
			if i+2 < len(runes) && (runes[i+2] == '"' || runes[i+2] == '\u201C') {
				isDialogue = true
			}
			if !isDialogue {
				boundaries = append(boundaries, boundaryMark{pos: i + 1, reason: "paragraph break"})
			}
		}
	}

	return boundaries
}

// findAttributionEnd finds the end of dialogue attribution after a quote
func findAttributionEnd(runes []rune, start int) int {
	if start >= len(runes) {
		return start
	}

	// Skip whitespace
	i := start
	for i < len(runes) && (runes[i] == ' ' || runes[i] == '\t') {
		i++
	}

	if i >= len(runes) {
		return start
	}

	// Look for pronoun + verb pattern
	pronouns := []string{"he", "she", "I", "they", "we", "you"}
	verbs := []string{"said", "asked", "replied", "stammered", "shouted", "whispered",
		"muttered", "continued", "added", "explained"}

	remaining := string(runes[i:])

	for _, pronoun := range pronouns {
		for _, verb := range verbs {
			pattern := pronoun + " " + verb
			if strings.HasPrefix(remaining, pattern) {
				// Found attribution, find the period
				j := i + len([]rune(pattern))
				for j < len(runes) && runes[j] != '.' && runes[j] != '\n' {
					j++
				}
				if j < len(runes) && runes[j] == '.' {
					return j + 1
				}
			}
		}
	}

	return start
}

// splitAtBoundaries splits the text at marked boundaries
func splitAtBoundaries(runes []rune, boundaries []boundaryMark) []string {
	if len(boundaries) == 0 {
		return []string{strings.TrimSpace(string(runes))}
	}

	// Sort boundaries by position
	for i := 0; i < len(boundaries)-1; i++ {
		for j := i + 1; j < len(boundaries); j++ {
			if boundaries[j].pos < boundaries[i].pos {
				boundaries[i], boundaries[j] = boundaries[j], boundaries[i]
			}
		}
	}

	// Remove duplicates
	uniqueBoundaries := []boundaryMark{boundaries[0]}
	for i := 1; i < len(boundaries); i++ {
		if boundaries[i].pos != uniqueBoundaries[len(uniqueBoundaries)-1].pos {
			uniqueBoundaries = append(uniqueBoundaries, boundaries[i])
		}
	}

	// Split at boundaries
	var sentences []string
	start := 0

	// Helper to normalize whitespace in a sentence
	normalizeWhitespace := func(s string) string {
		// Replace newlines and tabs with spaces
		s = strings.ReplaceAll(s, "\n", " ")
		s = strings.ReplaceAll(s, "\t", " ")
		// Collapse multiple spaces into one
		for strings.Contains(s, "  ") {
			s = strings.ReplaceAll(s, "  ", " ")
		}
		return strings.TrimSpace(s)
	}

	for _, boundary := range uniqueBoundaries {
		if boundary.pos > start && boundary.pos <= len(runes) {
			sentence := string(runes[start:boundary.pos])
			sentence = normalizeWhitespace(sentence)
			if sentence != "" {
				sentences = append(sentences, sentence)
			}
			start = boundary.pos
		}
	}

	// Add remaining text
	if start < len(runes) {
		sentence := string(runes[start:])
		sentence = normalizeWhitespace(sentence)
		if sentence != "" {
			sentences = append(sentences, sentence)
		}
	}

	return sentences
}
