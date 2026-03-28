# WriteSys UI Redesign Plan

## Overview

Complete redesign of the annotation interface from a sidebar pane to floating margin UI with simplified annotation model and auto-save.

**Key Changes:**
- Remove annotation sidebar entirely
- Add floating UI elements in right grey margin
- Simplify annotation model: one highlight per sentence with optional note, priority, and flag
- Replace Save/Cancel buttons with auto-save + change queue
- Add hover shortcut menu for quick highlighting

---

## Phase 1: Grey Margin Bounding Box

**Goal:** Create a responsive floating container in the right grey margin that doesn't overlap pages and resizes correctly.

**Requirements:**
- Position: Fixed or absolute in the grey margin to the right of the page
- Width: Dynamically sized based on available grey margin space
- Height: Positioned to align with manuscript content
- Must NOT overlap with the page content
- Must NOT overflow off visible area
- Responsive:
  - Gets narrower when window narrows
  - Gets wider when window widens
  - (Mobile view handling deferred to later)

**Implementation Hints:**
- Study existing Paged.js layout in `web/css/book.css`
- Grey margin area is `.pagedjs_pages` container background
- Pages are `.pagedjs_page` elements (576px width)
- Margin width = `(window width - page width) / 2`
- Use CSS to position container: `position: fixed; right: calc((100vw - 576px) / 2 - [margin-width]px)`
- Add resize event listener to recalculate on window resize
- Consider using a div with id `#annotation-margin` as the container

**Test Requirements:**
- Add test to `tests/e2e.spec.js`:
  - Verify margin container exists
  - Verify it doesn't overlap with `.pagedjs_page`
  - Verify it's visible and positioned correctly
  - Test at different viewport widths (1280px, 1600px, 1920px)
- Add test to `tests/ui-integration.js`:
  - Verify margin container dimensions
  - Verify position relative to page

**Files to Modify:**
- `web/css/book.css` - Add styles for `#annotation-margin`
- `web/js/renderer.js` - Add function to create and position margin container
- `tests/e2e.spec.js` - Add tests for margin positioning
- `tests/ui-integration.js` - Add tests for margin dimensions

---

## Phase 2: Database Schema Redesign

**Goal:** Simplify annotation model - remove types, make highlights the core concept.

**New Schema:**
```sql
-- Annotation table (simplified)
CREATE TABLE annotation (
  annotation_id SERIAL PRIMARY KEY,
  sentence_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL DEFAULT 'andrew',

  -- Core: Every annotation must have a color
  color VARCHAR(20) NOT NULL CHECK (color IN ('yellow', 'green', 'blue', 'purple', 'red', 'orange')),

  -- Optional components
  note TEXT,
  priority VARCHAR(10) CHECK (priority IN ('none', 'P0', 'P1', 'P2', 'P3')) DEFAULT 'none',
  flagged BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,

  UNIQUE(sentence_id, user_id)  -- Only one annotation per sentence per user
);

-- Tag table (many-to-many with annotations)
CREATE TABLE tag (
  tag_id SERIAL PRIMARY KEY,
  tag_name VARCHAR(100) NOT NULL,  -- lowercase, dash-separated, alphanumeric only
  migration_id INTEGER NOT NULL REFERENCES migration(migration_id),
  UNIQUE(tag_name, migration_id)
);

CREATE TABLE annotation_tag (
  annotation_id INTEGER NOT NULL REFERENCES annotation(annotation_id),
  tag_id INTEGER NOT NULL REFERENCES tag(tag_id),
  PRIMARY KEY (annotation_id, tag_id)
);
```

**Migration Strategy:**
1. Truncate existing data: `DELETE FROM annotation; DELETE FROM sentence;`
2. Reset Liquibase: `DELETE FROM databasechangeloglock; UPDATE databasechangelog SET ...`
3. Edit existing Liquibase changesets in `docker/liquibase/changelog/` to match new schema
4. Run migrations: `docker compose --profile migrate up liquibase`

**Implementation Hints:**
- Remove `type` column entirely
- Remove `payload` JSONB column - replace with explicit columns
- Add CHECK constraints for valid values
- Keep `annotation_version` table for migration tracking? (Discuss whether needed)
- Add validation in Go API layer for tag name format: `^[a-z0-9-]+$`

