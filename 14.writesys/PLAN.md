# WriteSys - Book Annotation System Design

## Overview

WriteSys is a system for tracking annotations (highlights, tags, tasks) on sentences in a Markdown manuscript, with intelligent migration of annotations as the text evolves through git commits.

**Core Philosophy:** Treat the Markdown file in git as the source of truth. Annotations attach to sentence instances (which get new IDs when edited). A heuristic migration algorithm relocates annotations to similar/nearby sentences when the manuscript changes. The author manually reviews and corrects migrations as needed.

**Key Design Decisions:**
1. **No sentence versioning or lineage tracking** - new IDs every commit, even for unchanged sentences
2. **Simplified schema** - text stored directly in `sentence` table (no separate `sentence_text` table)
3. **Deterministic 8-hex-char IDs** - collision-proof via hashing (text + ordinal + commit)
4. **Sequential DOM wrapping** - frontend and backend use identical tokenization logic
5. **Tokenizer parity required** - Go and JavaScript implementations must match exactly
6. **Ordinal-based synchronization** - sentence ID array acts as the bridge between backend and frontend

---

## Phase 1: Scope & Goals

**Primary Goals:**
1. Establish robust data structures and database schema
2. Implement sentence-level annotation tracking (highlights, tags, tasks)
3. Build sentence migration algorithm with confidence scoring
4. Create basic UI for viewing/editing annotations
5. Support local development with Docker + Postgres + Liquibase

**Explicit Non-Goals for Phase 1:**
- Multi-user authentication (hardcoded "andrew" user only)
- Mobile UI (desktop focus only)
- Real-time collaboration
- Export/import features
- Advanced search/filtering

---

## System Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│  the-wildfire.md (in git)                           │
│  Source of Truth                                    │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ git commit
                   ▼
┌─────────────────────────────────────────────────────┐
│  writesys CLI (Go)                                  │
│  - Processes commits sequentially or by choice      │
│  - Splits text into sentences                       │
│  - Generates sentence IDs                           │
│  - Computes sentence migrations                     │
│  - Updates Postgres database                        │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ writes to
                   ▼
┌─────────────────────────────────────────────────────┐
│  PostgreSQL Database                                │
│  - Sentence text (content-addressed, deduplicated)  │
│  - Sentence instances per commit                    │
│  - Annotations (highlights, tags, tasks)            │
│  - Migration maps with confidence scores            │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ reads from
                   ▼
┌─────────────────────────────────────────────────────┐
│  Web UI (HTML/CSS/JS)                               │
│  - Renders Markdown as book-style pages             │
│  - Wraps sentences in <span> with IDs               │
│  - Interactive annotation layer                     │
│  - Shows migration confidence & history             │
└─────────────────────────────────────────────────────┘
```

### Technology Stack

- **Backend:** Go 1.21+
  - CLI tool: `writesys`
  - HTTP API server for UI
- **Database:** PostgreSQL 16 (plain Postgres, no TimescaleDB extension needed)
- **Migrations:** Liquibase with XML changelogs
- **Frontend:** Plain HTML/CSS/JavaScript (no framework)
- **Sentence Splitting:** Go `prose` library (github.com/jdkato/prose/v2)
- **HTTP Routing:** Chi (github.com/go-chi/chi/v5)
- **Postgres Driver:** pgx (github.com/jackc/pgx/v5)
- **Markdown Parsing:** Goldmark (github.com/yuin/goldmark)
- **Deployment:** Docker Compose (local dev), GCP VM (future)

---

## Data Model

### Core Entities

#### 1. `processed_commit` (Git Commit History)

Tracks which commits have been processed.

```sql
CREATE TABLE processed_commit (
    commit_hash              VARCHAR(40) PRIMARY KEY,  -- Git SHA-1
    parent_commit_hash       VARCHAR(40),              -- For traversal
    branch_name              VARCHAR(255) NOT NULL,
    story_file_path          TEXT NOT NULL,            -- e.g., "the-wildfire.md"
    processed_at             TIMESTAMPTZ DEFAULT NOW(),
    sentence_count           INTEGER NOT NULL,
    additions_count          INTEGER NOT NULL DEFAULT 0,
    deletions_count          INTEGER NOT NULL DEFAULT 0,
    changes_count            INTEGER NOT NULL DEFAULT 0,
    sentence_id_array        JSONB NOT NULL,           -- Array for integrity checking & backup
    FOREIGN KEY (parent_commit_hash) REFERENCES processed_commit(commit_hash) ON DELETE SET NULL
);

CREATE INDEX idx_processed_commit_branch ON processed_commit(branch_name);
CREATE INDEX idx_processed_commit_processed_at ON processed_commit(processed_at);
CREATE INDEX idx_processed_commit_sentence_array ON processed_commit USING GIN(sentence_id_array);
```

**Why Store Sentence ID Array (Uncompressed JSON):**
- Integrity checking: verify ordinal reconstruction matches expected order
- Backup: if `sentence` table ordinals get corrupted, can rebuild from array
- Debugging: human-readable when querying database
- ~60-120KB for 7,500 sentences (acceptable tradeoff for resilience)
- Format: `["kostya-looked-around-a1f04c9d", "it-was-empty-b2g5d3e8", ...]`

**Why NOT Store Markdown:**
- Git already stores exact file content per commit (`git show <hash>:path`)
- No need to duplicate in database
- Can always reconstruct with: `git show abc123:the-wildfire.md`

---

#### 2. `sentence` (Sentence Instances per Commit)

Each row represents a specific sentence in a specific commit.

```sql
CREATE TABLE sentence (
    sentence_id     VARCHAR(100) PRIMARY KEY,    -- e.g., "kostya-looked-around-a1f04c9d"
    commit_hash     VARCHAR(40) NOT NULL,
    text            TEXT NOT NULL,               -- Full sentence text
    normalized_text TEXT NOT NULL,               -- Normalized for comparison/matching
    ordinal         INTEGER NOT NULL,            -- Position in manuscript (0-indexed)
    is_heading      BOOLEAN DEFAULT FALSE,       -- True if this is a Markdown heading
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (commit_hash) REFERENCES processed_commit(commit_hash) ON DELETE CASCADE,
    UNIQUE (commit_hash, ordinal)
);

