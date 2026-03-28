# Agent Guidelines for SEGMAN

## Project Structure (V3)

```
15.senseg/
├── src/
│   ├── segman/           # Language implementations
│   │   ├── go/           # Go library
│   │   ├── js/           # JavaScript library
│   │   └── rust/         # Rust library
│   └── tools/            # Development tools
│       ├── manuscript/
│       └── scenario-building/
├── tests/
│   └── scenarios.jsonl   # Test scenarios
├── reference/
│   └── the-wildfire.manuscript  # Reference manuscript
├── exports/
│   ├── lib/              # Library distributions
│   │   ├── segman-go/
│   │   ├── segman-js/
│   │   └── segman-rust/
│   ├── cli/              # CLI binaries
│   │   ├── segman-go-cli
│   │   ├── segman-node-cli
│   │   └── segman-rust-cli
│   ├── 00-sanitize-manuscript    # Tool binaries
│   ├── 01-segment-reference
│   ├── 02-inspect-segments
│   ├── 03-add-scenario
│   └── 04-manuscript-context
├── VERSION.json          # Version and hash metadata
├── PLAN_V3.md           # V3 refactoring plan
└── build scripts, test scripts, hooks, etc.
```

## Critical: Files That Must NEVER Be Modified

### DO NOT EDIT WITHOUT EXPLICIT INSTRUCTION
- **`reference/the-wildfire.manuscript`** - This is the source manuscript. NEVER edit, run scripts on, or modify this file unless the user explicitly and directly asks you to do so. Double-check even if you think the user is asking you to.
- **`tests/scenarios.jsonl`** - This contains hand-curated test scenarios. NEVER add, remove, or modify entries unless explicitly instructed by the user.
- **`VERSION.json`** - Managed by pre-commit hook. Manual bumps only for major/minor versions.

### MUST BE UPDATED TOGETHER
- **`SPECS.md` and `tests/scenarios.jsonl`** - These two files must stay synchronized:
  - When adding a test scenario, update SPECS.md with the corresponding rule
  - When modifying a rule in SPECS.md, ensure test coverage exists in tests/scenarios.jsonl
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
- **Go** - `src/segman/go/segmenter.go`
- **JavaScript** - `src/segman/js/segmenter.js`
- **Rust** - `src/segman/rust/src/lib.rs`

All three implementations pass all 45 test scenarios and produce byte-for-byte identical output.

**IMPORTANT**: When adding a new language:
- Add implementation to `src/segman/{language}/`
- Add case to `run-tests` script
- Add build steps to `build-segman` script
- Ensure it passes all 45 scenarios in `tests/scenarios.jsonl`

## Building Tools and Libraries

### Build Scripts

**`./build-tools`** - Build development/testing tools
- Compiles Go tools from `src/tools/` to `exports/`
- Copies bash scripts from `src/tools/` to `exports/`
- Run after modifying any tool

**`./build-segman`** - Build SEGMAN library distributions
- Builds Go library (copies source to `exports/lib/segman-go/`)
- Builds JS library (copies source to `exports/lib/segman-js/`)
- Builds Rust library (copies source to `exports/lib/segman-rust/`)
- Builds all CLI binaries to `exports/cli/`
- Run after modifying segmenter implementations

### Tool Source Location
- **All tool source** (Go and Bash) in `src/tools/`:
  - `src/tools/manuscript/` - Manuscript processing tools
  - `src/tools/scenario-building/` - Scenario and testing tools
- **All built tools** → `exports/` (root level, not in subdirs)

### Creating New Tools
1. Create source in `src/tools/manuscript/` or `src/tools/scenario-building/`
2. Add to `build-tools` script
3. Run `./build-tools`
4. **Always run tools from `exports/`**: e.g., `./exports/04-manuscript-context search term`

## Tools Usage

### DO NOT USE
- **`exports/03-add-scenario`** - This tool is for manual use only. Only the human user should add scenarios to ensure quality and intentionality of test cases.

### CAN USE
- `exports/00-sanitize-manuscript` - Sanitize manuscript formatting
- `exports/01-segment-reference` - Re-segment reference manuscript after segmenter changes (requires `--lang go|js|rust`)
- `exports/02-inspect-segments` - Inspect segmented output
- `exports/04-manuscript-context` - Search for context in manuscript
- `./run-tests [go|js|rust]` - Run test scenarios (reads from `tests/scenarios.jsonl`)
- All other development tools in `exports/`

## Workflow: When User Adds a New Scenario

When the user says "added a new scenario" or similar, follow this sequence:

1. **Run tests**: Execute `./run-tests [go|js|rust]` to see if the new scenario passes
2. **Fix segmenter if needed**: If tests fail, fix the segmenter implementation in the failing language(s) in `src/segman/`
3. **Re-run tests**: Execute `./run-tests` again to verify all scenarios pass
4. **Rebuild if needed**:
   - If you modified tools: run `./build-tools`
   - If you modified segmenters: run `./build-segman`
5. **Regenerate reference**: Run `./exports/01-segment-reference --lang [go|js|rust]` for each language
   - Outputs to `reference/the-wildfire.{lang}.jsonl`
6. **Report results**: Tell the user the outcome (tests passing, which files were regenerated)

**Note**: The pre-commit hook will automatically verify outputs match and bump version if needed.

## General Workflow
1. Fix/improve the segmenter based on test failures or requirements
2. Re-run `01-segment-manuscript` to regenerate segments for all supported languages
3. Run `run-scenarios` to verify tests pass
4. Report results to user

## Version Management (Automated)

### VERSION.json Structure
Contains version metadata and reference output hash:
```json
{
  "version": "1.0.0",
  "reference_hash": "sha256:...",
  "reference_file": "the-wildfire.manuscript",
  "blessed_at": "2026-03-27T...",
  "blessed_commit": "abc123",
  "test_scenarios": 45,
  "architecture": "v3-3phase"
}
```

### Pre-commit Hook Behavior
The pre-commit hook (`.git/hooks/pre-commit`) automatically:
1. Runs all tests when `src/segman/` files change
2. Regenerates reference output for all languages
3. Verifies all outputs are byte-for-byte identical
4. Computes SHA256 hash of reference output
5. Compares hash to `VERSION.json`
6. **Auto-bumps patch version** if output changed (unless VERSION.json was manually bumped)
7. Auto-stages VERSION.json and reference/*.jsonl files

### Manual Version Bumps
- **Patch** (auto): Bug fixes, no behavioral change expected but output differs
- **Minor** (manual): New features, new segmentation rules
- **Major** (manual): Breaking changes to algorithm

To manually bump major/minor:
1. Edit VERSION.json directly (change version field)
2. Commit - hook will detect manual bump and skip auto-bump

## Important Notes
- When in doubt about modifying the manuscript or scenarios, ASK the user first
- The manuscript and test scenarios are sacred - they represent the user's creative work and careful curation
- VERSION.json is managed by the pre-commit hook - only manually edit for major/minor bumps
