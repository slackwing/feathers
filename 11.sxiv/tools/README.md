# SXIVA Tools

CLI tools for working with SXIVA time-tracking files.

## Installation

### Prerequisites

You need to install the `tree-sitter` Python package:

**On Arch Linux:**
```bash
# Install via yay (requires sudo password)
yay -S python-tree-sitter
```

**On other systems:**
```bash
pip install tree-sitter
```

### Install SXIVA Tools

```bash
cd sxiva-tools
python3 -m pip install -e .
```

Or run directly without installing:
```bash
cd sxiva-tools
python3 -m sxiva.cli calculate path/to/file.sxiva
```

## Usage

### Calculate and verify points

```bash
# Check for incorrect points
sxiva calculate input.sxiva

# Fix incorrect points in place
sxiva calculate input.sxiva --fix
```

### Examples

```bash
# Check an example file
sxiva calculate ../examples/basic.sxiva

# Fix all point calculations automatically
sxiva calculate ../examples/basic.sxiva --fix
```

## Features

- **Point Calculation**: Automatically calculates points based on SXIVA rules
- **Sequential State Machine**: Walks file top-to-bottom, maintaining accumulation, focus, and running totals
- **Fix Mode**: Overwrites incorrect point calculations with correct values
- **Base Calculations**: Duration / 10, rounded down (negative points)
- **Focus Bonuses**: +2 per matching focus category
- **Accumulation System**: 0-10 counter, adds bonus points, resets on negative/rest/break
- **Rest & Break Handling**: Automatically resets accumulation to 0

## Testing

The calculation logic has been tested independently:

```bash
cd sxiva-tools
python3 test_manual.py
```

All tests pass:
- Basic point calculation
- Focus category bonuses
- Accumulation mechanics
- Time duration parsing
- Points notation parsing
