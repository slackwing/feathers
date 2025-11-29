local xml_config_path = "/Users/acheong/google-java-format.xml"

-- Set up formatprg for Java files
vim.api.nvim_create_autocmd("FileType", {
  pattern = "java",
  callback = function()
    vim.bo.formatprg = "google-java-format"
  end
})

-- Define the function to format the entire buffer in the global scope
_G.format_buffer = function()
  local view = vim.fn.winsaveview()
  vim.cmd("normal ggVG=")
  vim.fn.winrestview(view)
end

-- Set up the keybinding
vim.api.nvim_set_keymap('n', 'gf', ':lua format_buffer()<CR>', { noremap = true, silent = true })
