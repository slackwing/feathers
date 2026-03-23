# Agent Guidelines

## Critical: Files That Must NEVER Be Modified

### DO NOT EDIT WITHOUT EXPLICIT INSTRUCTION
- **`manuscripts/the-wildfire.manuscript`** - This is the source manuscript. NEVER edit, run scripts on, or modify this file unless the user explicitly and directly asks you to do so. Double-check even if you think the user is asking you to.
- **`scenarios.jsonl`** - This contains hand-curated test scenarios. NEVER add, remove, or modify entries unless explicitly instructed by the user.

## Tools Usage

### DO NOT USE
- **`03-add-scenario`** - This tool is for manual use only. Only the human user should add scenarios to ensure quality and intentionality of test cases.

### CAN USE
- `00-sanitize-manuscript` - For cleaning up the manuscript (but only with explicit permission for the-wildfire.manuscript)
- `01-segment-manuscript` - For re-segmenting after changes to the segmenter
- `02-inspect-segments` - For inspecting segmented output
- `run-scenarios` - For running tests against scenarios.jsonl (reading only)
- All other development tools

## Workflow
1. Fix/improve the segmenter based on test failures or requirements
2. Re-run `01-segment-manuscript` to regenerate segments
3. Run `run-scenarios` to verify tests pass
4. Report results to user

## Important Notes
- When in doubt about modifying the manuscript or scenarios, ASK the user first
- The manuscript and test scenarios are sacred - they represent the user's creative work and careful curation