CREATE INDEX idx_sentence_commit ON sentence(commit_hash);
CREATE INDEX idx_sentence_ordinal ON sentence(commit_hash, ordinal);
CREATE INDEX idx_sentence_normalized ON sentence(normalized_text);
```

**Normalization Rules:**
- Trim leading/trailing whitespace
- Collapse multiple spaces to single space
- Convert smart quotes to straight quotes: `"` → `"`, `'` → `'`
- Convert em-dashes/en-dashes to hyphens: `—` → `-`
- Lowercase for comparison (stored separately, original text preserved)

**Space Analysis:**
- ~203 bytes per row (sentence_id 100 + commit_hash 40 + text ~50 + normalized ~50 + metadata)
- For 200 commits × 7,500 sentences ≈ **304 MB** total
- Acceptable for local development and GCP deployment

**Sentence ID Format:** `{first-three-words}-{8-hex-chars}`
- First three words: lowercase, alphanumeric only, dash-separated
- 8 hex chars: 4.3 billion possible values (collision-proof)
- Always 8 hex chars (no adaptive length)
- Examples:
  - "Kostya looked around the room." → `kostya-looked-around-a1f04c9d`
  - "V" (chapter heading) → `v-e8f2a1c7`
  - "Gone. All of it." → `gone-e9a3b2f1` and `all-of-it-c4d8e2f6`

**Determinism:** The 8 hex chars are generated from SHA-256 hash of `{normalized_text}-{ordinal}-{commit_hash}`, truncated to 8 chars. This ensures:
- Same sentence in same position in same commit always generates same ID
- Re-running script produces identical IDs (reproducible)
- No collision checking needed during ingestion
- New commit = new IDs for all sentences (even if text unchanged), but content-addressed storage deduplicates

---

#### 3. `annotation` (User Annotations)

Stores all annotation types: highlights, tags, tasks.

```sql
CREATE TABLE annotation (
    annotation_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(20) NOT NULL,        -- 'highlight', 'tag', 'task'
    created_by      VARCHAR(50) NOT NULL,        -- Username (Phase 1: always "andrew")
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,                 -- Soft delete
    CHECK (type IN ('highlight', 'tag', 'task'))
);

CREATE INDEX idx_annotation_type ON annotation(type);
CREATE INDEX idx_annotation_created_by ON annotation(created_by);
CREATE INDEX idx_annotation_deleted_at ON annotation(deleted_at) WHERE deleted_at IS NULL;
```

---

#### 4. `annotation_version` (Version History)

Every edit creates a new version. Always append-only.

```sql
CREATE TABLE annotation_version (
    version_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annotation_id               UUID NOT NULL,
    sentence_id                 VARCHAR(100) NOT NULL,        -- Current attachment
    payload                     JSONB NOT NULL,                -- Type-specific data
    originating_sentence_id     VARCHAR(100),                  -- Where it was first created
    origin_commit_hash          VARCHAR(40),
    migration_event_id          UUID,                          -- NULL if not migrated
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    created_by                  VARCHAR(50) NOT NULL,
    snapshot_text               TEXT,                          -- Sentence text at creation/migration
    snapshot_prev_text          TEXT,                          -- Previous sentence text
    snapshot_next_text          TEXT,                          -- Next sentence text
    FOREIGN KEY (annotation_id) REFERENCES annotation(annotation_id) ON DELETE CASCADE,
    FOREIGN KEY (sentence_id) REFERENCES sentence(sentence_id) ON DELETE RESTRICT,
    FOREIGN KEY (originating_sentence_id) REFERENCES sentence(sentence_id) ON DELETE SET NULL,
    FOREIGN KEY (origin_commit_hash) REFERENCES processed_commit(commit_hash) ON DELETE SET NULL,
    FOREIGN KEY (migration_event_id) REFERENCES sentence_migration_event(event_id) ON DELETE SET NULL
);

