package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
)

func main() {
	from := flag.Int("from", 0, "Starting sentence index (1-indexed, inclusive)")
	to := flag.Int("to", 0, "Ending sentence index (1-indexed, inclusive)")
	flag.Parse()

	if *from == 0 || *to == 0 {
		fmt.Fprintf(os.Stderr, "Error: both --from and --to flags are required\n")
		fmt.Fprintf(os.Stderr, "Usage: 02-inspect-segments --from <int> --to <int>\n")
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

	// Open generated/out.jsonl
	file, err := os.Open("generated/out.jsonl")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening generated/out.jsonl: %v\n", err)
		fmt.Fprintf(os.Stderr, "Have you run 01-segment-manuscript yet?\n")
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
