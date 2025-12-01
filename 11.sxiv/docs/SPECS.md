# SXIVA Language Specification

**Version:** 0.1.0
**File Extension:** `.sxiva`

## Overview

SXIVA (pronounced "shiva") is a time-tracking notation language for recording work activities in 12-minute blocks divided into 3-minute "blicks" (block-ticks). The language supports focus tracking, point/reward calculations, and flexible time management patterns.

## Core Concepts

### Time Structure

- **Block**: A 12-minute time unit starting at :00, :12, :24, :36, :48 of each hour
- **Blick**: A 3-minute time chunk. Examples: `[3]` = 1 blick, `[6]` = 2 blicks, `[10]` (9 min) = 3 blicks, `[13]` (12 min) = 4 blicks. Standard blocks contain up to 3 blicks (9 minutes total).
- **Downtime**: The remaining 3 minutes in each block (used for planning, context-switching)
- **Start Block**: The first block in a sequence (after file start or break), may contain 4 blicks

### Block Types

1. **Standard Block (3-blick)**: 3 blicks totaling 9 minutes + 3 minutes downtime
2. **Shortened Block (x-block)**: 2 blicks (6 min) or 1 blick (3 min) when catching up after delays
3. **Start Block (4-blick)**: 4 blicks totaling 12 minutes + 4 minutes downtime; starts 4 minutes before standard boundaries

## Grammar Specification

### Lexical Elements

#### Whitespace
```
WHITESPACE ::= (' ' | '\t')*
LINE ::= WHITESPACE content NEWLINE
```

All line types may begin with arbitrary leading whitespace (spaces or tabs).

#### Time Format
```
TIME ::= HH ':' MM
HH ::= ('0' | '1') DIGIT | '2' ('0' | '1' | '2' | '3')
MM ::= '00' | '12' | '24' | '36' | '48'     # Standard blocks
     | '08' | '20' | '32' | '44' | '56'     # Start blocks (4 minutes before)
```

For end times, MM can be any two-digit minute value (00-59).

#### Category
```
CATEGORY ::= '[' CATEGORY_CONTENT ']'
CATEGORY_CONTENT ::= [^[\]]+    # Any characters except square brackets
```

Common examples: `[wr]`, `[err]`, `[sp/a]`, `[bkc]`, `[...]`

#### Minutes
```
MINUTES ::= '[' MINUTE_VALUE ']'
MINUTE_VALUE ::= '3' | '6' | '10' | '13'
```

- `[3]`, `[6]`: Actual time durations (3 and 6 minutes)
- `[10]`: Represents 9 minutes (used for single-blick blocks or within multi-blick combinations)
- `[13]`: Represents 12 minutes (used for single-blick 4-blick start blocks)
- **Note**: `[9]` is never used in SXIVA syntax; single-blick blocks use `[10]` instead

#### Subject
```
SUBJECT ::= [a-zA-Z0-9_\-,'";:!?@#$%^&*()+={}|\\/<>.]+(\s+[a-zA-Z0-9_\-,'";:!?@#$%^&*()+={}|\\/<>.]+)*
```