CREATE INDEX idx_annotation_version_annotation ON annotation_version(annotation_id);
CREATE INDEX idx_annotation_version_sentence ON annotation_version(sentence_id);
CREATE INDEX idx_annotation_version_created_at ON annotation_version(created_at);
```

**Payload Schema by Type:**

**Highlight:**
```json
{
  "color": "yellow",           // yellow, pink, blue, green, purple, grey
  "note": "Remember to revise this for pacing"  // Optional
}
```

**Tag:**
```json
{
  "tags": ["character-development", "dialogue"]  // Flat list of strings
}
```

**Task:**
```json
{
  "description": "Fix awkward phrasing",
  "status": "open",            // open, wip, nvm, dupe, done
  "priority": 2,               // Non-negative integer (displays as "P2")
  "tag": "editing",            // Single string tag
  "flag": false,               // Boolean (displays as red flag if true)
  "color": "pink"              // Optional, for visual distinction
}
```

---

#### 5. `sentence_migration_event` (Migration History)

Tracks how annotations were moved between commits.

```sql
CREATE TABLE sentence_migration_event (
    event_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_commit_hash        VARCHAR(40) NOT NULL,
    to_commit_hash          VARCHAR(40) NOT NULL,
    old_sentence_id         VARCHAR(100) NOT NULL,
    new_sentence_id         VARCHAR(100) NOT NULL,
    migration_type          VARCHAR(30) NOT NULL,  -- See types below
    confidence_score        NUMERIC(3, 2) NOT NULL, -- 0.00 to 1.00
    algorithm_used          VARCHAR(50) NOT NULL,   -- e.g., "fuzzy-word-v1"
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (from_commit_hash) REFERENCES processed_commit(commit_hash) ON DELETE CASCADE,
    FOREIGN KEY (to_commit_hash) REFERENCES processed_commit(commit_hash) ON DELETE CASCADE,
    CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
    CHECK (migration_type IN ('exact', 'high-similarity', 'moderate-similarity',
                               'low-similarity', 'positional-fallback', 'split-preferred',
                               'merge-source', 'deletion-nearest'))
);

CREATE INDEX idx_sentence_migration_from ON sentence_migration_event(from_commit_hash, old_sentence_id);
CREATE INDEX idx_sentence_migration_to ON sentence_migration_event(to_commit_hash, new_sentence_id);
CREATE INDEX idx_sentence_migration_confidence ON sentence_migration_event(confidence_score);
```

**Migration Types & Confidence:**

| Type | Confidence | Description |
|------|------------|-------------|
| `exact` | 1.00 | Normalized text identical |
| `high-similarity` | 0.80-0.99 | Fuzzy match > 80% similar |
| `moderate-similarity` | 0.60-0.79 | Fuzzy match 60-79% similar |
| `low-similarity` | 0.40-0.59 | Fuzzy match 40-59% similar |
| `positional-fallback` | 0.20 | No good match, use nearest ordinal |
| `split-preferred` | 0.50-0.90 | Old sentence split into multiple, picked best |
| `merge-source` | 0.70-0.95 | Multiple old sentences merged into one |
| `deletion-nearest` | 0.10 | Old sentence deleted, mapped to following sentence |

---

#### 6. `user` (User Management - Phase 1 Stub)

Minimal user table for future expansion.

```sql
CREATE TABLE "user" (
    username        VARCHAR(50) PRIMARY KEY,
    password_hash   VARCHAR(255) NOT NULL,       -- bcrypt hash (future Phase 2)
    role            VARCHAR(20) NOT NULL,        -- author, editor, reviewer
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    CHECK (role IN ('author', 'editor', 'reviewer'))
);

-- Phase 1: Seed with hardcoded user
INSERT INTO "user" (username, password_hash, role)
VALUES ('andrew', '$2a$10$placeholder.hash.for.phase1', 'author');
```

**Role Permissions:**
- **Author:** Full access (admin), can delete any annotation, edit own
- **Editor:** Create/edit/delete own highlights, tags, tasks
- **Reviewer:** Create/edit/delete own highlights and tags only (no tasks)

---

## Sentence Processing Algorithm

### 1. Sentence Tokenization

**Library:** `prose` (github.com/jdkato/prose/v2)

**Custom Rules for Fiction:**

1. **Dialogue with interruptions:** Treat as single sentence
   - `"I can't," he said, "believe this."` → ONE sentence

2. **Stylistic fragments:** Each fragment is a sentence
   - `Gone. All of it.` → TWO sentences: `"Gone."` and `"All of it."`

3. **Ellipses:**
   - If continuation is lowercase: same sentence
     - `He wondered... could it be true?` → ONE sentence
   - If continuation is uppercase: new sentence
     - `He left. ... She stayed.` → TWO sentences

4. **Em-dashes:** Treat like commas (same sentence)
   - `She turned—quickly, too quickly—toward the door.` → ONE sentence

5. **Headings:** Treated as sentences, marked with `is_heading = true`
   - `# Chapter 5` → sentence `chapter-5-a1f2c3d4`, `is_heading = true`
   - `V` → sentence `v-e8f2b3c1`, `is_heading = true`

**Implementation Strategy:**

**Backend (Go):**
```go
// internal/sentence/tokenizer.go
func SplitIntoSentences(text string) []string {
    // Use prose library as base
    doc, _ := prose.NewDocument(text)
    baseSentences := doc.Sentences()

    // Apply fiction-specific post-processing
    return applyFictionRules(baseSentences)
}

func applyFictionRules(sentences []prose.Sentence) []string {
    // Implement dialogue, ellipses, fragment rules
    // Return final sentence strings
}
```

**Frontend (JavaScript):**
```javascript
// web/js/tokenizer.js
function splitIntoSentences(text) {
    // Port exact same logic from Go
    // Use regex-based approach to match prose library behavior
    let baseSentences = basicSentenceSplit(text);
    return applyFictionRules(baseSentences);
}

function applyFictionRules(sentences) {
    // Identical logic to Go implementation
    // Handle dialogue, ellipses, fragments
}
```

**Testing Tokenizer Parity:**
- Create test suite with ~100 fiction examples
- Run through both Go and JS tokenizers
- Assert outputs match exactly
- Maintain shared test fixtures (JSON file) for both implementations

**Critical:** Frontend and backend tokenizers must produce identical output for the same input. This is the foundation of the ordinal-based sentence wrapping approach.

---

### 2. Sentence ID Generation

**Algorithm:**

