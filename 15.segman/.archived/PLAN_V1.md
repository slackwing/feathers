# Sentence Segmenter - Multi-Language Project Plan

## Overview

A sentence segmenter ported to multiple languages (Go, JavaScript, and possibly others), kept consistent through extensive shared test scenarios. Test scenarios consist of tuples of (longer string containing 3 sentences, the middle sentence to be isolated).

## Directory Structure

```
senseg/
├── scenarios.jsonl              # Shared test cases (language-agnostic)
├── manuscripts/                 # Source material for extracting scenarios
│   └── the-wildfire.manuscript
├── go/                          # Go implementation
├── js/                          # JavaScript implementation
├── tools/scenario-building/     # Tools for managing test scenarios
│   ├── 01-segment-manuscript
│   ├── 02-inspect-segments
│   └── 03-add-scenario
└── generated/                   # Auto-generated files (gitignored)
    └── out.jsonl
```

## Test Scenario Format

**File:** `scenarios.jsonl` (JSONL format - one JSON object per line)

**Schema:**
```json
{"id":"001","context":"First sentence here. This is the middle sentence. Final sentence completes it.","expected":"This is the middle sentence."}
```

**Fields:**
- `id`: Auto-incrementing identifier (001, 002, 003, ...)
- `context`: The 3-sentence string from the manuscript
- `expected`: The middle sentence that should be isolated

**Properties:**
- JSONL format (one test case per line)
- Easy to append new cases
- Git-friendly line-based diffs
- Simple to parse in any language

## Implementation Phases

### Phase 1: Initial Setup ✓

- [x] Create directory structure
- [x] Create empty scenarios.jsonl
- [x] Create .gitignore for generated/

### Phase 2: Basic Go Segmenter

Create a very basic (flawed) Go sentence segmenter:
- Input: text string
- Output: JSON array of sentences
- Location: `go/senseg.go`
- Note: Expected to be flawed initially; will iterate

### Phase 3: Scenario Building Tools (Go)

All tools written in Go. All tools use `$SENSEG_SCENARIOS_MANUSCRIPT` environment variable, defaulting to any `.manuscript` file in `manuscripts/` if not set.

#### Tool 1: `01-segment-manuscript`

**Purpose:** Segment the manuscript using a language's segmenter and output JSONL.

**Usage:**
```bash
01-segment-manuscript --lang [go|js]
```

**Behavior:**
- Takes `--lang` flag (required): `go` or `js`
- Reads manuscript from `$SENSEG_SCENARIOS_MANUSCRIPT` (or default)
- Uses the specified language's segmenter to segment text
- Outputs JSONL format (one sentence per line) to `generated/out.jsonl`
- Always clobbers existing `generated/out.jsonl`
- Creates `generated/` directory if it doesn't exist

**Note:** Initial segmentation will be poor; this is expected and part of iterative development.

#### Tool 2: `02-inspect-segments`

**Purpose:** View a range of segmented sentences for review.

**Usage:**
```bash
02-inspect-segments --from <integer> --to <integer>
```

**Behavior:**
- Reads from `generated/out.jsonl`
- `--from` and `--to` are 1-indexed, inclusive
- Prints each sentence with blank line between sentences (easier to see wrapping)
- Example output:
  ```
  Sentence one here.

  Sentence two here.

  Sentence three here.
  ```

#### Tool 3: `03-add-scenario`

**Purpose:** Interactively (or via flags) add test scenarios to scenarios.jsonl.

**Two Modes:**

##### Mode 1: Interactive (no flags)

1. **Find manuscript context:**
   - Prompt: "Manuscript context FROM string:"
   - User enters: e.g., `"This is a"`
   - Prompt: "Manuscript context TO string:"
   - User enters: e.g., `"and we died."`
   - Tool finds first exact match (byte-for-byte, case-sensitive) of FROM in manuscript
   - Tool finds first subsequent exact match of TO after FROM
   - Tool prints the entire range of characters
   - Prompt: "Is this correct? [Yes/Next/Retry/Cancel]"
     - `Yes`: Proceed to step 2
     - `Next`: Find next occurrence of FROM/TO pair
     - `Retry`: Re-prompt for FROM/TO strings
     - `Cancel`: Exit

2. **Find sentence within context:**
   - Prompt: "Sentence FROM string (within selected context):"
   - User enters a substring within the manuscript range
   - Prompt: "Sentence TO string:"
   - User enters the ending substring
   - Tool finds the exact match within the previously selected range
   - Tool prints the matched sentence
   - Prompt: "Is this correct? [Yes/Retry/Cancel]"
     - `Yes`: Add to scenarios.jsonl
     - `Retry`: Re-prompt for sentence FROM/TO
     - `Cancel`: Exit

3. **Add to scenarios.jsonl:**
   - Check for duplicates (same context + expected)
   - If duplicate, notify and exit
   - Auto-increment ID (find highest existing ID, add 1)
   - Append new line to scenarios.jsonl
   - Print the JSON line that was added

##### Mode 2: Non-Interactive (all flags provided)

**Usage:**
```bash
03-add-scenario --manuscript-from "..." --manuscript-to "..." --sentence-from "..." --sentence-to "..."
```

Optional flag:
```bash
--manuscript-occ N   # Find Nth occurrence of manuscript-from (default: 1)
```

**Behavior when only manuscript flags provided:**
```bash
03-add-scenario --manuscript-from "..." --manuscript-to "..."
```
- Finds the range
- Outputs structured JSON to stdout (not adding to scenarios.jsonl)
- Output format:
  ```json
  {
    "found": true,
    "manuscript_from": "...",
    "manuscript_to": "...",
    "context": "...[full matched text]...",
    "start_offset": 123,
    "end_offset": 456
  }
  ```

**Behavior when all four flags provided:**
```bash
03-add-scenario --manuscript-from "..." --manuscript-to "..." --sentence-from "..." --sentence-to "..."
```
- Non-interactive mode
- Finds manuscript range
- Finds sentence within range
- Checks for duplicates
- Adds to scenarios.jsonl
- Outputs the JSON line that was added

**String Matching Rules (all tools):**
- Exact case-sensitive matching
- Byte-for-byte comparison (no whitespace normalization)
- Newlines, spaces, all characters matched exactly as-is

**Occurrence Matching (`--manuscript-occ`):**
- Find the Nth occurrence of `--manuscript-from`
- Then find the first `--manuscript-to` after it

## Development Workflow

1. Create basic Go segmenter (flawed is fine)
2. Run `01-segment-manuscript --lang go` to segment manuscript
3. Run `02-inspect-segments --from 1 --to 50` to review segments
4. Run `03-add-scenario` interactively to create test cases from interesting/problematic segments
5. Fix segmenter based on test failures
6. Repeat

## Future Extensions

- JavaScript implementation in `js/`
- Additional languages as needed
- All languages share the same `scenarios.jsonl` test suite
- Continuous iteration to improve segmentation accuracy
