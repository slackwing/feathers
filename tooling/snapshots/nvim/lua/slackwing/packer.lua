--- This file can be loaded by calling `lua require('plugins')` from your init.vim

-- Only required if you have packer configured as `opt`
vim.cmd [[packadd packer.nvim]]

return require('packer').startup(function(use)
  -- Packer can manage itself
  use 'wbthomason/packer.nvim'

  use {
    -- 'nvim-telescope/telescope.nvim', tag = '0.1.8',
    -- temporarily using 'master' to fix filename_first
	  'nvim-telescope/telescope.nvim', branch = 'master',
	  requires = { {'nvim-lua/plenary.nvim'} }
  }

  -- good for synthwavey feel but felt like everything was bold
  -- font is controlled through iterm session
  -- use { 'embark-theme/vim',
  --     as = 'embark',
  --   config = function()
  --     vim.cmd('colorscheme embark')
  --   end
  -- }

  -- primeagen's colorscheme
  -- use { 'rose-pine/neovim',
  --     as = 'rose-pine',
  --   config = function()
  --     vim.cmd('colorscheme rose-pine')
  --   end
  -- }

  -- use { '0xstepit/flow.nvim',
  --     as = 'flow',
  --   config = function()
  --     vim.cmd('colorscheme flow')
  --   end
  -- }

  -- use { 'fcancelinha/nordern.nvim',
  --     as = 'nordern',
  --   config = function()
  --     vim.cmd('colorscheme nordern')
  --   end
  -- }
  
  -- use { 'rafi/awesome-vim-colorschemes',
  --     as = 'awesome-vim-colorschemes',
  --   config = function()
  --     vim.cmd('colorscheme hybrid_material')
  --   end
  -- }

  -- use { 'sainnhe/everforest',
  --     as = 'everforest',
  --   config = function()
  --     vim.cmd('colorscheme everforest')
  --   end
  -- }
  
  use { 'rmehri01/onenord.nvim',
      as = 'onenord',
    config = function()
      vim.cmd('colorscheme onenord')
      -- Change background color in some directories.
      _G.ChangeBackgroundColor = function()
        local dir = vim.fn.getcwd()
        if dir:match("^/Users/acheong/src/tmp/") then
          vim.cmd('highlight Normal guibg=#662D34')
        else
          -- onenord's default guibg
          vim.cmd('highlight Normal guibg=#2D3441')
        end
      end
      vim.cmd([[
        augroup ChangeBackgroundColor
          autocmd!
          autocmd BufEnter * lua ChangeBackgroundColor()
        augroup END
      ]])
    end
  }

  use('nvim-treesitter/nvim-treesitter', {run = ':TSUpdate'})
  use('theprimeagen/harpoon')
  use('mbbill/undotree')
  use('tpope/vim-fugitive')

  -- Above from Primeagen's video; below beyond.
  
  use('williamboman/mason.nvim')
  use('williamboman/mason-lspconfig.nvim')
  use({'VonHeikemen/lsp-zero.nvim', branch = 'v4.x'})
  use({'neovim/nvim-lspconfig'})
  use({'hrsh7th/nvim-cmp'})
  use({'hrsh7th/cmp-nvim-lsp'})
  use('mfussenegger/nvim-jdtls')
  -- use('nvim-java/nvim-java') -- Failed attempt.
  -- use({
  --   "okuuva/auto-save.nvim",
  --   config = function()
  --     require("auto-save").setup {}
  --   end,
  -- })
  use 'nvim-tree/nvim-web-devicons'
  use {"smartpde/telescope-recent-files"}
  use {
    'nvim-tree/nvim-tree.lua',
    requires = {
      'nvim-tree/nvim-web-devicons',
    }
  }
  use {'FabijanZulj/blame.nvim',
    config = function()
      require("blame").setup()
    end
  }
  use {"akinsho/toggleterm.nvim", tag = '*'}
  use 'tpope/vim-abolish'
  use {
    'goolord/alpha-nvim',
    requires = { 'echasnovski/mini.icons' },
    config = function ()
      require'alpha'.setup(require'alpha.themes.startify'.config)
    end
  }

end)

