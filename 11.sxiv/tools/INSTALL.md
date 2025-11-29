# SXIVA CLI Installation

## Installation

### Option 1: Use the wrapper script (easiest)

A `sxiva` shell script is provided in the repository root. Just symlink it to your PATH:

```bash
ln -s /path/to/11.sxiv/sxiva ~/bin/sxiva
# or
ln -s /path/to/11.sxiv/sxiva ~/.local/bin/sxiva
```

Make sure `~/bin` or `~/.local/bin` is in your PATH.

### Option 2: Install with pip

```bash
cd /path/to/11.sxiv/tools
pip install -e .
```

This will install the `sxiva` command globally.

### Option 3: Run directly from source

You can run the CLI directly without installing:

```bash
cd /path/to/11.sxiv/tools
python3 -m sxiva.cli [command]
```

### Option 4: Add alias to PATH

Add an alias to your shell config (`.bashrc`, `.zshrc`, etc.):

```bash
alias sxiva='python3 -m sxiva.cli'
```

Or create a shell script in your PATH:

```bash
#!/bin/bash
cd /path/to/11.sxiv/tools
python3 -m sxiva.cli "$@"
```

Save as `~/bin/sxiva` and make it executable:
```bash
chmod +x ~/bin/sxiva
```

## Setup

### 1. Set SXIVA_DATA environment variable

Add to your shell config (`.bashrc`, `.zshrc`, etc.):

```bash
export SXIVA_DATA="$HOME/sxiva"  # or wherever you want to store files
```

Create the directory:
```bash
mkdir -p $SXIVA_DATA
```

### 2. Set EDITOR environment variable (optional)

The default is `vi`, but you probably want:

```bash
export EDITOR=nvim  # or vim, nano, emacs, code --wait, etc.
```

## Usage

### Quick start: Open today's file

Just run:
```bash
sxiva
```

This will:
- Check for a file matching today's date (YYYYMMDD*)
- If found, open it
- If not found, create a new file with format: `YYYYMMDDd.sxiva`
  - Where `d` is the day of week: `U M T W R F S` (Sunday to Saturday)
- Open in your `$EDITOR`

**Examples:**
- Monday, Nov 25, 2025: `20251125M.sxiva`
- Saturday, Nov 29, 2025: `20251129S.sxiva`
- Sunday, Nov 30, 2025: `20251130U.sxiva`

### Calculate points for a file

```bash
sxiva calculate file.sxiva              # Check for errors
sxiva calculate file.sxiva --fix        # Fix all calculations
sxiva calculate file.sxiva -o out.sxiva # Fix to different file
```

## Workflow

Typical daily workflow:

```bash
# Morning: open today's timesheet
sxiva

# (Work on tasks, add blocks to your .sxiva file)
# In Neovim: press ;s to recalculate points

# Evening: done!
# File is automatically saved with calculations
```

## Troubleshooting

### "SXIVA_DATA environment variable not set"

Make sure you've added `export SXIVA_DATA=/path/to/dir` to your shell config and reloaded it:
```bash
source ~/.bashrc  # or ~/.zshrc
```

### "SXIVA_DATA directory does not exist"

Create the directory:
```bash
mkdir -p $SXIVA_DATA
```

### "Editor not found"

Set your EDITOR environment variable:
```bash
export EDITOR=nvim
```

### Command not found: sxiva

If you installed with pip, make sure `~/.local/bin` is in your PATH:
```bash
export PATH="$HOME/.local/bin:$PATH"
```

Or use the direct invocation:
```bash
python3 -m sxiva.cli
```
