# WriteSys - Project Guide for AI Agents

## Project Overview

WriteSys is a book annotation system that tracks highlights, tags, and tasks on sentences in a Markdown manuscript. Annotations intelligently migrate as the text evolves through git commits.

## Key Resources

**📋 Primary Design Document:** [PLAN.md](./PLAN.md)

The PLAN.md file contains:
- Complete system architecture
- Database schema with all tables
- Sentence processing and migration algorithms
- Git workflow and commit processing
- Web UI design and interaction patterns
- Implementation milestones
- Edge cases and design decisions

**Always read PLAN.md first** when working on this project.

## Quick Context

- **Tech Stack:** Go (backend/CLI), PostgreSQL, Liquibase, Plain HTML/CSS/JS (frontend)
- **Pattern Reference:** `/home/slackwing/src/worktree-writesys/11.sxiv/dashboard/docker/` (Docker + Liquibase setup)
- **Phase:** Currently in Phase 1 (data structures, migration algorithm, basic UI)
- **Database:** Postgres in Docker, following sxiva project patterns

## Core Principles

1. **Markdown in git is the source of truth** - annotations are a layer on top
2. **Sentences get new IDs when edited** - no false lineage tracking
3. **Heuristic migration with confidence scores** - user reviews/fixes manually
4. **Append-only annotation history** - never delete, only soft-delete
5. **Content-addressed sentence storage** - deduplicate text across commits

## Testing Philosophy

**CRITICAL: Write tests for EVERYTHING**

Every feature, fix, or change MUST have corresponding tests. No exceptions.

**The Rule:**
1. **Before you write code**: Write a failing test that demonstrates what needs to work
2. **While you code**: Run tests frequently to verify progress
3. **After you finish**: Ensure all tests pass before considering the work complete
4. **Before you commit**: Run the complete test suite (`./test-all.sh`)

**Why this matters:**
- Tests prevent regressions - bugs that get fixed stay fixed
- Tests document expected behavior - they ARE the specification
- Tests enable confident refactoring - you know immediately if you break something
- Tests save time - catching bugs early is 10x faster than debugging later

**Test Types:**
- **Unit Tests** (`go test ./...`): Test individual functions and modules
- **Integration Tests** (`./bin/writesys`): Test CLI with real database
- **API Tests** (`curl` commands): Test HTTP endpoints
- **UI Tests** (`node browser-testing/test-complete.js`): Test browser behavior with Playwright

When you discover a bug or make a mistake:
1. IMMEDIATELY write a test that would have caught it
2. Verify the test fails (reproduces the bug)
3. Fix the bug
4. Verify the test passes
5. Add it to the test suite

This creates a growing safety net that makes the codebase more robust over time.

## Common Tasks

### Working on the CLI (`writesys` command)
- See: PLAN.md → "Sentence Processing Algorithm" and "Git Processing Flow"
- Code location: `cmd/writesys/`

### Working on Migration Algorithm
- See: PLAN.md → "Migration Algorithm (Commit A → Commit B)"
- Code location: `internal/sentence/matcher.go`

### Working on Database Schema
- See: PLAN.md → "Data Model" section
- Liquibase changelogs: `docker/liquibase/changelog/`

### Working on Web UI
- See: PLAN.md → "Web UI Design" section
- Code location: `web/`

### Working on API Endpoints
- See: PLAN.md → "Rendering Pipeline" (API endpoints listed)
- Code location: `api/`

### Modifying Source Markdown Files

**CRITICAL**: Whenever you change source markdown files in `manuscripts/`, you MUST:

1. Commit the changes to git in the test repository:
   ```bash
   cd manuscripts/test-repo
   git add the-wildfire.md
   git commit -m "fix: describe your change"
   ```

2. Reprocess the commit to update the database:
   ```bash
   # Delete old processed commit first
   docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c "
   DELETE FROM annotation_version WHERE sentence_id IN (SELECT sentence_id FROM sentence WHERE commit_hash = 'OLD_HASH');
   DELETE FROM annotation WHERE annotation_id IN (SELECT DISTINCT annotation_id FROM annotation_version WHERE sentence_id IN (SELECT sentence_id FROM sentence WHERE commit_hash = 'OLD_HASH'));
   DELETE FROM sentence WHERE commit_hash = 'OLD_HASH';
   DELETE FROM processed_commit WHERE commit_hash = 'OLD_HASH';
   "

   # Process new commit
   ./bin/writesys --repo manuscripts/test-repo --file the-wildfire.md --commit NEW_HASH --yes
   ```