**Test Requirements:**
- Add Go unit tests in `internal/sentence/annotation_test.go`:
  - Test UNIQUE constraint (one annotation per sentence per user)
  - Test color CHECK constraint
  - Test priority CHECK constraint
  - Test tag name validation
- Add test to `test-e2e.sh`:
  - Create annotation with all fields
  - Verify unique constraint
  - Update annotation color (should update, not create new)

**Files to Modify:**
- `docker/liquibase/changelog/*.xml` - Edit existing changesets
- `internal/models/annotation.go` - Update struct
- `api/handlers.go` - Update handlers for new schema
- `internal/sentence/annotation_test.go` - Add unit tests
- `test-e2e.sh` - Add integration tests

---

## Phase 3: API Endpoints

**Goal:** Create/update API endpoints to support new annotation model and tag retrieval.

**New/Updated Endpoints:**

### GET /api/migrations/:migration_id/tags
Returns unique tags for a specific migration.
```json
{
  "tags": [
    {"tag_id": 1, "tag_name": "character"},
    {"tag_id": 2, "tag_name": "plot-twist"},
    {"tag_id": 3, "tag_name": "worldbuilding"}
  ]
}
```

### POST /api/annotations
Create or update annotation (upsert based on sentence_id + user_id).
```json
Request:
{
  "sentence_id": "chapter-1-i-dbd5ba08",
  "color": "blue",
  "note": "Important scene",
  "priority": "P1",
  "flagged": true,
  "tags": ["character", "plot-twist"]
}

Response:
{
  "annotation_id": 123,
  "created": false  // false = updated existing, true = created new
}
```

### PUT /api/annotations/:annotation_id
Update specific annotation.
```json
Request:
{
  "color": "yellow",
  "note": "Updated note",
  "priority": "none",
  "flagged": false,
  "tags": ["character"]
}
```

### DELETE /api/annotations/:annotation_id
Soft delete annotation (set deleted_at).

**Implementation Hints:**
- Use Go's `database/sql` UPSERT: `INSERT ... ON CONFLICT (sentence_id, user_id) DO UPDATE`
- Tag creation: Auto-create tags if they don't exist (case-insensitive check)
- Return `created` boolean to indicate if new or updated
- Validate tag names: `^[a-z0-9-]+$` (reject invalid names)
- When updating annotation, handle tag associations (delete old, insert new)

**Test Requirements:**
- Add tests to `tests/e2e.spec.js`:
  - Test GET tags endpoint returns tags for specific migration
  - Test POST creates new annotation
  - Test POST updates existing annotation (same sentence_id)
  - Test PUT updates annotation
  - Test DELETE soft-deletes annotation
  - Test tag validation (reject uppercase, spaces, special chars)
- Add Go unit tests for handlers

**Files to Modify:**
- `api/main.go` - Add route for GET tags
- `api/handlers.go` - Update annotation handlers
- `tests/e2e.spec.js` - Add API tests

---

## Phase 4: Tags Section UI

**Goal:** Implement tag chips in the margin container.

**Requirements:**
- Float right style within margin container
- Load tags via GET /api/migrations/:migration_id/tags
- Display as chip-style buttons
- Each chip has X button on one side for deletion
- Special "new tag" chip at end (greyer font)
- Clicking "new tag" prompts for tag name
- Validate: lowercase, dash-separated, alphanumeric only
- Auto-save when tag added/removed

**Implementation Hints:**
- Use CSS for chip style: `display: inline-block; padding: 4px 12px; border-radius: 16px; background: #e0e0e0;`
- X button: Use × character or small SVG icon, positioned with `position: absolute; right: 4px;`
- Research: Look at Material UI chips, GitHub label chips, or Notion tag chips for inspiration
- "new tag" chip: Same style but `color: #999; border: 1px dashed #ccc;`
- Prompt for new tag: Use browser `prompt()` or create inline input field
- Store tags in `WriteSysRenderer.currentAnnotation.tags = []` array

**Auto-save Integration:**
- When tag added: Add to change queue → `saveAnnotationChange()`
- When tag removed: Add to change queue → `saveAnnotationChange()`
- See Phase 8 for change queue implementation

