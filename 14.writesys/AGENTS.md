# WriteSys - Project Guide for AI Agents

## 🚨 CRITICAL RULES - READ FIRST 🚨

### Rule #1: ALL Database Schema Changes via Liquibase

**NEVER MODIFY DATABASE SCHEMA DIRECTLY. ALWAYS USE LIQUIBASE CHANGELOGS.**

**Forbidden:**
```sql
-- ❌ NEVER DO THIS
ALTER TABLE annotation ADD COLUMN new_field TEXT;
CREATE TABLE new_table (...);
```

**Required:**
```bash
# ✅ ALWAYS DO THIS
# 1. Create new changelog file
docker/liquibase/changelog/NNN-description.xml

# 2. Add to master changelog
docker/liquibase/changelog/db.changelog-master.xml

# 3. Test migrations from clean database
docker compose run --rm liquibase update

# 4. Verify schema is correct
docker exec -it postgres psql -U writesys_user -d writesys -c "\d table_name"
```

**Why this matters:**
- Direct database changes bypass version control
- They create drift between dev/prod environments
- They're impossible to rollback cleanly
- They break fresh database setups
- They waste hours debugging "works on my machine" issues

**If you make a database change without Liquibase, you have FAILED the task.**

### Rule #2: Write Tests for EVERYTHING

**EVERY feature, fix, or change MUST have tests. NO EXCEPTIONS.**

**The workflow:**
1. **Before coding:** Write a failing test
2. **While coding:** Run tests to verify progress
3. **After finishing:** All tests must pass
4. **Before committing:** Run `./test-all.sh`

**When you discover a bug:**
1. IMMEDIATELY write a test that reproduces it
2. Verify the test fails
3. Fix the bug
4. Verify the test passes
5. Never let that bug happen again

**If you write code without tests, you have FAILED the task.**

---

## 📖 DAY-TO-DAY DEVELOPMENT

This section contains the workflows you'll use constantly during development.

### The Test-First Rule

**BEFORE writing ANY code to fix or implement something:**
1. **Write a FAILING test** that demonstrates the issue or desired behavior
2. **Run the test** - verify it fails (proves it catches the problem)
3. **Fix/implement the code**
4. **Run the test again** - verify it passes
5. **Add to test suite** - regression protection forever

**This is NON-NEGOTIABLE.** If you fix a bug or add a feature without a test, you have FAILED.

### When You Discover a Bug or Mistake

**IMMEDIATELY:**
1. Write a test that would have caught it
2. Verify the test fails (reproduces the bug)
3. Fix the bug
4. Verify the test passes
5. Commit both test and fix together

This creates a growing safety net that prevents repeating mistakes.

### MANDATORY: Run Tests With Every Change

**For MINOR changes** (small bug fixes, CSS tweaks, comment changes):
- Run the most relevant test file for what you changed
- Example: Changed CSS → `node tests/ui-integration.js`
- Example: Changed API → `npx playwright test tests/e2e.spec.js`
- Example: Changed Go code → `go test ./...`

**For MAJOR changes** (new features, refactoring, API changes, UI architecture):
- Run ALL tests: `./test-all.sh`
- If tests fail, ask the user: "This test is failing: [test name]. Is this test still relevant?"
- Update or remove tests based on user feedback
- **NEVER let tests diverge from the codebase**

### Where to Add Tests (NEVER Create New Test Files)

**🚨🚨🚨 STOP - READ THIS BEFORE WRITING ANY TEST CODE 🚨🚨🚨**

**ABSOLUTELY FORBIDDEN: Creating new test files**

**RULE: If you create a new `.js` test file in `tests/`, you have FAILED the task.**

**YOU MUST:**
1. ALWAYS add tests to existing test files (`e2e.spec.js`, `ui-integration.js`, `smoke.js`, `test-*.js`)
2. NEVER create files like `tests/console-check.js`, `tests/interaction-test.js`, `tests/new-feature-test.js`, `tests/debug-*.js`
3. ALWAYS use headless mode (`headless: true`) when launching Playwright browsers
4. If you think you need a new test file, you are WRONG - add to existing files instead

**✅ REQUIRED: Add tests to existing files:**

1. **Playwright E2E tests** → `tests/e2e.spec.js`
   - When: Testing browser interactions, UI behavior, API endpoints from browser
   - Examples: Clicking buttons, form submissions, page navigation, sidebar behavior
   - Pattern: Add new `test('description', async ({ page }) => { ... })` within existing `test.describe()` block
   - **HEADLESS MODE REQUIRED:** ALWAYS use `{ headless: true }` when launching browsers to avoid interrupting the user

2. **UI Integration tests** → `tests/ui-integration.js`
   - When: Testing visual rendering, layout, styling, Paged.js behavior, interactions
   - Examples: Page dimensions, colors, fonts, positioning, pagination, color palette, sentence selection
   - Pattern: Add new test with `assert(condition, message)` function
   - **HEADLESS MODE REQUIRED:** Browser launches MUST use `headless: true`

3. **Feature-specific tests** → `tests/test-*.js` (tags, annotations, etc)
   - When: Testing specific features (tag API, note and tags, delete and recreate)
   - **HEADLESS MODE REQUIRED:** Browser launches MUST use `headless: true` if using Playwright

4. **Quick smoke tests** → `tests/smoke.js`
   - When: Testing absolute basics (page loads, auto-load works)
   - Pattern: Only add tests that must run very fast (<5 seconds total)
   - **HEADLESS MODE REQUIRED:** Browser launches MUST use `headless: true`

