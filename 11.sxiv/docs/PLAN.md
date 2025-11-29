# SXIVA Implementation Plan

## Overview

This plan outlines the step-by-step implementation of tooling for the SXIVA time-tracking language, including Tree-sitter grammar, Neovim integration, and command-line tools.

## Technology Stack

- **Tree-sitter**: Parser generator for syntax highlighting and structured parsing
- **Neovim**: Text editor integration via Tree-sitter
- **Python**: CLI tooling, point calculation, CSV export, Google Sheets integration
- **Tree-sitter Python bindings**: Share parser between Neovim and Python tools

## Current Status

✅ **Phase 1: Tree-sitter Grammar** - COMPLETE
✅ **Phase 2: Neovim Integration** - COMPLETE

**Next**: Phase 5 - Point Calculator (3-phase auto-calculation approach)

---

## Auto-Calculation Strategy (Linter-Based Approach)

The point calculation system works like a linter/formatter:

**Phase 5A: Python CLI Calculator** (Next)
- Standalone tool: `sxiva calculate input.sxiva --fix`
- Parses entire file, walks blocks sequentially
- Maintains state (accumulation, focus, previous time)
- Detects incorrect/missing points
- Overwrites with correct values
- Like running a code formatter on your .sxiva files

**Phase 5B: Neovim Command**
- Add `:SxivaRecalculate` command in Neovim
- Calls Python CLI on current buffer
- Reloads file with updated points
- Keyboard shortcut for quick recalculation

**Phase 5C: LSP with Real-Time Diagnostics** (Future)
- Language Server shows squiggly underlines for wrong points
- Hover to see "Expected: (-2,+1f,+1a=1), Actual: (-2,+1f=0)"
- Code action: "Fix points calculation"
- Real-time feedback as you type

**Why This Approach Works:**
- Points depend on all previous blocks → Walk file top-to-bottom
- State machine tracks accumulation, focus, timing
- Deterministic: same input always gives same output
- Can run as pre-commit hook, CI check, or manual command

---

## Phase 1: Tree-sitter Grammar (Foundation) ✅ COMPLETE

### 1.1 Setup Tree-sitter Project ✅
- [x] Install Tree-sitter CLI: `npm install -g tree-sitter-cli`
- [ ] Create project structure:
  ```
  tree-sitter-sxiva/
  ├── grammar.js          # Tree-sitter grammar definition
  ├── src/
  │   ├── parser.c        # Generated C parser
  │   └── ...
  ├── queries/
  │   ├── highlights.scm  # Syntax highlighting queries
  │   └── locals.scm      # Scope definitions (optional)
  ├── test/
  │   └── corpus/
  │       └── test.txt    # Test cases
  ├── package.json
  └── binding.gyp
  ```
- [ ] Initialize: `tree-sitter init`

### 1.2 Write Core Grammar Rules
Implement grammar.js with these components in order:

**1.2.1 Lexical tokens:**
- [ ] `time` (HH:MM with validation for :00, :12, :24, :36, :48, :04, :16, :28, :40, :52)
- [ ] `category` ([...])
- [ ] `minutes` ([3], [6], [9], [10], [13])
- [ ] `tilde` (~)
- [ ] `separator` (-, ...)
- [ ] `triple_dash` (---, <--, >--, -<-, ->-)
- [ ] `continuation_marker` (+)
- [ ] `break_marker` (;;;)

**1.2.2 Basic constructs:**
- [ ] `focus_declaration` ({focus: [cat1], [cat2], ...})
- [ ] `rest_block` ([...] (description) (minutes))
- [ ] `break` (;;;)

**1.2.3 Blick and block structures:**
- [ ] `subject` (text between category and minutes/tilde)
- [ ] `blick` (category + subject + optional tilde + optional minutes)
- [ ] `blick_list` (blick separated by - or ...)
- [ ] `points` (optional parenthetical point notation)
- [ ] `terminator` (triple_dash + time + points OR continuation_marker)