```go
func GenerateSentenceID(normalizedText string, ordinal int, commitHash string) string {
    // Extract first three alphanumeric words
    words := extractWords(normalizedText)
    prefix := strings.Join(words[:min(3, len(words))], "-")

    // Generate deterministic 8-char hex suffix
    data := fmt.Sprintf("%s-%d-%s", normalizedText, ordinal, commitHash)
    hash := sha256.Sum256([]byte(data))
    suffix := hex.EncodeToString(hash[:4]) // First 4 bytes = 8 hex chars

    return fmt.Sprintf("%s-%s", prefix, suffix)
}

func extractWords(text string) []string {
    // Remove non-alphanumeric, lowercase, split by whitespace
    cleaned := regexp.MustCompile(`[^a-zA-Z0-9\s]+`).ReplaceAllString(text, "")
    words := strings.Fields(strings.ToLower(cleaned))
    return words
}
```

**Flexible Word Count (1-3 words):**
```go
func GenerateSentenceID(normalizedText string, ordinal int, commitHash string) string {
    words := extractWords(normalizedText)

    // Use up to 3 words, or all words if fewer
    numWords := min(3, len(words))
    var prefix string
    if numWords == 0 {
        // Heading with no words, e.g., "***" scene break
        prefix = "heading"
    } else {
        prefix = strings.Join(words[:numWords], "-")
    }

    // Generate deterministic 8-char hex suffix
    data := fmt.Sprintf("%s-%d-%s", normalizedText, ordinal, commitHash)
    hash := sha256.Sum256([]byte(data))
    suffix := hex.EncodeToString(hash[:4]) // First 4 bytes = 8 hex chars

    return fmt.Sprintf("%s-%s", prefix, suffix)
}
```

**Examples:**
- `"Kostya looked around the room."` + ordinal=42 + commit=`abc123...` → `kostya-looked-around-d4e8f2a1`
- `"V"` + ordinal=0 + commit=`abc123...` → `v-9f3e2a1c`
- `"Yea."` + ordinal=15 + commit=`abc123...` → `yea-a8f2d4c1`
- `"No, but you should."` + ordinal=100 + commit=`def456...` → `no-but-you-7e3f9a2b`

**Why 8 Hex Chars is Collision-Proof:**
- Hash includes: `normalizedText + ordinal + commitHash`
- Same sentence at same position in same commit = impossible (only one sentence per ordinal per commit)
- Different ordinal or different commit = different hash
- 8 hex chars = 4.3 billion values (overkill, but ensures zero collision risk even with shortened prefix)

---

### 3. Migration Algorithm (Commit A → Commit B)

**High-Level Flow:**

```
1. Load all sentences from commit A (old)
2. Load all sentences from commit B (new)
3. Compute diff at sentence level:
   - Added sentences (in B, not in A)
   - Deleted sentences (in A, not in B)
   - Unchanged sentences (exact match on normalized_text)
4. For each deleted sentence:
   a. Find best match in added sentences (fuzzy matching)
   b. If good match found (>= 40% similarity):
      - Create migration map: old_id → new_id
      - Migration type: high/moderate/low-similarity or split-preferred
   c. If no good match:
      - Map to nearest following sentence by ordinal
      - Migration type: deletion-nearest or positional-fallback
5. Store migration events in database
6. Copy annotation_version rows:
   - Create new version pointing to new_sentence_id
   - Set migration_event_id
   - Snapshot new sentence context
```

**Fuzzy Matching Algorithm:**

Use **Levenshtein distance** at word level (not character level) for better semantic matching.

```go
func ComputeSimilarity(text1, text2 string) float64 {
    words1 := strings.Fields(normalizeForMatching(text1))
    words2 := strings.Fields(normalizeForMatching(text2))

    distance := levenshteinDistance(words1, words2)
    maxLen := max(len(words1), len(words2))

    if maxLen == 0 {
        return 1.0
    }

    similarity := 1.0 - (float64(distance) / float64(maxLen))
    return similarity
}
```

**Edge Cases:**

**Split (1 old → 2+ new):**
- Compute similarity to each new candidate
- Pick the new sentence with highest similarity
- If tie or both low: prefer the later sentence
- Migration type: `split-preferred`

**Merge (2+ old → 1 new):**
- Each old sentence independently maps to the new merged sentence
- All annotations accumulate on the new sentence (separate rows)
- Migration type: `merge-source`

**Deletion (old → nothing good):**
- Map to the sentence that follows in the new commit (by ordinal)
- If deleted sentence was last: map to new last sentence
- Migration type: `deletion-nearest`
- Confidence: 0.10

---

## Git Processing Flow

### CLI Commands

**Primary command:**
```bash
writesys process [OPTIONS]
```

**Behavior:**

1. **Check current state:**
   - Query database for latest processed commit on current branch
   - Compare with git history
   - Determine available commits to process

2. **Present options to user:**
   ```
   Current branch: main
   Story file: the-wildfire.md
   Last processed: a3f5c2d (2024-03-15)

   Available commits:
   [1] b4e6d3f (2024-03-16) - 15 additions, 3 deletions, 8 changes
   [2] c5f7e4g (2024-03-17) - 22 additions, 1 deletion, 5 changes
   [3] d6g8f5h (2024-03-18) - 8 additions, 0 deletions, 2 changes

   Options:
   [a] Process each sequentially (1 → 2 → 3)
   [b] Process latest only (3)
   [c] Force process specific commit (enter hash)
   [q] Quit

   Choice:
   ```

