# SXIVA Changelog

## [Unreleased]

### Added (2025-11-28)

#### End Marker Feature
- Added `===` end marker to grammar - marks end of timesheet
- Everything after `===` is ignored by parser and calculator
- Content after `===` preserved exactly as-is during recalculation
- Syntax highlighting stops after `===`
- Use case: Add notes, TODOs, links without syntax errors
- Test: `examples/end-marker.sxiva`

#### Neovim Command Integration (Phase 5B)
- Added `:SxivaRecalculate` command
- Automatically calls Python CLI calculator with `--fix` flag
- Reloads buffer after recalculation
- Shows notifications for progress and completion
- Added documentation with example workflow and keyboard shortcut
- Updated `editor/nvim/lua/sxiva/init.lua` with async job runner

#### Code Quality Improvements
- Completed comprehensive 4-pass code review:
  - **Pass 1**: Verified all logic documented in SPECS.md (5 fixes)
  - **Pass 2**: Analyzed rule consistency (no changes needed)
  - **Pass 3**: Code elegance refactoring (6 improvements)
  - **Pass 4**: Architectural review (2 DRY fixes)
- All 30 tests pass ✓

#### Refactoring
- Extracted magic numbers to class constants (`STANDARD_BOUNDARIES`, `START_BOUNDARIES`)
- Created `convert_blick_notation_to_minutes()` helper (eliminates 3 duplications)
- Created `build_points_notation()` helper (eliminates duplication)
- Removed redundant `import re` in calculator
- Simplified `continuation_marker` in grammar

#### Documentation
- Added end marker documentation to SPECS.md
- Updated NEOVIM_INSTALL.md with `:SxivaRecalculate` usage
- Removed obsolete files: ANALYSIS.md, CODE_REVIEW_SUMMARY.md, INSTRUCTIONS.md
- Updated PLAN.md status

## [0.1.0] - 2025-11-27

### Added

#### Phase 1: Tree-sitter Grammar
- Complete Tree-sitter grammar for SXIVA language
- Support for all block types (standard, start, x-blocks, continuations)
- Focus declarations, rest blocks, break markers
- Point notation parsing
- 29 comprehensive test examples

#### Phase 2: Neovim Integration
- Tree-sitter syntax highlighting
- Custom color scheme (times=red, categories=green, points=cyan)
- Filetype detection for `.sxiva` files
- Query files for semantic highlighting
- Parser installation in Neovim

#### Phase 5A: Python CLI Calculator
- Complete point calculation engine (`tools/sxiva/calculator.py`)
- Base points, focus points, accumulation points
- Continuation chain support with imagined end times
- Break and rest block handling
- Time offset preservation
- Comprehensive validation:
  - Time format validation
  - Boundary validation
  - Block duration validation
  - x-block marking requirements
  - Start block sequencing
- CLI commands:
  - `sxiva calculate <file>` - Check for errors
  - `sxiva calculate <file> --fix` - Fix all points
- Test suite with 29 examples
- All tests passing ✓

### Documentation
- Complete language specification (SPECS.md)
- Implementation plan (PLAN.md)
- Neovim installation guide (NEOVIM_INSTALL.md)
- AI assistant development guide (CLAUDE.md)
- Main README with project overview
