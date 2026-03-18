# WriteSys - Book Annotation System Design

## Overview

WriteSys is a system for tracking annotations (highlights, tags, tasks) on sentences in a Markdown manuscript, with intelligent migration of annotations as the text evolves through git commits.

**Core Philosophy:** Treat the Markdown file in git as the source of truth. Annotations attach to sentence instances (which get new IDs when edited). A heuristic migration algorithm relocates annotations to similar/nearby sentences when the manuscript changes. The author manually reviews and corrects migrations as needed.

**Key Design Decisions:**
1. **No sentence versioning or lineage tracking** - new IDs every commit, even for unchanged sentences
2. **Simplified schema** - text stored directly in `sentence` table (no separate `sentence_text` table)
3. **Deterministic 8-hex-char IDs** - collision-proof via hashing (text + ordinal + commit)
4. **No tokenizer parity needed!** - Backend sends word counts, frontend wraps by counting alphanumeric blobs
5. **Word-count based wrapping** - Frontend uses word counts to wrap sentences, no JS tokenizer needed
6. **Inline migration history** - No separate migration table, history stored as JSONB array in annotation_version
7. **No normalized_text storage** - Normalize on-the-fly during migration (saves ~75MB)

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
│  - Manuscripts (repo paths, file paths)             │
│  - Sentence instances per commit (with word counts) │
│  - Annotations (highlights, tags, tasks)            │
│  - Annotation version history with migration data   │
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
  - Paged.js for book pagination
  - marked.js for Markdown → HTML
  - smartquotes.js for typography
  - **No sentence tokenizer needed** - uses word counts from backend
- **Sentence Splitting (Backend only):** Go `prose` library (github.com/jdkato/prose/v2) + custom fiction rules
- **HTTP Routing:** Chi (github.com/go-chi/chi/v5)
- **Postgres Driver:** pgx (github.com/jackc/pgx/v5)
- **Deployment:** Docker Compose (local dev), GCP VM (future)

---

## Data Model

### Core Entities

#### 1. `manuscript` (Manuscript Metadata)

Tracks manuscripts being worked on.

```sql
CREATE TABLE manuscript (
    manuscript_id       SERIAL PRIMARY KEY,
    repo_path           TEXT NOT NULL,              -- e.g., "/home/user/my-novel"
    story_file_path     TEXT NOT NULL,              -- e.g., "the-wildfire.md"
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (repo_path, story_file_path)
);
```

**Interactive Mode:**
- First run: Prompts for repo path and file path, creates manuscript record
- Subsequent runs: Auto-detects manuscript from current directory
- Option to start new manuscript

---

#### 2. `processed_commit` (Git Commit History)

Tracks which commits have been processed.

```sql
CREATE TABLE processed_commit (
    commit_hash              VARCHAR(40) PRIMARY KEY,  -- Git SHA-1
    manuscript_id            INTEGER NOT NULL,
    parent_commit_hash       VARCHAR(40),              -- For traversal
    branch_name              VARCHAR(255) NOT NULL,
    processed_at             TIMESTAMPTZ DEFAULT NOW(),
    sentence_count           INTEGER NOT NULL,
    additions_count          INTEGER NOT NULL DEFAULT 0,
    deletions_count          INTEGER NOT NULL DEFAULT 0,
    changes_count            INTEGER NOT NULL DEFAULT 0,
    sentence_id_array        JSONB NOT NULL,           -- Array for integrity checking & backup
    FOREIGN KEY (manuscript_id) REFERENCES manuscript(manuscript_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_commit_hash) REFERENCES processed_commit(commit_hash) ON DELETE SET NULL
);

CREATE INDEX idx_processed_commit_manuscript ON processed_commit(manuscript_id);
CREATE INDEX idx_processed_commit_branch ON processed_commit(branch_name);
CREATE INDEX idx_processed_commit_processed_at ON processed_commit(processed_at);
CREATE INDEX idx_processed_commit_sentence_array ON processed_commit USING GIN(sentence_id_array);
```

**Why Store Sentence ID Array:**
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

#### 3. `sentence` (Sentence Instances per Commit)

