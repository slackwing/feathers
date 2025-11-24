-- disable netrw at the very start of your init.lua
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1
vim.opt.termguicolors = true

-- setup with some options
require("nvim-tree").setup({
  sort = {
    sorter = "case_sensitive",
  },
  view = {
    width = 36,
  },
  renderer = {
    group_empty = true,
  },
  filters = {
    dotfiles = true,
  },
  -- customizations
  update_focused_file = {
    enable = true,
  }
})

-- via Claude; toggling between 3 widths.
local next_tree_state = 1
_G.cycle_nvim_tree_state = function()
  local view = require("nvim-tree.view")
  local api = require("nvim-tree.api")
  if next_tree_state == 0 then
    if not view.is_visible() then
      api.tree.open()
    end
    view.resize(36)
    next_tree_state = 1
  elseif next_tree_state == 1 then
    if not view.is_visible() then
      api.tree.open()
    end
    view.resize(48)
    next_tree_state = 2
  else
    api.tree.close()
    next_tree_state = 0
  end
end
vim.api.nvim_set_keymap('n', '<leader>a', ':lua cycle_nvim_tree_state()<CR>', { noremap = true, silent = true })

-- added for easier navigation across panes (like the file tree)
vim.api.nvim_set_keymap('n', '<leader>w', '<C-w>w', { noremap = true, silent = true })

-- actually even better (and works with terminal plug-in too)
local opts = { noremap = true, silent = true }
vim.api.nvim_set_keymap('n', '<leader>h', '<C-w>h', opts)
vim.api.nvim_set_keymap('n', '<leader>j', '<C-w>j', opts)
vim.api.nvim_set_keymap('n', '<leader>k', '<C-w>k', opts)
vim.api.nvim_set_keymap('n', '<leader>l', '<C-w>l', opts)
-- these were stupid; breaks me out of insert mode while typing; do non-<leader>
-- vim.api.nvim_set_keymap('i', '<leader>h', '<Esc><C-w>h', opts)
-- vim.api.nvim_set_keymap('i', '<leader>j', '<Esc><C-w>j', opts)
-- vim.api.nvim_set_keymap('i', '<leader>k', '<Esc><C-w>k', opts)
-- vim.api.nvim_set_keymap('i', '<leader>l', '<Esc><C-w>l', opts)
