# SXIVA - Time-Tracking Notation Language

**Version:** 0.1.0
**Status:** Specification Complete, Ready for Implementation

SXIVA (pronounced "shiva") is a custom notation language for tracking time in 12-minute blocks divided into 3-minute "blicks" (block-ticks). It supports focus tracking, point/reward calculations, and flexible time management patterns.

## Project Overview

This project contains the complete specification and implementation plan for SXIVA, including:
- Formal grammar specification
- Example files demonstrating all features
- Implementation roadmap for Tree-sitter, Neovim, and Python tooling

## Documentation

### Core Documents

- **[SPECS.md](SPECS.md)** - Complete language specification
  - Formal grammar (BNF-style)
  - Block types and validation rules
  - Point calculation algorithms
  - Implementation notes for Tree-sitter, Neovim, LSP, and CLI

- **[PLAN.md](PLAN.md)** - 8-phase implementation roadmap
  - Technology stack (Tree-sitter, Neovim, Python)
  - Detailed tasks and milestones
  - Testing strategy
  - Timeline estimate (~2-3 weeks for core features)

- **[CLARIFICATIONS.md](CLARIFICATIONS.md)** - Specification clarifications
  - All Q&A from specification review
  - Edge cases and special rules
  - Grammar vs semantic validation
  - Common patterns and usage

- **[INSTRUCTIONS.md](INSTRUCTIONS.md)** - Original requirements
  - Initial language description
  - Use cases and motivation
  - Raw specifications before formalization

### Examples

The `examples/` directory contains 16 `.sxiva` files demonstrating all language features:

**Basic Examples:**
- `basic.sxiva` - Introduction to standard blocks
- `single-blick.sxiva` - Single-task blocks with [10] notation
- `unpointed.sxiva` - Data entry before point calculation

**Block Types:**
- `x-blocks.sxiva` - Shortened catch-up blocks
- `start-blocks.sxiva` - 4-blick start blocks with [13] notation
- `continuations.sxiva` - Block chaining with +
- `continuation-x-blocks.sxiva` - x-flag propagation

**Special Features:**
- `breaks-and-rest.sxiva` - ;;; breaks and rest blocks
- `rest-blocks.sxiva` - [...] (description) (minutes) syntax
- `focus-changes.sxiva` - Multiple focus declarations
- `tilde-shorthand.sxiva` - ~+ and ~--- shortcuts

**Advanced:**
- `whitespace-and-separators.sxiva` - Formatting variants
- `complex-categories.sxiva` - Category naming patterns
- `accumulation-rollover.sxiva` - +1a through +10a
- `edge-cases.sxiva` - Unusual but valid patterns
- `full-day.sxiva` - Realistic full workday example

**Testing:**
- `INVALID-test-errors.sxiva` - Intentional errors for validator testing

See [examples/README.md](examples/README.md) and [examples/EXAMPLES_INDEX.md](examples/EXAMPLES_INDEX.md) for detailed descriptions.

## Quick Start

### Language Basics

**Time Structure:**
- **Block**: 12-minute unit starting at :00, :12, :24, :36, :48
- **Blick**: 3-minute sub-unit, standard blocks have 3 blicks (9 min)
- **Downtime**: 3 minutes per block for planning/context-switching

**Basic Syntax:**
```sxiva
{focus: [wr], [err]}
13:48 - [wr] brainstorm [3] - [err] take out recycling [3] - [err] text taylor [3] --- 14:02 (-2,+2f,+1a=1)
14:00 - [err] look up flights ~[6] - [bkc] read 3 pages [3] --- 14:13 (+1,+1f,+2a=5)
```

**Key Features:**
- `[category]` - Task categories (e.g., [wr]=writing, [err]=errands)
- `[3]`, `[6]`, `[10]`, `[13]` - Minute durations
- `~` - Tilde marks indefinite-end tasks
- `---` - Block terminator with end time
- `(points)` - Base, focus (f), and accumulation (a) points
- `x` prefix - Shortened blocks when running late
- `+` - Continuation to next block
- `;;;` - Break marker
- `[...] (desc) (mins)` - Rest blocks

