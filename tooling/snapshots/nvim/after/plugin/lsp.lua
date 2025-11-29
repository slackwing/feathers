-- https://github.com/VonHeikemen/lsp-zero.nvim/blob/v2.x/doc/md/guides/setup-with-nvim-jdtls.md

local lsp = require('lsp-zero')

local lsp_attach = function(client, bufnr)
  local opts = {buffer = bufnr}
  -- vim.keymap.set('n', 'ga', '<cmd>lua vim.lsp.buf.code_action()<cr>', opts)
  -- vim.keymap.set('n', 'gh', '<cmd>lua vim.lsp.buf.hover()<cr>', opts)
  -- vim.keymap.set({'n', 'x'}, 'gf', '<cmd>lua vim.lsp.buf.format({async = true})<cr>', opts)
  -- vim.keymap.set('n', 'gd', '<cmd>lua vim.lsp.buf.definition()<cr>', opts)
  -- vim.keymap.set('n', 'gD', '<cmd>lua vim.lsp.buf.declaration()<cr>', opts)
  -- vim.keymap.set('n', 'gi', '<cmd>lua vim.lsp.buf.implementation()<cr>', opts)
  -- vim.keymap.set('n', 'go', '<cmd>lua vim.lsp.buf.type_definition()<cr>', opts)
  -- vim.keymap.set('n', 'gr', '<cmd>lua vim.lsp.buf.references()<cr>', opts)
  -- vim.keymap.set('n', 'gs', '<cmd>lua vim.lsp.buf.signature_help()<cr>', opts)
  -- vim.keymap.set('n', '<F6>', '<cmd>lua vim.lsp.buf.rename()<cr>', opts)
  vim.keymap.set('n', '<leader>d', '<cmd>lua vim.lsp.buf.definition()<cr>', opts)
  vim.keymap.set('n', '<leader>D', '<cmd>lua vim.lsp.buf.declaration()<cr>', opts)
  vim.keymap.set('n', '<leader>i', '<cmd>lua vim.lsp.buf.implementation()<cr>', opts)
  vim.keymap.set('n', '<leader>t', '<cmd>lua vim.lsp.buf.type_definition()<cr>', opts)
  vim.keymap.set('n', '<leader>r', '<cmd>lua vim.lsp.buf.references()<cr>', opts)
  vim.keymap.set('n', '<leader>s', '<cmd>lua vim.lsp.buf.signature_help()<cr>', opts)
  vim.keymap.set('n', '<F6>', '<cmd>lua vim.lsp.buf.rename()<cr>', opts)
  vim.keymap.set('n', '<leader><cr>', '<cmd>lua vim.lsp.buf.code_action()<cr>', opts)
end

lsp.extend_lspconfig({
  sign_text = true,
  lsp_attach = lsp_attach,
  capabilities = require('cmp_nvim_lsp').default_capabilities(),
})

-- Failed attempt at switching to nvim-java which is not compat with nvim-jdtls.
-- require('java').setup()

-- require('lspconfig').jdtls.setup({})

local cmp = require('cmp')

cmp.setup({
  sources = {
    {name = 'nvim_lsp'},
  },
  snippet = {
    expand = function(args)
      vim.snippet.expand(args.body)
    end,
  },
  mapping = cmp.mapping.preset.insert({}),
})

lsp.setup()

vim.diagnostic.config({
  virtual_text = false,
})
vim.api.nvim_set_keymap(
  'n', 'ee', ':lua vim.diagnostic.open_float()<CR>', 
  { noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
  'n', 'e]', ':lua vim.diagnostic.goto_next()<CR>',
  { noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
  'n', 'e[', ':lua vim.diagnostic.goto_prev()<CR>',
  { noremap = true, silent = true }
)
