# Sentence Segmenter Specification

**Keep this document terse - only enough to capture every segmenter rule.**

---

## Core Principles

### Nesting Pattern (CRITICAL)

**Rule:** Any nested structure that begins at the top level stays as ONE sentence.

**Nested structures:**
- Parentheticals: `(text)`
- Editorial brackets: `[text]`
- Quotes: `"text"`
- Italicized thoughts: `*text*`

**Depth:** Only 1 level deep

**Implication:** No splitting within any nesting. Even if the nested content contains periods, exclamation points, or question marks, the entire structure (including surrounding context) remains one sentence.

**Examples:**
- `Sentence. (Parenthetical with period.) Continuation.` = ONE sentence
- `Text [editorial note.] more text.` = ONE sentence
- `Before "quote. Another sentence." after.` = ONE sentence

---

## Rule Categories

### 1. Structural Boundaries

| Pattern | Description | Test Scenarios | Priority |
|---------|-------------|----------------|----------|
| `\n\n` | Double newline always creates boundary (paragraphs, sections) | 001 | HIGH |
| Markdown headers | Lines starting with `#` are separate segments | 001 | HIGH |

### 2. Dialogue & Quotation Rules

| Pattern | Description | Test Scenarios | Priority |
|---------|-------------|----------------|----------|
| `"quote" <pronoun> <attribution_verb>` | Quote + attribution stays together (e.g., "Hello." he said.) BUT period after attribution ends sentence | 006 | HIGH |
| `\n"quote"` or `\n\t"quote"` | Quote starting on new line creates boundary before quote | 004, 005 | HIGH |
| `"quote!"` embedded in sentence | Quote with internal punctuation but embedded in sentence doesn't split | 003 | MEDIUM |
| Multi-sentence quote | Entire quote stays as ONE sentence, even with internal `.!?` | 031 | HIGH |
| `*italic thought*` | Italics used for internal thoughts follow SAME rules as quotes | 016 | HIGH |

**Attribution verbs:** said, asked, replied, stammered, shouted, whispered, muttered, continued, added, explained

**Pronouns:** he, she, I, they, we, you

**Italic thought patterns:** Internal monologue in italics treated identically to quoted dialogue for boundary detection.

### 3. Punctuation Context Rules

| Pattern | Description | Test Scenarios | Priority |
|---------|-------------|----------------|----------|
| `...` (ellipsis) | Ellipsis does NOT create sentence boundary | 002, 006 | HIGH |
| `. ` (period + space) | Default boundary unless in exception context | All | MEDIUM |
| `.\n` (period + newline) | Boundary at period followed by newline | Multiple | MEDIUM |
| `! `, `? ` | Exclamation/question + space creates boundary | 003 | MEDIUM |
| `!\n`, `?\n` | Exclamation/question + newline creates boundary | Multiple | MEDIUM |
| `:` (colon) | Colon does NOT create boundary (transparent) | TBD | MEDIUM |
| `;` (semicolon) | Semicolon does NOT create boundary (transparent) | TBD | LOW |
| `—` (em-dash) | Em-dash is transparent (ignore for boundaries) except at `\n\n` | TBD | HIGH |
| Abbreviations with `.` | Period after abbreviation does NOT create boundary | TBD | MEDIUM |

### 4. Exception Contexts (Boundary Inhibitors)

| Context | Rule | Test Scenarios | Priority |
|---------|------|----------------|----------|
| Inside quoted text | No splitting on internal punctuation | 003 | HIGH |
| Ellipsis pattern | `...` followed by space or punctuation is NOT boundary | 002, 006 | HIGH |
| Quote + attribution | Pattern `"..." <pronoun> <verb>` blocks split after quote punctuation | 006 | HIGH |

---

## Abbreviations List (Hardcoded)

**Common titles:**
- Mr., Mrs., Ms., Dr., Prof., Sr., Jr.

**Time expressions:**
- a.m., p.m., am, pm (no periods)

**Common abbreviations:**
- etc., vs., e.g., i.e., approx., govt.

**Single letters:**
- Single capital letter + period (e.g., `K.`, `A.`, `I.`) - context-dependent
- Exception: `I.` as Roman numeral at start of line IS a boundary