Each row represents a specific sentence in a specific commit.

```sql
CREATE TABLE sentence (
    sentence_id     VARCHAR(100) PRIMARY KEY,    -- e.g., "kostya-looked-around-a1f04c9d"
    commit_hash     VARCHAR(40) NOT NULL,
    text            TEXT NOT NULL,               -- Full sentence text
    word_count      INTEGER NOT NULL,            -- Count of alphanumeric word blobs
    ordinal         INTEGER NOT NULL,            -- Position in manuscript (0-indexed)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (commit_hash) REFERENCES processed_commit(commit_hash) ON DELETE CASCADE,
    UNIQUE (commit_hash, ordinal)
);

CREATE INDEX idx_sentence_commit ON sentence(commit_hash);
CREATE INDEX idx_sentence_ordinal ON sentence(commit_hash, ordinal);
```

**Word Count Definition:**
- Count of contiguous alphanumeric character sequences (`[a-zA-Z0-9]+`)
- Used by frontend to wrap sentences without needing tokenizer
- Examples:
  - "Kostya looked around." → 3 words
  - "He said, 'No.'" → 3 words (`He`, `said`, `No`)
  - "The variable `userId` is important." → 5 words

**Why No normalized_text?**
- Only needed during migration for fuzzy matching
- Can normalize on-the-fly when comparing (adds ~10 seconds per commit)
- Saves ~75MB for full manuscript lifecycle

**Space Analysis:**
- ~190 bytes per row (sentence_id 100 + commit_hash 40 + text ~50 + word_count 4)
- For 200 commits × 7,500 sentences ≈ **285 MB** total
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

#### 4. `annotation` (User Annotations)

Stores all annotation types: highlights, tags, tasks.

```sql
CREATE TABLE annotation (
    annotation_id   SERIAL PRIMARY KEY,
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

#### 5. `annotation_version` (Version History)

Every edit creates a new version. Always append-only. Stores migration history inline.

```sql
CREATE TABLE annotation_version (
    annotation_id               INTEGER NOT NULL,
    version                     INTEGER NOT NULL,
    sentence_id                 VARCHAR(100) NOT NULL,        -- Current attachment
    payload                     JSONB NOT NULL,               -- Type-specific data
    sentence_id_history         JSONB NOT NULL,               -- Array of sentence IDs through migrations
    migration_confidence        NUMERIC(3, 2),                -- Latest migration confidence (0.00-1.00)
    origin_sentence_id          VARCHAR(100) NOT NULL,        -- Where it was first created
    origin_commit_hash          VARCHAR(40) NOT NULL,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    created_by                  VARCHAR(50) NOT NULL,
    PRIMARY KEY (annotation_id, version),
    FOREIGN KEY (annotation_id) REFERENCES annotation(annotation_id) ON DELETE CASCADE,
    FOREIGN KEY (sentence_id) REFERENCES sentence(sentence_id) ON DELETE RESTRICT,
    FOREIGN KEY (origin_sentence_id) REFERENCES sentence(sentence_id) ON DELETE SET NULL,
    FOREIGN KEY (origin_commit_hash) REFERENCES processed_commit(commit_hash) ON DELETE SET NULL
);

CREATE INDEX idx_annotation_version_annotation ON annotation_version(annotation_id);
CREATE INDEX idx_annotation_version_sentence ON annotation_version(sentence_id);
CREATE INDEX idx_annotation_version_created_at ON annotation_version(created_at);
```

**Migration History Storage:**
- `sentence_id_history`: JSONB array tracking sentence ID changes
  - Example: `["old-id-1", "old-id-2", "current-id"]`
  - UI can walk back through history to show context at each migration point
- `migration_confidence`: Latest migration's confidence score (0.00-1.00)

**No Snapshot Fields:**
- Context can be reconstructed by querying sentences using `origin_sentence_id` + `origin_commit_hash`
- Async request for context when user clicks annotation

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
  "tags": ["editing", "dialogue"],  // Array of tags
  "flag": false,               // Boolean (displays as red flag if true)
  "color": "pink"              // Optional, for visual distinction
}
```

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

