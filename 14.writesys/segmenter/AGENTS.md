# Agent Instructions for Sentence Segmenter

## Critical Rules

**⚠️ MUST ALWAYS MAINTAIN DUAL IMPLEMENTATION SYNC ⚠️**

The sentence segmenter has TWO implementations that **MUST** produce identical output:

1. **Go implementation** (`segmenter/go/`)
2. **JavaScript implementation** (`segmenter/js/`)

### Non-Negotiable Requirements

1. **Both implementations must always be updated together**
   - If you change the algorithm in one language, you MUST change it in the other
   - If you fix a bug in one, you MUST fix it in the other
   - If you add a feature to one, you MUST add it to the other

2. **Both implementations must pass ALL test scenarios**
   - Run Go tests: `go test ./segmenter/go/`
   - Run JS tests: `npm test segmenter/js/`
   - All 142 test scenarios in `test-scenarios.ndjson` must pass in BOTH languages

3. **Algorithm must follow PLAN.md exactly**
   - Read `segmenter/PLAN.md` before making any changes
   - Any algorithm changes must be documented in PLAN.md first
   - Both implementations must follow the same pseudocode logic

## When Making Changes

### Before Changing Anything

1. Read `PLAN.md` to understand the current algorithm
2. Read both `go/` and `js/` implementations to see current state
3. Run existing tests to establish baseline: `make test-segmenter` (if available)

### When Changing the Algorithm

1. **Update PLAN.md first** with the new logic
2. Update Go implementation in `segmenter/go/`
3. Update JavaScript implementation in `segmenter/js/`
4. Run tests for BOTH implementations
5. If any tests fail, fix BOTH implementations
6. Verify identical output on all 142 scenarios

### When Fixing Bugs

1. Identify which scenario(s) are failing
2. Fix the bug in BOTH Go and JavaScript
3. Run full test suite for both
4. Update PLAN.md if the bug reveals unclear specification

### When Adding Features

1. Add new test scenarios to `test-scenarios.ndjson` first
2. Update PLAN.md with the feature specification
3. Implement in Go
4. Implement in JavaScript
5. Verify both pass all new and existing tests

## Testing Enforcement

The test suite **enforces synchronization** by:

1. Running the same 142 test scenarios against both implementations
2. Comparing outputs character-by-character
3. Failing if ANY discrepancy is found between Go and JS output

**Never bypass or skip tests.**

## Common Pitfalls to Avoid

### ❌ DON'T:
- Change only one implementation
- Skip tests because "it's a small change"
- Assume identical logic will behave identically (different regex engines!)
- Merge changes without running tests
- Implement "temporary" differences between languages

### ✅ DO:
- Test edge cases in BOTH languages
- Use the same test scenarios for both
- Keep pseudocode in PLAN.md updated
- Run full test suite before committing
- Document any language-specific quirks in PLAN.md

## Language-Specific Gotchas

### Go vs JavaScript Differences

**String indexing**:
- Go: `text[i]` returns byte value
- JS: `text[i]` returns character string

**Regular expressions**:
- Go: `regexp.MustCompile()` once, reuse matcher
- JS: `new RegExp()` or literal `/pattern/`

**Arrays/Slices**:
- Go: `append(slice, item)` returns new slice
- JS: `array.push(item)` mutates in place

**Unicode handling**:
- Go: Use `rune` for Unicode, `string` is bytes
- JS: Strings are UTF-16, chars are 16-bit units

**Watch out for**: Em dashes (—), smart quotes (should be normalized), multi-byte characters

## Source of Truth

1. **Algorithm specification**: `PLAN.md`
2. **Test scenarios**: `test-scenarios.ndjson` (142 scenarios)
3. **Expected behavior**: Both implementations must produce identical output

## Reprocessing Manuscripts

When you change the segmenter:

1. ✓ Update both implementations
2. ✓ Run all tests
3. ✓ Update `internal/sentence/tokenizer.go` to use new Go segmenter
4. ✓ Update `web/js/renderer.js` to use new JS segmenter
5. ✓ Reprocess all manuscripts: `./bin/writesys process --all`
6. ✓ Verify UI highlighting matches database sentences

## Version Control

Always commit both implementations together:

```bash
git add segmenter/go/ segmenter/js/ segmenter/PLAN.md
git commit -m "feat(segmenter): [description of change to both implementations]"
```

Never commit only one implementation without the other.

## Questions?

If you're unsure whether a change affects both implementations:

**The answer is YES. It always affects both.**

Make the change in both, run the tests, and verify synchronization.
