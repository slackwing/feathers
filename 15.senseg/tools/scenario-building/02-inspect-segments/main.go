package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	from := flag.Int("from", 0, "Starting sentence index (1-indexed, inclusive)")
	to := flag.Int("to", 0, "Ending sentence index (1-indexed, inclusive)")
	lang := flag.String("lang", "go", "Language segmenter output to use (go|js)")
	flag.Parse()

	if *from == 0 || *to == 0 {
		fmt.Fprintf(os.Stderr, "Error: both --from and --to flags are required\n")
		fmt.Fprintf(os.Stderr, "Usage: 02-inspect-segments --from <int> --to <int> [--lang go|js]\n")
		os.Exit(1)
	}

	if *from < 1 || *to < 1 {
		fmt.Fprintf(os.Stderr, "Error: --from and --to must be >= 1 (1-indexed)\n")
		os.Exit(1)
	}

	if *from > *to {
		fmt.Fprintf(os.Stderr, "Error: --from must be <= --to\n")
		os.Exit(1)
	}

	// Get manuscript path to determine manuscript name
	manuscriptPath := os.Getenv("SENSEG_SCENARIOS_MANUSCRIPT")
	if manuscriptPath == "" {
		matches, err := filepath.Glob("manuscripts/*.manuscript")
		if err != nil || len(matches) == 0 {
			fmt.Fprintf(os.Stderr, "Error: no manuscript file found in manuscripts/\n")
			os.Exit(1)
		}
		manuscriptPath = matches[0]
	}

	// Extract manuscript name (without .manuscript extension)
	manuscriptName := filepath.Base(manuscriptPath)
	manuscriptName = strings.TrimSuffix(manuscriptName, ".manuscript")

	// Open segmented/{manuscript-name}/{manuscript-name}.{lang}.jsonl
	segmentedPath := filepath.Join("segmented", manuscriptName, fmt.Sprintf("%s.%s.jsonl", manuscriptName, *lang))
	file, err := os.Open(segmentedPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening %s: %v\n", segmentedPath, err)
		fmt.Fprintf(os.Stderr, "Have you run 01-segment-manuscript --lang %s yet?\n", *lang)
		os.Exit(1)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	lineNum := 0
	displayedCount := 0

	for scanner.Scan() {
		lineNum++

		// Check if this line is in our range (1-indexed, inclusive)
		if lineNum < *from {
			continue
		}
		if lineNum > *to {
			break
		}

		var sentence string
		if err := json.Unmarshal(scanner.Bytes(), &sentence); err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing line %d: %v\n", lineNum, err)
			continue
		}

		// Print sentence with blank line after
		fmt.Println(sentence)
		fmt.Println()
		displayedCount++
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "Error reading file: %v\n", err)
		os.Exit(1)
	}

	if displayedCount == 0 {
		fmt.Fprintf(os.Stderr, "No sentences found in range %d-%d\n", *from, *to)
	}
}
