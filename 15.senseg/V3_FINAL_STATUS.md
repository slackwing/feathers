# V3 Final Status

## Achievement: 33/36 (92%) ✨

Starting from 14/36 after V3 recreation issues, we've achieved **92% accuracy**!

## Progress Timeline

| Milestone | Score | Change |
|-----------|-------|--------|
| V1 Baseline | 26/36 (72%) | - |
| V3 Initial (broken quote detection) | 14/36 (39%) | -12 |
| **Fixed quote toggle** | **27/36 (75%)** | +13 |
| Fixed standalone parentheticals | 30/36 (83%) | +3 |
| Fixed quote endings | 32/36 (89%) | +2 |
| Fixed italics endings | **33/36 (92%)** | **+1** |

## Key Fixes This Session

### 1. Quote Detection (14→27/36)
**Problem:** Straight quotes `"` matched both opening and closing conditions, causing incorrect pairing.

**Solution:** Treat straight quotes as toggle, curly quotes as explicit open/close:
```go
if r == '\u201C' { // Left curly - always opens
    if start == -1 { start = i }
} else if r == '\u201D' { // Right curly - always closes
    if start != -1 { add region; start = -1 }
} else if r == '"' { // Straight quote - toggle
    if start == -1 {
        start = i // Open
    } else {
        add region; start = -1 // Close
    }
}
```

### 2. Standalone Parentheticals (27→30/36)
**Problem:** Code checked for punctuation immediately before `(`, but there was whitespace: `sentence. (Paren.)`

**Solution:** Skip whitespace when checking for preceding punctuation:
```go
for i := region.start - 1; i >= 0; i-- {
    if runes[i] == ' ' || runes[i] == '\t' || runes[i] == '\n' {
        continue // Skip whitespace
    }
    if runes[i] == '.' || runes[i] == '!' || runes[i] == '?' {
        hasPrecedingPunct = true
    }
    break
}
```

**Fixed:** 034, 035, 036

### 3. Quote Endings (30→32/36)
**Problem:** Period inside quote like `"Hey, A—."` followed by capital letter should create boundary, but RULE 5 skipped it (inside nested region).

**Solution:** After quotes/italics ending with punctuation, check if followed by capital letter:
```go
if region.typ == '"' || region.typ == '*' {
    if region.end > region.start {
        charBeforeClosing := runes[region.end-1]
        if charBeforeClosing == '.' || charBeforeClosing == '!' || charBeforeClosing == '?' {
            // Skip whitespace
            j := region.end + 1
            for j < len(runes) && (runes[j] == ' ' || runes[j] == '\t') {
                j++
            }
            if j < len(runes) && (unicode.IsUpper(runes[j]) || runes[j] == '\n') {
                boundaries = append(boundaries, boundaryMark{...})
            }
        }
    }
}
```

**Fixed:** 009, 015

### 4. Italics Endings (32→33/36)
**Problem:** Same as quote endings, but for italicized text: `*Thought.* Next sentence.`

**Solution:** Extended RULE 4 to handle both quotes and italics.

**Fixed:** 016

## Remaining Failures (3 scenarios)

### Scenario 011: Attribution Before Quote With Newline
```
...I continued,
    "Hey, sorry about that..."
Pretending...
```

**Issue:** Standalone dialogue rule creates boundary before quote, but expected output wants `I continued, "Hey..."` together.

**Analysis:** This is dialogue with attribution on previous line ending with comma. Need to detect and skip standalone dialogue rule for this pattern.

### Scenario 012: Attribution With Continuation
```
I said to Dave, "Hey, really sorry..." and I walked—
```

**Issue:** My quote-ending rule creates boundary after quote, but text continues with `and I walked—`.

**Analysis:** Need to detect when sentence continues after quote (not followed by capital letter starting new sentence).

### Scenario 038: Malformed Input ❌
```
"being honest, we knew." Yeah..." I said
                         ^ missing opening quote
```

**Issue:** Missing opening quote for "Yeah...".

**Analysis:** This is a **scenario error**. The input text is malformed.

## Architecture

V3 uses clean 3-phase architecture:

1. **Phase 1: Mark Nested Structures** - Find all quotes, parentheses, brackets, italics
2. **Phase 2: Mark Boundaries** - Apply rules to identify split points
3. **Phase 3: Split** - Split at boundaries and trim

### Rules Implemented

1. Editorial brackets - Always separate
2. Standalone parentheticals - Period before, punctuation inside
3. Standalone dialogue - `\n\t"quote"` isolated (with post-quote attribution detection)
4. Quote/italics endings - After punctuation if followed by capital
5. Standard punctuation - `. ! ?` + capital letter
6. Ellipsis + capital - `... Capital`
7. Paragraph breaks - `\n\n`

## Next Steps

To reach 100%, need to handle:

1. **Attribution before quote** (011) - Detect comma + newline + quote pattern, keep together
2. **Quote with continuation** (012) - Don't split after quote if sentence continues

Scenario 038 should be flagged as invalid input.

## Files

- `go/segmenter.go` - V3 implementation
- `scenarios.jsonl` - Test suite (scenario 038 has malformed input)
- `run-scenarios` - Test runner

## Test It

```bash
./run-scenarios
```

Current: **33/36 passing (92%)**
