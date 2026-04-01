# Multi-Note Support Plan

## Overview
Enable multiple annotations per sentence (even for the same user), laying groundwork for future multi-user collaboration and multi-color visual experiments.

**Current Limitation:** Database unique constraint prevents multiple annotations per sentence per user.

**Goal:** Remove constraint, update data handling to support arrays, but keep UI minimal (only show one annotation, no UI for creating second+ annotations yet).

---

## Current State vs. New State

### Database Schema

**Current:**
```sql
-- Unique constraint prevents multiple annotations per sentence per user
CREATE UNIQUE INDEX uq_annotation_sentence_user_active
ON annotation (sentence_id, user_id)
WHERE deleted_at IS NULL;
```

**New:**
```sql
-- NO unique constraint
-- Multiple annotations per sentence per user allowed
-- Index remains for query performance:
CREATE INDEX idx_annotation_sentence_user
ON annotation (sentence_id, user_id)
WHERE deleted_at IS NULL;
```

### Go API Response Shape

**Current:**
```javascript
// GET /api/annotations/sentence/:sentence_id
{
  "annotations": [...]  // Already returns array!
}
```

**New:**
- No change needed - API already returns arrays
- `CreateAnnotation()` will work without unique constraint violation

### Frontend JavaScript Data Structure

**Current:**
```javascript
// annotationsMap: sentenceId -> single annotation object
annotationsMap['sent-123'] = { annotation_id: 1, color: 'yellow', ... }
```

**New:**
```javascript
// annotationsMap: sentenceId -> array of annotations
annotationsMap['sent-123'] = [
  { annotation_id: 1, color: 'yellow', ... },
  { annotation_id: 2, color: 'green', ... }
]
```

### UI Behavior

**Current:**
- One annotation per sentence
- Click sentence → show note popup
- Change color → update that annotation

**New (Minimal Changes):**
- If multiple annotations exist, pick one to display (first in array is fine)
- Click sentence → show note popup for that one annotation
- Change color → update that annotation
- **No UI for creating 2nd+ annotations yet** (future work)
- **No visual indicator of multiple annotations yet** (future: rainbow sidebars experiment)

---

## Implementation Steps

### 1. Database Changes (Liquibase)

#### Reset Database Completely
```bash
# Stop containers
docker-compose down

# Remove volume (WARNING: deletes all data)
docker volume rm postgres-data

# Reset Liquibase tracking
# (will be handled by fresh container)
```

#### Consolidate Changesets
Create single `001-initial-schema.xml` combining all current tables:
- user table
- manuscript table
- migration table
- sentence table (composite PK: sentence_id, migration_id)
- annotation table (**WITHOUT unique constraint**)
- annotation_version table
- tag table
- annotation_tag table

**Key Change:**
```xml
<!-- OLD: Unique constraint preventing multiple annotations -->
<addUniqueConstraint
    tableName="annotation"
    columnNames="sentence_id, user_id"
    constraintName="uq_annotation_sentence_user"/>

<!-- NEW: Just an index for performance -->
<createIndex tableName="annotation" indexName="idx_annotation_sentence_user">
    <column name="sentence_id"/>
    <column name="user_id"/>
</createIndex>
<sql>
    CREATE INDEX idx_annotation_sentence_user_active
    ON annotation(sentence_id, user_id)
    WHERE deleted_at IS NULL;
</sql>
```

#### New Master Changelog
```xml
<!-- db.changelog-master.xml -->
<include file="001-initial-schema.xml"/>
<include file="002-seed-default-user.xml"/>
```

### 2. Go API Changes

**No changes required!**

The API already:
- Returns `[]models.Annotation` arrays from `GetAnnotationsBySentence()`
- Supports creating annotations without constraint issues
- Handles updates/deletes by annotation_id

### 3. Frontend JavaScript Changes

#### File: `web/js/annotations.js`

**Change 1: Data structure**
```javascript
// OLD
const annotationsMap = {}; // sentenceId -> annotation object

// NEW
const annotationsMap = {}; // sentenceId -> array of annotations
```