5. **Headings:** Treated as sentences (no special marker needed)
   - `# Chapter 5` → sentence `chapter-5-a1f2c3d4`
   - `V` → sentence `v-e8f2b3c1`

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
// web/js/renderer.js
function wrapSentencesByWordCount(container, sentences) {
    // Walk text nodes sequentially
    // Count alphanumeric blobs: /[a-zA-Z0-9]+/g
    // Wrap when word count matches backend's count
    // No tokenizer needed!
}
```

**Word Counting (Backend):**
```go
func CountWords(text string) int {
    // Count alphanumeric sequences
    words := regexp.MustCompile(`[a-zA-Z0-9]+`).FindAllString(text, -1)
    return len(words)
}
```

**No Tokenizer Parity Needed:** Backend tokenizes and counts words. Frontend just counts alphanumeric blobs to wrap. Simpler and more robust!

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
writesys
```

The CLI runs in **interactive mode by default** (no flags needed for Phase 1).

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

**Flags (for testing/automation):**
- `--file <path>`: Specify story file (default: auto-detect `*.md` in repo)
- `--commit <hash>`: Process specific commit non-interactively
- `--branch <name>`: Override branch detection
- `--yes`: Skip confirmations (for automation)

**Note:** Flags enable testing and automated workflows. Interactive mode is still the primary UX focus for Phase 1.

**Edge Case Handling:**

**Branch changed but history joins:**
- Treat as same lineage
- Continue processing from last processed commit

**Branch changed, history diverged:**
- Warn user: "Branch 'feature' does not share history with last processed branch 'main'. Annotations may not migrate correctly."
- Prompt: Continue [y/n]?

**Processed commit no longer in history (rebase):**
- **Option A (Chosen):** Treat current HEAD as coming after last processed commit
- Warning: "Last processed commit abc123 not found in current branch history (likely rebased). Sentences from old commits still exist in database. Continue migrating from last processed commit to current HEAD?"
- Prompt: Continue [y/n]?
- If yes: Proceed with migration using sentence data from database
- **Note:** Annotations can still migrate because sentence IDs from old commits remain in database, only the git commit is gone

---

## Web UI Design

### Rendering Pipeline

**Backend API Endpoints:**