### File Extension
`.sxiva`

## Technology Stack

**Parser & Syntax:**
- Tree-sitter grammar (single source of truth)
- Neovim integration via Tree-sitter
- Python bindings for CLI tools

**Command-Line Tools (Python):**
- Parsing and validation
- Point calculation
- CSV export
- Google Sheets integration
- Analytics and reporting

## Implementation Status

✅ **Complete:**
- Language specification (SPECS.md)
- Grammar rules and validation
- Example files covering all features
- Implementation plan (PLAN.md)

🔄 **In Progress:**
- None (ready to begin Phase 1)

📋 **Planned:**
- Phase 1: Tree-sitter grammar
- Phase 2: Neovim integration
- Phase 3: Python tooling foundation
- Phase 4: Semantic validation
- Phase 5: Point calculator
- Phase 6: CLI commands
- Phase 7: Documentation & distribution
- Phase 8: Advanced features (LSP, TUI, etc.)

## Development

### Prerequisites
- Node.js (for Tree-sitter CLI)
- Neovim 0.9+ (for Tree-sitter integration)
- Python 3.9+ (for CLI tools)
- Git

### Getting Started

1. **Review Specification:**
   ```bash
   # Read the complete language spec
   cat SPECS.md

   # Review examples
   ls examples/*.sxiva
   ```

2. **Follow Implementation Plan:**
   ```bash
   # See detailed roadmap
   cat PLAN.md
   ```

3. **Begin Phase 1** (Tree-sitter grammar):
   ```bash
   npm install -g tree-sitter-cli
   mkdir tree-sitter-sxiva
   cd tree-sitter-sxiva
   tree-sitter init
   # Follow PLAN.md Phase 1 instructions
   ```

### Testing

Example files provide comprehensive test coverage:
- Parser testing: All `.sxiva` files should parse successfully
- Validator testing: Use `INVALID-test-errors.sxiva` for negative tests
- Point calculator: Use `unpointed.sxiva` as input, compare to pointed examples

See [examples/EXAMPLES_INDEX.md](examples/EXAMPLES_INDEX.md) for testing progression.

## Core Concepts

### Block Types

1. **Standard 3-blick** (9 minutes):
   - 1 blick: `[10]` (shorthand for 9 min)
   - 2 blicks: `[3]+[6]` or `[6]+[3]`
   - 3 blicks: `[3]+[3]+[3]`

2. **4-blick start block** (12 minutes, HH:04/16/28/40/52):
   - 1 blick: `[13]` (shorthand for 12 min)
   - 2-4 blicks: Various combinations summing to 12

3. **x-blocks** (catch-up when running late):
   - 2-blick (6-11 min late): 6 minutes total
   - 1-blick (≥12 min late): 3 minutes total

### Point System

**Base Points:** Minutes ahead (+) or behind (-) schedule
**Focus Points (+Nf):** Awarded for each unique focus category
**Accumulation Points (+Na):** Streak counter (+1a to +10a, then reset)
**Running Total (=N):** Sum of all point types

### Special Syntax

- `~` - Tilde for indefinite-end tasks
- `~+` - Shorthand: single-blick + continuation
- `~---` - Shorthand: single-blick + terminator
- `...` - Alternate separator (equivalent to `-`)
- `<--`, `>--`, `-<-`, `->-` - Triple-dash variants

## Use Cases

- Personal time tracking with reward system
- Productivity gamification
- Time-blocking with built-in accountability
- Export to CSV for analysis
- Integration with Google Sheets for reporting
- Focus category analytics
- Streak tracking for building habits

## Contributing

This project is currently in the specification phase. Implementation is about to begin.

Contributions welcome for:
- Grammar implementation (Phase 1)
- Parser development
- Tooling implementation
- Example files
- Documentation improvements

## License

[To be determined]

## Author

Created for personal time-tracking with a bespoke reward system.

## Acknowledgments

- Inspired by time-blocking and productivity systems
- Built on Tree-sitter for robust parsing
- Designed for Neovim integration