3. **Execute processing:**
   - Read Markdown file at specified commit (`git show HASH:path`)
   - Tokenize into sentences
   - Generate sentence IDs
   - If first commit (bootstrap): store sentences, no migration
   - If subsequent commit: compute migration, update annotations
   - Store sentence ID array (uncompressed JSON) in `processed_commit`
   - Update `processed_commit` table

**Flags:**
- `--file <path>`: Specify story file (default: auto-detect `*.md` in repo)
- `--force-commit <hash>`: Skip interactive mode, process specific commit
- `--branch <name>`: Override branch detection

**Edge Case Handling:**

**Branch changed but history joins:**
- Treat as same lineage
- Continue processing from last processed commit

**Branch changed, history diverged:**
- Warn user: "Branch 'feature' does not share history with last processed branch 'main'. Annotations may not migrate correctly."
- Prompt: Continue [y/n]?

**Processed commit no longer in history (rebase):**
- Error: "Last processed commit abc123 not found in current branch history. Database may be out of sync."
- Offer options:
  - [1] Rebuild from scratch (WARNING: will recompute all migrations)
  - [2] Manually specify new starting commit
  - [3] Abort

---

## Web UI Design

### Rendering Pipeline

**Backend API Endpoints:**

```
GET  /api/manuscripts/:commit_hash
  → Returns: { sentences: [...], markdown: "..." }

GET  /api/annotations/:commit_hash
  → Returns: { annotations: [...] } (for all sentences in this commit)

GET  /api/annotations/sentence/:sentence_id
  → Returns: { annotations: [...] } (for specific sentence)

POST /api/annotations
  → Body: { type, sentence_id, payload }
  → Creates new annotation

PUT  /api/annotations/:annotation_id
  → Body: { sentence_id, payload }
  → Creates new version

DELETE /api/annotations/:annotation_id
  → Soft-deletes annotation (sets deleted_at)
```

### Frontend Architecture

