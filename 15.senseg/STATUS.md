# Sentence Segmenter Status - After Research & Iteration

## Current State

📉 **21/36 passing (58%)** - below previous best of 23/36 (64%)

After researching best practices and implementing 3 additional iterations (4, 5, 6), the sophisticated approaches to quote handling actually degraded performance. **Key learning: Simpler is better.**

## Test Results - Current (Iteration 6)

### ✅ PASSING (21/36):
001, 021, 023, 029, 030, 031, 032, 034, 035, 036, 038, 040, 045, 047, 049, 053, 055, 022

### ❌ FAILING (15/36):
002, 003, 004, 005, 006, 007, 009, 010, 011, 012, 013, 014, 016, 024, 039, 042, 048

## Iteration Comparison

| Iteration | Passing | % | Approach |
|-----------|---------|---|----------|
| V1 (baseline) | 26 | 72% | Quote placeholders |
| V2 Iter 1 | 9 | 25% | Too simplistic |
| V2 Iter 2 | 18 | 50% | Added newline markers |
| **V2 Iter 3** | **23** | **64%** | **Marker-based (best V2)** |
| V2 Iter 4 | 21 | 58% | Full quote extraction |
| V2 Iter 5 | 21 | 58% | Selective extraction |
| V2 Iter 6 | 21 | 58% | Quote-aware boundaries |

## What Was Tried (This Session)

### 1. Research Phase ✅
Studied rule-based sentence segmentation best practices:
- **Pragmatic Segmenter** (Ruby): Conservative, keeps quotes as single segments
- **pySBD** (Python): Rule-based, no training data needed
- **Key insight:** "Keep parentheticals, quotations within a sentence as ONE segment"

### 2. Implementation Attempts ❌

**Iteration 4 - Full Quote Extraction:**
- Extract ALL quotes, replace with placeholders
- Problem: Too aggressive, broke embedded quotes
- Example failure: `"Yay! Home!"` split into `"Yay!"` + `Home!`

**Iteration 5 - Selective Extraction:**
- Only extract standalone dialogue (`\n\t"..."`)
- Problem: Extraction didn't create sentence boundaries
- Example failure: `"Hello?"` merged with adjacent sentences

**Iteration 6 - Quote-Aware Boundary Detection:**
- Track quote depth to prevent breaking inside quotes
- Problem: Complex state management, mixed quote types (curly vs straight)
- Example failure: Curly `"` with straight closing `"` never closes quote

## Core Technical Issues

### Issue #1: Standalone Dialogue Not Isolated ⚠️
**Pattern:** `\n\t"quote"` or `\n"quote"`
**Expected:** Separate sentence
**Actual:** Merged with previous or next sentence
**Root Cause:** Placeholder replacement doesn't create boundaries

**Example (Scenario 004):**
```
Context: I picked up.\n\t"Hello?"\n\tI waited.
Expected: ["I picked up.", "Hello?", "I waited."]
Got: ["I picked up.", "Hello?"\n\tI waited."]
```

### Issue #2: Embedded Quotes Breaking Incorrectly ⚠️
**Pattern:** Mid-sentence quotes with internal punctuation
**Expected:** No split inside quote
**Actual:** Sometimes splits on `!` or `?` inside quote
**Root Cause:** Quote depth tracking bugs

**Example (Scenario 003):**
```
Text: ...shouting, "Yay! Home!"—except...
Expected: One sentence
Got: Split after "Yay!" (in some iterations)
```

### Issue #3: Attribution Pattern Detection Incomplete
**Pattern:** `"quote" verb` or `"quote," pronoun verb`
**Expected:** Quote + attribution = one sentence
**Actual:** Works for common verbs (said, asked), misses others (laughed)
**Root Cause:** Incomplete verb list

**Example (Scenario 024):**
```
Text: "Sorry," he laughed, oddly normal-sounding all of a sudden, "It's a tricky question sometimes."
Expected: Entire thing is one sentence
Got: Splitting incorrectly
```

### Issue #4: Ellipsis Mid-Sentence
**Pattern:** `to... you know.`
**Expected:** Break after `know.`, not after `to...`
**Actual:** Not breaking correctly
**Root Cause:** Ellipsis logic only handles ending ellipsis

**Example (Scenario 039):**
```
Text: didn't want to... you know. We wanted...
Expected: ["...to... you know.", "We wanted..."]
Got: ["...to... you know. We wanted..."]
```

## What Actually Works

The **Iteration 3 marker-based approach** (23/36) was most effective:

1. ✅ **Editorial brackets** - Always separate sentences
2. ✅ **Parenthetical sentences** - Periods inside parens = separate
3. ✅ **Colon/semicolon transparency** - Don't create boundaries
4. ✅ **Ellipsis endings** - `...` at end can end sentence
5. ✅ **Most attribution patterns** - Common speech verbs
6. ✅ **Abbreviation detection** - Mr., Dr., etc.
7. ✅ **Markdown headers** - Separate segments

## Recommendations for Next Session

### Option 1: Revert to Iteration 3 + Targeted Fixes (Recommended)
**Pros:** Builds on proven foundation (23/36)
**Approach:**
1. Restore iteration 3 code (or rebuild it)
2. Fix standalone dialogue isolation (top priority)
3. Add missing attribution verbs
4. Fix ellipsis mid-sentence handling

**Expected result:** 26-28/36 (match or exceed V1)

### Option 2: Hybrid V1 + V2
**Pros:** Combines best of both implementations
**Approach:**
1. Take V1's quote placeholder system (what got it to 26/36)
2. Add V2's parenthetical detection (034, 035, 036)
3. Add V2's bracket handling (021, 022)
4. Keep V2's ellipsis ending logic (040)

**Expected result:** 28-30/36 (better than either alone)

### Option 3: Clean Rewrite from SPECS.md
**Pros:** Fresh start, simpler architecture
**Cons:** High risk, could take multiple iterations
**Approach:**
1. Phase 1: Identify all nested structures
2. Phase 2: Mark boundaries respecting nesting
3. Phase 3: Split on marked boundaries

**Expected result:** Unknown, 25-32/36 range

## Key Learnings

1. **Complexity ≠ Better:** Sophisticated quote extraction (iterations 4-6) performed worse than simple marker approach (iteration 3)

2. **State is Hard:** Tracking quote depth across mixed quote types (curly vs straight) introduced bugs

3. **Extraction vs Marking:** Extracting structures and restoring them doesn't preserve boundaries well. Marking boundary points is more effective.

4. **V1 Had It Right:** Quote placeholder system in V1 got 26/36 for a reason

5. **Incremental wins:** Adding parenthetical and bracket logic (iteration 3) showed measurable improvement. Should continue that pattern.

## Files

- **`go/segmenter.go`** - Current iteration 6 (21/36)
- **`scenarios.jsonl`** - All 36 test scenarios
- **`SPECS.md`** - Specification
- **`ITERATION_LOG.md`** - Detailed iteration history
- **`WELCOME_BACK.md`** - Summary for user's return

## Next Action

Choose one of the three options above and implement it. **Option 1 or 2 recommended** for faster path to matching V1's 26/36 baseline.