3. Update any tests that reference the old commit hash to use the new hash

Without reprocessing, the UI will continue showing the old version from the database.

## Development Workflow

```bash
# Start database
cd docker && docker compose up -d

# Run migrations
docker compose --profile migrate up liquibase

# Build CLI
cd ../cmd/writesys && go build -o writesys

# Process a commit
./writesys process --file ../../manuscripts/the-wildfire.md

# Start API server
cd ../api && go run main.go
```

## Testing

### Quick Test Reference

```bash
# Run all unit tests
go test ./...

# Run specific test package
go test -v ./internal/sentence

# Run specific test
go test -v ./internal/sentence -run TestComputeSimilarity

# CLI bootstrap test (first commit)
./bin/writesys --repo manuscripts/test-repo --file the-wildfire.md --commit b30bd0f --yes

# CLI migration test (second commit)
./bin/writesys --repo manuscripts/test-repo --file the-wildfire.md --commit 76c9a7f --yes

# Verify database results
docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c "SELECT * FROM processed_commit ORDER BY processed_at;"
```

### Unit Tests (56 total)

**Tokenizer Tests** (`internal/sentence/tokenizer_test.go`)
- TestSplitIntoSentences (20 cases): edge cases, abbreviations, quotes, lists
- TestCountWords (10 cases): word counting with various inputs
- TestNormalizeText (8 cases): lowercase, punctuation removal
- TestExtractWords (5 cases): word extraction for IDs

**Sentence ID Tests** (`internal/sentence/id_test.go`)
- TestGenerateSentenceID (6 cases): format validation, determinism, uniqueness

**Matcher Tests** (`internal/sentence/matcher_test.go`)
- TestComputeSimilarity (10 cases): word-level similarity scoring
- TestLevenshteinDistance (7 cases): edit distance computation
- TestComputeSentenceDiff (5 cases): added/deleted/unchanged detection
- TestComputeMigrationMap (3 cases): fuzzy matching with confidence

### Integration Tests

**Test Data:** `manuscripts/test-repo/` (nested git repo)
- Commit b30bd0f: Initial draft (214 sentences)
- Commit 76c9a7f: Added Section III (216 sentences, +2)

**Bootstrap Test:**
```bash
./bin/writesys --repo manuscripts/test-repo --file the-wildfire.md --commit b30bd0f --yes
```
Expected: 214 sentences stored, additions_count=214

**Migration Test:**
```bash
./bin/writesys --repo manuscripts/test-repo --file the-wildfire.md --commit 76c9a7f --yes
```
Expected: 216 sentences, 214 exact matches, 2 additions

### Database Verification

```bash
# View all processed commits
docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c \
  "SELECT commit_hash, sentence_count, additions_count, deletions_count FROM processed_commit ORDER BY processed_at;"

# Count sentences per commit
docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c \
  "SELECT commit_hash, COUNT(*) FROM sentence GROUP BY commit_hash;"

# Sample sentences
docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c \
  "SELECT sentence_id, text, ordinal FROM sentence WHERE commit_hash = 'b30bd0f' LIMIT 5;"
```

### Cleanup and Re-run

```bash
# Clear test data
docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c "
  DELETE FROM sentence WHERE commit_hash IN ('b30bd0f', '76c9a7f');
  DELETE FROM processed_commit WHERE manuscript_id = 1;
  DELETE FROM manuscript WHERE manuscript_id = 1;
"

# Re-run tests
./bin/writesys --repo manuscripts/test-repo --file the-wildfire.md --commit b30bd0f --yes
./bin/writesys --repo manuscripts/test-repo --file the-wildfire.md --commit 76c9a7f --yes
```

### Test Coverage

```bash
# Generate coverage report
go test -coverprofile=coverage.out ./internal/sentence

# View in terminal
go tool cover -func=coverage.out

# Generate HTML
go tool cover -html=coverage.out -o coverage.html
```

### API Tests

**Start API Server:**
```bash
# Build API
cd api && go build -o ../bin/writesys-api && cd ..

# Start server (default port 5000)
./bin/writesys-api

# Start on custom port
API_PORT=5003 ./bin/writesys-api
```

**Health Check:**
```bash
curl http://localhost:5000/health | jq .
# Expected: {"status":"ok","database":"connected","version":"0.1.0-dev"}
```