**Tech Stack (Following Existing Pattern):**
- **Paged.js** - Book pagination library (https://pagedjs.org/)
- **marked.js** - Markdown → HTML parsing
- **smartquotes.js** - Automatic smart quote conversion
- Plain JavaScript (no framework)

**Page Structure:**

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="book.css">
</head>
<body>
  <div id="manuscript-content">
    <!-- Markdown rendered to HTML, sentences wrapped -->
  </div>

  <div id="annotation-sidebar" class="hidden">
    <!-- Shows annotations for selected sentence -->
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/smartquotes/2.3.2/smartquotes.min.js"></script>
  <script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="renderer.js"></script>
  <script src="annotations.js"></script>
</body>
</html>
```

**Rendering Flow (Backend → Frontend Separation):**

**Backend responsibilities:**
1. Sentence splitting on **plain text Markdown**
2. Serve raw Markdown + ordered sentence ID array via API
3. No Markdown rendering needed in Go

**Frontend responsibilities:**
1. Fetch Markdown + ordered sentence IDs from API
2. Parse Markdown → HTML using `marked.js`
3. **Sequentially walk text nodes, splitting with same tokenizer rules as backend**
4. Wrap sentences in `<span>` tags, matching IDs by ordinal
5. Apply Paged.js for book-style pagination
6. Run smartquotes.js for typographic quotes

**Critical Requirement: Tokenizer Parity**

The backend (Go) and frontend (JavaScript) must use **identical sentence tokenization rules**. This is achieved by:
1. Implementing fiction-specific rules in Go first (backend)
2. Porting identical logic to JavaScript (frontend)
3. Testing both with same input to ensure identical output

**Rendering Steps:**

1. **Fetch data:**
   ```javascript
   const response = await fetch(`/api/manuscripts/${commitHash}`);
   const { markdown, sentenceIds, annotations } = await response.json();
   // sentenceIds: ["kostya-looked-around-a1f0", "it-was-empty-b2g5", ...]
   ```

2. **Parse Markdown → HTML:**
   ```javascript
   const html = marked.parse(markdown);
   const container = document.getElementById('manuscript-content');
   container.innerHTML = html;
   ```

3. **Sequential sentence wrapping:**
   ```javascript
   let currentIdIndex = 0;

   function wrapSentencesInContainer(container, sentenceIds) {
     // Walk all text nodes in DOM order
     const walker = document.createTreeWalker(
       container,
       NodeFilter.SHOW_TEXT,
       null,
       false
     );

     let textNode;
     while (textNode = walker.nextNode()) {
       // Skip empty/whitespace-only nodes
       if (!textNode.textContent.trim()) continue;

       // Split text node into sentences (same rules as backend)
       const sentences = splitTextNodeIntoSentences(textNode.textContent);

       // Create span for each sentence
       const fragment = document.createDocumentFragment();
       sentences.forEach(sentenceText => {
         const span = document.createElement('span');
         span.className = 'sentence';
         span.dataset.id = sentenceIds[currentIdIndex++];
         span.textContent = sentenceText;
         fragment.appendChild(span);
       });

       // Replace text node with wrapped sentences
       textNode.parentNode.replaceChild(fragment, textNode);
     }

     // Verify all IDs were used
     if (currentIdIndex !== sentenceIds.length) {
       console.error(`Mismatch: ${currentIdIndex} spans created, ${sentenceIds.length} IDs provided`);
     }
   }

   wrapSentencesInContainer(container, sentenceIds);
   ```

4. **Apply annotations as CSS classes:**
   ```javascript
   // After wrapping, apply annotation styles
   annotations.forEach(annotation => {
     const span = document.querySelector(`[data-id="${annotation.sentence_id}"]`);
     if (span) {
       span.classList.add(`highlight-${annotation.payload.color}`);
       span.dataset.annotationCount = (span.dataset.annotationCount || 0) + 1;
     }
   });
   ```

5. **Paginate with Paged.js:**
   ```javascript
   class AnnotationHandler extends Paged.Handler {
     afterRendered(pages) {
       smartquotes();
       attachSentenceInteractions();
     }
   }
   Paged.registerHandlers(AnnotationHandler);
   ```

**Performance Estimates:**

For a **60,000 word novel** (~9,000 sentences):
- Fetch sentence IDs: ~100KB JSON → **< 100ms**
- Markdown → HTML parsing: ~400KB → **< 50ms**
- DOM insertion (innerHTML): **< 100ms**
- Sequential sentence wrapping: 9,000 text node operations → **~500-800ms**
- Paged.js pagination: **~1-2 seconds**

**Total initial load time: 3-4 seconds** (acceptable for desktop tool)

**Why Sequential Approach:**
- ✅ Fast (ordinal-based, no searching)
- ✅ Robust (no ambiguity with duplicate sentences)
- ✅ Simple (one pass through DOM)
- ⚠️ Requires tokenizer parity (manageable one-time porting effort)

**Interaction Behavior:**

**Hover (Desktop):**
- Highlight sentence with preview color (lightest shade)
- Show subtle indicator if annotations exist (e.g., small colored dots)

**Click (Desktop):**
- Sentence highlighted with border
- Right sidebar shows:
  - All annotations for this sentence
  - Migration history (if migrated)
  - Confidence score (if migrated, color-coded: green >0.8, yellow 0.4-0.8, red <0.4)
  - Action buttons: Add Highlight, Add Tag, Add Task

**Annotation Display (Sidebar):**

```
┌─────────────────────────────────────┐
│ Sentence: "Kostya looked around..." │
│ ID: kostya-looked-around-a1f04c9d    │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │ 🟡 Highlight (yellow)           │ │
│ │ "Remember to revise pacing"     │ │
│ │ by andrew • 2024-03-15          │ │
│ │ [Edit] [Delete]                 │ │
│ └─────────────────────────────────┘ │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │ 📌 Task (P2) • open             │ │
│ │ "Fix awkward phrasing"          │ │
│ │ tag: editing • 🚩 flagged       │ │
│ │ by andrew • 2024-03-16          │ │
│ │ [Edit] [Delete]                 │ │
│ └─────────────────────────────────┘ │
│                                      │
│ ⚠️ Migrated from commit a3f5c2d     │
│ Original: "Kostya glanced around..." │
│ Confidence: 0.87 (high-similarity)   │
│ [View History]                       │
└─────────────────────────────────────┘
```

**Visual Styling:**

- **Highlights:** Background color (semi-transparent)
  - Yellow: `rgba(255, 235, 59, 0.3)`
  - Pink: `rgba(255, 128, 171, 0.3)`
  - Blue: `rgba(100, 181, 246, 0.3)`
  - Green: `rgba(129, 199, 132, 0.3)`
  - Purple: `rgba(186, 104, 200, 0.3)`
  - Grey: `rgba(189, 189, 189, 0.3)`

- **Tasks:** Small folded corner graphic (top-right), color border
  - Use CSS clip-path or SVG overlay

- **Tags:** Small tag icon in margin

**Book-Style Page Layout CSS (Based on Existing Pattern):**

```css
/* Paged.js page definition */
@page {
  size: 6in 9in;
  margin: 0.75in 0.5in;
  @bottom-right {
    content: counter(page);
    font-family: Georgia, serif;
    font-size: 10pt;
  }
}

@page :first {
  @bottom-right {
    content: none;
  }
}

/* Paged.js container styling */
.pagedjs_pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2em;
  padding: 2em;
  background: #f5f5f5;
}

.pagedjs_page {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #ccc;
}

/* Typography */
body {
  font-family: Georgia, serif;
  font-size: 12pt;
  line-height: 1.6;
  text-align: justify;
  margin: 0;
  padding: 0;
}

p {
  margin: 0;
  text-indent: 2em;
  orphans: 2;
  widows: 2;
}

p:first-of-type {
  text-indent: 0;
}

h1 {
  text-align: center;
  font-size: 18pt;
  font-weight: normal;
  font-style: italic;
  margin-bottom: 2em;
  page-break-before: always;
  page-break-after: avoid;
}

/* Sentence interaction */
.sentence {
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-radius: 2px;
  padding: 0 1px;
}

.sentence:hover {
  background-color: rgba(255, 235, 59, 0.15);
}

.sentence.selected {
  outline: 2px solid #4a90e2;
  outline-offset: 2px;
}

/* Annotation highlight colors */
.highlight-yellow { background-color: rgba(255, 235, 59, 0.3); }
.highlight-pink { background-color: rgba(255, 128, 171, 0.3); }
.highlight-blue { background-color: rgba(100, 181, 246, 0.3); }
.highlight-green { background-color: rgba(129, 199, 132, 0.3); }
.highlight-purple { background-color: rgba(186, 104, 200, 0.3); }
.highlight-grey { background-color: rgba(189, 189, 189, 0.3); }

/* Task folded corner effect */
.task-marker {
  position: relative;
}

.task-marker::after {
  content: '';
  position: absolute;
  top: -2px;
  right: -2px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 12px 12px 0;
  border-color: transparent var(--task-color, #ff6b6b) transparent transparent;
}

/* Annotation sidebar */
#annotation-sidebar {
  position: fixed;
  right: 0;
  top: 0;
  width: 350px;
  height: 100vh;
  background: white;
  box-shadow: -2px 0 8px rgba(0,0,0,0.1);
  overflow-y: auto;
  padding: 20px;
  transform: translateX(100%);
  transition: transform 0.3s ease;
}

