# Agent Guidelines

## Critical: Files That Must NEVER Be Modified

### DO NOT EDIT WITHOUT EXPLICIT INSTRUCTION
- **`manuscripts/the-wildfire.manuscript`** - This is the source manuscript. NEVER edit, run scripts on, or modify this file unless the user explicitly and directly asks you to do so. Double-check even if you think the user is asking you to.
- **`scenarios.jsonl`** - This contains hand-curated test scenarios. NEVER add, remove, or modify entries unless explicitly instructed by the user.

## Supported Languages

Currently supported segmenter implementations:
- **Go** - `go/segmenter.go` (active)
- **JavaScript** - `js/` (placeholder, not yet implemented)

## Tools Usage

### DO NOT USE
- **`03-add-scenario`** - This tool is for manual use only. Only the human user should add scenarios to ensure quality and intentionality of test cases.

### CAN USE
- `00-sanitize-manuscript` - For cleaning up the manuscript (but only with explicit permission for the-wildfire.manuscript)
- `01-segment-manuscript` - For re-segmenting after changes to the segmenter (requires `--lang`, e.g., `--lang go`)
- `02-inspect-segments` - For inspecting segmented output (optional `--lang`, defaults to `go`)
- `run-scenarios` - For running tests against scenarios.jsonl (reading only)
- All other development tools

## Workflow: When User Adds a New Scenario

When the user says "added a new scenario" or similar, follow this sequence:

1. **Run tests**: Execute `./run-scenarios` to see if the new scenario passes
2. **Fix segmenter if needed**: If tests fail, fix the segmenter implementation in the failing language(s)
3. **Re-run tests**: Execute `./run-scenarios` again to verify all scenarios pass
4. **Regenerate segments**: For each supported language, run:
   - `./tools/scenario-building/01-segment-manuscript/01-segment-manuscript --lang go` → outputs to `segmented/the-wildfire/the-wildfire.go.jsonl`
   - `./tools/scenario-building/01-segment-manuscript/01-segment-manuscript --lang js` → outputs to `segmented/the-wildfire/the-wildfire.js.jsonl` (when JS is implemented)
5. **Report results**: Tell the user the outcome (tests passing, which files were regenerated)

## General Workflow
1. Fix/improve the segmenter based on test failures or requirements
2. Re-run `01-segment-manuscript` to regenerate segments for all supported languages
3. Run `run-scenarios` to verify tests pass
4. Report results to user

## Important Notes
- When in doubt about modifying the manuscript or scenarios, ASK the user first
- The manuscript and test scenarios are sacred - they represent the user's creative work and careful curation
