# V2 Implementation Iteration Log

## Summary

After researching best practices and attempting multiple approaches, V2 is currently at **21/36 passing (58%)**, which is below both:
- **V2 Iteration 3:** 23/36 (64%)
- **V1 Baseline:** 26/36 (72%)

## Research Findings

Studied Pragmatic Segmenter and sentence boundary detection best practices:

1. **Quote preservation:** Keep quotations as ONE segment (aligns with our nesting pattern)
2. **Conservative strategy:** When ambiguous, avoid splitting
3. **Preprocessing-focused:** Extract special structures FIRST, process boundaries, then restore

## Iteration History

### Iteration 3 (23/36 - BEST so far)
- **Approach:** Marker-based boundaries with newline+quote detection
- **Strengths:** Parentheticals, brackets, most punctuation patterns
- **Weakness:** Quote boundary detection lost context after split+trim

### Iteration 4 (21/36)
- **Approach:** Full quote extraction with attribution detection
- **Problem:** Too aggressive - extracted ALL quotes, broke embedded quotes
- **Issues:**
  - Embedded quotes like `shouting, "Yay! Home!"` split incorrectly
  - Trailing spaces in extracted dialogue

### Iteration 5 (21/36)
- **Approach:** Selective extraction - only standalone dialogue (`\n\t"..."`)
- **Problem:** Extraction didn't ensure quotes were separate sentences
- **Issues:** Same as iteration 4

### Iteration 6 (21/36 - CURRENT)
- **Approach:** Quote-aware boundary detection (track quote depth)
- **Changes:** Don't break on punctuation inside quotes
- **Problem:** Quote tracking has bugs with mixed quote types
- **Issues:**
  - Standalone dialogue still not isolated
  - Complex quote tracking introducing new bugs

## Current Failing Scenarios (15 total)

### Quote-related (9):
- 002: Paragraph boundary + markdown header
- 003: Embedded quote mid-sentence
- 004: Standalone dialogue `\n\t"Hello?"`
- 005: Standalone dialogue with comma before
- 009: Quote with em-dash name
- 010: Another standalone dialogue case
- 024: Attribution with "laughed" pattern
- 038: Quote boundary after period
- 042: Multi-sentence quote with ellipsis

### Other (6):
- 006, 007, 011, 012, 013, 014: Various dialogue and punctuation patterns
- 016: Italics with periods
- 039: Ellipsis mid-sentence `to... you know.`
- 048: Abbreviation `T.` with capitalization hint

## Key Problems Identified

1. **Standalone Dialogue Isolation**
   - Pattern: `\n\t"quote"` or `\n"quote"`
   - Should be: Separate sentence
   - Currently: Merged with adjacent sentences
   - Root cause: Extraction doesn't create boundaries, just placeholders

2. **Embedded Quote Handling**
   - Example: `shouting, "Yay! Home!"—except`
   - Should be: Part of sentence, no internal splitting
   - Currently: Sometimes breaks on `!` inside quote
   - Root cause: Quote tracking complexity

3. **Attribution Detection**
   - Pattern: `"quote" he said` or `"quote," he laughed`
   - Should be: Quote + attribution = one sentence
   - Currently: Works for some verbs, misses others

4. **Ellipsis Mid-Sentence**
   - Pattern: `to... you know.`
   - Should be: Break after `know.` not after `to...`
   - Currently: Not breaking correctly

## Recommendations

### Option A: Revert to Iteration 3, Targeted Fixes
Go back to the 23/36 implementation and fix specific issues:
1. Preserve newline structure when processing standalone dialogue
2. Don't extract all quotes - just mark boundaries
3. Keep the working parenthetical and bracket logic

### Option B: Architectural Redesign
Implement clean 3-phase approach:
1. **Phase 1 - Identification:** Find all nested structures (quotes, parens, brackets, italics)
2. **Phase 2 - Boundary Marking:** Mark where splits should occur, respecting nesting
3. **Phase 3 - Splitting:** Execute splits based on marked boundaries

### Option C: Simplify - Focus on Top Failures
Fix the most common patterns first:
1. Standalone dialogue isolation (scenarios 004, 005, 010)
2. Attribution patterns (024)
3. Ellipsis rules (002, 039)

## Files

- `go/segmenter.go` - Current iteration 6 implementation
- `scenarios.jsonl` - All 36 test scenarios
- `STATUS.md` - Previous session summary
- `V2_PROGRESS.md` - Previous iteration notes
- `SPECS.md` - Specification (source of truth)

## Next Steps

Recommend **Option A**: Revert to iteration 3 (23/36) and apply targeted fixes. The iteration 3 approach was simpler and more effective. The quote extraction attempts (iterations 4-6) introduced more complexity than they solved.