**1.2.4 Complete blocks:**
- [ ] `time_block` (optional 'x' + time + '-' + blick_list + terminator)
- [ ] `continuation_block` (optional 'x' + time + '+' + blick_list + terminator)

**1.2.5 File structure:**
- [ ] `file` (sequence of lines with leading whitespace support)
- [ ] Handle empty lines

### 1.3 Write Test Cases
Create `test/corpus/test.txt` with comprehensive examples:
- [ ] Basic 3-blick blocks
- [ ] 4-blick start blocks
- [ ] x-blocks (shortened)
- [ ] Continuation blocks
- [ ] Continuation with x-blocks
- [ ] Focus declarations
- [ ] Rest blocks
- [ ] Breaks
- [ ] Various point notations
- [ ] Edge cases (unclosed parentheses, ~+, ~---, etc.)

### 1.4 Test and Iterate
- [ ] Run: `tree-sitter generate`
- [ ] Run: `tree-sitter test`
- [ ] Debug failures and refine grammar
- [ ] Run: `tree-sitter parse test/file.sxiva` to manually inspect parse trees

### 1.5 Syntax Highlighting Queries
Create `queries/highlights.scm`:
- [ ] Time values → `@constant.numeric`
- [ ] Categories → `@type`
- [ ] Subjects → `@string`
- [ ] Minutes → `@number`
- [ ] Tilde → `@comment` (or `@punctuation.special`)
- [ ] Triple dash variants → `@operator`
- [ ] Points → `@number` / `@constant`
- [ ] Focus declarations → `@keyword`
- [ ] Rest blocks → `@keyword`
- [ ] Break markers → `@keyword`
- [ ] 'x' prefix → `@warning` (visual indicator)

## Phase 2: Neovim Integration

### 2.1 Install Tree-sitter Parser in Neovim
- [ ] Copy `tree-sitter-sxiva` to Neovim parser directory or use package manager
- [ ] Register parser in Neovim config:
  ```lua
  require'nvim-treesitter.parsers'.get_parser_configs().sxiva = {
    install_info = {
      url = "/path/to/tree-sitter-sxiva",
      files = {"src/parser.c"}
    },
    filetype = "sxiva",
  }
  ```

### 2.2 File Type Detection
Create `ftdetect/sxiva.vim`:
```vim
au BufRead,BufNewFile *.sxiva set filetype=sxiva
```

### 2.3 Basic Neovim Configuration
Create `after/plugin/sxiva.lua` or `after/ftplugin/sxiva.lua`:
- [ ] Enable Tree-sitter highlighting
- [ ] Set up indentation (probably none needed)
- [ ] Configure folding (optional: fold by focus sections or breaks)
- [ ] Add keybindings (optional: jump to next/prev block)

### 2.4 Test in Neovim
- [ ] Open sample `.sxiva` file
- [ ] Verify syntax highlighting works
- [ ] Test with malformed syntax to ensure error detection
- [ ] Verify performance with large files (hundreds of blocks)

## Phase 3: Python Tooling Foundation

### 3.1 Setup Python Project
```
sxiva-tools/
├── pyproject.toml      # Project metadata
├── sxiva/
│   ├── __init__.py
│   ├── parser.py       # Tree-sitter Python bindings
│   ├── validator.py    # Semantic validation
│   ├── calculator.py   # Point calculations
│   ├── exporter.py     # CSV and Google Sheets export
│   └── cli.py          # Click/Typer CLI interface
├── tests/
│   ├── test_parser.py
│   ├── test_validator.py
│   └── test_calculator.py
└── README.md
```

### 3.2 Dependencies
Create `pyproject.toml` with:
- [ ] `tree-sitter` - Parser bindings
- [ ] `tree-sitter-sxiva` - Our grammar (local or published)
- [ ] `click` or `typer` - CLI framework
- [ ] `pandas` - Data manipulation for CSV
- [ ] `gspread` - Google Sheets API
- [ ] `oauth2client` or `google-auth` - Google authentication
- [ ] `pytest` - Testing
- [ ] `rich` - Pretty terminal output (optional)

