# Sentence Segmenter V2 - Redesign Plan

## Why V2?

The V1 implementation became increasingly complex and fragile through iterative edge-case fixes:
- Order-dependent operations that break if rearranged
- Mixed concerns (protection, boundary detection, special cases all interleaved)
- Fragile null-byte markers that corrupt each other when adjacent
- Hardcoded patterns with repetitive logic
- No clear taxonomy - rules organized chronologically by discovery, not by function

## Research Insights

### From Pragmatic Segmenter
- Organize rules by **category** (abbreviations, quotations, parentheticals), not chronological order
- Be conservative when encountering ambiguous boundaries (don't oversplit)
- Preserve quoted material as unified segments

### From Punkt Algorithm
- Periods have different meanings in different contexts
- Statistical properties can identify abbreviations automatically
- Context around punctuation matters (what precedes, what follows)

### From Modern NLP (2024)
- Reduce reliance on punctuation alone
- Use sliding windows and context
- Token-based approaches clearer than string manipulation

## V2 Architecture: Phase-Based Processing

### Phase 1: NORMALIZE
- Trim whitespace
- Handle unicode variants (if needed)
- Preserve original structure

### Phase 2: IDENTIFY CONTEXTS
Build a **context map** of the entire text:
- Find all quoted regions (with position info)
- Find all attribution patterns
- Find all ellipsis
- Find structural elements (markdown headers, double newlines)
- Store as ranges/positions, not placeholder substitution

### Phase 3: CLASSIFY QUOTES
Based on context map:
- Standalone vs embedded dialogue
- With vs without attribution
- Followed by newline vs space
- Internal punctuation patterns

### Phase 4: APPLY BOUNDARY RULES
Rules check context before applying:
```
Rule Priority (specific overrides general):
  High:   \n\n → always boundary (structural)
  High:   Quote classification rules
  Medium: Punctuation + space/newline → boundary (unless...)
          - Exception: inside quote
          - Exception: ellipsis
          - Exception: quote with attribution
  Low:    Fallback heuristics
```

### Phase 5: SPLIT & CLEAN
- Split on identified boundaries
- Trim whitespace from each segment
- Return clean sentences

## Alternative Considered: Token-Based Approach

Instead of string operations, treat text as token stream:
```go
type Token struct {
    Text       string
    Type       TokenType  // Punctuation, Word, Quote, Whitespace, Newline
    StartPos   int
    EndPos     int
}
```

Rules operate on token sequences. May be clearer but adds complexity.

**Decision:** Start with position/range-based context map. Can evolve to tokens if needed.

## Implementation Strategy

### 1. Comprehensive Specification First
Create **SPECS.md** - a terse specification with:
- Tables organized by rule category
- Each row: rule pattern, test scenario ID, priority
- Use proper parser/tokenizer terminology
- Keep minimal but complete

### 2. Exhaustive Manuscript Analysis
Scan entire manuscript to identify all edge cases:
- Dialogue patterns (attribution, embedded, standalone)
- Punctuation contexts (ellipsis, em-dashes, colons)
- Structural elements (markdown, newlines)
- Nested constructs

### 3. Build Comprehensive Test Suite
Add scenarios to `scenarios.jsonl` for every discovered pattern.
**Rule:** SPECS.md and scenarios.jsonl always updated together.

### 4. Implement Clean V2
With complete specification and tests, implement segmenter:
- Clear phase separation
- Context-aware rule application
- No fragile string replacement chains

## Key Principles

1. **Specification-Driven**: SPECS.md is source of truth
2. **Context-Aware**: Rules check surrounding context, not just local pattern
3. **Conservative**: When ambiguous, don't split
4. **Testable**: Every rule has corresponding test scenario(s)
5. **Maintainable**: Code organization matches conceptual phases

## Documentation Requirements

### SPECS.md
- Header: "Keep this document terse - only enough to capture every segmenter rule"
- Tables by category (Dialogue, Punctuation, Structural, etc.)
- Columns: Pattern, Description, Test Scenario(s), Priority
- Use technical terminology (lookahead, boundary conditions, context windows)

### AGENTS.md Addition
- Note: SPECS.md and scenarios.jsonl must be updated together
- When adding scenario, update SPECS.md with corresponding rule
- When modifying rule in SPECS.md, ensure test coverage exists

## Next Steps

1. ✓ Create PLAN_V2.md (this file)
2. Create initial SPECS.md with tables for discovered categories
3. Thoroughly scan manuscript for all edge cases
4. Build comprehensive test scenarios
5. Implement segmenter_v2.go with clean architecture
6. Migrate when V2 passes all tests

## Success Criteria

V2 is ready when:
- All current test scenarios pass
- No order-dependency issues
- Clear separation of concerns
- Easy to add new rules without breaking existing ones
- Code is self-documenting (matches SPECS.md structure)