```
GET  /api/manuscripts/:commit_hash
  → Returns: {
      markdown: "# Chapter 1\n\nKostya...",
      sentences: [
        { "id": "kostya-looked-around-a1f0", "wordCount": 3 },
        { "id": "it-was-empty-b2g5", "wordCount": 3 },
        ...
      ],
      annotations: [...]
    }

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
2. Generate sentence IDs with word counts
3. Serve raw Markdown + structured sentence objects via API

**Frontend responsibilities:**
1. Fetch Markdown + sentence objects (with word counts) from API
2. Parse Markdown → HTML using `marked.js`
3. **Sequentially walk text nodes, using word counts to wrap sentences**
4. Wrap sentences in `<span>` tags, matching IDs by ordinal
5. Apply Paged.js for book-style pagination
6. Run smartquotes.js for typographic quotes

**Word-Count Based Wrapping (No Tokenizer Parity Needed!)**

The backend sends word counts for each sentence. The frontend wraps by counting alphanumeric blobs:
1. Backend: Tokenizes sentences, generates IDs, **counts words** (alphanumeric sequences)
2. Frontend: Walks text nodes, **counts alphanumeric blobs** (`[a-zA-Z0-9]+`), wraps when count matches
3. No need to port tokenizer logic to JavaScript!
4. Simpler, more robust, and faster

**Rendering Steps:**

1. **Fetch data:**
   ```javascript
   const response = await fetch(`/api/manuscripts/${commitHash}`);
   const { markdown, sentences, annotations } = await response.json();
   // sentences: [{ id: "kostya-looked-around-a1f0", wordCount: 3 }, ...]
   ```

2. **Parse Markdown → HTML:**
   ```javascript
   const html = marked.parse(markdown);
   const container = document.getElementById('manuscript-content');
   container.innerHTML = html;
   ```

3. **Sequential sentence wrapping by word count:**
   ```javascript
   let currentSentenceIndex = 0;

   function wrapSentencesByWordCount(container, sentences) {
     // Walk all text nodes in DOM order
     const walker = document.createTreeWalker(
       container,
       NodeFilter.SHOW_TEXT,
       null,
       false
     );

     let textNode;
     while (textNode = walker.nextNode()) {
       if (!textNode.textContent.trim()) continue;

       const fragment = document.createDocumentFragment();
       const text = textNode.textContent;
       let textPos = 0;

       while (currentSentenceIndex < sentences.length) {
         const { id, wordCount } = sentences[currentSentenceIndex];

         // Count alphanumeric blobs in remaining text
         const words = text.substring(textPos).match(/[a-zA-Z0-9]+/g) || [];

         if (words.length === 0) break;

         // Find position after N words
         let wordsFound = 0;
         let endPos = textPos;
         const regex = /[a-zA-Z0-9]+/g;
         regex.lastIndex = textPos;
         let match;

         while (wordsFound < wordCount && (match = regex.exec(text))) {
           wordsFound++;
           endPos = match.index + match[0].length;
         }

         // Capture sentence text including trailing punctuation/whitespace
         while (endPos < text.length && /[\s.,!?;:'"]/.test(text[endPos])) {
           endPos++;
         }

         const sentenceText = text.substring(textPos, endPos);

         // Create span
         const span = document.createElement('span');
         span.className = 'sentence';
         span.dataset.id = id;
         span.textContent = sentenceText;
         fragment.appendChild(span);

         textPos = endPos;
         currentSentenceIndex++;

         if (textPos >= text.length) break;
       }

       // Add any remaining text
       if (textPos < text.length) {
         fragment.appendChild(document.createTextNode(text.substring(textPos)));
       }

       textNode.parentNode.replaceChild(fragment, textNode);
     }

     // Verify all sentences were wrapped
     if (currentSentenceIndex !== sentences.length) {
       console.warn(`Wrapped ${currentSentenceIndex}/${sentences.length} sentences`);
     }
   }

   wrapSentencesByWordCount(container, sentences);
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

**Why Word-Count Approach:**
- ✅ Fast (ordinal-based, no searching, no tokenizer needed)
- ✅ Robust (no ambiguity with duplicate sentences)
- ✅ Simple (one pass through DOM, count alphanumeric blobs)
- ✅ **No tokenizer parity needed!** Backend sends word counts, frontend just counts

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
2. `manuscript` (manuscript metadata)
3. `processed_commit` (git history)
4. `sentence` (sentence instances)
5. `annotation` (annotation metadata)
6. `annotation_version` (versioned annotation content with inline migration history)

**Liquibase Changelog Structure:**

```
liquibase/changelog/
├── db.changelog-master.xml
├── 001-create-user-table.xml
├── 002-create-manuscript-table.xml
├── 003-create-processed-commit-table.xml
├── 004-create-sentence-table.xml
├── 005-create-annotation-table.xml
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
- [ ] Implement word counting (alphanumeric blobs)
- [ ] Build `writesys` CLI command in interactive mode (bootstrap mode only)
- [ ] Test with sample Markdown file

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
- [ ] Implement word-count based sentence wrapping (count alphanumeric blobs)
- [ ] Verify sentence wrapping matches backend sentence boundaries
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
   - Current design: Headings are sentences (no special marker)
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
cd ../cli/writesys
go build -o writesys

# Run interactive mode (will prompt for manuscript on first run)
./writesys

# Start API server
cd ../../api
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
├── cli/
│   └── writesys/
│       ├── main.go                  # CLI entry point (interactive mode)
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

The simplified schema with inline migration history and word-count based wrapping keeps the database compact (~285MB for a full novel lifecycle), while the append-only annotation history ensures no data loss.

Phase 1 provides a solid foundation for future multi-user collaboration, AI-assisted features, and production deployment.

---

**Last Updated:** 2024-03-18
**Author:** Andrew (with Claude Code)
**Status:** Design Document for Phase 1 Implementation
