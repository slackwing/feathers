package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Scenario struct {
	ID       string `json:"id"`
	Context  string `json:"context"`
	Expected string `json:"expected"`
}

type MatchResult struct {
	Found       bool   `json:"found"`
	ManuscriptFrom string `json:"manuscript_from"`
	ManuscriptTo   string `json:"manuscript_to"`
	Context     string `json:"context"`
	StartOffset int    `json:"start_offset"`
	EndOffset   int    `json:"end_offset"`
}

func main() {
	manuscriptFrom := flag.String("manuscript-from", "", "Starting string in manuscript")
	manuscriptTo := flag.String("manuscript-to", "", "Ending string in manuscript")
	sentenceFrom := flag.String("sentence-from", "", "Starting string of sentence within context")
	sentenceTo := flag.String("sentence-to", "", "Ending string of sentence")
	manuscriptOcc := flag.Int("manuscript-occ", 1, "Occurrence number (default: 1)")
	flag.Parse()

	// Get manuscript path
	manuscriptPath := getManuscriptPath()
	manuscript, err := os.ReadFile(manuscriptPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading manuscript: %v\n", err)
		os.Exit(1)
	}
	manuscriptText := string(manuscript)

	// Determine mode
	hasManuscriptFlags := *manuscriptFrom != "" && *manuscriptTo != ""
	hasSentenceFlags := *sentenceFrom != "" && *sentenceTo != ""

	if hasManuscriptFlags && hasSentenceFlags {
		// Non-interactive mode: add scenario directly
		nonInteractiveMode(manuscriptText, *manuscriptFrom, *manuscriptTo, *sentenceFrom, *sentenceTo, *manuscriptOcc)
	} else if hasManuscriptFlags && !hasSentenceFlags {
		// Output mode: just show the manuscript range
		outputMode(manuscriptText, *manuscriptFrom, *manuscriptTo, *manuscriptOcc)
	} else if !hasManuscriptFlags && !hasSentenceFlags {
		// Interactive mode
		interactiveMode(manuscriptText)
	} else {
		fmt.Fprintf(os.Stderr, "Error: invalid flag combination\n")
		fmt.Fprintf(os.Stderr, "Use either:\n")
		fmt.Fprintf(os.Stderr, "  - No flags for interactive mode\n")
		fmt.Fprintf(os.Stderr, "  - --manuscript-from and --manuscript-to to output context\n")
		fmt.Fprintf(os.Stderr, "  - All four flags to add scenario directly\n")
		os.Exit(1)
	}
}

func interactiveMode(manuscript string) {
	reader := bufio.NewReader(os.Stdin)

	// Step 1: Find manuscript context
	var context string

	for {
		fmt.Print("Manuscript context FROM string: ")
		fromStr, _ := reader.ReadString('\n')
		fromStr = strings.TrimSuffix(fromStr, "\n")

		fmt.Print("Manuscript context TO string: ")
		toStr, _ := reader.ReadString('\n')
		toStr = strings.TrimSuffix(toStr, "\n")

		occNum := 1
		for {
			start, end, found := findRange(manuscript, fromStr, toStr, occNum)
			if !found {
				if occNum == 1 {
					fmt.Println("No match found. Try again.")
					break
				} else {
					fmt.Println("No more occurrences found.")
					occNum = 1
					break
				}
			}

			context = manuscript[start:end]

			fmt.Println("\n--- Found context ---")
			fmt.Println(context)
			fmt.Println("--- End context ---\n")

			fmt.Print("Is this correct? [Yes/Next/Retry/Cancel]: ")
			response, _ := reader.ReadString('\n')
			response = strings.TrimSpace(strings.ToLower(response))

			switch response {
			case "yes", "y":
				goto sentenceStep
			case "next", "n":
				occNum++
				continue
			case "retry", "r":
				goto retryManuscript
			case "cancel", "c":
				fmt.Println("Cancelled.")
				return
			default:
				fmt.Println("Invalid response. Please enter Yes, Next, Retry, or Cancel.")
			}
		}
	retryManuscript:
	}

sentenceStep:
	// Step 2: Find sentence within context
	for {
		fmt.Print("\nSentence FROM string (within selected context): ")
		fromStr, _ := reader.ReadString('\n')
		fromStr = strings.TrimSuffix(fromStr, "\n")

		fmt.Print("Sentence TO string: ")
		toStr, _ := reader.ReadString('\n')
		toStr = strings.TrimSuffix(toStr, "\n")

		start, end, found := findRange(context, fromStr, toStr, 1)
		if !found {
			fmt.Println("No match found within context. Try again.")
			continue
		}

		sentence := context[start:end]

		fmt.Println("\n--- Found sentence ---")
		fmt.Println(sentence)
		fmt.Println("--- End sentence ---\n")

		fmt.Print("Is this correct? [Yes/Retry/Cancel]: ")
		response, _ := reader.ReadString('\n')
		response = strings.TrimSpace(strings.ToLower(response))

		switch response {
		case "yes", "y":
			addScenario(context, sentence)
			return
		case "retry", "r":
			continue
		case "cancel", "c":
			fmt.Println("Cancelled.")
			return
		default:
			fmt.Println("Invalid response. Please enter Yes, Retry, or Cancel.")
		}
	}
}