**GET /api/manuscripts/:commit_hash**
```bash
curl -s "http://localhost:5000/api/manuscripts/b30bd0f?repo=manuscripts/test-repo&file=the-wildfire.md" | jq '.sentences | length'
# Expected: 214
```

**GET /api/annotations/sentence/:sentence_id**
```bash
curl -s "http://localhost:5000/api/annotations/sentence/chapter-1-i-dbd5ba08" | jq .
# Expected: Array of annotations for that sentence
```

**POST /api/annotations** (Create)
```bash
# Create test file
cat > test-annotation.json <<EOF
{
  "type": "highlight",
  "sentence_id": "chapter-1-i-dbd5ba08",
  "payload": {
    "color": "yellow",
    "note": "Great opening line!"
  }
}
EOF

# Create annotation
curl -s -X POST http://localhost:5000/api/annotations \
  -H "Content-Type: application/json" \
  -d @test-annotation.json | jq .
# Expected: {"annotation_id":1,"version":1}
```

**PUT /api/annotations/:annotation_id** (Update)
```bash
# Create update file
cat > test-update.json <<EOF
{
  "sentence_id": "chapter-1-i-dbd5ba08",
  "payload": {
    "color": "green",
    "note": "Updated note!"
  }
}
EOF

# Update annotation
curl -s -X PUT http://localhost:5000/api/annotations/1 \
  -H "Content-Type: application/json" \
  -d @test-update.json | jq .
# Expected: {"annotation_id":1,"version":2}
```

**DELETE /api/annotations/:annotation_id** (Soft Delete)
```bash
curl -s -X DELETE http://localhost:5000/api/annotations/1 -w "\nHTTP Status: %{http_code}"
# Expected: HTTP Status: 204

# Verify soft delete
docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c \
  "SELECT annotation_id, type, deleted_at FROM annotation WHERE annotation_id = 1;"
# Expected: deleted_at should have a timestamp
```

### Web UI Tests

**CRITICAL: Test-Driven Issue Discovery**

**When you discover a mistake in your analysis or find a new issue:**
1. **IMMEDIATELY write a test** that would have caught the issue
2. **Run the test** to verify it fails (reproduces the issue)
3. **Fix the issue**
4. **Verify the test passes**
5. **Add the test to the suite** for future regression protection

This creates a growing safety net that prevents repeating mistakes.

**IMPORTANT: Always Run ALL Tests After Making Changes**
```bash
# Run complete test suite after any code changes
./test-all.sh
```

**Start Web UI:**
```bash
# API server serves both API endpoints and static web files
API_PORT=5003 ./bin/writesys-api

# Open in browser
open http://localhost:5003
```

**Visual Testing with Playwright:**

ALWAYS run Playwright tests after making changes to HTML, CSS, or JavaScript.

```bash
# Complete UI test suite (21 tests) - see file for what it tests
node browser-testing/test-complete.js

# Individual diagnostic tests - see browser-testing/ directory
node browser-testing/test-auto-load.js  # Auto-load verification
node browser-testing/test-ui-visual.js
node browser-testing/test-ui-detailed.js
node browser-testing/test-structure.js
```

**The tests ARE the documentation.** Read the test files to understand what the UI should do:
- `browser-testing/test-complete.js` - Complete specification (21 tests covering auto-load, rendering, styling, pagination)
- `browser-testing/test-*.js` - Diagnostic tools for debugging

**What test-complete.js verifies:**
1. **Auto-load (Tests 1-4)**: Dropdown populated, latest commit selected, manuscript loads automatically
2. **Controls (Tests 5-9)**: Visibility, positioning, outside Paged.js container
3. **Styling (Tests 10-13)**: Page colors, borders, shadows, text justification
4. **Content (Tests 14-17)**: Text rendering, sentence wrapping, page numbers
5. **Layout (Tests 18-20)**: Page dimensions, content area size
6. **Typography (Test 21)**: Short dialogue lines don't have stretched justification

**Reference Design:**
- Live: https://andrewcheong.com/.staging/stories/
- Live (Wildfire): https://andrewcheong.com/.staging/wildfire/
- Source: `$HOME/src/worktree-stories/foundry/website/html/stories/`
- Source (common): `$HOME/src/worktree-stories/foundry/website/html/common/book.css` and `book.js`
- Source (Wildfire): `$HOME/src/worktree-stories/foundry/website/html/wildfire/`

**Manual Testing Checklist:**

