vim.g.mapleader = " "
vim.keymap.set("n", "<leader>q", vim.cmd.Ex)

-- These are not overriding any existing functionality.
vim.keymap.set('n', '<A-]>', '<C-I>', { noremap = true, silent = true })
vim.keymap.set('n', '<A-[>', '<C-O>', { noremap = true, silent = true })
