# Never Mind Functionality

## Overview

The "never mind" feature allows users to undo auto-created annotations by simply deleting all text before committing the note.

## Behavior

### Auto-Create
When a user starts typing in a grey (uncreated) note:
1. The first character typed automatically creates a yellow annotation in the database
2. The note UI updates to show a yellow note
3. The annotation is tracked as "uncommitted" in `WriteSysAnnotations.neverMindState`

### Never Mind (Undo)
If the user deletes all text **before committing**, the annotation is automatically deleted:
1. User deletes all text (textarea becomes empty)
2. System detects empty text on an uncommitted annotation
3. Annotation is deleted from database
4. UI reverts to grey uncreated note
5. Sentence highlighting remains (as grey)

### Commit Actions
Any of these actions "commit" the note (prevent never mind):
1. **Losing focus** - clicking anywhere else, including another note or sentence
2. **Clicking a color** - changing the note color via palette
3. **Clicking priority** - setting P1, P2, or P3
4. **Clicking flag** - toggling the flag
5. **Clicking tag** - adding or removing a tag
6. **Switching sentences** - selecting a different sentence

Once committed, deleting text will leave an empty annotation (normal behavior).

## Implementation

### State Tracking
```javascript
neverMindState: {
  annotationId: null,  // ID of the auto-created annotation
  isCommitted: false   // Whether user has committed
}
```

### Key Code Locations

#### Auto-Create (setupUncreatedNoteHandlers)
`web/js/annotations.js:setupUncreatedNoteHandlers()`
- Detects first character typed
- Creates annotation with DEFAULT_COLOR (yellow)
- Sets `neverMindState.annotationId`
- Sets `neverMindState.isCommitted = false`

#### Never Mind Detection (setupNoteEventListeners)
`web/js/annotations.js:setupNoteEventListeners()`
- Checks on every input event
- If annotation is uncommitted AND text is empty:
  - Deletes annotation via API
  - Clears neverMindState
  - Re-renders (shows grey note again)

#### Commit Detection
Multiple locations mark `neverMindState.isCommitted = true`:
- `setupNoteEventListeners()` - on textarea blur
- `handleColorSelectionForNote()` - on color change
- Priority/flag/tag click handlers
- `showAnnotationsForSentence()` - on sentence switch

## Tests

### Test File
`tests/never-mind-test.js` - Comprehensive test suite
`tests/never-mind-simple.js` - Quick smoke test

### Test Coverage
1. ✅ Basic never mind - type and delete
2. Type, change color, delete - should NOT revert (committed)
3. Type, click tag, delete - should NOT revert (committed)
4. Type, switch sentence - original should be committed

### Running Tests
```bash
# Quick test
node tests/never-mind-simple.js

# Comprehensive test
node tests/never-mind-test.js
```

## Known Issues / Future Work

1. Note background doesn't visually change to yellow immediately after typing (CSS class application timing)
2. Color palette visibility after auto-create needs improvement

## Design Rationale

The "never mind" feature prevents accidental annotation creation when users:
- Start typing exploratory notes
- Change their mind before finishing
- Accidentally trigger the note creation

This reduces database clutter and provides a better UX for tentative note-taking.
