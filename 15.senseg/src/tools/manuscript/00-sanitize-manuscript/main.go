package main

import (
	"flag"
	"fmt"
	"os"
	"strings"
)

func main() {
	output := flag.String("output", "", "Output file (defaults to stdout)")
	flag.Parse()

	if flag.NArg() < 1 {
		fmt.Fprintf(os.Stderr, "Usage: 00-sanitize-manuscript <input-file> [--output <output-file>]\n")
		fmt.Fprintf(os.Stderr, "  Converts curly quotes to straight quotes\n")
		fmt.Fprintf(os.Stderr, "  If no --output specified, prints to stdout\n")
		os.Exit(1)
	}

	inputPath := flag.Arg(0)

	// Read input file
	content, err := os.ReadFile(inputPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading input file: %v\n", err)
		os.Exit(1)
	}

	// Convert curly quotes to straight quotes
	sanitized := sanitize(string(content))

	// Write output
	if *output != "" {
		if err := os.WriteFile(*output, []byte(sanitized), 0644); err != nil {
			fmt.Fprintf(os.Stderr, "Error writing output file: %v\n", err)
			os.Exit(1)
		}
		fmt.Fprintf(os.Stderr, "Sanitized %s to %s\n", inputPath, *output)
	} else {
		fmt.Print(sanitized)
	}
}

func sanitize(text string) string {
	// Convert curly quotes to straight quotes
	result := text

	// Left and right double quotation marks to straight double quote
	result = strings.ReplaceAll(result, "\u201C", "\"") // "
	result = strings.ReplaceAll(result, "\u201D", "\"") // "

	// Left and right single quotation marks to straight single quote
	result = strings.ReplaceAll(result, "\u2018", "'") // '
	result = strings.ReplaceAll(result, "\u2019", "'") // '

	return result
}