**Test Requirements:**
- Add tests to `tests/e2e.spec.js`:
  - Verify tags load when sentence selected
  - Click tag X button → tag removed, auto-save triggered
  - Click "new tag" → prompt appears
  - Enter valid tag → tag added, auto-save triggered
  - Enter invalid tag (uppercase, spaces) → rejected with error message
  - Verify tags persist after reload

**Files to Modify:**
- `web/css/book.css` - Add chip styles
- `web/js/annotations.js` - Add tag UI functions
- `web/index.html` - Add tag container to margin
- `tests/e2e.spec.js` - Add tag interaction tests

---

## Phase 5: Highlight Color Palette

**Goal:** Add 6-color highlight palette in the margin.

**Requirements:**
- 6 circles: yellow, green, blue, purple, red, orange
- Kindle-like colors:
  - Yellow: #FFF3A3 (soft yellow)
  - Green: #C3FDB8 (soft mint green)
  - Blue: #AEDFF7 (soft sky blue)
  - Purple: #E0BBE4 (soft lilac)
  - Red: #FFCCCB (soft pink/salmon)
  - Orange: #FFD8A8 (soft peach)
- Circles should be equal size, justified alignment (full width of margin container)
- Clicking circle creates/updates highlight (sets color)
- Auto-save on click

**Default Mouseover/Selection Colors:**
- Mouseover (no highlight): `background: #e0e0e0` (light grey)
- Selected (no highlight): `background: #d0d0d0` (medium grey)
- Choose grey that matches tone of the Kindle-like palette (soft, muted)

**Implementation Hints:**
- Use CSS Grid or Flexbox with `justify-content: space-between`
- Circle style: `width: 36px; height: 36px; border-radius: 50%; border: 2px solid #ddd; cursor: pointer;`
- Active circle (current highlight color): Add thicker border or checkmark icon
- Store current color in `WriteSysRenderer.currentAnnotation.color`

**Test Requirements:**
- Add tests to `tests/ui-integration.js`:
  - Verify 6 circles render
  - Verify justified alignment
  - Verify circles span full width of margin
- Add tests to `tests/e2e.spec.js`:
  - Click yellow circle → annotation created with color='yellow'
  - Click different circle on highlighted sentence → color updated (not new annotation)
  - Verify auto-save triggered

**Files to Modify:**
- `web/css/book.css` - Add palette styles
- `web/js/annotations.js` - Add palette click handlers
- `web/index.html` - Add palette HTML to margin
- `tests/ui-integration.js` - Add visual tests
- `tests/e2e.spec.js` - Add interaction tests

---

## Phase 6: Note Textbox with Default-to-Blue Logic

**Goal:** Add note textbox with smart defaulting behavior.

**Requirements:**
- Textbox below color palette
- Placeholder: "Optional note..."
- No outside label
- Typing first character → defaults to blue highlight (if no color selected)
- User can change color after typing
- Edge case: If user erases note to empty, undo blue highlight (only within same sentence session)
- Auto-save 1 second after last keystroke

**Session State Management:**
- "Sentence session" = from clicking sentence until clicking away or selecting different sentence
- Track session state in `WriteSysRenderer.currentAnnotationSession = {}`
- Session state:
  ```javascript
  {
    sentenceId: "chapter-1-...",
    autoDefaultedToBlue: false,  // Track if we auto-defaulted
    originalColor: null,          // Original color before auto-default
    lastKeystroke: timestamp
  }
  ```
- Reset session on sentence change

**Default-to-Blue Logic:**
```javascript
onNoteInput(event) {
  const noteText = event.target.value;

  if (noteText.length === 1 && !this.currentAnnotation.color) {
    // First character typed, no color selected → default to blue
    this.currentAnnotation.color = 'blue';
    this.currentAnnotationSession.autoDefaultedToBlue = true;
    this.updatePaletteUI();
  }

  if (noteText.length === 0 && this.currentAnnotationSession.autoDefaultedToBlue) {
    // Erased all text, and we auto-defaulted → undo blue
    this.currentAnnotation.color = null;
    this.currentAnnotationSession.autoDefaultedToBlue = false;
    this.updatePaletteUI();
  }

  // Queue auto-save 1 second after last keystroke
  this.scheduleAutoSave();
}
```