### 3.3 Parser Module (`parser.py`)
- [ ] Load Tree-sitter SXIVA grammar
- [ ] Parse `.sxiva` files into AST
- [ ] Extract structured data:
  - Focus declarations
  - Blocks (time, x-flag, blicks, end time, points)
  - Rest blocks
  - Breaks
- [ ] Handle malformed syntax gracefully with error messages

### 3.4 Data Models
Create dataclasses or Pydantic models:
- [ ] `Blick`: category, subject, minutes, has_tilde
- [ ] `Block`: start_time, is_x_block, blicks, end_time, points, is_continuation
- [ ] `FocusDeclaration`: categories list
- [ ] `RestBlock`: description, minutes
- [ ] `SxivaFile`: all blocks, focus declarations, rest blocks, breaks

## Phase 4: Semantic Validation

### 4.1 Validator Module (`validator.py`)
Implement validation rules from SPECS.md:

**Block structure validation:**
- [ ] Standard 3-blick blocks: 1-3 blicks summing to 9 minutes
- [ ] 4-blick start blocks: 4 blicks summing to 12 minutes, correct start times
- [ ] x-blocks: 1 blick (3 min) or 2 blicks (6 min)
- [ ] Continuation chains: matching + markers, x-propagation

**Timing validation:**
- [ ] Start times on valid boundaries
- [ ] x-block placement (≥6 min or ≥12 min late)
- [ ] Rest block minutes (multiple of 12)
- [ ] 4-blick blocks only at file start or after break

**Continuation validation:**
- [ ] Block ending with + must be followed by block starting with +
- [ ] x-flag propagates through entire continuation chain
- [ ] Imagined end times for x-block continuations

**Output:**
- [ ] List of errors with line numbers and descriptions
- [ ] Warnings for potential issues (e.g., unusual timing patterns)

### 4.2 Test Suite
- [ ] Unit tests for each validation rule
- [ ] Test with examples from SPECS.md
- [ ] Test error detection and reporting

## Phase 5: Point Calculator (3-Phase Auto-Calculation Approach)

**Goal**: Auto-calculate and fix points via linting/diagnostics system

This phase implements a linter-based approach where:
1. Missing or incorrect points are detected as "linting issues"
2. Code actions/fixes automatically recalculate and overwrite points
3. The calculator maintains state while walking the file top-to-bottom

### Implementation Phases:

**Phase 5A: Python CLI Calculator**
- Build standalone CLI tool that can recalculate entire file
- Command: `sxiva calculate input.sxiva --fix`
- Validates and overwrites points in place

**Phase 5B: Neovim Integration**
- Add Neovim command: `:SxivaRecalculate`
- Calls Python CLI on current buffer
- Reloads file with updated points

**Phase 5C: LSP/Diagnostics (Future)**
- Real-time diagnostics for incorrect points
- Hover to show expected vs actual
- Code action: "Fix points calculation"
- Squiggly underlines for mismatches

### 5.1 Calculator Module (`calculator.py`)
Implement point calculation algorithms from SPECS.md:

**Base points:**
- [ ] Calculate expected completion time based on block type
- [ ] Handle continuation block threshold summation
- [ ] Reset after breaks
- [ ] Handle first block in file

**Focus points:**
- [ ] Track current focus categories
- [ ] Award +1f per unique focus category in block
- [ ] Update on focus declaration changes

**Accumulation points:**
- [ ] Track accumulation counter (+1a to +10a, then reset)
- [ ] Increment on blocks with focus categories
- [ ] Reset on: no focus, x-blocks, breaks
- [ ] Continue across focus declaration changes

**Running total:**
- [ ] Sum all point types across blocks
- [ ] Format as =N

