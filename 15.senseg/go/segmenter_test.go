package senseg

import (
	"bufio"
	"encoding/json"
	"os"
	"testing"
)

type Scenario struct {
	ID       string `json:"id"`
	Context  string `json:"context"`
	Expected string `json:"expected"`
}

func TestScenarios(t *testing.T) {
	// Read scenarios.jsonl from parent directory
	file, err := os.Open("../scenarios.jsonl")
	if err != nil {
		t.Fatalf("Failed to open scenarios.jsonl: %v", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	lineNum := 0
	scenarioCount := 0
	passCount := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()

		// Skip empty lines
		if line == "" {
			continue
		}

		var scenario Scenario
		if err := json.Unmarshal([]byte(line), &scenario); err != nil {
			t.Errorf("Line %d: failed to parse JSON: %v", lineNum, err)
			continue
		}

		scenarioCount++

		// Run segmenter on context
		sentences := Segment(scenario.Context)

		// Debug scenario 003
		if scenario.ID == "003" {
			t.Logf("Context bytes: %q", scenario.Context)
			t.Logf("Expected bytes: %q", scenario.Expected)
			for i, s := range sentences {
				t.Logf("Sentence[%d]: %q", i, s)
			}
		}

		// Check if expected sentence is in the output
		found := false
		for _, sentence := range sentences {
			if sentence == scenario.Expected {
				found = true
				break
			}
		}

		if !found {
			t.Errorf("Scenario %s FAILED: expected sentence not found\n  Context: %q\n  Expected: %q\n  Got: %v",
				scenario.ID, scenario.Context, scenario.Expected, sentences)
		} else {
			passCount++
			t.Logf("Scenario %s PASSED", scenario.ID)
		}
	}

	if err := scanner.Err(); err != nil {
		t.Fatalf("Error reading scenarios.jsonl: %v", err)
	}

	t.Logf("\n=== Summary ===\nTotal: %d  Passed: %d  Failed: %d",
		scenarioCount, passCount, scenarioCount-passCount)

	if passCount < scenarioCount {
		t.Fail()
	}
}
