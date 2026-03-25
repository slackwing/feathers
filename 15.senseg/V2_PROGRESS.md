# V2 Segmenter Implementation Progress

## Status: 23/36 scenarios passing (64%)

**Baseline (V1):** 26/36 passing (72%)
**Goal:** Match or exceed V1 baseline

## Progress Timeline

1. ✅ **Scenarios extracted and added** - 36 total (6 original + 30 new)
2. ✅ **V2 Iteration 1** - 9/36 (too simplistic, rune-by-rune parsing)
3. ✅ **V2 Iteration 2** - 18/36 (added newline+quote markers)
4. ✅ **V2 Iteration 3** - 23/36 (fixed parentheticals & editorial brackets)

## Current V2 Iteration 3 Results (23/36 = 64%)

### ✅ Passing (23 scenarios):
- 001: Markdown headers
- 005, 006: Dialogue scenarios
- 007: Em-dash parenthetical series
- 013, 014: Em-dash patterns
- 021: Editorial bracket
- 022: Markdown + bracket placeholder
- 023: Attribution with adverb
- 029, 030, 031: Colon patterns
- 032, 034, 035, 036: Parenthetical patterns
- 038, 040: Ellipsis patterns
- 045, 047: Number scenarios
- 049: Italic + em-dash
- 053, 055: Semicolon patterns

### ❌ Failing (13 scenarios):

**Quote boundary issues (9):**
- 002: Ellipsis in normal text not handled
- 003: Embedded quote mid-sentence breaking incorrectly
- 004: Newline+tab quote - boundary created AFTER but not BEFORE
- 009: Quote with em-dash name
- 010: Newline+tab quote issue
- 011: Quote after comma+newline
- 012: Em-dash trailing off before newline
- 015: Multi-sentence quote breaking inside
- 024: Quote with "laughed" attribution
- 042: Multi-sentence quote with ellipsis

**Other issues (4):**
- 016: Italic thought with periods inside
- 039: Ellipsis "to... you know" not handled
- 048: Period after "T." - capitalization hint not working

## Key Problems to Fix

1. **Quote handling is too simplistic**
   - Multi-sentence quotes should stay together UNLESS specific patterns
   - Need better attribution detection (verb can come before pronoun: "laughed, oddly...")
   - Embedded quotes mid-sentence shouldn't break

2. **Parenthetical logic has bug**
   - Scenario 032 has (question?) but should NOT be separate - it's mid-sentence
   - Need to distinguish: parenthetical AS complete sentence vs parenthetical IN sentence

3. **Editorial brackets**
   - Currently only detecting if entire part is `[...]`
   - Need to split them out even if embedded in paragraph

4. **Ellipsis ending**
   - "..." at end should end sentence (scenario 040)
   - Current code has this logic but something's wrong

5. **Markdown + brackets**
   - Scenario 022: `### IV.\n\n[Placeholder...]` being treated as one paragraph
   - But they should be separate (header, then bracket)

## Iteration 3 Improvements

✅ Fixed:
- Parenthetical sentences now properly detected (scenarios 034, 035, 036, 032)
- Editorial brackets extracted first (scenario 021)
- Markdown+bracket combo working (scenario 022)
- Ellipsis ending "..." now ends sentences (scenario 040)

## Next Steps (13 failures remaining)

Main issue: **Quote boundary detection**
- Newline+tab creates boundary AFTER quote but not BEFORE (scenarios 004, 010)
- The marker approach has a flaw: after splitting on markers, the newline+tab is lost during trim
- Need to preserve the quote isolation better

Other issues:
- Italics with periods (scenario 016)
- Ellipsis mid-sentence (scenarios 002, 039)
- Attribution with laughed (scenario 024)

## Files

- `go/segmenter.go` - V2 iteration 2 implementation
- `scenarios.jsonl` - All 36 test scenarios
- `SPECS.md` - Specification (source of truth)
- `SCENARIO_EXTRACTION.md` - Extracted scenarios with contexts

## For User

Welcome back! I've made progress on V2:
- Added all 36 scenarios to `scenarios.jsonl`
- Implemented V2 with 2 iterations
- Currently at 18/36 passing (50%)

The main issues are quote handling and parenthetical logic. V1 was better (26/36) because it had sophisticated quote placeholder logic. V2 needs similar sophistication but following SPECS.md more closely.

Ready to continue iterating when you are!
