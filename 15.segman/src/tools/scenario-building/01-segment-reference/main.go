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

	if *lang != "go" && *lang != "js" && *lang != "rust" {
		fmt.Fprintf(os.Stderr, "Error: --lang must be 'go', 'js', or 'rust'\n")
		os.Exit(1)
	}

	// Get manuscript path
	manuscriptPath := os.Getenv("SENSEG_SCENARIOS_MANUSCRIPT")
	if manuscriptPath == "" {
		// Default: find any .manuscript file in reference/
		matches, err := filepath.Glob("reference/*.manuscript")
		if err != nil || len(matches) == 0 {
			fmt.Fprintf(os.Stderr, "Error: no manuscript file found in reference/\n")
			os.Exit(1)
		}
		manuscriptPath = matches[0]
	}

	// Extract manuscript name (without .manuscript extension)
	manuscriptName := filepath.Base(manuscriptPath)
	manuscriptName = strings.TrimSuffix(manuscriptName, ".manuscript")

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
		sentences, err = callJSSegmenter(string(content))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error calling JS segmenter: %v\n", err)
			os.Exit(1)
		}
	case "rust":
		sentences, err = callRustSegmenter(string(content))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error calling Rust segmenter: %v\n", err)
			os.Exit(1)
		}
	}

	// Write to reference/{manuscript-name}.{lang}.jsonl
	outPath := filepath.Join("reference", fmt.Sprintf("%s.%s.jsonl", manuscriptName, *lang))
	outFile, err := os.Create(outPath)
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

	fmt.Printf("Segmented %d sentences from %s to %s\n", len(sentences), manuscriptPath, outPath)
}

// callJSSegmenter calls the JavaScript segmenter
func callJSSegmenter(text string) ([]string, error) {
	cmd := exec.Command("node", "exports/cli/segman-node-cli")
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

// callRustSegmenter calls the Rust segmenter
func callRustSegmenter(text string) ([]string, error) {
	cmd := exec.Command("exports/cli/segman-rust-cli")
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