#annotation-sidebar.visible {
  transform: translateX(0);
}
```

**Phase 1 Limitations:**
- Desktop only (no touch/mobile optimization)
- Annotations load for entire commit (no lazy loading)
- Single hardcoded user ("andrew")

---

## Database Schema Summary

**Tables (in order of dependencies):**

1. `user` (seed data: andrew)
2. `processed_commit` (git history)
3. `sentence` (sentence instances)
4. `annotation` (annotation metadata)
5. `sentence_migration_event` (migration history)
6. `annotation_version` (versioned annotation content)

**Liquibase Changelog Structure:**

```
liquibase/changelog/
├── db.changelog-master.xml
├── 001-create-user-table.xml
├── 002-create-processed-commit-table.xml
├── 003-create-sentence-table.xml
├── 004-create-annotation-table.xml
├── 005-create-migration-event-table.xml
├── 006-create-annotation-version-table.xml
└── 007-seed-default-user.xml
```

---

## Implementation Plan

### Phase 1 Milestones

**Milestone 1: Infrastructure Setup**
- [ ] Initialize Go project structure
- [ ] Set up Docker Compose (Postgres + API + Liquibase)
- [ ] Create Liquibase changelogs for all tables
- [ ] Verify database migrations with test-db.sh script
- [ ] Set up basic Go HTTP server (Chi or Gorilla Mux)

**Milestone 2: Sentence Processing Core**
- [ ] Implement sentence tokenizer with fiction rules (Go)
- [ ] Create test suite with ~100 fiction sentence examples
- [ ] Implement sentence ID generation algorithm
- [ ] Implement sentence normalization
- [ ] Build `writesys process` CLI command (bootstrap mode only)
- [ ] Test with sample Markdown file
- [ ] **Port tokenizer to JavaScript (maintain parity with Go)**
- [ ] **Create shared test fixtures (JSON) and verify Go/JS produce identical output**

**Milestone 3: Migration Algorithm**
- [ ] Implement fuzzy word-level Levenshtein matching
- [ ] Implement sentence diff algorithm (added/deleted/unchanged)
- [ ] Implement migration mapping with confidence scoring
- [ ] Handle edge cases: splits, merges, deletions
- [ ] Test with realistic manuscript edits

**Milestone 4: API Backend**
- [ ] Implement GET /api/manuscripts/:commit_hash
- [ ] Implement GET /api/annotations endpoints
- [ ] Implement POST /api/annotations (create)
- [ ] Implement PUT /api/annotations/:id (update/new version)
- [ ] Implement DELETE /api/annotations/:id (soft delete)

**Milestone 5: Web UI**
- [ ] Set up HTML page with Paged.js, marked.js, smartquotes.js
- [ ] Implement sequential sentence wrapping (using JS tokenizer)
- [ ] Verify sentence IDs match between backend and frontend (ordinal alignment)
- [ ] Implement book-style page layout CSS (based on existing pattern)
- [ ] Implement hover/click interaction on sentences
- [ ] Build annotation sidebar (view/create/edit/delete)
- [ ] Style highlights, tags, tasks visually
- [ ] Show migration history and confidence scores
- [ ] Performance test: 60K words should load in < 5 seconds

**Milestone 6: Testing & Refinement**
- [ ] End-to-end test: Markdown → process → UI → annotate → edit → process
- [ ] Test migration quality on real manuscript edits
- [ ] Performance testing with 10,000+ sentences
- [ ] Bug fixes and UX polish

---

## Future Phases (Out of Scope for Phase 1)

**Phase 2: Multi-User & Collaboration**
- Real authentication (OAuth, JWT, or session-based)
- User permissions enforcement in API
- Activity feed / change history
- Comments/discussions on annotations

**Phase 3: Advanced Features**
- Search and filter annotations
- Export annotations to CSV/JSON/Markdown
- Annotation statistics dashboard
- Keyboard shortcuts for power users
- Mobile/touch optimization

**Phase 4: AI-Assisted Features**
- Suggest similar sentences for manual migration override
- Auto-tag sentences by theme/topic
- Detect inconsistencies (character names, timeline)

**Phase 5: Production Deployment**
- GCP VM deployment
- Backup/restore automation
- Multi-manuscript support
- Team/workspace model

---

## Edge Cases & Open Questions

### Handled Edge Cases

1. **Sentence unchanged across commits:** New sentence row created with new ID, but duplicate text stored (acceptable space cost)
2. **Commit skipped:** Larger diff, lower migration accuracy, user warned
3. **Branch diverged:** User warned, allowed to continue
4. **Rebase destroys history:** Error with rebuild option
5. **Sentence split:** Annotation goes to most similar new sentence
6. **Sentence merge:** Multiple annotations accumulate on new sentence
7. **Sentence deleted:** Annotation maps to following sentence
8. **Collision in sentence ID:** Deterministic hashing eliminates collisions
9. **Annotation edited multiple times:** Each edit creates new `annotation_version`
10. **User tries to delete another's annotation:** Role check (Phase 1: only andrew can delete)

### Open Questions for Future Decisions

1. **How to handle very large manuscripts (100K+ words)?**
   - Current design should handle up to ~20K sentences efficiently
   - May need pagination/lazy loading in UI for larger works

2. **Should we support multiple manuscripts in one database?**
   - Phase 1: Single manuscript assumed
   - Phase 2+: Add `manuscript_id` to schema

3. **What if user wants to override migration mapping?**
   - Future: Manual override UI to re-map annotations
   - Phase 1: User manually moves annotation by editing

4. **How to handle merge conflicts in git?**
   - Phase 1: User resolves conflicts before running `writesys process`
   - Tool only processes clean commits

5. **Should headings be first-class entities separate from sentences?**
   - Current design: Headings are sentences with `is_heading = true`
   - May revisit if heading-specific features needed (e.g., TOC generation)

---

## Development Environment Setup

### Prerequisites

- Docker & Docker Compose
- Go 1.21+
- Git
- pgcli (optional, for database inspection)

### Docker & Database Setup

**Multiple Databases in One Postgres Instance:**

WriteSys uses a dedicated database (`writesys`) within the same Postgres instance as other projects (e.g., `sxiva_stats` from the sxiva project). This follows the pattern from `/home/slackwing/src/worktree-writesys/11.sxiv/`.

**Database Configuration:**
- **Database name:** `writesys`
- **User:** `writesys_user`
- **Port:** `127.0.0.1:5432` (localhost only, shared with other projects)
- **No TimescaleDB extension needed** (plain Postgres 16)

**docker-compose.yml Service:**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: writesys-postgres
    environment:
      POSTGRES_USER: writesys_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: writesys
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U writesys_user -d writesys"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - writesys-network

volumes:
  postgres-data:

networks:
  writesys-network:
    driver: bridge
```