**Test Requirements:**
- Add tests to `tests/e2e.spec.js`:
  - Select sentence (no highlight)
  - Type one character in note → blue highlight auto-selected
  - Verify blue circle highlighted in palette
  - Erase character → blue highlight removed
  - Type again → blue highlight auto-selected again
  - Type, then manually click yellow → yellow selected, blue not re-applied
  - Type more → yellow stays, blue not re-applied
  - Select different sentence → session resets
  - Return to first sentence → previous auto-default state forgotten

**Files to Modify:**
- `web/js/annotations.js` - Add note input handlers and session logic
- `web/index.html` - Add note textbox HTML
- `tests/e2e.spec.js` - Add comprehensive tests for all cases

---

## Phase 7: Priority/Flag Chips

**Goal:** Add priority and flag chips below note textbox.

**Requirements:**
- 5 chips in a row: P0, P1, P2, P3, Flag
- All grey styling (don't color them)
- P0-P3 are mutually exclusive (radio button behavior)
- Flag is independent toggle
- Flag icon: Red flag that gets red circular background when active
- Enabling flag or priority without color → defaults to blue
- Undoing in same sentence session → undo blue (similar to note logic)

**Chip Styling:**
- Inactive: `background: #f5f5f5; border: 1px solid #ddd; color: #666;`
- Active: `background: #e0e0e0; border: 1px solid #999; color: #333;`
- Flag active: Add `background: rgba(255, 0, 0, 0.1);` or red circle behind icon

**Default-to-Blue Logic (Extended):**
```javascript
onPriorityClick(priority) {
  // If no color selected, default to blue
  if (!this.currentAnnotation.color) {
    this.currentAnnotation.color = 'blue';
    this.currentAnnotationSession.autoDefaultedToBlue = true;
  }

  // Toggle priority (click same = none, click different = that one)
  if (this.currentAnnotation.priority === priority) {
    this.currentAnnotation.priority = 'none';

    // If auto-defaulted and now no note, no priority, no flag → undo blue
    if (this.shouldUndoAutoBlue()) {
      this.currentAnnotation.color = null;
      this.currentAnnotationSession.autoDefaultedToBlue = false;
    }
  } else {
    this.currentAnnotation.priority = priority;
  }

  this.scheduleAutoSave();
}

shouldUndoAutoBlue() {
  return this.currentAnnotationSession.autoDefaultedToBlue &&
         !this.currentAnnotation.note &&
         this.currentAnnotation.priority === 'none' &&
         !this.currentAnnotation.flagged;
}
```

**Test Requirements:**
- Add tests to `tests/e2e.spec.js`:
  - Click P0 → P0 active, blue auto-defaulted
  - Click P1 → P0 inactive, P1 active, blue stays
  - Click P1 again → P1 inactive, priority = none, blue removed (if no note/flag)
  - Click Flag → flag active, blue auto-defaulted
  - Unclick Flag → flag inactive, blue removed (if no note/priority)
  - Type note + set P0 + set flag → all active, blue from note
  - Remove note + remove P0 + remove flag → all inactive, blue removed

**Files to Modify:**
- `web/css/book.css` - Add chip styles
- `web/js/annotations.js` - Add priority/flag handlers
- `web/index.html` - Add priority/flag chips HTML
- `tests/e2e.spec.js` - Add comprehensive tests

---

## Phase 8: Auto-Save with Change Queue

**Goal:** Replace Save/Cancel buttons with automatic background saving.

**Requirements:**
- No Save/Cancel buttons
- Auto-save triggers:
  1. Focus out of textbox (blur event)
  2. Tag added/removed
  3. Color selected
  4. Priority/flag toggled
  5. 1 second after last change (debounced)
- Change queue in memory (array of pending changes)
- Changes tried in sequence (FIFO)
- Exponential backoff on errors
- Prominent warning overlay on save errors

**Change Queue Implementation:**
```javascript
const AnnotationChangeQueue = {
  queue: [],
  processing: false,
  retryDelay: 1000,  // Start at 1 second
  maxRetryDelay: 32000,  // Max 32 seconds

  enqueue(change) {
    // Change object: { sentenceId, annotation: {...}, attempt: 0 }
    this.queue.push({
      sentenceId: change.sentenceId,
      annotation: { ...change.annotation },
      attempt: 0,
      timestamp: Date.now()
    });

    this.processQueue();
  },

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const change = this.queue[0];

    try {
      await this.saveChange(change);

      // Success → remove from queue, reset retry delay
      this.queue.shift();
      this.retryDelay = 1000;
      this.hideErrorOverlay();

      // Process next
      this.processing = false;
      this.processQueue();

    } catch (error) {
      // Failed → increment attempt, show error, retry after delay
      change.attempt++;
      const delay = Math.min(this.retryDelay * Math.pow(2, change.attempt - 1), this.maxRetryDelay);

      this.showErrorOverlay(`Unable to save, trying again in ${delay/1000}s...`);

      setTimeout(() => {
        this.processing = false;
        this.processQueue();
      }, delay);
    }
  },

  async saveChange(change) {
    const response = await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentence_id: change.sentenceId,
        ...change.annotation
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  },

  showErrorOverlay(message) {
    // Create/show overlay with message
    let overlay = document.getElementById('save-error-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'save-error-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: rgba(255, 0, 0, 0.9);
        color: white;
        padding: 12px;
        text-align: center;
        font-weight: bold;
        z-index: 10001;
      `;
      document.body.appendChild(overlay);
    }
    overlay.textContent = message;
    overlay.style.display = 'block';
  },

  hideErrorOverlay() {
    const overlay = document.getElementById('save-error-overlay');
    if (overlay) overlay.style.display = 'none';
  }
};
```

**Debounced Auto-Save:**
```javascript
scheduleAutoSave() {
  clearTimeout(this.autoSaveTimeout);

  this.autoSaveTimeout = setTimeout(() => {
    AnnotationChangeQueue.enqueue({
      sentenceId: this.currentSentenceId,
      annotation: { ...this.currentAnnotation }
    });
  }, 1000);  // 1 second debounce
}
```

**Test Requirements:**
- Add tests to `tests/e2e.spec.js`:
  - Type in note → wait 1 second → verify auto-save triggered
  - Type, wait 0.5s, type more → verify only one save after 1s from last keystroke
  - Click color → verify immediate save
  - Add tag → verify immediate save
  - Simulate network error → verify error overlay appears
  - Simulate network error → verify exponential backoff (1s, 2s, 4s, 8s)
  - Simulate network recovery → verify queue processes successfully
  - Add multiple changes rapidly → verify all saved in sequence

**Mock Network Errors in Tests:**
```javascript
// Intercept fetch requests in test
await page.route('/api/annotations', route => {
  if (shouldSimulateError) {
    route.abort('failed');
  } else {
    route.continue();
  }
});
```

**Files to Modify:**
- `web/js/annotations.js` - Add change queue
- `web/css/book.css` - Add error overlay styles
- `tests/e2e.spec.js` - Add extensive auto-save tests

---

## Phase 9: Hover Shortcut Menu

**Goal:** Add quick highlight menu that appears on hover below the sentence.

**Requirements:**
- Appears when: Hovering over sentence AND sentence is selected
- Position: Below bottom of sentence, horizontally centered on sentence
- Content: 6 color palette circles in a row
- Background: White rounded-corner rectangle (optional, test what looks good)
- Must not disappear when mouse moves from sentence to palette
- Solution: Invisible connecting region (not timer-based)

**Positioning Logic:**
```javascript
showHoverMenu(sentenceElement) {
  const menu = document.getElementById('hover-shortcut-menu');
  const rect = sentenceElement.getBoundingClientRect();

  // Position below sentence, centered horizontally
  menu.style.top = `${rect.bottom + 8}px`;  // 8px gap
  menu.style.left = `${rect.left + rect.width / 2}px`;
  menu.style.transform = 'translateX(-50%)';  // Center align

  menu.style.display = 'block';
}
```

**Preventing Disappearance:**
- Use CSS to create invisible bridge:
```css
#hover-shortcut-menu::before {
  content: '';
  position: absolute;
  top: -8px;  /* Extend upward to connect with sentence */
  left: 0;
  right: 0;
  height: 8px;  /* Bridge gap */
  background: transparent;
}
```

**Visual Design Options:**
1. **Option A:** White rounded rectangle with shadow
   ```css
   background: white;
   border-radius: 8px;
   box-shadow: 0 2px 8px rgba(0,0,0,0.15);
   padding: 8px 12px;
   ```

2. **Option B:** Transparent, just the circles
   ```css
   background: transparent;
   padding: 4px;
   ```

Choose Option A for better visibility and clearer affordance.

**Test Requirements:**
- Add tests to `tests/e2e.spec.js`:
  - Hover over unhighlighted sentence → no menu appears
  - Click sentence (select) → hover → menu appears
  - Verify menu positioned below sentence
  - Verify menu horizontally centered
  - Move mouse from sentence to menu → menu stays visible
  - Click color in menu → highlight applied, menu stays visible
  - Click different sentence → old menu disappears, new menu appears
  - Click outside → menu disappears

**Files to Modify:**
- `web/css/book.css` - Add hover menu styles
- `web/js/renderer.js` - Add hover menu positioning logic
- `web/index.html` - Add hover menu HTML
- `tests/e2e.spec.js` - Add hover menu tests

---

## Phase 10: Cleanup and Polish

**Goal:** Remove old code, update tests, verify everything works.

**Tasks:**
1. Delete old sidebar code:
   - Remove `#annotation-sidebar` from `web/index.html`
   - Remove sidebar styles from `web/css/book.css`
   - Remove sidebar functions from `web/js/annotations.js`

