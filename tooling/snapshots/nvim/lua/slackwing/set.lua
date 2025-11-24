local g = vim.g
local opt = vim.opt
local wo = vim.wo

opt.expandtab = true
opt.shiftwidth = 2
opt.tabstop = 2
opt.softtabstop= 2
opt.backspace = indent,eol,start
opt.autoindent = true
opt.smartindent = true
opt.hlsearch = false -- try without for a while
opt.showmatch = true

-- From https://www.youtube.com/watch?v=w7i4amO_zaE @ 22:45

opt.guicursor = ""
opt.nu = true
opt.relativenumber = true
opt.wrap = false
opt.swapfile = false
opt.backup = false
opt.undodir = os.getenv("HOME") .. "/.vim/undodir"
opt.undofile = true
opt.incsearch = true
opt.termguicolors = true
opt.scrolloff = 8
opt.signcolumn = "yes"
opt.isfname:append("@-@")
opt.updatetime = 50
opt.colorcolumn = "100"
g.mapleader = " "

-- Use system clipboard for yank
vim.keymap.set('n','y','"+y')
vim.keymap.set('n','yy','"+yy')
vim.keymap.set('n','Y','"+Y')
vim.keymap.set('x','y','"+y')

-- Don't use clipboard at all for...
vim.keymap.set('n','d','"_d');
vim.keymap.set('n','dd','"_dd');
vim.keymap.set('n','D','"_D');
vim.keymap.set('x','d','"_d');
vim.keymap.set('x','D','"_D');
vim.keymap.set('n','x','"_x');
vim.keymap.set('x','x','"_x');

-- Use 'cc' (for "cut") for original 'dd' behavior
vim.keymap.set('n','cc','"+dd');

-- Navigation remappings
vim.api.nvim_set_keymap('i', '<C-j>', '<C-o><C-e>', { noremap = true, silent = true })
vim.api.nvim_set_keymap('i', '<C-k>', '<C-o><C-y>', { noremap = true, silent = true })
vim.api.nvim_set_keymap('n', '<C-j>', '<C-e>', { noremap = true, silent = true })
vim.api.nvim_set_keymap('n', '<C-k>', '<C-y>', { noremap = true, silent = true })

-- Helpers for writing
vim.keymap.set('v', '<leader>fb', "c**<C-r>\"**<Esc>", { desc = "Surround with bold (**)" })
vim.keymap.set('v', '<leader>fi', "c_<C-r>\"_<Esc>", { desc = "Surround with italic (_)" })
vim.keymap.set('v', '<leader>fc', "c`<C-r>\"`<Esc>", { desc = "Surround with code (`)" })
vim.keymap.set('n', '<leader>fq', function()
  vim.cmd('%s/[“”]/"/g')
  vim.cmd('%s/[‘’]/\'/g')
end, { desc = "Replace smart quotes with straight quotes" })

-- Disable mouse.
opt.mouse = ""
