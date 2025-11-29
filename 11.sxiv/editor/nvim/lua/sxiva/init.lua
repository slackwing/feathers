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

-- Point calculation function - runs Python CLI calculator
function M.recalculate()
  local filepath = vim.fn.expand('%:p')

  -- Check if current file is a .sxiva file
  if not filepath:match('%.sxiva$') then
    vim.notify('Not a .sxiva file', vim.log.levels.ERROR)
    return
  end

  -- Check if file has been saved
  if vim.bo.modified then
    vim.notify('Please save file first', vim.log.levels.WARN)
    return
  end

  -- Get path to Python CLI (assume it's in the project)
  local nvim_dir = vim.fn.fnamemodify(debug.getinfo(1).source:sub(2), ':h:h:h')
  local project_root = vim.fn.fnamemodify(nvim_dir, ':h:h')

  -- Run the Python CLI calculator with --fix flag
  local cmd = string.format('cd "%s" && python3 -m tools.sxiva.cli calculate "%s" --fix',
                           project_root,
                           filepath)

  vim.notify('Recalculating points...', vim.log.levels.INFO)

  -- Run command asynchronously
  vim.fn.jobstart(cmd, {
    on_exit = function(_, exit_code, _)
      if exit_code == 0 then
        -- Reload the buffer to show updated points
        vim.cmd('silent! edit!')
        vim.notify('✓ Points recalculated', vim.log.levels.INFO)
      else
        vim.notify('Error recalculating points', vim.log.levels.ERROR)
      end
    end,
    on_stderr = function(_, data, _)
      if data and #data > 0 then
        local err = table.concat(data, '\n')
        if err:match('%S') then
          vim.notify('Calculator error: ' .. err, vim.log.levels.ERROR)
        end
      end
    end,
  })
end

-- Legacy function for backward compatibility
function M.calculate_points()
  M.recalculate()
end

return M
