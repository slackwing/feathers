require("slackwing.packer")
require("slackwing.set")
require("slackwing.remap")
require("slackwing.format")
require("slackwing.telescope")
require("slackwing.alpha")

-- tmp for debugging files disappearing issue
-- vim.api.nvim_create_autocmd({"BufWritePre", "BufWritePost"}, {
--   group = vim.api.nvim_create_augroup("SaveDebug", { clear = true }),
--   callback = function(ev)
--     print(ev.event .. " " .. ev.file)
--   end,
-- })
