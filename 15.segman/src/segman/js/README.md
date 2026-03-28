# JavaScript Segmenter

Pure JavaScript implementation of the sentence segmenter, matching the Go implementation byte-for-byte.

## Files

- **segmenter.js** - Core segmentation logic (pure JS, no dependencies)
- **segmenter_test.js** - Test runner for scenarios.jsonl
- **segment-manuscript.js** - Tool to segment manuscript files

## Usage

### Run Tests

```bash
# From project root
./run-scenarios js

# Or directly
cd js
node segmenter_test.js
```

### Segment Manuscript

```bash
cd js
node segment-manuscript.js
```

Outputs to: `segmented/the-wildfire/the-wildfire.js.jsonl`

### Use as Library

```javascript
const { segment } = require('./segmenter.js');

const text = "Your text here. Another sentence.";
const sentences = segment(text);
// => ["Your text here.", "Another sentence."]
```

## Implementation Notes

- **100% pure JavaScript** - No dependencies, no build step required
- **Identical output to Go** - Produces byte-for-byte identical results (verified with md5sum)
- **All 38 scenarios passing** - Complete feature parity with Go implementation
- **3-Phase Architecture**:
  1. Mark nested structures (quotes, parens, brackets, italics)
  2. Mark sentence boundaries (8 rules)
  3. Split at boundaries and normalize whitespace

## Testing

The JavaScript implementation passes all 38 test scenarios:
- ✓ 38/38 scenarios passing
- ✓ Identical output to Go implementation
- ✓ 767 sentences from the-wildfire.manuscript