### 5.2 Point Annotation & File Rewriting
- [ ] Function to calculate missing points for a block
- [ ] Function to detect incorrect points (compare calculated vs actual)
- [ ] Function to update .sxiva file with calculated points
- [ ] **Overwrite all points** when running in `--fix` mode
- [ ] Close open parentheses `(` with calculated points
- [ ] Maintain line structure and formatting (preserve whitespace, comments, etc.)
- [ ] Handle edge cases: missing end times, malformed blocks

### 5.3 Test Suite
- [ ] Test each point type calculation independently
- [ ] Test with all examples from SPECS.md
- [ ] Test edge cases (continuation chains, breaks, etc.)
- [ ] Verify running totals match expected values

## Phase 6: CLI Commands

### 6.1 CLI Framework (`cli.py`)
Use Click or Typer to create command structure:

```bash
sxiva --help
sxiva validate <file.sxiva>
sxiva points <file.sxiva> [--update]
sxiva export csv <file.sxiva> [--output result.csv]
sxiva export sheets <file.sxiva> [--sheet-id ID]
sxiva stats <file.sxiva>
```

### 6.2 Validate Command
- [ ] Parse file
- [ ] Run validator
- [ ] Print errors/warnings with line numbers
- [ ] Exit code 0 for valid, 1 for errors

### 6.3 Calculate/Points Command (PRIMARY FEATURE)
This is the main command for the linter-based auto-calculation:

```bash
sxiva calculate <file.sxiva>              # Show what would be fixed (dry-run)
sxiva calculate <file.sxiva> --fix        # Recalculate and overwrite all points
sxiva calculate <file.sxiva> --check      # Exit 0 if correct, 1 if mismatches
```

- [ ] Parse file with Tree-sitter
- [ ] Walk blocks sequentially, maintaining state:
  - Accumulation counter (0-10)
  - Current focus categories
  - Previous block end time
  - Running point total
- [ ] For each block:
  - Calculate expected points
  - Compare to actual points (if present)
  - Generate diagnostic if mismatch
- [ ] Display diagnostics (line numbers, expected vs actual)
- [ ] With `--fix`: overwrite file with correct points
- [ ] With `--check`: exit code for CI/validation
- [ ] Preserve all formatting, whitespace, comments

### 6.4 Export CSV Command
- [ ] Parse and validate file
- [ ] Generate CSV with columns:
  - Date (if file contains date info or use filename)
  - Start Time
  - End Time
  - Duration (minutes)
  - Category
  - Subject
  - Is X-Block
  - Base Points
  - Focus Points
  - Accumulation Points
  - Running Total
- [ ] Write to specified output file or stdout

### 6.5 Export Sheets Command
- [ ] Authenticate with Google Sheets API
- [ ] Parse and validate file
- [ ] Generate data in same format as CSV
- [ ] Append or update specified Google Sheet
- [ ] Handle rate limiting gracefully

### 6.6 Stats Command
Generate analytics report:
- [ ] Total time by category
- [ ] Focus category time breakdown
- [ ] Average blocks per hour
- [ ] X-block frequency
- [ ] Point summary (total, by type)
- [ ] Longest accumulation streak
- [ ] Time distribution (heatmap data)

### 6.7 Testing
- [ ] Integration tests for each command
- [ ] Test with sample files
- [ ] Test error handling (missing files, malformed syntax)
- [ ] Test on both macOS and Linux

## Phase 7: Documentation and Distribution

### 7.1 Documentation
- [ ] README.md for Tree-sitter grammar
- [ ] README.md for Python tools
- [ ] Installation instructions (Neovim + CLI)
- [ ] Usage examples and tutorials
- [ ] API documentation (if creating library)

### 7.2 Package Distribution
- [ ] Publish Tree-sitter grammar to npm (optional)
- [ ] Package Python tools with setuptools/poetry
- [ ] Create pip-installable package: `pip install sxiva-tools`
- [ ] Test installation on fresh systems (macOS, Arch Linux)