**Numbers/Measurements:**
- No., vol., ch., p., pp.

**Growing list:** Add to this as encountered in manuscript.

---

## Implementation Notes

### Context Detection Order
1. Identify all quoted regions first (position ranges)
2. Detect attribution patterns adjacent to quotes
3. Mark ellipsis positions
4. Apply boundary rules with context awareness

### Quote Classification
- **Standalone dialogue**: Quote on own line or after clear sentence boundary
- **Embedded dialogue**: Quote within ongoing sentence (e.g., after "shouting,")
- **Attributed dialogue**: Quote immediately followed by `<pronoun> <verb>` pattern

### Boundary Decision Logic
```
For each potential boundary position:
  1. Check HIGH priority rules first (structural, dialogue)
  2. If no HIGH rule applies, check MEDIUM (punctuation)
  3. Check exception contexts (inhibitors)
  4. If exceptions apply, NO boundary
  5. Otherwise, create boundary
```

---

## Edge Cases Discovered from Manuscript

*Patterns found through manuscript analysis. Status: ✓ = handled, ⚠ = partial, ✗ = not handled, ? = TBD*

### Quotation Variations

| Pattern | Example from MS | Line(s) | Status | Scenario | Notes |
|---------|-----------------|---------|--------|----------|-------|
| Embedded quote mid-sentence | `shouting, "Yay! Home!"—except the purse` | 14 | ⚠ | 003 | After comma, em-dash continuation |
| Multiple quotes in attribution | `he said trailing off...then, "Not yet"` | 26 | ✗ | 006 | Continuing after first attribution |
| Quote with colon prefix | `you'd definitely remember, because: It was` | 14 | ✗ | - | Colon as quote introducer |
| Standalone dialogue line | `\t"Hello?"` | 15 | ✓ | 004 | Tab-indented dialogue |
| Action → newline → dialogue | `I yelled,\n\t"Ow! F—!"` | 18-19 | ✓ | 005 | Comma before newline quote |
| Quote followed by question | `"I'm alright," and offered it` | 128 | ✗ | - | Quote in mid-action |
| Direct address in quote | `"Hey A—, sorry if I'm"` | 22 | ✗ | - | Em-dash for redacted name |

### Punctuation Context

| Pattern | Example from MS | Line(s) | Status | Scenario | Notes |
|---------|-----------------|---------|--------|----------|-------|
| Ellipsis mid-sentence | `because... well, I'm writing` | 8 | ✓ | 002 | Does NOT end sentence |
| Ellipsis in dialogue | `"No... I mean, yeah. Or..."` | 26 | ✓ | 006 | Multiple ellipses in one quote |
| Em-dash parenthetical | `the other hand—the other hand holding` | 18 | ✗ | - | Mid-sentence dash |
| Em-dash continuation | `Home!"—except the purse` | 14 | ✗ | - | After punctuation |
| Question mark in context | `why in your house to put it?` | 7 | ✗ | - | Question within sentence |
| Possessive + period | `Carmella's and have` | 14 | ✗ | - | Don't split on 's. |
| Numbers with comma | `2,638 miles away` | 8 | ✗ | - | Comma in numbers |
| Abbreviations | `2am`, `Mr.`, `Dr.` | 128 | ✗ | - | Period not boundary |

### Structural Elements

| Pattern | Example from MS | Line(s) | Status | Scenario | Notes |
|---------|-----------------|---------|--------|----------|-------|
| Markdown H1 | `# The Wildfire` | 1 | ✓ | 001 | Standalone segment |
| Markdown H2 | `## Chapter 1` | 3 | ✓ | 001 | Standalone segment |
| Markdown H3 | `### I.` | 5 | ✓ | 001 | Roman numeral header |
| Paragraph break | `\n\n` | Multiple | ✓ | 001 | Always boundary |
| Tab-indented line | `\tAh well, who` | 8 | ✗ | - | Continues from previous |
| Section marker | `II.` at start of line | 10, 115 | ✗ | - | Roman numeral paragraph |
| Placeholder text | `[A little more dialogue here.]` | 65 | ✗ | - | Editorial placeholder |
| Bracketed narrative | `[Placeholder. Kostya throws...]` | 136 | ✗ | - | Author notes |

### Complex Attribution Patterns

