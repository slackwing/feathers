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
require('sxiva').setup()

-- Optional: Configure Tree-sitter
require('nvim-treesitter.configs').setup {
  highlight = {
    enable = true,
    additional_vim_regex_highlighting = false,
  },
}
```

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
  - Highlighting stops after `===` end marker

- **Filetype Detection**: Automatic for `.sxiva` files

- **Commands**:
  - `:SxivaRecalculate` - Recalculate and fix all points in current file
  - `:SxivaValidate` - Validate file syntax (coming soon)

## Usage

### Recalculating Points

When you've finished adding time blocks to your `.sxiva` file:

1. Save the file (`:w`)
2. Run `:SxivaRecalculate`
3. The file will be automatically updated with correct point calculations

The command will:
- Run the Python calculator with `--fix` flag
- Update all incorrect or missing points
- Reload the buffer to show the changes
- Display a notification when complete

**Example workflow:**
```
# Edit your .sxiva file, add some blocks with wrong/missing points:
00:00 - [wr] task ~,[ts] other [3] --- 00:12 (+0=0)

# Save and recalculate:
:w
:SxivaRecalculate

# File is now updated:
00:00 - [wr] task ~,[ts] other [3] --- 00:12 (+4,+2f,+1a=7)
```

**Keyboard shortcut (optional):**

Add to your `init.lua` to map `<leader>sc` (s=sxiva, c=calculate):

```lua
vim.api.nvim_create_autocmd('FileType', {
  pattern = 'sxiva',
  callback = function()
    vim.keymap.set('n', '<leader>sc', ':SxivaRecalculate<CR>',
      { buffer = true, desc = 'Recalculate SXIVA points' })
  end,
})
```

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