### 7.3 Neovim Plugin (optional)
- [ ] Create Neovim plugin with:
  - Commands: `:SxivaValidate`, `:SxivaCalculatePoints`, `:SxivaStats`
  - Keybindings for common operations
  - Statusline integration (show current points)
- [ ] Package for plugin managers (lazy.nvim, packer, etc.)

## Phase 8: Advanced Features (Future)

### 8.1 LSP Server (optional)
Create Language Server Protocol server for rich IDE features:
- [ ] Real-time error diagnostics
- [ ] Hover: show calculated points for block
- [ ] Autocomplete: suggest categories, valid times
- [ ] Code actions: "Fill missing points", "Fix blick sum"
- [ ] Document symbols: outline of blocks
- [ ] Go-to-definition: jump to category first usage

### 8.2 Additional Tooling
- [ ] Watch mode: auto-calculate points on file save
- [ ] Interactive TUI for browsing/editing .sxiva files
- [ ] Data visualization: charts for time usage, point trends
- [ ] Mobile app for quick time entry (generates .sxiva)
- [ ] Integration with calendar apps

### 8.3 Performance Optimization
- [ ] Incremental parsing for large files
- [ ] Caching for repeated calculations
- [ ] Parallel processing for batch operations

## Testing Strategy

### Per-Phase Testing
Each phase should include:
- Unit tests for individual functions
- Integration tests for component interactions
- Manual testing with sample files
- Performance testing with large files (>1000 blocks)

### End-to-End Testing
After Phase 6:
- [ ] Create realistic multi-day .sxiva files
- [ ] Run full validation and point calculation
- [ ] Export to CSV and verify correctness
- [ ] Import to Google Sheets and verify
- [ ] Test on both macOS and Arch Linux

### Regression Testing
- [ ] Maintain test suite with all examples from SPECS.md
- [ ] Run tests after any grammar or calculator changes
- [ ] Track code coverage (aim for >90%)

## Development Workflow

### Recommended Order
1. **Start with Tree-sitter**: Get parsing working first
2. **Neovim integration**: Verify syntax highlighting works
3. **Python parser**: Reuse Tree-sitter grammar
4. **Validator**: Ensure semantic correctness
5. **Calculator**: Core business logic
6. **CLI**: User-facing interface
7. **Export**: Practical utility
8. **Polish**: Documentation, packaging, distribution

### Version Control
- [ ] Initialize git repository for each component
- [ ] Use conventional commits
- [ ] Tag releases (v0.1.0, v0.2.0, etc.)
- [ ] Keep grammar and tools in sync with versions

### Continuous Integration (optional)
- [ ] GitHub Actions or similar
- [ ] Run tests on each commit
- [ ] Test on multiple platforms (Linux, macOS)
- [ ] Auto-generate documentation

## Timeline Estimate

**Note**: This is a rough estimate; adjust based on your pace and complexity encountered.

- Phase 1 (Tree-sitter grammar): 2-4 days
- Phase 2 (Neovim integration): 1-2 days
- Phase 3 (Python foundation): 1-2 days
- Phase 4 (Validation): 2-3 days
- Phase 5 (Point calculator): 3-5 days (most complex)
- Phase 6 (CLI): 2-4 days
- Phase 7 (Documentation): 1-2 days
- **Total**: ~2-3 weeks for core functionality

Phase 8 can be added incrementally over time.

## Next Steps

1. Review this plan with user and get approval
2. Set up development environment
3. Begin Phase 1: Create Tree-sitter grammar
4. Iterate based on testing and feedback

## Questions for User

Before beginning implementation:
- [ ] Confirm technology choices (Tree-sitter, Python, etc.)
- [ ] Prioritize features (can we defer some to Phase 8?)
- [ ] Clarify any remaining ambiguities in SPECS.md
- [ ] Set up Google Sheets API credentials (for Phase 6.5)
- [ ] Decide on distribution strategy (GitHub, npm, PyPI?)
