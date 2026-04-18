# WriteSys Architecture

## Critical Spacing Invariants

These spacing values are tested in `tests/spacing-invariants-test.js` and must remain constant:

- **Vertical gap (between pages)**: 32px (`--page-gap: 2em`)
- **Horizontal gap (page to annotation margin)**: 32px (`--horizontal-gap`)
- **Top margin (viewport to annotations)**: 150px (`--annotation-top`)
- **Annotation container width**: 240px (`--annotation-width`)

These values are defined as CSS variables in `web/css/book.css` and must match the JavaScript positioning logic in `web/js/annotations.js`.

## Color System

WriteSys uses a Kindle-like highlighting system with 6 colors. Each color has 4 variants:

### Color Hierarchy

1. **Highlight colors** (`--highlight-*`): Applied to sentence backgrounds when highlighted
2. **Sticky note backgrounds** (`--sticky-*`): Lighter versions for sticky note containers
3. **Chip colors** (`--chip-*`): Darker shades for tags and priority chips
4. **Outline colors** (`--outline-*`): Even darker shades for active palette circles

### Available Colors

- Yellow
- Green
- Blue
- Purple
- Red
- Orange

### Color Usage

- User clicks a sentence → color palette appears
- User selects a color → sentence gets highlight color, sticky note gets sticky color
- User adds tags or sets priority → chips inherit darker chip color
- Active palette circle shows outline color

## Component Structure

### Annotation Margin

The annotation margin is a fixed-position container that floats in the right margin of the page:

```
#annotation-margin (fixed, calculated right position)
  └─ .annotation-margin-inner (240px width)
      ├─ .sentence-preview (first 3 words)
      ├─ .color-palette (6 color circles + trash)
      ├─ #sticky-note-container
      │   ├─ #note-container (textarea)
      │   └─ #sticky-bottom-controls
      │       ├─ #tags-container
      │       └─ #priority-flag-container
      └─ #margin-annotations (list of other annotations)
```

### Positioning Logic

The annotation margin is positioned using JavaScript to maintain a constant 32px gap from the page edge:

```javascript
const pageWidth = 576;
const containerWidth = 240; // matches --annotation-width
const windowWidth = window.innerWidth;
const marginWidth = (windowWidth - pageWidth) / 2;
const desiredGap = 32; // matches --horizontal-gap

const rightPosition = marginWidth - desiredGap - containerWidth;
margin.style.right = `${rightPosition}px`;
```

This ensures the gap remains 32px regardless of window size.

## Sticky Note Behavior

### Default State
- Background: light grey (`--sticky-default: #e8e8e8`)
- Indicates no annotation exists

### With Color
- Background: color-specific sticky shade
- Tags and priority chips inherit darker shade
- +tag button and editable tags remain uncolored

### Auto-resize
- Textarea automatically grows with content
- No scrollbar (overflow: hidden)
- Uses JavaScript to set height = scrollHeight

## Testing Strategy

1. **Spacing Invariants** (`tests/spacing-invariants-test.js`)
   - Tests 4 window sizes: 1024, 1440, 1920, 2560
   - Validates all 3 critical spacing values
   - Takes screenshots for visual verification

2. **UI Integration** (`tests/ui-integration.js`)
   - Tests manuscript loading and pagination
   - Validates sentence wrapping and highlighting
   - Tests color palette interactions

3. **Sticky Note Features** (`tests/sticky-note-features.js`)
   - Tests default grey background
   - Tests color-specific backgrounds
   - Tests textarea auto-resize
   - Tests tag and chip color inheritance
