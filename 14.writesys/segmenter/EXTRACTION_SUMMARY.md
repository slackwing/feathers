# Sentence Segmenter Test Scenario Extraction Summary

## Overview

Successfully extracted **99 test scenarios** from `/home/slackwing/src/worktree-writesys/14.writesys/manuscripts/the-wildfire.md` for sentence boundary detection testing.

## Validation Status

✅ **ALL 99 scenarios pass verbatim validation**
- All `text` fields exist character-for-character in the source manuscript
- All `expected` fields exist character-for-character in the source manuscript  
- All `expected` fields exist within their corresponding `text` fields

Verified by: `node validate-verbatim.js`

## Scenario Structure

Each scenario contains exactly 3 contiguous sentences from the source, testing extraction of the **middle sentence**:

```json
{
  "text": "<sentence 1> <sentence 2> <sentence 3>",
  "expected": "<sentence 2>",
  "description": "Brief description of edge case"
}
```

## Edge Cases Covered

The scenarios comprehensively test challenging sentence boundary patterns:

| Pattern | Count | % of Total |
|---------|-------|------------|
| **Em dashes (—)** | 73 | 73% |
| **Newlines/whitespace** | 53 | 53% |
| **Questions (?)** | 52 | 52% |
| **Ellipsis (...)** | 24 | 24% |
| **Italics (*text*)** | 17 | 17% |
| **Dialogue** | 7 | 7% |
| **Curly quotes ("")** | 7 | 7% |
| **Parentheticals ()** | 6 | 6% |

## Key Patterns Documented

### 1. Em Dashes
- Em dashes do **NOT** necessarily indicate sentence boundaries
- Example: "I remember—handing you one end—us plopping down"
- Capitals after em dashes don't always start new sentences

### 2. Dialogue
- Curly/smart quotes: `"` and `"` (not straight quotes)
- Dialogue can span multiple segments without sentence breaks
- Attribution can interrupt dialogue: `"text," he said, "more text."`

### 3. Ellipsis
- Three dots `...` can appear mid-sentence
- Example: "But no, I ask seriously, because... well, I'm writing"
- Not a reliable sentence boundary marker

### 4. Italics
- Markdown italics `*text*` can appear within sentences
- Example: "*So it was*—the epidemic of being in our 20s."

### 5. Parentheticals
- Can contain questions without breaking sentences
- Example: "Families (didn't we feel ready?), now we imagined"

### 6. Newlines
- Markdown double-space + newline doesn't always break sentences
- Some dialogue has newlines between attribution and quotes

### 7. Questions
- Questions can be embedded within longer sentences
- Parenthetical questions: "(didn't we feel ready?)"
- Em-dash questions: "—did it *just* happen?"

## Files

- **Source**: `/home/slackwing/src/worktree-writesys/14.writesys/manuscripts/the-wildfire.md`
- **Scenarios**: `/home/slackwing/src/worktree-writesys/14.writesys/segmenter/test-scenarios.ndjson` (99 lines)
- **Validation**: `/home/slackwing/src/worktree-writesys/14.writesys/segmenter/validate-verbatim.js`
- **Extraction**: `/home/slackwing/src/worktree-writesys/14.writesys/segmenter/extract-scenarios.py`

## Extraction Method

1. Identified ~100 interesting passages with complex punctuation
2. Used automated extraction to ensure character-for-character verbatim copying
3. Verified all text exists exactly as-is in source (no normalization, no cleaning)
4. Preserved all original formatting: curly quotes, em dashes, italics, newlines, etc.

## Critical Requirements Met

✅ ALL text copied EXACTLY verbatim from source  
✅ NO modification or normalization of ANY text  
✅ Character-for-character match including whitespace  
✅ Curly quotes preserved  
✅ Em dashes preserved  
✅ Newlines preserved  
✅ ALL scenarios validated via string matching  

## Usage

The scenarios can be used to test sentence boundary detection algorithms:

1. Input the `text` field (3 sentences)
2. Extract the middle sentence
3. Compare result to `expected` field
4. Score: exact match required for pass

This tests the ability to correctly identify sentence boundaries in real literary prose with complex punctuation patterns.