The arbitrary text describing what the blick is about. Subjects may contain:
- Letters (a-z, A-Z), numbers (0-9), spaces
- Dashes/hyphens: `look-up`, `follow-up`, `clean-up`
- Underscores: `slack_up`, `check_email`
- Periods: `v2.0`, `file.txt`
- Commas: `cr, next`, `review, update`
- Allowed punctuation: `'` `"` `;` `:` `!` `?` `@` `#` `$` `%` `^` `&` `*` `(` `)` `+` `=` `{` `}` `|` `\` `/` `<` `>` `.` `,`
- **Excluded** (reserved syntax):
  - Square brackets `[` `]` (reserved for categories and minutes)

**Note:** Commas in subjects are allowed. A comma only acts as a blick separator when followed by `[category]`.

### Top-Level Constructs

#### File Structure
```
FILE ::= DATE_HEADER? (LINE)*
LINE ::= WHITESPACE (FOCUS_DECL | REST_BLOCK | TIME_BLOCK | METADATA_LINE | BREAK | EMPTY) NEWLINE
```

#### Date Header
```
DATE_HEADER ::= DAY_NAME ',' WHITESPACE* MONTH_NAME WHITESPACE* DAY_NUMBER ORDINAL ',' WHITESPACE* YEAR NEWLINE
DAY_NAME ::= 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
MONTH_NAME ::= 'January' | 'February' | 'March' | 'April' | 'May' | 'June' | 'July' | 'August' | 'September' | 'October' | 'November' | 'December'
DAY_NUMBER ::= [1-31]
ORDINAL ::= 'st' | 'nd' | 'rd' | 'th'
YEAR ::= DIGIT DIGIT DIGIT DIGIT
```

**Example:**
```
Saturday, November 29th, 2025
```

**Semantics:**
- The date header is optional but recommended
- Should be the first line of the file
- Generated automatically from the filename (format: `YYYYMMDDd.sxiva`)
- The calculator will automatically add/fix the date header based on the filename

#### Metadata Lines
```
METADATA_LINE ::= CATEGORY WHITESPACE+ METADATA_SUBJECT WHITESPACE* '-' WHITESPACE* TIME
METADATA_SUBJECT ::= [^\n]+    # Any text except newline (ends at " - TIME" separator)
```

**Examples:**
```
[med] 200b-500v, 100mg moda, 1x cof - 08:15
[med] 50mg moda - 11:20
[note] checked email and slack - 09:30
[task] submitted timesheet for review - 16:45
```

**Semantics:**
- Metadata lines are informational entries that don't participate in time block calculations
- They start with a category `[cat]`, followed by subject text, a dash `-`, and a time `HH:MM`
- The subject can contain commas, unlike time block subjects
- Metadata lines can appear anywhere in the file but are commonly used:
  - At the beginning (after date header) for morning routines, medications, etc.
  - At the end for daily summaries, notes, or end-of-day tasks
- No point calculations are performed on metadata lines
- The calculator automatically indents metadata lines (4 spaces) for visual clarity
- **Note**: Currently metadata lines are not fully supported by the grammar parser and appear as ERROR nodes, but the calculator recognizes and handles them correctly

#### Focus Declaration
```
FOCUS_DECL ::= '{' 'focus' ':' CATEGORY (',' WHITESPACE* CATEGORY)* '}'
```

**Example:**
```
{focus: [wr], [err]}
{focus: [sys], [bkc], [fit]}
```

**Semantics:**
- Sets the current focus categories for point calculation
- Replaces any previous focus declaration
- Remains in effect until changed or file ends
- Focus points are awarded for each unique focus category present in a block

#### Break Markers

There are two types of break markers that handle time discontinuities:

**1. Hard Break (`;;;`)**
```
BREAK ::= ';;;'
```

**Semantics:**
- Marks a discontinuity in time tracking
- **Accumulation points reset to +1a** after break
- **Focus categories remain in effect** across breaks (not reset)
- Time offset is preserved across the break
- Next block uses `start + threshold + offset` calculation (as if there was no break)

**2. Rest Block (`[...]`)**
```
REST_BLOCK ::= '[...]' WHITESPACE* '(' REST_DESC ')' WHITESPACE* '[' REST_MINUTES ']'
REST_DESC ::= [^)]+
REST_MINUTES ::= DIGIT+ (must be multiple of 12)
```

**Example:**
```
[...] (lunch) [48]
[...] (meeting) [24]
```

**Semantics:**
- Skips time without explicit block notation
- **Accumulation points are NOT reset** (unlike `;;;`)
- **Focus categories remain in effect** across rest blocks (not reset)
- Time offset is preserved across the rest block
- Next block uses `start + threshold + offset` calculation (as if there was no break)
- `REST_MINUTES` must be a multiple of 12
- Rest starts from the **expected** end time of the previous block (not actual end time)

**Unified Break Behavior:**

Both `;;;` and `[...]` work the same way for timing calculations: the timesheet should work "as if there was no break at all." This means:
- Time offset from before the break is preserved
- After the break, calculations use `start + threshold + offset` (not `previous_end + threshold`)
- If you subtract the break duration from all times after the break, you'd have a continuous timesheet

The **only difference** between `;;;` and `[...]`:
- `;;;` resets accumulation to +1a
- `[...]` preserves accumulation (streak continues)

**3. End Marker (`===`)**
```
END_MARKER ::= '==='
```

**Example:**
```
00:00 - [wr] work ~ --- 00:09 (+3,+1f,+1a=5)
===
Notes, TODO items, and other free-form text.
Nothing after === is parsed or modified by tooling.
```

**Semantics:**
- Marks the end of the timesheet - everything after `===` is ignored
- Parser stops processing when it encounters `===`
- Calculator and formatter preserve all content after `===` exactly as-is
- Allows you to add notes, paste links, TODOs, or any other text without syntax errors
- Useful for keeping related notes in the same file as your timesheet

**If previous block started at T with expected duration D:
  - Rest covers [T+D, T+D+REST_MINUTES)
  - Standard 3-blick block: D = 12 minutes
  - 4-blick start block: D = 16 minutes
  - x-block (2-blick): D = 6 minutes
  - x-block (1-blick): D = 3 minutes
- Next block starts at the first valid boundary ≥ T + D + REST_MINUTES
- Rest blocks are ignored for all point calculations
- Example: Block at 12:48 (expected end 13:00) + rest(36) → rest covers 13:00-13:36, next at 13:48

### Time Blocks

#### Standard Time Block
```
TIME_BLOCK ::= 'x'? TIME WHITESPACE* '-' WHITESPACE* BLICK_LIST WHITESPACE* TERMINATOR
```

#### Blick List
```
BLICK_LIST ::= BLICK (',' BLICK)*
```

Blicks within a time block are separated by commas with optional whitespace:
- `[3], [err]` (space after comma - recommended)
- `[3],[err]` (no space - also valid)

#### Blick
```
BLICK ::= CATEGORY WHITESPACE+ SUBJECT WHITESPACE* TILDE? WHITESPACE* MINUTES  # Explicit minutes (tilde optional)
        | CATEGORY WHITESPACE+ SUBJECT WHITESPACE+ TILDE WHITESPACE*           # Omitted minutes (tilde defaults to [10])