**Change 2: Loading annotations**
```javascript
// OLD
function loadAnnotationsFromAPI(manuscript) {
  manuscript.annotations.forEach(ann => {
    annotationsMap[ann.sentence_id] = ann;
  });
}

// NEW
function loadAnnotationsFromAPI(manuscript) {
  manuscript.annotations.forEach(ann => {
    if (!annotationsMap[ann.sentence_id]) {
      annotationsMap[ann.sentence_id] = [];
    }
    annotationsMap[ann.sentence_id].push(ann);
  });
}
```

**Change 3: Applying highlights**
```javascript
// OLD
function applyAnnotationsToSentences() {
  Object.keys(annotationsMap).forEach(sentenceId => {
    const annotation = annotationsMap[sentenceId];
    applyHighlightToSentence(sentenceId, annotation.color);
  });
}

// NEW
function applyAnnotationsToSentences() {
  Object.keys(annotationsMap).forEach(sentenceId => {
    const annotations = annotationsMap[sentenceId];
    if (annotations && annotations.length > 0) {
      // Pick first annotation to display (could be random, doesn't matter)
      const annotation = annotations[0];
      applyHighlightToSentence(sentenceId, annotation.color);
    }
  });
}
```

**Change 4: Getting annotation for sentence**
```javascript
// OLD
function getAnnotationForSentence(sentenceId) {
  return annotationsMap[sentenceId] || null;
}

// NEW
function getAnnotationForSentence(sentenceId) {
  const annotations = annotationsMap[sentenceId];
  // Return first annotation (or null if none)
  return (annotations && annotations.length > 0) ? annotations[0] : null;
}
```

**Change 5: Updating annotation in map**
```javascript
// OLD
function updateAnnotationInMap(annotationId, updates) {
  Object.keys(annotationsMap).forEach(sentenceId => {
    if (annotationsMap[sentenceId].annotation_id === annotationId) {
      Object.assign(annotationsMap[sentenceId], updates);
    }
  });
}

// NEW
function updateAnnotationInMap(annotationId, updates) {
  Object.keys(annotationsMap).forEach(sentenceId => {
    const annotations = annotationsMap[sentenceId];
    const annotation = annotations.find(a => a.annotation_id === annotationId);
    if (annotation) {
      Object.assign(annotation, updates);
    }
  });
}
```

**Change 6: Deleting annotation from map**
```javascript
// OLD
function deleteAnnotationFromMap(annotationId) {
  Object.keys(annotationsMap).forEach(sentenceId => {
    if (annotationsMap[sentenceId].annotation_id === annotationId) {
      delete annotationsMap[sentenceId];
    }
  });
}

// NEW
function deleteAnnotationFromMap(annotationId) {
  Object.keys(annotationsMap).forEach(sentenceId => {
    const annotations = annotationsMap[sentenceId];
    const index = annotations.findIndex(a => a.annotation_id === annotationId);
    if (index !== -1) {
      annotations.splice(index, 1);
      // Clean up empty arrays
      if (annotations.length === 0) {
        delete annotationsMap[sentenceId];
      }
    }
  });
}
```

### 4. Testing Strategy

**Full Database Reset & Bootstrap Procedure:**

Following the procedure from AGENTS.md, perform a complete database reset:

```bash
# Step 1: Delete Liquibase changelock
docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c "DELETE FROM databasechangeloglock;"

# Step 2: Drop all WriteSys tables
docker exec sxiva-timescaledb psql -U writesys_user -d writesys <<EOF
DROP TABLE IF EXISTS annotation_version CASCADE;
DROP TABLE IF EXISTS annotation_tag CASCADE;
DROP TABLE IF EXISTS annotation CASCADE;
DROP TABLE IF EXISTS tag CASCADE;
DROP TABLE IF EXISTS sentence CASCADE;
DROP TABLE IF EXISTS migration CASCADE;
DROP TABLE IF EXISTS manuscript CASCADE;
DROP TABLE IF EXISTS databasechangelog CASCADE;
DROP TABLE IF EXISTS databasechangeloglock CASCADE;
EOF

# Step 3: Run Liquibase migrations (with NEW consolidated schema)
cd docker && docker compose --profile migrate up liquibase && cd ..

# Step 4: Bootstrap the-wildfire.manuscript (USER'S WORKING DOCUMENT - manuscript_id=1)
./bin/writesys --repo manuscripts/test-repo --file the-wildfire.manuscript --yes

# Step 5: Bootstrap test.manuscript (TEST MANUSCRIPT - manuscript_id=2)
./bin/writesys --repo manuscripts/test-repo --file test.manuscript --yes

# Step 6: Verify manuscript IDs
docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c \
  "SELECT manuscript_id, file_path FROM manuscript ORDER BY manuscript_id;"
```