func outputMode(manuscript, fromStr, toStr string, occ int) {
	start, end, found := findRange(manuscript, fromStr, toStr, occ)

	result := MatchResult{
		Found:          found,
		ManuscriptFrom: fromStr,
		ManuscriptTo:   toStr,
	}

	if found {
		result.Context = manuscript[start:end]
		result.StartOffset = start
		result.EndOffset = end
	}

	output, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(output))
}

func nonInteractiveMode(manuscript, manuscriptFrom, manuscriptTo, sentenceFrom, sentenceTo string, occ int) {
	// Find manuscript context
	contextStart, contextEnd, found := findRange(manuscript, manuscriptFrom, manuscriptTo, occ)
	if !found {
		fmt.Fprintf(os.Stderr, "Error: manuscript range not found\n")
		os.Exit(1)
	}

	context := manuscript[contextStart:contextEnd]

	// Find sentence within context
	sentStart, sentEnd, found := findRange(context, sentenceFrom, sentenceTo, 1)
	if !found {
		fmt.Fprintf(os.Stderr, "Error: sentence range not found within context\n")
		os.Exit(1)
	}

	sentence := context[sentStart:sentEnd]

	addScenario(context, sentence)
}

func findRange(text, fromStr, toStr string, occurrence int) (start, end int, found bool) {
	searchStart := 0
	for i := 0; i < occurrence; i++ {
		idx := strings.Index(text[searchStart:], fromStr)
		if idx == -1 {
			return 0, 0, false
		}
		start = searchStart + idx

		// Find toStr after fromStr
		afterFrom := start + len(fromStr)
		idx = strings.Index(text[afterFrom:], toStr)
		if idx == -1 {
			return 0, 0, false
		}
		end = afterFrom + idx + len(toStr)

		if i < occurrence-1 {
			searchStart = start + 1
		}
	}

	return start, end, true
}

func addScenario(context, expected string) {
	// Check for duplicates
	scenarios := loadScenarios()
	for _, s := range scenarios {
		if s.Context == context && s.Expected == expected {
			fmt.Println("Error: duplicate scenario already exists")
			os.Exit(1)
		}
	}

	// Generate new ID
	maxID := 0
	for _, s := range scenarios {
		id, err := strconv.Atoi(s.ID)
		if err == nil && id > maxID {
			maxID = id
		}
	}
	newID := fmt.Sprintf("%03d", maxID+1)

	newScenario := Scenario{
		ID:       newID,
		Context:  context,
		Expected: expected,
	}

	// Append to scenarios.jsonl
	file, err := os.OpenFile("scenarios.jsonl", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening scenarios.jsonl: %v\n", err)
		os.Exit(1)
	}
	defer file.Close()

	line, _ := json.Marshal(newScenario)
	fmt.Fprintln(file, string(line))

	fmt.Println(string(line))
}

func loadScenarios() []Scenario {
	file, err := os.Open("scenarios.jsonl")
	if err != nil {
		if os.IsNotExist(err) {
			return []Scenario{}
		}
		fmt.Fprintf(os.Stderr, "Error reading scenarios.jsonl: %v\n", err)
		os.Exit(1)
	}
	defer file.Close()

	var scenarios []Scenario
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		var s Scenario
		if err := json.Unmarshal(scanner.Bytes(), &s); err != nil {
			continue
		}
		scenarios = append(scenarios, s)
	}

	return scenarios
}

func getManuscriptPath() string {
	manuscriptPath := os.Getenv("SENSEG_SCENARIOS_MANUSCRIPT")
	if manuscriptPath == "" {
		matches, err := filepath.Glob("manuscripts/*.manuscript")
		if err != nil || len(matches) == 0 {
			fmt.Fprintf(os.Stderr, "Error: no manuscript file found in manuscripts/\n")
			os.Exit(1)
		}
		manuscriptPath = matches[0]
	}
	return manuscriptPath
}