1. **Page Load**
   - ✓ Page loads with controls at top
   - ✓ Default values populated (commit: b30bd0f, repo: manuscripts/test-repo, file: the-wildfire.md)
   - ✓ Click "Load Manuscript" button
   - ✓ Status shows "Loading manuscript..."
   - ✓ Manuscript renders with book-style formatting
   - ✓ Sentence count displayed (should show "214 sentences")

2. **Sentence Wrapping**
   - ✓ All text is wrapped in `.sentence` spans
   - ✓ Hover over sentence shows blue highlight
   - ✓ Click sentence to select (blue background)
   - ✓ Open browser console: Check for "Wrapped X sentences" log
   - ✓ Verify no "Mismatch" warnings in console

3. **Annotation Sidebar**
   - ✓ Click any sentence
   - ✓ Sidebar slides in from right
   - ✓ Selected sentence text displayed in italics
   - ✓ "No annotations yet" message shown
   - ✓ Click "Add one?" link
   - ✓ Annotation form appears

4. **Create Highlight Annotation**
   - ✓ Select sentence
   - ✓ Click "Add one?" or "+ Add Annotation"
   - ✓ Type: "Highlight" (default)
   - ✓ Color: "Yellow" (default)
   - ✓ Optional note: "Great opening line!"
   - ✓ Click "Save"
   - ✓ Annotation appears in list
   - ✓ Sentence gets yellow background

5. **Create Tag Annotation**
   - ✓ Select another sentence
   - ✓ Add annotation
   - ✓ Type: "Tag"
   - ✓ Tag value: "character"
   - ✓ Save
   - ✓ Sentence gets blue underline

6. **Create Task Annotation**
   - ✓ Select another sentence
   - ✓ Add annotation
   - ✓ Type: "Task"
   - ✓ Task description: "Revise this sentence"
   - ✓ Priority: "P2 - Medium"
   - ✓ Save
   - ✓ Sentence gets red folded corner (top-right)

7. **Delete Annotation**
   - ✓ Click on annotated sentence
   - ✓ Sidebar shows annotation
   - ✓ Click "Delete" button
   - ✓ Confirm deletion dialog
   - ✓ Annotation removed from list
   - ✓ Sentence styling removed

8. **Close Sidebar**
   - ✓ Click X button in sidebar header
   - ✓ Sidebar slides out
   - ✓ Click anywhere on manuscript
   - ✓ Sidebar closes if open

**Automated UI Tests:**
```bash
# Test manuscript endpoint for web UI
curl -s "http://localhost:5003/api/manuscripts/b30bd0f?repo=manuscripts/test-repo&file=the-wildfire.md" \
  | jq '{sentences_count: (.sentences | length), markdown_length: (.markdown | length)}'
# Expected: {"sentences_count": 214, "markdown_length": 15950}

# Verify web UI is being served
curl -s http://localhost:5003/ | grep "WriteSys - Book Annotation System"
# Expected: <title>WriteSys - Book Annotation System</title>

# Verify CSS is served
curl -s http://localhost:5003/css/book.css | head -5
# Expected: CSS content

# Verify JS is served
curl -s http://localhost:5003/js/renderer.js | head -5
# Expected: JS content with WriteSysRenderer
```

### End-to-End Tests

**Run Complete Workflow Test:**
```bash
./test-e2e.sh
```

This script tests the complete lifecycle:
1. Clean database
2. Bootstrap first commit (b30bd0f) - 214 sentences
3. Create 3 annotations (highlight, tag, task)
4. Process second commit (76c9a7f) with migration - 216 sentences
5. Verify annotations migrated correctly
6. Check API returns migrated annotations

**Expected Output:**
```
========================================
Test Summary
========================================
  Bootstrap:              ✓    214 sentences
  Annotations Created:    ✓      3
  Migration:              ✓    216 sentences
  Annotations Preserved:  ✓      3
  API Retrieval:          ✓ 3

✓ End-to-End Test Complete!
```

**Annotation Migration Verification:**
```bash
# Check annotation versions in database
docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c \
  "SELECT annotation_id, version, sentence_id, migration_confidence
   FROM annotation_version ORDER BY annotation_id, version;"
```

Expected: Each annotation should have 2 versions
- Version 1: Original sentence ID, no confidence (bootstrap)
- Version 2: New sentence ID, confidence = 1.00 (migrated)

### Last Test Run: 2026-03-19

