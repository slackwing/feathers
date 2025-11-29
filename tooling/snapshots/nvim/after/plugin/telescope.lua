require('nvim-web-devicons').setup {
  default = true;
}
vim.cmd([[highlight TelescopeNormal guifg=#cbe3e7 guibg=#282c34]])
local builtin = require('telescope.builtin')
vim.keymap.set('n', '<leader>f', function()
  builtin.find_files({
    path_display = {filename_first = {reverse_directories = true}},
    color_devicons = true,
  })
end, {})
vim.keymap.set('n', '<C-p>', builtin.git_files, {}) -- TODO: Learn and decide.
vim.keymap.set('n', '<leader>/', function()
	builtin.grep_string({
    path_display = {filename_first = {reverse_directories = true}},
    search = vim.fn.input("Search: ")
  });
end)
vim.keymap.set("n", "<leader><leader>", function()
  require('telescope').extensions.recent_files.pick({
    path_display = {filename_first = {reverse_directories = true}},
    only_cwd = true,
  })
end, { noremap = true, silent = true })
vim.keymap.set('n', '<leader>m', function()
  builtin.lsp_document_symbols({
    sorting_strategy = 'ascending',
    previewer = false,
    symbol_width = 100,
  })
end, {})
