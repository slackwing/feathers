# WriteSys Test Setup

## Overview

All integration tests now run on a separate test manuscript (`ui-test.manuscript`) that is isolated from your working document.

## Test Manuscript Setup

### Manuscripts in Database:
- **manuscript_id=1**: `manuscripts/test-repo/the-wildfire.manuscript` (YOUR WORKING DOCUMENT)
  - Commit: 24575cf8242aa7eb31293441ff5e2239e0a7bffd
  - Has 31 annotations (your work)
  - **Tests NEVER touch this manuscript**

- **manuscript_id=2**: `manuscripts/test-repo/ui-test.manuscript` (TEST MANUSCRIPT)
  - Commit: 6bb63c0f5dbdb06bb9456e404d2ec26cacbf51bd
  - Frozen for testing purposes
  - **All tests run on this manuscript**
  - Annotations are cleaned up before/after each test run

## How It Works

### Per-File Commit Tracking
The CLI now tracks commits per manuscript file, not per repository HEAD:
- Changed `getLatestCommitHash(repo)` → `getLatestCommitHash(repo, filePath)`
- Uses `git log -n 1 --format=%H -- <file>` to get the last commit that modified the specific manuscript
- This allows multiple manuscripts in one repository without interference

### Frontend Manuscript Selection
The web frontend accepts a `manuscript_id` query parameter:
- `http://localhost:5003` → defaults to manuscript_id=1 (your working document)
- `http://localhost:5003?manuscript_id=2` → loads test manuscript

### Test Utilities (`tests/test-utils.js`)
Provides:
- `TEST_URL`: Points to manuscript_id=2
- `TEST_MANUSCRIPT_ID`: The ID for test manuscript (2)
- `cleanupTestAnnotations()`: Deletes all annotations for manuscript_id=2

### Test Cleanup
Every test:
1. **Before test**: Calls `cleanupTestAnnotations()` to ensure clean state
2. **Runs test**: Creates/modifies annotations on manuscript_id=2
3. **After test**: Calls `cleanupTestAnnotations()` to clean up

## Updated Tests

All tests now use the test manuscript:
- ✅ `test-delete-and-recreate.js` - Tests annotation deletion and recreation
- ✅ `ui-integration.js` - Comprehensive UI tests
- ✅ `smoke.js` - Basic smoke test

## Running Tests

```bash
# Run individual tests
node tests/test-delete-and-recreate.js
node tests/ui-integration.js
node tests/smoke.js

# All tests clean up after themselves automatically
```

## Benefits

1. **Isolation**: Your working annotations (manuscript_id=1) are never touched by tests
2. **Deterministic**: Tests always start with a clean state
3. **Multi-manuscript support**: You can now have multiple manuscripts in one repo
4. **No interference**: Tests don't affect your work, your work doesn't affect tests

## File Structure

```
manuscripts/test-repo/
├── the-wildfire.manuscript  # Your working document (manuscript_id=1)
└── ui-test.manuscript       # Test manuscript (manuscript_id=2, frozen)
```

## Important Notes

- **DO NOT modify `ui-test.manuscript`** - it's frozen for consistent testing
- If you need to update test content, copy `the-wildfire.manuscript` to `ui-test.manuscript` and re-run writesys CLI
- Tests automatically handle the deletion confirmation dialog
- Cleanup uses direct database access for speed and reliability
