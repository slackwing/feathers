# Sentence Segmentation Algorithm

## Overview

This document specifies the sentence segmentation algorithm for WriteSys. The algorithm is implemented in **both Go and JavaScript** with identical behavior, verified by shared test scenarios.

## Design Goals

1. **Deterministic**: Same input always produces same output across both languages
2. **Fiction-optimized**: Handles dialogue, em dashes, ellipses, and italics correctly
3. **Simple**: Uses basic programming constructs (variables, loops, arrays, maps)
4. **Fast**: O(n) time complexity, single-pass through text
5. **Exact match**: Frontend and backend produce identical sentence boundaries

## Word Definition

A **word** is defined as any sequence of alphanumeric characters matching the regex pattern: `[a-zA-Z0-9]+`

This definition is used for:
- Counting words in sentences (stored in database)
- Generating sentence IDs (hash of first N words)

## Sentence Boundary Rules

### Basic Rules

1. **Sentence terminators**: `.` `!` `?`
2. **Sentence starts**: Must follow terminator + whitespace + uppercase letter
3. **Minimum sentence**: At least one word (non-empty after trimming)

### Fiction-Specific Rules

#### 1. Dialogue Handling

**Pattern**: `"text," speaker verb, "more text."`

**Rule**: Interrupted dialogue is ONE sentence if the interruption is speaker attribution.

**Examples**:
- ✓ `"I can't," he said, "believe this."` → ONE sentence
- ✓ `"Guess we'll just die," I'm pretty sure you said.` → ONE sentence
- ✗ `"Hello." She paused. "Goodbye."` → TWO sentences (separate with period)

**Implementation**:
- Track quote state (inside/outside quotes)
- Don't split on `.` if inside quotes
- Don't split on `,` + lowercase continuation after closing quote (speaker attribution)

#### 2. Em Dash Interruptions

**Pattern**: `text—interrupted—continuation`

**Rule**: Em dashes create interruptions within a sentence, not sentence breaks.

**Examples**:
- ✓ `So it was—the epidemic of being in our 20s.` → ONE sentence
- ✓ `Unless he was still in shock—did it just happen?` → ONE sentence
- ✓ `We barely talked—maybe feeling, in a lofty sort of way, that there was no need of words.` → ONE sentence

**Implementation**:
- Em dashes (`—`) never terminate sentences
- Text after em dash can have capital letters without starting new sentence
- Sentence ends at actual terminator (`.` `!` `?`)

#### 3. Ellipses

**Pattern**: `text...` or `text ...`

**Rule**: Ellipses (`...`) indicate continuation or trailing off, not sentence termination.

**Examples**:
- ✓ `But... can you bear with me?` → ONE sentence
- ✓ `Well... he said trailing off with an unconvincing laugh` → ONE sentence

**Implementation**:
- Three or more consecutive periods = ellipsis
- Ellipses don't terminate sentences
- Next sentence needs standard terminator

#### 4. Italics and Bold

**Pattern**: `*text*` or `**text**`

**Rule**: Markdown formatting is transparent to sentence boundaries.

**Examples**:
- ✓ `*So it was*—the epidemic of being in our 20s.` → ONE sentence
- ✓ `in the uninteresting details of life, memories go to hide and survive—*forested safely in peripheral flora*—so maybe` → Part of larger sentence

**Implementation**:
- Ignore `*` when detecting sentence boundaries
- Process markdown as plain text for boundary detection

#### 5. Parenthetical Asides

**Pattern**: `text (aside) more text.`

**Rule**: Parentheses don't create sentence boundaries.

**Examples**:
- ✓ `Families in their cars (didn't we feel ready to share?), now we imagined rolling their eyes.` → ONE sentence

**Implementation**:
- Parentheses are treated as regular punctuation
- Question marks inside parentheses don't terminate outer sentence

### Edge Cases

#### Abbreviations