| Pattern | Example from MS | Line(s) | Status | Scenario | Notes |
|---------|-----------------|---------|--------|----------|-------|
| Simple attribution | `"Hello?" he said.` | - | ✓ | 006 | pronoun + verb |
| Attribution with adverb | `he said calmly` | 83 | ✗ | - | verb + adverb |
| Attribution + continuation | `he said trailing off...then,` | 26 | ✗ | 006 | Multiple parts |
| Attribution with laugh | `unconvincing laugh, then,` | 26 | ✗ | 006 | Non-verb action |
| Past participle action | `he stammered` vs `he was stammering` | 26 | ✓ | 006 | Tense variation |
| Multiple dialogue verbs | `he said, "I'm"` + continuation | - | ✗ | - | Nested structure |

### Italic/Emphasis Patterns

| Pattern | Example from MS | Line(s) | Status | Scenario | Notes |
|---------|-----------------|---------|--------|----------|-------|
| Italic with period inside | `*upon a time*.` | 8 | ✓ | 002 | Period before asterisk |
| Italic emphasis mid-sentence | `I *couldn't* tell you` | 8 | ✗ | - | Internal emphasis |
| Italic phrase | `*So it was*—the epidemic` | 7 | ✗ | - | Em-dash after italic |

### Abbreviations & Proper Nouns

| Pattern | Example from MS | Line(s) | Status | Scenario | Notes |
|---------|-----------------|---------|--------|----------|-------|
| Redacted names | `K—,`, `A—,`, `A—.` | 7, 17, 22 | ✗ | - | Em-dash after initial |
| Highway numbers | `highway 101` | 7 | ✗ | - | No period |
| Time expressions | `2am`, `eleven o'clock` | 24, 128 | ✗ | - | Various formats |
| Initials | `J.` or `K.` | - | ✗ | - | Single letter + period |
| Terminal number | `Terminal 4, please` | 125 | ✗ | - | Number in name |

### Sentence-Internal Structures

| Pattern | Example from MS | Line(s) | Status | Scenario | Notes |
|---------|-----------------|---------|--------|----------|-------|
| Parenthetical aside | `(didn't we feel ready` | 7 | ✗ | - | Parens mid-sentence |
| Nested em-dashes | `word—word—word` | Multiple | ✗ | - | Multiple dashes |
| Question within sentence | `What if...? We shrugged` | 7 | ✗ | - | ? mid-paragraph |
| List with semicolons | - | - | ? | - | Not seen yet |
| Colon introducing | `remember, because: It was` | 14 | ✗ | - | Colon not boundary |

---

## Scenario Coverage Map

*Which scenarios test which rules*

| Rule Category | Scenarios Testing This Pattern |
|---------------|--------------------------------|
| Markdown headers | 001, 017, 018 |
| Double newline `\n\n` | 001 |
| Newline + tab `\n\t` | 004, 005 |
| Ellipsis `...` | 002, 006, 038, 039, 040, 042 |
| Em-dash transparent | 007, 009, 010, 011, 012, 013, 014, 015, 049 |
| Colon transparent | 029, 030, 031 |
| Semicolon transparent | 053, 055 |
| Parenthetical transparent | 030, 032, 035, 036 (034 pending) |
| Dialogue attribution | 006, 023, 024 |
| Multi-sentence quotes | 031 |
| Embedded dialogue | 003 |
| Italics (like quotes) | 016, 049 |
| Editorial placeholders | 021, 022 |
| Abbreviations | 045, 047, 048 |
| Numbers with commas | 002 |
| Possessives | 003 |

---

## Rule Modifications Log

*Track changes to rules and their rationale.*

| Date | Rule Modified | Reason | Related Scenarios |
|------|---------------|--------|-------------------|
| 2026-03-24 | Initial spec | V2 redesign | 001-006 |
| 2026-03-24 | Comprehensive extraction | Added 24 scenarios covering all patterns | 007-055 |
| 2026-03-24 | Italics = quotes | User confirmed italics follow quote rules | 016 |
| 2026-03-24 | Multi-sentence quotes | User confirmed entire quote = one sentence | 031 |
| 2026-03-24 | Period after attribution | Clarified period AFTER attribution ends sentence | 023, 024 |