2. Update CSS for new hover/selection colors:
   - `.sentence:hover` → `background: #e0e0e0`
   - `.sentence.selected` → `background: #d0d0d0`
   - `.sentence.highlighted-yellow` → `background: #FFF3A3` (etc for all 6 colors)

3. Update all tests:
   - Remove tests that reference old sidebar
   - Update tests that check for `.visible` class (no longer used)
   - Verify all new tests pass

4. Test complete workflow:
   - Load page → manuscript renders
   - Click sentence → margin UI appears
   - Add tags → auto-saved
   - Select color → auto-saved
   - Type note → auto-saved after 1s
   - Set priority → auto-saved
   - Flag → auto-saved
   - Reload page → all annotations persist
   - Hover over highlighted sentence → shortcut menu appears
   - Click color in shortcut → color changes

**Test Requirements:**
- Run complete test suite: `./test-all.sh`
- All tests must pass
- Manual testing checklist (document in AGENTS.md)

**Files to Modify:**
- `web/index.html` - Remove old sidebar HTML
- `web/css/book.css` - Remove old sidebar CSS, update sentence colors
- `web/js/annotations.js` - Remove old sidebar functions
- `tests/e2e.spec.js` - Remove/update old tests
- `AGENTS.md` - Update manual testing checklist

---