- Unit tests: 56/56 passing
- Bootstrap test: PASSED (214 sentences)
- Migration test: PASSED (216 sentences, 214 exact matches, 2 additions)
- Database verification: All foreign keys satisfied, JSONB arrays properly formatted
- API tests: All endpoints PASSED
  - Health check: PASSED
  - GET /api/manuscripts/:commit_hash: PASSED (214 sentences)
  - GET /api/commits: PASSED (6 commits returned)
  - GET /api/annotations/sentence/:sentence_id: PASSED
  - POST /api/annotations: PASSED (annotation_id: 3, version: 1)
  - PUT /api/annotations/:annotation_id: PASSED (version: 2)
  - DELETE /api/annotations/:annotation_id: PASSED (soft delete confirmed)
- Web UI tests: PASSED (21/21 tests)
  - Auto-load: PASSED (dropdown populated with 6 commits, latest auto-selected and loaded)
  - Controls visibility and positioning: PASSED
  - Paged.js pagination: PASSED (10 pages rendered)
  - Page styling: PASSED (white background, borders, shadows, gray container)
  - Typography: PASSED (justified paragraphs, no stretched dialogue)
  - Sentence wrapping: PASSED (319 .sentence elements)
  - Page numbers: PASSED (hidden on first page, visible on others)
  - Layout dimensions: PASSED (576×864 pages, 480×720 content area)
  - Screenshot: browser-testing/test-complete.png
- Annotation Migration tests: PASSED
  - Created 3 annotations on commit b30bd0f
  - Processed commit 76c9a7f with migration
  - All 3 annotations migrated successfully
  - Migration confidence: 1.00 (exact matches)
  - API retrieval: All 3 annotations returned for new commit
- End-to-End Workflow: PASSED
  - Full lifecycle test script (./test-e2e.sh)
  - Bootstrap → Annotate → Edit → Migrate
  - All steps completed successfully

## Architecture at a Glance

```
Markdown (git) → writesys CLI → Postgres DB ← API Server ← Web UI
                      ↓
              Sentence tokenizer
              ID generator
              Migration algorithm
```

## Important Design Decisions

1. **Why no `sentence_anchor`?** We don't track sentence identity across commits. Annotations migrate heuristically, user fixes manually.

2. **Why 8 hex chars in IDs?** 4.3 billion possible values = collision-proof without runtime checks. Deterministic from hash (text + ordinal + commit).

3. **Why no separate `sentence_text` table?** Text stored directly in `sentence` table. Space savings (~8%) not worth the complexity. ~304MB for full novel lifecycle is acceptable.

4. **Why store sentence ID array uncompressed?** Acts as integrity check and backup. Human-readable for debugging. JSONB in Postgres is efficient enough (~100KB for 7,500 sentences).

5. **Why NOT store markdown in database?** Git already stores it. Use `git show <hash>:path` to retrieve any commit's content.

6. **Why tokenizer parity?** Frontend uses sequential DOM wrapping (fast, robust). Requires Go and JavaScript tokenizers to split sentences identically. One-time porting effort with high payoff.

7. **Why confidence scores?** Makes low-quality migrations visible in UI so user knows to review.

## Phase 1 Boundaries

**In scope:**
- Local development (Docker)
- Single user ("andrew")
- Desktop UI only
- Basic annotations (highlights, tags, tasks)

**Out of scope:**
- Multi-user auth
- Mobile optimization
- Real-time collaboration
- Search/filter/export
- AI features

See PLAN.md → "Phase 1: Scope & Goals" for complete list.

## Key Files to Read

1. **PLAN.md** - Complete design (READ THIS FIRST)
2. `docker/docker-compose.yml` - Infrastructure setup
3. `docker/liquibase/changelog/db.changelog-master.xml` - Database schema evolution
4. `cmd/writesys/main.go` - CLI entry point
5. `internal/sentence/tokenizer.go` - Sentence splitting logic
6. `api/handlers.go` - API endpoints

## External References

- **Pattern source:** `/home/slackwing/src/worktree-writesys/11.sxiv/` (sxiva dashboard Docker/Liquibase patterns)
- **Sentence splitting:** `github.com/jdkato/prose` (Go NLP library)
- **Fuzzy matching:** Levenshtein distance at word level

## Questions?

If anything is unclear or conflicts with PLAN.md, **ask the user** rather than making assumptions. The design is intentionally opinionated to avoid scope creep.

---

**Last Updated:** 2026-03-19