5. **Go unit tests** → `internal/*_test.go`
   - When: Testing Go functions and modules
   - Pattern: Same package as code being tested

**Ask the user FIRST** if you think you need a new test file.

### Quick Test Commands

```bash
# Complete suite (run before commits)
./test-all.sh

# Quick tests (run frequently)
go test ./...                           # Go unit tests
node tests/test-tags-comprehensive.js   # Tag functionality
node tests/smoke.js                     # Basic smoke test
npx playwright test                     # All E2E tests

# Specific feature tests
node tests/test-tag-api.js              # Tag API
node tests/test-note-and-tags.js        # Note and tag interactions
```

**When tests fail:**
- Test is outdated → Update it to match current behavior
- Test is irrelevant → Ask user if it should be deleted
- Code broke something → Fix the code, NOT the test

---

## 📋 PROJECT OVERVIEW

WriteSys is a book annotation system that tracks highlights, tags, and tasks on sentences in a Markdown manuscript. Annotations intelligently migrate as the text evolves through git commits.

**📋 Primary Design Document:** [PLAN.md](./PLAN.md) - Read this first for architecture, database schema, algorithms, and design decisions.

### Quick Context

- **Tech Stack:** Go (backend/CLI), PostgreSQL, Liquibase, Plain HTML/CSS/JS (frontend)
- **Database:** Postgres on host (localhost:5432), managed via Liquibase
- **Phase:** Phase 1 (data structures, migration algorithm, basic UI)

### Core Principles

1. **Markdown in git is the source of truth** - annotations are a layer on top
2. **Sentences get new IDs when edited** - no false lineage tracking
3. **Heuristic migration with confidence scores** - user reviews/fixes manually
4. **Append-only annotation history** - never delete, only soft-delete
5. **All schema changes via Liquibase** - no direct database modifications

### Code Locations

- **CLI:** `cmd/writesys/` - See PLAN.md "Sentence Processing Algorithm"
- **Migration:** `internal/sentence/matcher.go` - See PLAN.md "Migration Algorithm"
- **Database Schema:** `docker/liquibase/changelog/` - See PLAN.md "Data Model"
- **Web UI:** `web/` - See PLAN.md "Web UI Design"
- **API:** `api/` - See PLAN.md "Rendering Pipeline"

---

## 🚀 DEVELOPMENT WORKFLOW

```bash
# Start API (serves both API and web UI)
API_PORT=5003 ./bin/api

# Process a manuscript
./bin/writesys -repo manuscripts/test-repo -file the-wildfire.manuscript -yes

# Run tests
./test-all.sh              # Complete suite before commits
go test ./...              # Go unit tests
node tests/smoke.js        # Quick smoke test
npx playwright test        # E2E tests
```

**Initial setup (if needed):**
```bash
# Start database
cd docker && docker compose up -d

# Run migrations
docker compose --profile migrate up liquibase

# Build CLI
cd ../cmd/writesys && go build -o writesys
```

---

## ⚙️ SPECIALIZED PROCEDURES

These procedures are less frequent but critical when needed.

### Updating Sentence Segmenters

**CRITICAL: Always Update Both Segmenters Together**

WriteSys uses sentence segmenters from the `15.senseg` project. When the segmenter is updated (bug fixes, improvements), you MUST update both JavaScript and Go versions:

**Location of canonical segmenters:**
- JavaScript: `../15.senseg/js/segmenter.js`
- Go: `../15.senseg/go/segmenter.go`

**Update process:**
```bash
# From the 14.writesys directory
cp ../15.senseg/js/segmenter.js web/js/segmenter.js
cp ../15.senseg/go/segmenter.go internal/senseg/segmenter.go
```

**Why both must be updated:**
- The JavaScript segmenter runs in the browser to wrap sentences in the DOM
- The Go segmenter runs on the server to process manuscripts and generate sentence IDs
- They MUST split sentences identically, or wrapping will fail
- ID generation depends on exact segmentation (text + ordinal + commit hash)
- A mismatch causes "disparity" warnings where JS and server sentence counts don't match

**After updating segmenters:**
1. Reprocess any test commits if needed
2. Run UI tests to verify wrapping still works: `node tests/ui-integration.js`
3. Check for disparities in console output
4. Run complete test suite: `./test-all.sh`

**Note:** Segmentation-specific tests have been removed from WriteSys since segmentation is now the responsibility of the 15.senseg project.

### Modifying Source Markdown

When changing manuscripts: (1) commit to git, (2) reprocess with WriteSys CLI, (3) update test commit hashes

### Frontend Verification

**AI agents can't open browsers, but can verify frontend via API logs:**

1. Start API: `API_PORT=5003 ./bin/api`
2. User opens browser to http://localhost:5003
3. Check API logs for errors (404s, 500s)
4. Test API directly: `curl http://localhost:5003/api/migrations/latest?manuscript_id=1`

**Common issues:** Wrong manuscript_id, missing routes in `api/main.go`, CORS errors, missing static files

---

## 🎯 KEY DESIGN DECISIONS

See PLAN.md for full details.

1. **No sentence identity tracking** - Annotations migrate heuristically with confidence scores
2. **8-char hex sentence IDs** - Deterministic from content hash, collision-proof
3. **Tokenizer parity required** - JS and Go must split identically for DOM wrapping
4. **Markdown stays in git** - Don't duplicate in database

---

## ❓ QUESTIONS?

If anything is unclear or conflicts with PLAN.md, **ask the user** rather than making assumptions.

---

**Last Updated:** 2026-03-29
