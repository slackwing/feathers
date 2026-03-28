# Agent Guidelines

## Critical: Files That Must NEVER Be Modified

### DO NOT EDIT WITHOUT EXPLICIT INSTRUCTION
- **`manuscripts/the-wildfire.manuscript`** - This is the source manuscript. NEVER edit, run scripts on, or modify this file unless the user explicitly and directly asks you to do so. Double-check even if you think the user is asking you to.
- **`scenarios.jsonl`** - This contains hand-curated test scenarios. NEVER add, remove, or modify entries unless explicitly instructed by the user.

### MUST BE UPDATED TOGETHER
- **`SPECS.md` and `scenarios.jsonl`** - These two files must stay synchronized:
  - When adding a test scenario, update SPECS.md with the corresponding rule
  - When modifying a rule in SPECS.md, ensure test coverage exists in scenarios.jsonl
  - Only update if changes are actually needed (don't modify for no reason)

## Git Operations

### NEVER CREATE GIT COMMITS
- **NEVER run `git commit`** - Only the user should create commits
- You may read git status, diffs, logs, etc. for informational purposes
- You may make file changes, but NEVER commit them
- The user will handle all git commit operations themselves

### Build Artifacts MUST Be Gitignored
When adding support for a new language, **ALWAYS create a `.gitignore` file** in the language directory to exclude build artifacts:

- **Rust** - `.gitignore` should contain:
  - `/target/` - Contains compiled binaries, intermediate build files, caches

- **Go** - Build artifacts typically not kept in language directory (built to `generated/`)

- **JavaScript/Node.js** - If using `node_modules/`, add to `.gitignore`:
  - `/node_modules/`

- **General rule**: Any directory containing compiled binaries, dependency caches, or auto-generated build files should NEVER be committed to version control

## Supported Languages

Currently supported segmenter implementations:
- **Go** - `go/segmenter.go`
- **JavaScript** - `js/segmenter.js`
- **Rust** - `rust/src/lib.rs`

All three implementations pass all 45 test scenarios and produce identical output.

## Building Tools

**IMPORTANT**: All tool binaries MUST be in the `generated/` directory, NEVER in the tool's source directory.

### Tool Source Location
- **All tool source** (Go and Bash) goes in `tools/` subdirectories:
  - `tools/manuscript/` - Manuscript processing tools
  - `tools/scenario-building/` - Scenario and testing tools
- **All built/deployed tools** go in `generated/`

### Building/Deploying Tools
- **Always run `./build-tools`** after creating or modifying any tool
- This script:
  - Compiles Go tools: `tools/*/toolname/main.go` → `generated/toolname`
  - Copies bash scripts: `tools/*/scriptname` → `generated/scriptname`
  - Makes everything executable

### After Creating New Tools
1. Create source in `tools/manuscript/` or `tools/scenario-building/`
2. Add to `build-tools` script (for Go: add `go build` line; for bash: add `cp` line)
3. Run `./build-tools` to deploy to `generated/`
4. **Always run tools from `generated/`**: e.g., `./generated/04-context search term`

### Note on go/tools/
The `go/tools/` directory appears to be legacy. Active source is in root-level `tools/`.

## Tools Usage

### DO NOT USE
- **`03-add-scenario`** - This tool is for manual use only. Only the human user should add scenarios to ensure quality and intentionality of test cases.

### CAN USE
- `restore-italics` - For restoring italics to manuscript (manual use only)
- `01-segment-manuscript` - For re-segmenting after changes to the segmenter (requires `--lang`, e.g., `--lang go`)
- `02-inspect-segments` - For inspecting segmented output (optional `--lang`, defaults to `go`)
- `run-scenarios` - For running tests against scenarios.jsonl (reading only)
- All other development tools

## Workflow: When User Adds a New Scenario

When the user says "added a new scenario" or similar, follow this sequence:

1. **Run tests**: Execute `./run-scenarios` to see if the new scenario passes
2. **Fix segmenter if needed**: If tests fail, fix the segmenter implementation in the failing language(s)
3. **Re-run tests**: Execute `./run-scenarios` again to verify all scenarios pass
4. **Rebuild tools if needed**: If you modified any tools, run `./build-tools`
5. **Regenerate segments**: For each supported language, run:
   - `./generated/01-segment-manuscript --lang go` → outputs to `segmented/the-wildfire/the-wildfire.go.jsonl`
   - `./js/segment-manuscript.js` → outputs to `segmented/the-wildfire/the-wildfire.js.jsonl`
   - `./generated/segment-manuscript-rust` (or `cd rust && cargo run --bin segment-manuscript`) → outputs to `segmented/the-wildfire/the-wildfire.rust.jsonl`
6. **Report results**: Tell the user the outcome (tests passing, which files were regenerated)

## General Workflow
1. Fix/improve the segmenter based on test failures or requirements
2. Re-run `01-segment-manuscript` to regenerate segments for all supported languages
3. Run `run-scenarios` to verify tests pass
4. Report results to user

## Important Notes
- When in doubt about modifying the manuscript or scenarios, ASK the user first
- The manuscript and test scenarios are sacred - they represent the user's creative work and careful curation