**init-scripts/01-init-database.sql:**
```sql
-- Basic initialization (no TimescaleDB needed)
CREATE TABLE IF NOT EXISTS health_check (
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT
);

INSERT INTO health_check (status) VALUES ('Database initialized successfully');
```

### Quick Start

```bash
# Clone repository
cd /home/slackwing/src/worktree-writesys/14.writesys

# Set up environment
cd docker
cp .env.example .env
# Edit .env with your passwords

# Start database and run migrations
docker compose up -d
docker compose --profile migrate up liquibase

# Verify setup
./test-db.sh

# Build CLI tool
cd ../cmd/writesys
go build -o writesys

# Bootstrap first commit
./writesys process --file ../../manuscripts/the-wildfire.md

# Start API server
cd ../api
go run main.go

# Open browser
open http://localhost:5000
```

### Project Structure

```
14.writesys/
├── PLAN.md                          # This file
├── AGENTS.md or CLAUDE.md           # Reference to PLAN.md
├── docker/
│   ├── docker-compose.yml           # 3 services: postgres, api, liquibase
│   ├── Dockerfile                   # Go API container
│   ├── Dockerfile.liquibase         # Liquibase container
│   ├── .env.example                 # Environment template
│   ├── init-scripts/
│   │   └── 01-init-database.sql
│   ├── liquibase/
│   │   ├── liquibase.properties
│   │   └── changelog/
│   │       ├── db.changelog-master.xml
│   │       └── 001-*.xml ... 008-*.xml
│   ├── test-db.sh                   # Setup verification script
│   └── README.md
├── cmd/
│   └── writesys/
│       ├── main.go                  # CLI entry point
│       ├── process.go               # Git commit processing
│       └── migrate.go               # Migration algorithm
├── internal/
│   ├── database/
│   │   ├── db.go                    # Database connection
│   │   └── queries.go               # SQL queries
│   ├── sentence/
│   │   ├── tokenizer.go             # Sentence splitting
│   │   ├── id.go                    # ID generation
│   │   └── matcher.go               # Fuzzy matching
│   └── models/
│       └── models.go                # Go structs for DB entities
├── api/
│   ├── main.go                      # HTTP server
│   ├── handlers.go                  # API route handlers
│   └── middleware.go                # Auth, logging, etc.
├── web/
│   ├── index.html
│   ├── css/
│   │   └── book.css
│   └── js/
│       ├── renderer.js              # Markdown → book pages
│       └── annotations.js           # Annotation interactions
├── manuscripts/
│   └── the-wildfire.md              # Example story file
├── go.mod
└── go.sum
```

---

## Success Criteria for Phase 1

Phase 1 is complete when:

1. ✅ Database schema implemented with Liquibase migrations
2. ✅ `writesys process` command can bootstrap and process sequential commits
3. ✅ Sentence migration algorithm produces reasonable mappings (>80% accuracy on typical edits)
4. ✅ Migration confidence scores visible in UI
5. ✅ Web UI can display manuscript as book-style pages with sentence-level interactivity
6. ✅ User can create/edit/delete highlights, tags, and tasks
7. ✅ Annotations survive manuscript edits via migration (with manual review)
8. ✅ System handles 60K word manuscript (7,500 sentences) with 200 commits and 50K annotations
9. ✅ Docker-based local development workflow is smooth and documented
10. ✅ No data corruption or integrity issues detected in testing

---

## Conclusion

This design balances pragmatism with extensibility. By treating sentence instances as independent entities (no false lineage tracking) and using heuristic migration with confidence scoring, the system stays simple while giving the author the tools needed to manage annotations through manuscript evolution.

The content-addressed storage and compressed snapshots keep the database compact (~150-400MB for a full novel lifecycle), while the append-only annotation history ensures no data loss.

Phase 1 provides a solid foundation for future multi-user collaboration, AI-assisted features, and production deployment.

---

**Last Updated:** 2024-03-18
**Author:** Andrew (with Claude Code)
**Status:** Design Document for Phase 1 Implementation
