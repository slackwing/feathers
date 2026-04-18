package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/term"
)

func main() {
	from := flag.Int("from", 0, "Starting sentence index (1-indexed, inclusive)")
	to := flag.Int("to", 0, "Ending sentence index (1-indexed, inclusive, omit for interactive mode)")
	lang := flag.String("lang", "go", "Language segmenter output to use (go|js)")
	flag.Parse()

	if *from == 0 {
		fmt.Fprintf(os.Stderr, "Error: --from flag is required\n")
		fmt.Fprintf(os.Stderr, "Usage: 02-inspect-segments --from <int> [--to <int>] [--lang go|js]\n")
		fmt.Fprintf(os.Stderr, "  Omit --to for interactive mode (press any key for next sentence, 'q' to quit)\n")
		os.Exit(1)
	}

	if *from < 1 {
		fmt.Fprintf(os.Stderr, "Error: --from must be >= 1 (1-indexed)\n")
		os.Exit(1)
	}

	if *to != 0 && *to < 1 {
		fmt.Fprintf(os.Stderr, "Error: --to must be >= 1 (1-indexed)\n")
		os.Exit(1)
	}

	if *to != 0 && *from > *to {
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

	// Load all sentences
	sentences, err := loadSentences(segmentedPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening %s: %v\n", segmentedPath, err)
		fmt.Fprintf(os.Stderr, "Have you run 01-segment-manuscript --lang %s yet?\n", *lang)
		os.Exit(1)
	}

	// Interactive mode if --to is omitted
	if *to == 0 {
		interactiveMode(*from, sentences)
		return
	}

	// Non-interactive mode
	nonInteractiveMode(*from, *to, sentences)
}

func loadSentences(path string) ([]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var sentences []string
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		var sentence string
		if err := json.Unmarshal(scanner.Bytes(), &sentence); err != nil {
			continue
		}
		sentences = append(sentences, sentence)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return sentences, nil
}

func interactiveMode(from int, sentences []string) {
	// Set terminal to raw mode
	oldState, err := term.MakeRaw(int(os.Stdin.Fd()))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error setting terminal to raw mode: %v\n", err)
		os.Exit(1)
	}
	defer term.Restore(int(os.Stdin.Fd()), oldState)

	current := from - 1 // Convert to 0-indexed
	for current < len(sentences) {
		// Print sentence with line number and angle brackets: <line>< <sentence> >
		fmt.Printf("%d< %s >\r\n\r\n", current+1, sentences[current])

		// Wait for keypress
		buf := make([]byte, 1)
		_, err := os.Stdin.Read(buf)
		if err != nil {
			break
		}

		// Check for quit
		if buf[0] == 'q' || buf[0] == 'Q' {
			fmt.Print("\r\n")
			break
		}

		current++
	}
}

func nonInteractiveMode(from, to int, sentences []string) {
	displayedCount := 0

	for i := from - 1; i < to && i < len(sentences); i++ {
		fmt.Printf("%d< %s >\n\n", i+1, sentences[i])
		displayedCount++
	}

	if displayedCount == 0 {
		fmt.Fprintf(os.Stderr, "No sentences found in range %d-%d\n", from, to)
	}
}
