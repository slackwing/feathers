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

-- Point calculation function - recalculates and updates buffer directly
function M.recalculate()
  local filepath = vim.fn.expand('%:p')

  -- Check if current file is a .sxiva file
  if not filepath:match('%.sxiva$') then
    vim.notify('Not a .sxiva file', vim.log.levels.ERROR)
    return
  end

  -- Auto-save if modified
  if vim.bo.modified then
    vim.cmd('silent write')
  end

  -- Get path to Python CLI (assume it's in the project)
  local nvim_dir = vim.fn.fnamemodify(debug.getinfo(1).source:sub(2), ':h:h:h')
  local project_root = vim.fn.fnamemodify(nvim_dir, ':h:h')

  -- Use a temporary file for output
  local temp_file = vim.fn.tempname() .. '.sxiva'

  -- Run the Python CLI calculator with --fix flag, output to temp file
  local cmd = string.format('cd "%s" && python3 -m tools.sxiva.cli calculate "%s" --fix -o "%s"',
                           project_root,
                           filepath,
                           temp_file)

  vim.notify('Recalculating points...', vim.log.levels.INFO)

  -- Run command asynchronously
  vim.fn.jobstart(cmd, {
    on_exit = function(_, exit_code, _)
      if exit_code == 0 then
        -- Read the temp file and update buffer directly
        local file = io.open(temp_file, 'r')
        if file then
          local content = file:read('*all')
          file:close()

          -- Split into lines
          local lines = {}
          for line in content:gmatch('([^\n]*)\n?') do
            table.insert(lines, line)
          end
          -- Remove last empty line if present
          if lines[#lines] == '' then
            table.remove(lines)
          end

          -- Update buffer
          vim.api.nvim_buf_set_lines(0, 0, -1, false, lines)

          -- Clean up temp file
          os.remove(temp_file)

          vim.notify('✓ Points recalculated', vim.log.levels.INFO)

          -- Auto-save after recalculation
          vim.cmd('silent write')
        else
          vim.notify('Error reading temp file', vim.log.levels.ERROR)
        end
      else
        vim.notify('Error recalculating points', vim.log.levels.ERROR)
        -- Clean up temp file on error
        os.remove(temp_file)
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

-- Log now function - sets last entry end time to current time
function M.log_now()
  local filepath = vim.fn.expand('%:p')

  -- Check if current file is a .sxiva file
  if not filepath:match('%.sxiva$') then
    return
  end

  -- Get path to Python CLI (assume it's in the project)
  local nvim_dir = vim.fn.fnamemodify(debug.getinfo(1).source:sub(2), ':h:h:h')
  local project_root = vim.fn.fnamemodify(nvim_dir, ':h:h')

  -- Use a temporary file
  local temp_file = vim.fn.tempname() .. '.sxiva'

  -- Write current buffer to temp file
  local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
  local file = io.open(temp_file, 'w')
  if file then
    file:write(table.concat(lines, '\n') .. '\n')
    file:close()
  end

  -- Run the Python CLI log-now command on temp file (modifies in place)
  local cmd = string.format('cd "%s" && python3 -m tools.sxiva.cli log-now "%s" > /dev/null 2>&1',
                           project_root,
                           temp_file)

  vim.fn.system(cmd)

  -- Read the temp file and update buffer
  file = io.open(temp_file, 'r')
  if file then
    local content = file:read('*all')
    file:close()

    -- Split into lines
    local updated_lines = {}
    for line in content:gmatch('([^\n]*)\n?') do
      table.insert(updated_lines, line)
    end
    -- Remove last empty line if present
    if updated_lines[#updated_lines] == '' then
      table.remove(updated_lines)
    end

    -- Update buffer
    vim.api.nvim_buf_set_lines(0, 0, -1, false, updated_lines)

    -- Clean up temp file
    os.remove(temp_file)

    vim.notify('✓ Logged current time', vim.log.levels.INFO)

    -- Now recalculate points (schedule to avoid blocking prompt)
    vim.schedule(function()
      M.recalculate()
    end)
  else
    vim.notify('Error reading temp file', vim.log.levels.ERROR)
    os.remove(temp_file)
  end
end

-- Log end function - cleans up last incomplete entry and logs current time
function M.log_end()
  local filepath = vim.fn.expand('%:p')

  -- Check if current file is a .sxiva file
  if not filepath:match('%.sxiva$') then
    return
  end

  -- Get path to Python CLI (assume it's in the project)
  local nvim_dir = vim.fn.fnamemodify(debug.getinfo(1).source:sub(2), ':h:h:h')
  local project_root = vim.fn.fnamemodify(nvim_dir, ':h:h')

  -- Use a temporary file
  local temp_file = vim.fn.tempname() .. '.sxiva'

  -- Write current buffer to temp file
  local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
  local file = io.open(temp_file, 'w')
  if file then
    file:write(table.concat(lines, '\n') .. '\n')
    file:close()
  end

  -- Run the Python CLI log-end command on temp file (modifies in place)
  local cmd = string.format('cd "%s" && python3 -m tools.sxiva.cli log-end "%s" > /dev/null 2>&1',
                           project_root,
                           temp_file)

  vim.fn.system(cmd)

  -- Read the temp file and update buffer
  file = io.open(temp_file, 'r')
  if file then
    local content = file:read('*all')
    file:close()

    -- Split into lines
    local updated_lines = {}
    for line in content:gmatch('([^\n]*)\n?') do
      table.insert(updated_lines, line)
    end
    -- Remove last empty line if present
    if updated_lines[#updated_lines] == '' then
      table.remove(updated_lines)
    end

    -- Update buffer
    vim.api.nvim_buf_set_lines(0, 0, -1, false, updated_lines)

    -- Clean up temp file
    os.remove(temp_file)

    vim.notify('✓ Logged end time', vim.log.levels.INFO)

    -- Now recalculate points (schedule to avoid blocking prompt)
    vim.schedule(function()
      M.recalculate()
    end)
  else
    vim.notify('Error reading temp file', vim.log.levels.ERROR)
    os.remove(temp_file)
  end
end

-- Repeat entry function - duplicates last entry with +12 min start time
function M.repeat_entry()
  local filepath = vim.fn.expand('%:p')

  -- Check if current file is a .sxiva file
  if not filepath:match('%.sxiva$') then
    return
  end

  -- Get path to Python CLI (assume it's in the project)
  local nvim_dir = vim.fn.fnamemodify(debug.getinfo(1).source:sub(2), ':h:h:h')
  local project_root = vim.fn.fnamemodify(nvim_dir, ':h:h')

  -- Use a temporary file
  local temp_file = vim.fn.tempname() .. '.sxiva'

  -- Write current buffer to temp file
  local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
  local file = io.open(temp_file, 'w')
  if file then
    file:write(table.concat(lines, '\n') .. '\n')
    file:close()
  end

  -- Run the Python CLI repeat-entry command on temp file (modifies in place)
  local cmd = string.format('cd "%s" && python3 -m tools.sxiva.cli repeat-entry "%s" 2>&1',
                           project_root,
                           temp_file)

  local result = vim.fn.system(cmd)
  local exit_code = vim.v.shell_error

  if exit_code ~= 0 then
    vim.notify('Error: ' .. result, vim.log.levels.ERROR)
    os.remove(temp_file)
    return
  end

  -- Read the temp file and update buffer
  file = io.open(temp_file, 'r')
  if file then
    local content = file:read('*all')
    file:close()

    -- Split into lines
    local updated_lines = {}
    for line in content:gmatch('([^\n]*)\n?') do
      table.insert(updated_lines, line)
    end
    -- Remove last empty line if present
    if updated_lines[#updated_lines] == '' then
      table.remove(updated_lines)
    end

    -- Update buffer
    vim.api.nvim_buf_set_lines(0, 0, -1, false, updated_lines)

    -- Clean up temp file
    os.remove(temp_file)

    vim.notify('✓ Created repeat entry', vim.log.levels.INFO)
  else
    vim.notify('Error reading temp file', vim.log.levels.ERROR)
    os.remove(temp_file)
  end
end

return M