## Testing Strategy

**Test-Driven Development:**
- Write tests BEFORE implementing each feature
- Run tests frequently during development
- Every feature must have corresponding tests

**Test Coverage by Phase:**
- Phase 1: Margin positioning and responsiveness
- Phase 2: Database constraints and validation
- Phase 3: API endpoint behavior
- Phase 4: Tag UI interactions and validation
- Phase 5: Color palette UI and auto-save
- Phase 6: Note textbox default-to-blue logic (all edge cases!)
- Phase 7: Priority/flag chips and auto-default logic
- Phase 8: Change queue, exponential backoff, error handling
- Phase 9: Hover menu positioning and visibility
- Phase 10: Complete workflow integration

**Test Files:**
- `tests/e2e.spec.js` - Browser interactions, UI behavior
- `tests/ui-integration.js` - Visual rendering, layout, positioning
- `internal/sentence/annotation_test.go` - Database validation, constraints
- `test-e2e.sh` - Complete workflow from CLI to database

---

## Implementation Order

**Recommended sequence:**

1. ✅ **Phase 2: Database Schema** (get data model right first)
2. ✅ **Phase 3: API Endpoints** (build backend before frontend)
3. ✅ **Phase 1: Grey Margin Box** (establish UI foundation)
4. ✅ **Phase 5: Highlight Palette** (core feature, simplest UI component)
5. ✅ **Phase 8: Auto-Save Queue** (needed by all features)
6. ✅ **Phase 6: Note Textbox** (builds on palette + auto-save)
7. ✅ **Phase 7: Priority/Flag Chips** (similar to note logic)
8. ✅ **Phase 4: Tags Section** (most complex UI component)
9. ✅ **Phase 9: Hover Shortcut** (enhancement on top of palette)
10. ✅ **Phase 10: Cleanup** (final polish)