TILDE ::= '~'
```

**Tilde Notation Rules:**

The tilde (`~`) can be used in two ways:

1. **Decorative tilde** (with explicit minutes): `~[3]`, `~[6]`, `~[10]`, `~[13]`
   - The tilde is optional decoration with no semantic meaning when minutes are specified
   - Examples: `[wr] work ~[6]`, `[wr] work [6]` (both equivalent - 2 blicks)
   - Human-readable marker to indicate open-ended/ongoing work

2. **Shorthand tilde** (without minutes): `~`
   - When tilde appears alone (no minutes specified), it defaults to `[10]`
   - Example: `[wr] deep work ~` → interpreted as `[wr] deep work [10]` (3 blicks)
   - Common shorthand: `~---` instead of `[10] ---`

**Valid examples:**
- `[wr] task ~[6]` → 2 blicks (tilde is decorative, `[6]` defines blick count)
- `[wr] task [6]` → 2 blicks (no tilde)
- `[wr] task ~` → 3 blicks (tilde alone defaults to `[10]`)
- `[wr] task [10]` → 3 blicks (explicit)

**Invalid:**
- `[wr] task ---` (MUST have either tilde or explicit minutes)

**Parsing strategy for SUBJECT:**
- Trim leading/trailing whitespace
- Capture text from after CATEGORY up to:
  - A `~` preceded by whitespace (tilde form)
  - A `[N]` minutes marker (standard form)
  - End of blick (before `,` comma separator)
- Internal dashes in subjects are allowed

#### Terminator
```
TERMINATOR ::= END_TERM | CONTINUATION
END_TERM ::= TRIPLE_DASH WHITESPACE* TIME WHITESPACE* POINTS
CONTINUATION ::= TILDE? '+'