**Assumption**: Fiction prose typically doesn't use abbreviations like "Dr.", "U.S.", "etc."

**Rule**: For this manuscript genre, treat all `.` as potential sentence terminators.

**Future enhancement**: If abbreviations are needed, maintain a whitelist (Dr, Mrs, Mr, Ms, etc).

#### Quotation Marks at Boundaries

**Rule**:
- Opening quote (`"`) is part of FIRST sentence in dialogue
- Closing quote (`"`) is part of LAST sentence in dialogue

**Examples**:
- `"Guess we'll just die," I'm pretty sure you said.` → Closing quote part of sentence
- `"Hello?"` → Both quotes part of sentence

#### Whitespace

**Rule**: Normalize all whitespace to single spaces for boundary detection, but preserve original in output.

**Examples**:
- Multiple spaces after period: `Sentence one.  Sentence two.` → TWO sentences
- Newlines: `Sentence one.\n\nSentence two.` → TWO sentences

## Algorithm Pseudocode

```
function segmentSentences(text):
    sentences = []
    currentStart = 0
    insideQuotes = false
    i = 0

    while i < text.length:
        char = text[i]

        // Track quote state
        if char == '"':
            insideQuotes = !insideQuotes

        // Check for sentence terminator
        if char in ['.', '!', '?'] and not insideQuotes:
            // Look ahead for ellipsis
            if isEllipsis(text, i):
                i++
                continue

            // Find next non-whitespace character
            j = i + 1
            while j < text.length and isWhitespace(text[j]):
                j++

            // Check if next char is uppercase (new sentence)
            if j < text.length and isUppercase(text[j]):
                // Extract sentence
                sentence = text[currentStart:i+1]
                sentence = cleanBoundaries(sentence)
                if isValidSentence(sentence):
                    sentences.append(sentence)
                currentStart = j
                i = j
                continue

        i++

    // Handle remaining text
    if currentStart < text.length:
        sentence = text[currentStart:text.length]
        sentence = cleanBoundaries(sentence)
        if isValidSentence(sentence):
            sentences.append(sentence)

    return sentences

function cleanBoundaries(text):
    text = trim(text)

    // Remove leading punctuation (except quotes)
    while text.length > 0:
        if text[0] in ['.', ',', ';', ':', '!', '?', '—', '-']:
            text = text[1:]
            text = trimLeft(text)
        else:
            break

    return text

function isValidSentence(text):
    words = extractWords(text)
    return words.length > 0

function isEllipsis(text, pos):
    // Check if we have 3+ periods
    if pos + 2 < text.length:
        return text[pos] == '.' and text[pos+1] == '.' and text[pos+2] == '.'
    return false

function extractWords(text):
    return findAll(text, regex('[a-zA-Z0-9]+'))
```

## Testing

All implementations must pass the shared test suite in `test-scenarios.ndjson` (142 scenarios).

Each test provides:
- `text`: Context including target sentence and surrounding sentences
- `expected`: The exact sentence that should be extracted

## Implementation Notes

### Go Implementation (`segmenter/go/`)

- Use `regexp` for word extraction
- Use `strings` for trimming and manipulation
- Return `[]string` slice of sentences

### JavaScript Implementation (`segmenter/js/`)

- Use `RegExp` for word extraction
- Use string methods for trimming and manipulation
- Return `string[]` array of sentences

## Migration Path

1. Build and test Go implementation against all 142 test scenarios
2. Build and test JavaScript implementation against all 142 test scenarios
3. Replace `internal/sentence/tokenizer.go` with new segmenter
4. Replace `web/js/renderer.js` sentence wrapping with new segmenter
5. Reprocess all manuscripts in database
6. Verify UI highlighting matches database sentences exactly

## Future Enhancements

- Abbreviation detection if needed for other manuscripts
- Language-specific rules (currently English-only)
- Configurable rules for different prose styles
- Performance optimizations for very large documents
