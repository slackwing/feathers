# CLI Command Tests

This directory contains integration tests for SXIVA CLI commands that operate on files in-place.

## Structure

```
tests/cli/
├── source/           # Source test files (never modified)
├── expected/         # Generated output (git-ignored)
├── test_cli_commands.sh  # Test runner script
└── README.md         # This file
```

## Commands Tested

### `log-now`
Sets the end time of the last **complete** entry (one with an existing end time) to the current time.

**Test files:**
- `log-now-basic.sxiva` - Basic test with complete entries

### `log-end`
Finds the last **incomplete** entry (ending with `---` or `~---` without end time), removes any notes after the dashes, and sets the end time to current time.

**Test files:**
- `log-end-with-notes.sxiva` - Incomplete entry with notes after `---`
- `log-end-clean.sxiva` - Incomplete entry already clean (no notes)
- `log-end-tilde.sxiva` - Incomplete entry with `~---` and notes
- `log-end-x-block.sxiva` - X-block (shortened block) incomplete entry
- `log-end-x-block-with-notes.sxiva` - X-block with notes after `---`
- `log-end-x-block-tilde.sxiva` - X-block with `~---` and notes

### `repeat-entry`
Duplicates the last timesheet entry (incomplete or complete) with start time +12 minutes (wraps at midnight). Preserves category, subject, minutes, and dash style but leaves end time empty.

**Test files:**
- `repeat-entry-basic.sxiva` - Basic complete entry
- `repeat-entry-incomplete.sxiva` - Incomplete entry to duplicate
- `repeat-entry-tilde.sxiva` - Entry with `~---` style
- `repeat-entry-midnight-wrap.sxiva` - Entry at 23:50 (tests wrapping to 00:00)
- `repeat-entry-indented.sxiva` - Indented entry (tests `.strip()` handling)
- `repeat-entry-x-block.sxiva` - X-block (shortened block) entry
- `repeat-entry-x-block-tilde.sxiva` - X-block with `~---` style

## Running Tests

```bash
./tests/cli/test_cli_commands.sh
```

This script:
1. Copies source files to `expected/`
2. Runs the appropriate CLI command on each file
3. Reports success/failure for each test

## Important Notes

- **Source files are immutable** - They are never modified by tests
- **Expected directory is transient** - Generated fresh on each run, not committed to git
- **Tests use real timestamps** - Output will vary by when tests are run
- **Purpose**: Verify commands run without errors and produce valid syntax, not exact output matching

## Inspecting Results

After running tests, you can inspect the results:

```bash
# List generated files
ls -la tests/cli/expected/

# View a specific result
cat tests/cli/expected/log-end-with-notes.sxiva

# See what changed from source
diff tests/cli/source/log-end-with-notes.sxiva tests/cli/expected/log-end-with-notes.sxiva
```

## Adding New Tests

1. Create a new source file in `source/` with appropriate naming:
   - `log-now-*.sxiva` for log-now tests
   - `log-end-*.sxiva` for log-end tests
   - `repeat-entry-*.sxiva` for repeat-entry tests

2. Run the test script - it will automatically pick up new files

3. Verify the output in `expected/` is correct
