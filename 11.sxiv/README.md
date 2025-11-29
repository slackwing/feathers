# SXIVA - Time Tracking Notation Language

**Version:** 0.1.0

SXIVA (pronounced "shiva") is a time-tracking notation language for recording work activities in 12-minute blocks divided into 3-minute "blicks" (block-ticks). The language supports focus tracking, point/reward calculations, and flexible time management patterns.

## Quick Start

```bash
# 1. Set up your data directory
export SXIVA_DATA="$HOME/sxiva"
mkdir -p $SXIVA_DATA

# 2. Install the CLI (see tools/INSTALL.md)
cd tools && pip install -e .

# 3. Open today's timesheet
sxiva
```

That's it! Type `sxiva` any time to open today's file. In Neovim, press `;s` to recalculate points.

## Project Structure

```
sxiva/
├── docs/                   # Complete documentation
│   ├── README.md          # Detailed project documentation
│   ├── SPECS.md           # Language specification
│   ├── PLAN.md            # Implementation roadmap
│   ├── INSTRUCTIONS.md    # Original requirements
│   └── NEOVIM_INSTALL.md  # Neovim installation guide
│
├── grammar/               # Tree-sitter grammar
│   ├── grammar.js        # Grammar definition
│   └── src/              # Generated parser files
│
├── editor/               # Editor integrations
│   └── nvim/            # Neovim plugin
│
├── tools/               # Python CLI tools
│   ├── sxiva/          # Python package
│   │   ├── cli.py     # Command-line interface
│   │   ├── parser.py  # Tree-sitter wrapper
│   │   └── calculator.py # Point calculation engine
│   └── pyproject.toml
│
├── examples/           # Example .sxiva files
│   └── calculated/    # Auto-generated with complete points
│
└── tests/             # Test suite
    └── test_examples.py
```

## Quick Start

### 1. Install Python Tools

```bash
cd tools
pip install -e .
```

### 2. Use the CLI

```bash
# Check point calculations
sxiva calculate examples/basic.sxiva

# Fix and format a file
sxiva calculate examples/basic.sxiva --fix

# Output to a specific file
sxiva calculate input.sxiva -o output.sxiva
```

### 3. Install Neovim Plugin

See [`docs/NEOVIM_INSTALL.md`](docs/NEOVIM_INSTALL.md) for detailed installation instructions.

## Language Overview

### Basic Syntax

```sxiva
{focus: [wr], [sys]}
13:48 - [wr] brainstorm [3], [sys] organize [3], [wr] outline [3] --- 14:02
14:00 - [wr] deep writing session ~--- 14:15
```

### Key Concepts

- **Block**: 12-minute time unit (:00, :12, :24, :36, :48)
- **Blick**: 3-minute chunk (e.g., `[3]` = 1 blick, `[6]` = 2 blicks)
- **Focus**: Categories that earn bonus points
- **Points**: Reward calculations based on time, focus, and accumulation

### Block Types

1. **Standard (3-blick)**: `---` (9 minutes work + 3 minutes downtime)
2. **X-blocks (1-2 blick)**: `x14:36 -` (shortened when catching up)
3. **Start blocks (4-blick)**: Uses `[13]` for 12-minute start
4. **Continuations**: `14:24 + [wr] continue ~--- 14:39`

## Documentation

- **Full Documentation**: [`docs/README.md`](docs/README.md)
- **Language Specification**: [`docs/SPECS.md`](docs/SPECS.md)
- **Examples**: Browse [`examples/`](examples/) directory

## Development

### Run Tests

```bash
cd tests
python test_examples.py
```

### Compile Grammar

```bash
cd grammar
npx tree-sitter generate
gcc -o parser.so -shared src/parser.c -I./src -fPIC -O2
cp parser.so ../parser.so  # Copy to project root for Neovim
```

Or use the convenience script from project root:
```bash
./compile_parser.sh
```

## License

[Specify license here]

## Links

- **Documentation**: [`docs/`](docs/)
- **Examples**: [`examples/`](examples/)
- **Neovim Plugin**: [`editor/nvim/`](editor/nvim/)
- **Python Tools**: [`tools/`](tools/)
