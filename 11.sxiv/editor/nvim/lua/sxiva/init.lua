-- SXIVA Neovim Lua module
-- Provides Tree-sitter integration and utilities

local M = {}

-- Setup function for Tree-sitter parser
function M.setup()
  -- Register the parser
  local parser_config = require("nvim-treesitter.parsers").get_parser_configs()

  -- Get path to project root (two levels up from editor/nvim)
  local nvim_dir = vim.fn.fnamemodify(debug.getinfo(1).source:sub(2), ':h:h:h')
  local project_root = vim.fn.fnamemodify(nvim_dir, ':h:h')

  parser_config.sxiva = {
    install_info = {
      url = project_root,
      files = {"grammar/src/parser.c"},
      branch = "main",
      generate_requires_npm = false,
    },
    filetype = "sxiva",
  }
end

-- Validation function (placeholder for future implementation)
function M.validate()
  print("SXIVA validation coming soon!")
  -- TODO: Implement syntax validation
  -- - Check minute sums (3-blick = 9, 4-blick = 12)
  -- - Check x-block placement
  -- - Check continuation pairs
  -- - Check rest block minutes (multiple of 12)
end

-- Point calculation function (placeholder)
function M.calculate_points()
  print("SXIVA point calculation coming soon!")
  -- TODO: Implement point calculations
  -- - Base points from time difference
  -- - Focus points
  -- - Accumulation points
end

return M
