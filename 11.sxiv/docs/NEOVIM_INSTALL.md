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
  - `:Sxiv` - Recalculate and fix all points in current file
  - `:SxivaRecalculate` - (alias for `:Sxiv`)
  - `:SxivaValidate` - Validate file syntax (coming soon)

- **Keybinding**:
  - `<leader>ss` - Recalculate points (only in .sxiva files)

## Usage

### Recalculating Points

When you've finished adding time blocks to your `.sxiva` file:

1. Run `:Sxiv` or press `<leader>ss` (or `;s`)
2. The buffer will be automatically updated with correct point calculations
3. Save when ready (`:w`)

The command will:
- Auto-save the file if there are unsaved changes
- Run the Python calculator with `--fix` flag
- Update the buffer directly (no reload needed)
- Mark the buffer as modified so you can review before saving
- Display a notification when complete

**Example workflow:**
```
# Edit your .sxiva file, add some blocks without points:
00:00 - [wr] task ~,[ts] other [3] --- 00:12

# Recalculate (auto-saves first):
:Sxiv
# Or press: ;s

# Buffer is updated immediately:
00:00 - [wr] task ~,[ts] other [3] --- 00:12 (+4,+2f,+1a=7)

# Save when you're happy with the result:
:w
```

**Default keybinding:** `<leader>ss` (only active in .sxiva files)
- `<leader>` is typically `\` or `<Space>` depending on your config
- So: `<Space>ss` or `\ss` to recalculate

**Custom keybinding:**

If you want a different key, add to your `init.lua`:

```lua
vim.api.nvim_create_autocmd('FileType', {
  pattern = 'sxiva',
  callback = function(args)
    -- Change <leader>ss to whatever you prefer
    vim.keymap.set('n', '<leader>sc', ':Sxiv<CR>',
      { buffer = args.buf, desc = 'Recalculate SXIVA points', silent = true })
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
