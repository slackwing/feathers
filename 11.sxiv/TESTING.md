# Testing SXIVA

This document describes how to test the SXIVA project after making changes.

## Test Categories

### 1. Example Calculation Tests

**What**: Validates that the point calculation engine produces correct results for all example files.

**When to run**: After modifying grammar, calculator logic, parser, or any core functionality.

**How to run**:
```bash
./regenerate.sh
```

**How to verify**:
```bash
git diff examples/calculated/
```

**Important**: Carefully examine ALL diffs in `examples/calculated/`:
- ✅ **Expected changes**: Diffs related to your modifications are good
- ⚠️ **Unintended side-effects**: Changes to unrelated examples require investigation
  - If they seem correct/reasonable → **Ask the user to review**
  - If they're clearly wrong → **Fix the side-effect before proceeding**

**Why this matters**: The `examples/calculated/` directory is the source of truth for verifying correctness. Any unintended changes indicate bugs or regressions.

### 2. CLI Command Tests

**What**: Integration tests for interactive CLI commands (`log-now`, `log-end`, `repeat-entry`).

**When to run**: After modifying CLI commands or related parsing logic.

**How to run**:
```bash
./tests/cli/test_cli_commands.sh
```

**How to verify**: All tests should pass (show green ✓). See `tests/cli/README.md` for details.

**Coverage**:
- `log-now`: Sets end time on last complete entry
- `log-end`: Cleans incomplete entries and logs current time
- `repeat-entry`: Duplicates last entry with +12 min start time
- Tests cover: `---` vs `~---`, notes vs clean, regular vs x-blocks, indentation, midnight wrapping

### 3. Python Unit Tests

**What**: Unit tests for specific functionality (if any exist).

**When to run**: After modifying tested components.

**How to run**:
```bash
python3 tests/test_examples.py
```

### 4. Grammar Tests

**What**: Validates Tree-sitter grammar compiles and parses correctly.

**When to run**: After modifying `grammar/grammar.js`.

**How to run**:
```bash
cd grammar
npx tree-sitter generate
gcc -o parser.so -shared src/parser.c -I./src -fPIC -O2
cd ..
python3 tests/test_examples.py
```

## Complete Testing Workflow

After making changes, follow this checklist:

1. **Regenerate examples**:
   ```bash
   ./regenerate.sh
   ```

2. **Review all diffs carefully**:
   ```bash
   git diff examples/calculated/
   ```
   - Verify changes are intentional and correct
   - Investigate any unexpected diffs
   - Ask user to review if uncertain

3. **Run CLI command tests**:
   ```bash
   ./tests/cli/test_cli_commands.sh
   ```

4. **Run Python tests**:
   ```bash
   python3 tests/test_examples.py
   ```

5. **All tests passing?**
   - ✅ Yes → Changes are likely safe
   - ❌ No → Fix failures before proceeding

## Critical Rules

1. **NEVER run `--fix` on source examples directly**
   - ❌ Wrong: `python3 -m tools.sxiva.cli calculate examples/*.sxiva --fix`
   - ✅ Correct: `./regenerate.sh`

2. **ALWAYS verify calculated diffs** after regenerating
   - Don't assume all changes are correct
   - Unintended changes = potential bugs

3. **Keep `docs/SPECS.md` updated** when behavior changes
   - SPECS.md is the source of truth for the language
   - Must be detailed enough to regenerate everything from scratch

## Adding New Tests

### For Calculation Tests (examples/)
1. Add new `.sxiva` file to `examples/`
2. Run `./regenerate.sh`
3. Verify output in `examples/calculated/` is correct
4. Commit both source and calculated files

### For CLI Command Tests (tests/cli/)
1. Add new `.sxiva` file to `tests/cli/source/` with appropriate naming:
   - `log-now-*.sxiva` for log-now tests
   - `log-end-*.sxiva` for log-end tests
   - `repeat-entry-*.sxiva` for repeat-entry tests
2. Run `./tests/cli/test_cli_commands.sh`
3. Verify output in `tests/cli/expected/` is correct
4. Commit only the source file (expected/ is git-ignored)

## Quick Reference

| Test Type | Command | What it validates |
|-----------|---------|-------------------|
| Calculation | `./regenerate.sh` | Point calculations, summaries, attributes |
| CLI Commands | `./tests/cli/test_cli_commands.sh` | log-now, log-end, repeat-entry |
| Python Unit | `python3 tests/test_examples.py` | Example validation |
| Grammar | `cd grammar && npx tree-sitter generate && gcc ...` | Parser compilation |

## Debugging Test Failures

### Calculation Tests Fail
- Check `git diff examples/calculated/` for what changed
- Compare against `docs/SPECS.md` for expected behavior
- Verify source examples have correct syntax

### CLI Command Tests Fail
- Check error messages in test output
- Run commands manually: `python3 -m tools.sxiva.cli <command> /tmp/test.sxiva`
- Inspect `tests/cli/expected/` files for actual output

### Grammar Compilation Fails
- Check `grammar/grammar.js` for syntax errors
- Run `npx tree-sitter generate` and review errors
- Verify grammar rules are valid
