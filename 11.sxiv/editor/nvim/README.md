# SXIVA Neovim Plugin Installation

This guide shows how to install and configure the SXIVA Tree-sitter parser and syntax highlighting in Neovim.

## Prerequisites

- Neovim 0.9+ (for Tree-sitter support)
- [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter) plugin installed

## Installation

### Using lazy.nvim

Add to your `lazy.nvim` configuration:

```lua
{
  "tree-sitter-sxiva",
  dir = "~/src/feathers/11.sxiv", -- Adjust path to your installation
  config = function()
    require('sxiva').setup()
  end,
  ft = "sxiva", -- Load only for .sxiva files
}
```

### Using packer.nvim

```lua
use {
  '~/src/feathers/11.sxiv', -- Local path
  config = function()
    require('sxiva').setup()
  end,
  ft = 'sxiva',
}
```

### Manual Installation

1. Clone or symlink this repository to your Neovim plugins directory:

```bash
# For Neovim with lazy.nvim or packer
ln -s ~/src/feathers/11.sxiv ~/.local/share/nvim/site/pack/plugins/start/sxiva

# Or for traditional vim-plug
ln -s ~/src/feathers/11.sxiv ~/.config/nvim/plugged/sxiva
```

2. Generate the parser:

```bash
cd ~/src/feathers/11.sxiv
npx tree-sitter generate
```

3. In Neovim, run:

```vim
:TSInstall sxiva
```

## Configuration

Add to your `init.lua`:

```lua
-- Load the sxiva plugin
require('sxiva').setup()

-- After setup, you need to install the parser once:
-- :TSInstall sxiva
```

**Important:** After adding this to your config, restart Neovim and run:
```vim
:TSInstall sxiva
```

This will compile and install the parser. You only need to do this once (or after updating the grammar).

## Verification

1. Open a `.sxiva` file in Neovim
2. Check syntax highlighting is active:
   ```vim
   :echo &filetype
   " Should output: sxiva

   :TSBufEnable highlight
   " Should enable Tree-sitter highlighting
   ```

3. View the syntax tree:
   ```vim
   :TSPlaygroundToggle
   ```

## Features

- **Syntax Highlighting**: Full semantic highlighting via Tree-sitter
  - Times, categories, subjects, points all colored appropriately
  - Special colors for `[wr]`, `[err]`, `[sp/*]`, `[...]` categories

- **Filetype Detection**: Automatic for `.sxiva` files

- **Commands** (coming soon):
  - `:SxivaValidate` - Validate file syntax
  - `:SxivaCalculate` - Calculate points

## Troubleshooting

### Parser not loading

Check Tree-sitter can find the parser:

```vim
:echo nvim_treesitter#get_parser_configs().sxiva
```

### No syntax highlighting

1. Ensure Tree-sitter is enabled:
   ```vim
   :TSBufEnable highlight
   ```

2. Check queries are loaded:
   ```vim
   :echo findfile('after/queries/sxiva/highlights.scm', &runtimepath)
   ```

3. Verify parser is compiled:
   ```bash
   ls ~/src/feathers/11.sxiv/src/parser.c
   ```

### Regenerate parser

```bash
cd ~/src/feathers/11.sxiv
npx tree-sitter generate
```

## Color Scheme Compatibility

The highlighting uses standard Tree-sitter capture groups that work with most color schemes:

- `@keyword` - Keywords (focus, x)
- `@number` - Times and minute values
- `@type` - Categories
- `@string` - Subject descriptions
- `@operator` - Block markers (---, etc.)
- `@punctuation` - Brackets, commas
- `@comment` - # comments

## Next Steps

See `SPECS.md` for complete SXIVA language specification.
