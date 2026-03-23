package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/slackwing/senseg"
)

func main() {
	lang := flag.String("lang", "", "Language segmenter to use (go|js)")
	flag.Parse()

	if *lang == "" {
		fmt.Fprintf(os.Stderr, "Error: --lang flag is required (go|js)\n")
		os.Exit(1)
	}

	if *lang != "go" && *lang != "js" {
		fmt.Fprintf(os.Stderr, "Error: --lang must be 'go' or 'js'\n")
		os.Exit(1)
	}

	// Get manuscript path
	manuscriptPath := os.Getenv("SENSEG_SCENARIOS_MANUSCRIPT")
	if manuscriptPath == "" {
		// Default: find any .manuscript file in manuscripts/
		matches, err := filepath.Glob("manuscripts/*.manuscript")
		if err != nil || len(matches) == 0 {
			fmt.Fprintf(os.Stderr, "Error: no manuscript file found in manuscripts/\n")
			os.Exit(1)
		}
		manuscriptPath = matches[0]
	}

	// Read manuscript
	content, err := os.ReadFile(manuscriptPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading manuscript: %v\n", err)
		os.Exit(1)
	}

	var sentences []string

	// Segment based on language
	switch *lang {
	case "go":
		sentences = senseg.Segment(string(content))
	case "js":
		// TODO: Call JS segmenter when implemented
		fmt.Fprintf(os.Stderr, "Error: JavaScript segmenter not yet implemented\n")
		os.Exit(1)
	}

	// Ensure generated/ directory exists
	if err := os.MkdirAll("generated", 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Error creating generated/ directory: %v\n", err)
		os.Exit(1)
	}

	// Write to generated/out.jsonl
	outFile, err := os.Create("generated/out.jsonl")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating output file: %v\n", err)
		os.Exit(1)
	}
	defer outFile.Close()

	for _, sentence := range sentences {
		line, err := json.Marshal(sentence)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error marshaling sentence: %v\n", err)
			os.Exit(1)
		}
		fmt.Fprintln(outFile, string(line))
	}

	fmt.Printf("Segmented %d sentences from %s to generated/out.jsonl\n", len(sentences), manuscriptPath)
}

// callJSSegmenter calls the JavaScript segmenter (placeholder for future implementation)
func callJSSegmenter(text string) ([]string, error) {
	// This will call the JS implementation when it exists
	cmd := exec.Command("node", "js/segmenter.js")
	cmd.Stdin = strings.NewReader(text)
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var sentences []string
	if err := json.Unmarshal(output, &sentences); err != nil {
		return nil, err
	}

	return sentences, nil
}