TRIPLE_DASH ::= '---' | '<--' | '>--' | '-<-' | '->-'
```

The various triple-dash forms are human markers; treat all as equivalent to `---`.

**Continuation:**
- Blocks ending in `+` continue to the next block
- Next block must start with `TIME '+'` instead of `TIME '-'`
- No end time or points are recorded for the continuing block
- `~+` is shorthand: single blick, omitted `[10]`, continuation

#### Continuation Block
```
CONTINUATION_BLOCK ::= 'x'? TIME WHITESPACE* '+' WHITESPACE* BLICK_LIST WHITESPACE* TERMINATOR
```

### Points

```
POINTS ::= '(' POINT_LIST? ('=' TOTAL)? ')'?
POINT_LIST ::= POINT (',' WHITESPACE* POINT)*
POINT ::= SIGN? DIGIT+ POINT_TYPE?
SIGN ::= '+' | '-'
POINT_TYPE ::= 'f' | 'a'
TOTAL ::= SIGN? DIGIT+
```

**Point Types:**
- **Base points** (no suffix): Minutes ahead/behind relative to expected completion time
- **Focus points** (`f` suffix): Awarded for each unique focus category in the block
- **Accumulation points** (`a` suffix): Incrementing streak counter (resets on non-focus or x-block)

**Examples:**
```
--- 14:02 (-2,+2f,+1a=1)
--- 14:13 (+1,+1f,+2a=5)
--- 14:28 (-3=2)
--- 14:42 (
```

**Semantics:**
- Points are **optional** in the grammar (for human entry)
- An open parenthesis `(` without closing `)` is valid (indicates unpointed block)
- Tooling will calculate and populate missing points, adding closing `)`
- The `=TOTAL` shows running sum of all point types
- Points can be partial: `(+1f` or `(-2,+1f` are valid (unclosed)

## Block Validation Rules

These are **semantic rules** for tooling, not enforced by grammar:

### Standard 3-Blick Blocks
- Must contain 1-3 blicks
- Total minutes must sum to 9 (actual time, where [10]=9):
  - **1 blick**: `[10]` only (represents 9 minutes)
  - **2 blicks**: `[3] + [6]`, `[6] + [3]`
  - **3 blicks**: `[3] + [3] + [3]`
- Individual blick minutes can be `[3]`, `[6]`, or `[10]`

### Start 4-Blick Blocks
- Only valid as first block in file or after `;;;` break (semantic validation, not grammar)
- Start time must be 4 minutes before standard boundary (HH:08, HH:20, HH:32, HH:44, HH:56)
- Must contain 1-4 blicks
- Total minutes must sum to 12 (actual time, where [10]=9, [13]=12):
  - **1 blick**: `[13]` only (represents 12 minutes)
  - **2 blicks**: `[10] + [3]`, `[3] + [10]`, `[6] + [6]`
  - **3 blicks**: `[3] + [3] + [6]`, `[3] + [6] + [3]`, `[6] + [3] + [3]`
  - **4 blicks**: `[3] + [3] + [3] + [3]`
- Individual blick minutes can be `[3]`, `[6]`, `[10]`, or `[13]`
- **Next block after start block**: After a start block, the following block must begin at the corresponding standard boundary (not the immediate next boundary):
  - After `:08` start → next block must be at `:24` (not `:12` or `:20`)
  - After `:20` start → next block must be at `:36` (not `:24` or `:32`)
  - After `:32` start → next block must be at `:48` (not `:36` or `:44`)
  - After `:44` start → next block must be at `:00` next hour (not `:48` or `:56`)
  - After `:56` start → next block must be at `:12` next hour (not `:00` or `:08`)
  - This ensures the 16-minute start block cycle (12 min work + 4 min downtime) completes properly

### Shortened x-Blocks

**When to use x-blocks (VALIDATION ENFORCED):**
- `x` prefix is **required** when previous block ended ≥6 minutes after current block's start time
- `x` prefix is **invalid** (error) when previous block ended <6 minutes after current block's start time

**x-Block size requirements (VALIDATION ENFORCED):**
- **2-blick x-block** (previous block ended 6-11 minutes after current start):
  - 1 blick: `[6]` (represents 6 minutes)
  - 2 blicks: `[3] + [3]`
  - Total must sum to 6 actual minutes
  - Using wrong size (e.g., 1-blick when 6-11 min late) is an **error**
- **1-blick x-block** (previous block ended ≥12 minutes after current start):
  - Must be exactly `[3]` (3 minutes)
  - Using wrong size (e.g., 2-blick when ≥12 min late) is an **error**

**x-Block point rules:**
- x-blocks award base points based on work completed
- x-blocks do **not** award focus or accumulation points
- x-blocks reset accumulation counter to +1a for the next block

### Continuation Block Rules
- When a block ends with `+`, the next block must start with `TIME +`
- Continuation blocks inherit block type (standard/shortened) based on timing rules
- If **any** block in a continuation chain is an x-block, **all** blocks in that chain must be marked with `x`
  - This includes continuation blocks that would normally be standard (3-blick) blocks
  - The entire continuation chain is treated as an x-block for accumulation point purposes
- **Imagined end times** for blocks without actual end times (continuation blocks):
  - Calculated from the **previous block's end time** (or previous imagined end in a chain), not from the continuation block's start time
  - **x-blocks**: imagined_end = previous_end + work_minutes (no grace period)
  - **Standard blocks**: imagined_end = previous_end + work_minutes + 1 (1-minute grace)
  - Examples:
    - Previous block ends at 09:32, continuation x-block with [3]: imagined end = 09:32 + 3 = 09:35
    - Previous block ends at 09:32, continuation standard block with [3],[3]: imagined end = 09:32 + 6 + 1 = 09:39
    - Chain: 09:32 → 09:36 block [3],[3],[3] → imagined end = 09:32 + 9 + 1 = 09:42
- **Threshold calculation for continuation chains**:
  - All non-final blocks in the chain contribute their work time to the "imagined end" calculation
  - The final block (the one with the actual end time) uses the standard 12-minute threshold
  - Base points = (imagined_end_of_previous_block_in_chain + 12) - actual_end
  - Example: Previous block ends at 09:32, continuation at 09:36 with [3],[3],[3] has imagined end = 09:42, final block at 09:48 has expected end = 09:42 + 12 = 09:54, actual end 10:00, base = -6
  - In other words: the work time from all continuation blocks is "summed" via the imagined end calculation, but the final block always uses threshold=12
- **Focus points for continuation chains**:
  - Aggregate ALL unique focus categories from ALL blocks in the chain
  - Award +1f for each unique focus category match across the entire chain
  - Not awarded for x-block chains (same rule as individual x-blocks)
- **Indentation rules** (applies to all blocks, including continuation chains):
  - Blocks with accumulation ≥ 2 are indented with 4 spaces
  - First `+1a` block (after reset) is NOT indented
  - Rollover `+1a` block (from `+10a` → `+1a`) IS indented (still in streak)
  - x-blocks are NEVER indented (regardless of accumulation)
  - Focus declarations during an active streak (accumulation ≥ 2) are indented

## Point Calculation (Tooling)

### Base Points
- **Formula**: Minutes difference from (previous_end_time + threshold + time_offset)
- **Threshold** (minutes after previous block):
  - Standard block: 12 minutes
  - 2-blick x-block: 6 minutes
  - 1-blick x-block: 3 minutes
  - 4-blick start block: 16 minutes
- **Time Offset**: Tracks timing drift relative to standard 12-minute block boundaries
  - **Calculation**: offset = actual_end - (block_start + 12)
  - Always calculated relative to standard 12-minute boundaries, regardless of actual block type (x-blocks, start blocks, etc.)
  - Positive offset = running late past the boundary, negative offset = running early
  - Updated after each block based on actual end vs standard boundary
  - **Preserved across all breaks**: When a break occurs (`;;;` or `[...]`), the time offset from before the break is maintained and applied to blocks after the break
  - **Example**: x14:48 block ends at 14:58. Standard boundary = 14:48 + 12 = 15:00. Offset = 14:58 - 15:00 = -2. After rest block `[...] (coffee) (12)`, block at 15:12 has expected end = 15:12 + 12 + (-2) = 15:22, so if actual end is 15:26, base points = -4
- **After any break**: Calculate from new start block using `start + threshold + offset` (not `previous_end + threshold`)
- **Continuation blocks**: See "Threshold calculation for continuation chains" above for how thresholds work in chains

### Focus Points
- Award `+1f` for each **unique** focus category present in the block
- **NOT awarded** for x-blocks (x-blocks only get base points)

### Accumulation Points
- Start at `+1a`, increment by 1 each block **with a focus category**
- **Only awarded** if the block has at least one focus category match
- **NOT awarded** for x-blocks (x-blocks reset accumulation and only get base points)
- Max value: `+10a`, then wraps to `+1a` (continues the streak)
- Reset to `+1a` (for the next focus block) when:
  - No focus category present in block (no accumulation points awarded this block)
  - x-block encountered (including entire continuation chains marked with x)
  - Hard break (`;;;`) encountered
- **Not affected** by:
  - New focus declarations (continues counting across focus changes)
  - Rest blocks `[...]` (accumulation continues across rest blocks)

### Running Total
- **Cumulative sum** of all point totals across all previous blocks plus current block
- Format: `=N` at end of point list
- Example: `(-2,+2f,+1a=1)` means total of -2+2+1=1 (first block)
- Next block: `(+1,+1f,+2a=5)` means current block is +4, running total is 1+4=5

## Summary Calculation (Tooling)

The calculator can automatically generate a `{summary}` section that shows total time spent per category.

### Freeform Declaration

```
{freeform}
```

The `{freeform}` section allows tracking unstructured time that doesn't fit into the standard 12-minute block format. This is useful for:
- Ad-hoc tasks that don't align with standard boundaries
- Retrospective time tracking
- Quick notes about time spent throughout the day

**Syntax:**
```
{freeform}
    [category] description with time ranges and/or explicit minutes
```

**Time notation in freeform lines:**
- Time ranges: `HH:MM-HH:MM` (e.g., `18:56-19:47`)
- Explicit minutes: `(\d+h)?\d+m` (e.g., `6m`, `1h`, `1h30m`, `2h15m`)
- Multiple ranges/minutes can appear anywhere in the description text

**Processing:**
1. Calculator scans the line for all time ranges and explicit minute notations
2. Calculates total minutes from all matched patterns
3. Appends ` - HH:MM` with the total time
4. Adds this time to the category total in the summary

**Example:**
```sxiva
{freeform}
    [wf] random coding, 18:56-19:47, 19:50-19:53, 6m, 8m, 20:02-20:09 - 01:15
    [wr] writing notes, 14:30-14:45, 3m - 00:18
    [err] debugging issue, 10:05-10:23 - 00:18
    [wf] quick task 1h30m somewhere in the day - 01:30
    [wr] mixed 2h15m and 15:00-15:23 total - 02:38
```

Calculations:
- Line 1: 51m + 3m + 6m + 8m + 7m = 75m = 01:15
- Line 2: 15m + 3m = 18m = 00:18
- Line 3: 18m = 00:18
- Line 4: 90m = 01:30
- Line 5: 135m + 23m = 158m = 02:38

**Rules:**
- Freeform section must appear after structured timesheet blocks
- Must appear before `{summary}` if summary exists
- Must appear before `===` end marker if present
- Each line must start with `[category]`
- Calculator always recalculates the total, even if ` - HH:MM` already exists

### Summary Declaration

```
{summary}
```

- Marks the start of a summary section
- Calculator generates category totals below this declaration
- Includes time from both structured blocks (blick-based) and freeform sections
- Always preceded by a blank line
- Summary lines are indented with 4 spaces

### Time Calculation Rules

**Critical:** Each blick counts as **4 minutes** in the summary (not 3 minutes).

This is because a "blick" represents a unit of focused work, and the 4-minute calculation accounts for overhead/context-switching.

#### Blick to Minute Mapping

For summary time calculations:
- `[3]` = 1 blick = 4 minutes
- `[6]` = 2 blicks = 8 minutes
- `[10]` = 3 blicks = 12 minutes
- `[13]` = 4 blicks = 16 minutes
- `~` (tilde alone) = defaults to `[10]` = 3 blicks = 12 minutes
- `~[3]`, `~[6]`, etc. = tilde is decorative, explicit minutes define blick count

#### Examples

**Single block:**
```sxiva
09:00 - [wr] session [10] --- 09:14
```
Summary: `[wr] - 00:12` (3 blicks × 4 min/blick = 12 minutes)

**Multiple blicks in one block:**
```sxiva
13:48 - [wr] brainstorm [3], [err] recycling [3], [err] text [3] --- 14:02
```
Summary:
- `[err] - 00:08` (2 blicks × 4 min/blick = 8 minutes)
- `[wr] - 00:04` (1 blick × 4 min/blick = 4 minutes)

**Tilde shorthand:**
```sxiva
14:00 - [wr] deep writing ~--- 14:15
```
Summary: `[wr] - 00:12` (tilde = 3 blicks × 4 min/blick = 12 minutes)

**Multiple blocks:**
```sxiva
09:00 - [wr] session 1 [10] --- 09:14
    09:12 - [wr] session 2 [10] --- 09:26
    09:24 - [wr] session 3 [10] --- 09:38
```
Summary: `[wr] - 00:36` (3 blocks × 3 blicks × 4 min/blick = 36 minutes)

### Category Consolidation

Summary totals use **base categories only**:
- `[sp/a]` and `[sp/b]` → consolidated as `[sp]`
- `[wr]` → remains `[wr]`
- Extract base category by taking text before first `/`

### Formatting

- Categories sorted alphabetically
- Dashes aligned based on longest category name
- Time format: `HH:MM` (zero-padded)
- Each summary line indented with 4 spaces

**Example:**
```sxiva
{summary}
    [...]  - 00:04
    [bkc]  - 00:16
    [err]  - 00:24
    [sp]   - 01:32
    [sys]  - 00:12
    [wr]   - 02:24
```

## Examples

### Basic Sequence
```sxiva
{focus: [wr], [err]}
13:48 - [wr] brainstorm [3], [err] take out recycling [3], [err] text taylor [3] --- 14:02 (-2,+2f,+1a=1)
14:00 - [err] look-up flights ~--- 14:13 (+1,+1f,+2a=5)
14:12 - [sp/a] claude work ~[6], [...] rest [3] --- 14:28 (-3=2)
```

### With x-Blocks
```sxiva
14:24 - [sp/b] slack-up ~[3], [err] reply [3], [bkc] read 3 pages [3] --- 14:42 (-2,+1f,+1a=2)
x14:36 - [err] do the dishes [6] --- 14:50 (-2=0)
```

### With Break
```sxiva
14:48 - [wr] brainstorm ~--- 15:14 (-12,+1f,+1a=-10)
x15:00 - [bkc] read 2 pages [3] --- 15:19 (-2=-12)
;;;
x15:36 - [err] call taylor ~[6] --- 15:49 (-1,+1f=-12)
```

### With Continuation (Standard Blocks)
```
{focus: [sys]}
09:36 - [sys] calc [3] - [err] start dishwasher [3] - [sys] org 7 [3] +
09:48 + [err] wipe counter, wash pots [6] - [err] put away 5 things [3] --- 10:01 (-5,+1f,+1a
```

### With Continuation (x-Block Chain)
```
{focus: [sys]}
09:24 - [sys] calc [3] - [err] hang clothes [6] --- 09:52 (-16,+1f,+1a
x09:36 - [sys] calc [3] +
x09:48 + [err] start dishwasher [3] - [sys] org 7 [3] +
x10:00 + [err] wipe counter [6] - [err] put away 5 [3] --- 10:09 (+4,+1f
```
Note: The entire continuation chain is marked with `x` and gets no accumulation points.

### With Rest Block
```
12:48 - [wr] write email [6] - [bkc] read 2 pages [3] --- 13:01 (-1,+1f,+1a=10)
[...] (lunch) [36]
13:48 - [err] call back [3] - [sys] review calendar [6] --- 14:03 (-3,+1f,+1a=8)
```

### 4-Blick Start Block
```
13:44 - [wr] deep work [13] --- 14:02 (-2,+1f,+1a=1)
14:00 - [err] emails [6] - [bkc] read 4 pages [3] --- 14:15 (-3,+1f,+2a=0)
```

### Visual Block Separators

```
BLOCK_SEPARATOR ::= ','','','
```

**Semantics:**
- Visual markers automatically inserted by the calculator to separate groups of 5 blocks
- Only time_block and continuation_block nodes count toward the 5-block limit
- Continuation chains (multiple continuation_block nodes) count as a single block
- Rest blocks `[...]`, break markers `;;;`, metadata lines, focus declarations, and freeform sections do NOT count toward the block limit
- Separator matches the indentation level of the preceding block
- All existing separators are removed before recalculation (always regenerated fresh)
- Highlighted like comments (muted/gray appearance)

**Example:**
```sxiva
09:00 - [wr] block 1 ~--- 09:14 (+2,+1f,+1a=3)
    09:12 - [wr] block 2 ~--- 09:26 (+2,+1f,+2a=7)
    09:24 - [wr] block 3 ~--- 09:38 (+2,+1f,+3a=12)
    09:36 - [wr] block 4 ~--- 09:50 (+2,+1f,+4a=18)
    09:48 - [wr] block 5 ~--- 10:02 (+2,+1f,+5a=25)
    ,,,
    10:00 - [wr] block 6 ~--- 10:14 (+2,+1f,+6a=33)
    10:12 - [wr] block 7 +
    10:24 + [wr] block 7 continued ~--- 10:38 (+2,+1f,+7a=42)
    10:36 - [wr] block 8 ~--- 10:50 (+2,+1f,+8a=52)
    10:48 - [wr] block 9 ~--- 11:02 (+2,+1f,+9a=62)
    ,,,
```

In this example:
- Blocks 1-5 are followed by `,,,` (indented with 4 spaces to match blocks 2-5)
- Blocks 6-7 (continuation chain counts as 1), 8, 9 are followed by `,,,`
- The separator at line 6 has 4 spaces matching the preceding indented blocks
- The separator at line 12 has 4 spaces matching the preceding indented blocks

## Reserved Tokens

The following have special meaning and cannot appear in subjects or category content:
- `[` `]` - Category and minute delimiters
- `,` - Blick separator (except `,,,` block separator)
- `-` `+` `~` - Block/continuation markers
- `(` `)` - Point delimiters
- `{` `}` - Focus declaration delimiters
- `;;;` - Break marker
- `---`, `<--`, `>--`, `-<-`, `->-` - Block terminators
- `,,,` - Visual block separator (auto-generated)

## Implementation Notes

### For Tree-sitter Grammar
- All line types must handle arbitrary leading whitespace
- Time validation (boundaries) should be in semantic validation, not grammar
- Point calculations are for tooling layer, not parser
- `---` variants are syntactic sugar (normalize during parsing)
- **Separator**: Comma `,` with optional surrounding whitespace
- Subjects cannot contain commas (reserved as separator)

### For Neovim Syntax
- Highlight invalid time formats
- Highlight mismatched minute sums (3-blick ≠ 9, 4-blick ≠ 12)
- Highlight misplaced x-blocks (basic heuristic)
- Optional: highlight tilde `~` as comment/marker

### For LSP/Linting
- Validate blick minute sums
- Validate x-block placement based on previous end times
- Validate continuation block pairing (+ must follow +)
- Validate rest block minutes (multiple of 12)
- Calculate and suggest point values
- Warn on missing end times (except continuations)

### For CLI Tooling
- Parse and validate `.sxiva` files
- Calculate and append point values
- Export to CSV: time, category, subject, minutes, points
- Integrate with Google Sheets API
- **Formatting/Linting Rules:**
  - Add 4-space indentation to lines in an active accumulation streak (accumulation > 1)
  - **x-blocks**: NEVER indented (regardless of streak status)
  - First block after file start, break, or no-focus reset: no indentation
  - First `+1a` after accumulation reset: no indentation
  - Accumulation rollover from `+10a` to `+1a`: keep indentation (still in streak)
  - **Focus declarations**: Indented if appearing during an active accumulation streak
  - Remove comments and empty lines in formatted output
- Generate reports: time by category, focus streak analytics, point trends