**Why this order:**
- Backend first (data model, API) so frontend can use real endpoints
- Simple UI components first (margin box, palette) to establish patterns
- Auto-save early so all features can use it
- Complex features last (tags, hover menu) when patterns established
- Cleanup at end once everything works

---

## Reminders Throughout

**🧪 WRITE TESTS FIRST**
- Before implementing any feature, write failing tests
- Verify tests fail (proving they test the right thing)
- Implement feature
- Verify tests pass

**💾 AUTO-SAVE INTEGRATION**
- Every user action must trigger auto-save:
  - Color selection → immediate save
  - Tag add/remove → immediate save
  - Priority/flag toggle → immediate save
  - Note input → debounced save (1s)
  - Focus out → immediate save
- All saves go through change queue
- Test error handling and retries

**🎨 CONSISTENT STYLING**
- Use soft, muted Kindle-like colors
- Grey for default hover/selection
- Coherent color palette across all 6 highlight colors
- Follow existing book.css patterns for consistency

**♿ EDGE CASES**
- Default-to-blue logic:
  - Test typing then erasing
  - Test typing then clicking color
  - Test priority then removing priority
  - Test session reset on sentence change
- One highlight per sentence:
  - Test changing color updates, doesn't duplicate
  - Test note carries over when changing color
- Tag validation:
  - Test rejection of uppercase, spaces, special chars
  - Test auto-lowercase conversion?

**📱 DEFER MOBILE**
- Mobile view handling deferred to later
- Focus on desktop (>1024px width) for now
- Document mobile considerations for future work

---

## Success Criteria

**Phase 1-3 Complete When:**
- Grey margin container appears and resizes correctly
- Database schema updated and migrations run
- API endpoints return correct data
- Tests pass for margin, database, API

**Phase 4-7 Complete When:**
- All UI components render in margin
- Tags, colors, note, priority, flag all functional
- Auto-save works for all actions
- Tests pass for all UI interactions

**Phase 8-10 Complete When:**
- Change queue handles errors gracefully
- Exponential backoff works
- Hover shortcut menu appears and works
- Old sidebar code removed
- All tests pass
- Manual testing checklist complete

**Full Redesign Complete When:**
- User can annotate sentences with highlights, notes, tags, priorities, flags
- All changes auto-save without clicking Save button
- Save errors handled gracefully with retries
- Hover shortcut provides quick highlighting
- All automated tests pass
- Manual testing confirms good UX

---

## Questions to Resolve During Implementation

1. **Annotation versioning:** Keep `annotation_version` table for migration tracking?
2. **Tag auto-creation:** Auto-create tags on first use, or require explicit creation?
3. **Hover menu background:** White rectangle or transparent (just circles)?
4. **Mobile breakpoint:** At what width should we switch to mobile view? (Deferred for now)
5. **Multiple users:** How to handle in UI when we add multi-user support later?
6. **Tag name normalization:** Auto-convert to lowercase, or reject non-lowercase?

Document decisions in this file as they're made.

---

## Files Modified Summary

**Backend:**
- `docker/liquibase/changelog/*.xml`
- `internal/models/annotation.go`
- `api/main.go`
- `api/handlers.go`

**Frontend:**
- `web/index.html`
- `web/css/book.css`
- `web/js/renderer.js`
- `web/js/annotations.js`

**Tests:**
- `tests/e2e.spec.js`
- `tests/ui-integration.js`
- `internal/sentence/annotation_test.go`
- `test-e2e.sh`

**Documentation:**
- `AGENTS.md` - Update manual testing checklist
- `REDESIGN_PLAN.md` - This file (track progress)

---

## Progress Tracking

Use checkboxes to track completion:

- [ ] Phase 1: Grey Margin Bounding Box
- [ ] Phase 2: Database Schema Redesign
- [ ] Phase 3: API Endpoints
- [ ] Phase 4: Tags Section UI
- [ ] Phase 5: Highlight Color Palette
- [ ] Phase 6: Note Textbox with Default-to-Blue
- [ ] Phase 7: Priority/Flag Chips
- [ ] Phase 8: Auto-Save with Change Queue
- [ ] Phase 9: Hover Shortcut Menu
- [ ] Phase 10: Cleanup and Polish

Last Updated: 2026-03-28
