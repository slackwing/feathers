package main

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

func main() {
	// Read source file with italics
	sourceContent, err := os.ReadFile("/home/slackwing/Downloads/The Wildfire - First Draft(1).md")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading source file: %v\n", err)
		os.Exit(1)
	}

	// Read target manuscript
	targetContent, err := os.ReadFile("manuscripts/the-wildfire.manuscript")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading manuscript: %v\n", err)
		os.Exit(1)
	}

	sourceText := string(sourceContent)
	targetText := string(targetContent)

	// Find all italicized text in source (text between single asterisks)
	// Exclude double asterisks (bold) and very long stretches
	italicRegex := regexp.MustCompile(`\*([^*]{1,100})\*`)
	matches := italicRegex.FindAllStringSubmatch(sourceText, -1)

	// Extract unique italicized phrases
	italicPhrases := make(map[string]bool)
	for _, match := range matches {
		if len(match) > 1 {
			phrase := match[1]
			// Skip certain patterns
			if phrase != "" && phrase != "—" && !strings.Contains(phrase, "\n") {
				italicPhrases[phrase] = true
			}
		}
	}

	// Apply italics to target text
	totalCount := 0
	phraseCount := 0

	// Sort phrases by length (longest first) to avoid partial replacements
	var phrases []string
	for phrase := range italicPhrases {
		phrases = append(phrases, phrase)
	}

	// Simple length-based sort
	for i := 0; i < len(phrases); i++ {
		for j := i + 1; j < len(phrases); j++ {
			if len(phrases[i]) < len(phrases[j]) {
				phrases[i], phrases[j] = phrases[j], phrases[i]
			}
		}
	}

	for _, phrase := range phrases {
		// Only replace if the phrase exists and isn't already italicized
		if strings.Contains(targetText, phrase) && !strings.Contains(targetText, "*"+phrase+"*") {
			count := strings.Count(targetText, phrase)
			targetText = strings.ReplaceAll(targetText, phrase, "*"+phrase+"*")
			totalCount += count
			phraseCount++
			fmt.Printf("Italicized: %q (%d instances)\n", phrase, count)
		}
	}

	// Write back to manuscript
	if err := os.WriteFile("manuscripts/the-wildfire.manuscript", []byte(targetText), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing manuscript: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\nTotal phrases: %d\n", phraseCount)
	fmt.Printf("Total italic instances added: %d\n", totalCount)
}