**Expected result:**
- manuscript_id=1 should be the-wildfire.manuscript
- manuscript_id=2 should be test.manuscript

**Manual Tests (using test.manuscript):**

⚠️ **CRITICAL: Use test.manuscript (manuscript_id=2) for ALL testing!**
- NEVER run tests on the-wildfire.manuscript (user's working document)

1. Start API: `API_PORT=5003 ./bin/api`
2. Open browser to http://localhost:5003?manuscript_id=2 (test.manuscript)
3. Create annotation on sentence A → verify it shows
4. Manually INSERT second annotation on sentence A in database
5. Reload page → verify page loads, shows one of the annotations
6. Update/delete annotation → verify still works
7. Run existing test suite: `./test-all.sh`

**Database Insert for Testing (on test.manuscript sentences):**

```sql
-- Get a sentence_id from test.manuscript first:
SELECT sentence_id FROM sentence s
JOIN migration m ON s.migration_id = m.migration_id
WHERE m.manuscript_id = 2
LIMIT 1;

-- After creating first annotation via UI, manually add second annotation:
-- Replace 'YOUR_SENTENCE_ID_HERE' with actual sentence_id from query above
INSERT INTO annotation (sentence_id, user_id, color, note, priority, flagged)
VALUES ('YOUR_SENTENCE_ID_HERE', 'andrew', 'green', 'Second note test', 'P1', false)
RETURNING annotation_id;

-- Get the returned annotation_id, then create version:
-- Replace ANNOTATION_ID with the ID from above
-- Replace MIGRATION_ID with test.manuscript's migration_id
INSERT INTO annotation_version (
  annotation_id, version, sentence_id, color, note, priority, flagged,
  origin_sentence_id, origin_migration_id, origin_commit_hash,
  sentence_id_history, created_by
)
SELECT
  ANNOTATION_ID,
  1,
  'YOUR_SENTENCE_ID_HERE',
  'green',
  'Second note test',
  'P1',
  false,
  'YOUR_SENTENCE_ID_HERE',
  m.migration_id,
  m.commit_hash,
  '[]'::jsonb,
  'andrew'
FROM migration m
WHERE m.manuscript_id = 2
ORDER BY m.processed_at DESC
LIMIT 1;
```

---

## Future Work (Not in This Phase)

### Phase 2: UI for Creating Multiple Annotations
- Add "+ Add Another" button/UI
- Show list of existing annotations when clicked
- Select which annotation to edit/delete

### Phase 3: Visual Indicators
- Use rainbow sidebar experiment from `___writesys_rainbow-sidebars` branch
- Show all annotation colors as vertical bars in margin
- Or other multi-color visualization from experiments

### Phase 4: Multi-User Support
- Remove hardcoded `user_id = 'andrew'`
- Add user authentication
- Filter annotations by user or show all users' annotations
- May need unique constraint per user again, or different design

---

## Rollback Plan

If issues arise:
1. Revert Liquibase changeset to old structure with unique constraint
2. Revert frontend changes to single-object annotationsMap
3. Data loss: any second+ annotations per sentence would be lost

Better approach: Keep database dump before migration for safety.

---

## Files to Modify

1. `docker/liquibase/changelog/001-initial-schema.xml` (NEW - consolidated)
2. `docker/liquibase/changelog/db.changelog-master.xml` (simplified)
3. `web/js/annotations.js` (array handling)
4. Delete old changelog files: 002-010 (consolidate into 001)

## Files NOT Modified

- `internal/models/models.go` - no changes needed
- `internal/database/queries.go` - no changes needed
- `api/main.go` - no changes needed
- `web/js/renderer.js` - no changes needed
- `web/js/pagedjs-config.js` - no changes needed
- `web/css/book.css` - no changes needed

---

## Success Criteria

- ✅ Database allows multiple annotations per sentence per user
- ✅ Page loads and displays sentences with annotations
- ✅ Can create first annotation via UI
- ✅ If multiple annotations exist (manually inserted), page shows one without errors
- ✅ Can update/delete existing annotations
- ✅ All existing UI functionality still works
