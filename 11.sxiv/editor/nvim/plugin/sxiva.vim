" SXIVA plugin for Neovim
" Time-tracking notation language support

if exists('g:loaded_sxiva')
  finish
endif
let g:loaded_sxiva = 1

" Plugin configuration variables
if !exists('g:sxiva_enable_folding')
  let g:sxiva_enable_folding = 0
endif

if !exists('g:sxiva_enable_treesitter')
  let g:sxiva_enable_treesitter = 1
endif

" Commands
command! -nargs=0 SxivaValidate call sxiva#validate()
command! -nargs=0 SxivaCalculate call sxiva#calculate_points()
