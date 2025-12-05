" SXIVA filetype plugin
" This runs when a .sxiva file is opened

if exists('b:did_ftplugin')
  finish
endif
let b:did_ftplugin = 1

" Comment string for commentify plugins
setlocal commentstring=#\ %s

" Enable Tree-sitter highlighting if available
if exists('g:sxiva_enable_treesitter') && g:sxiva_enable_treesitter
  if has('nvim-0.5') && luaeval("pcall(require, 'nvim-treesitter')")
    setlocal syntax=off
    lua require'nvim-treesitter.configs'.setup { highlight = { enable = true } }
  endif
endif

" Define highlight groups
highlight default link SxivaError ErrorMsg
highlight default link SxivaTime Type

" Highlight error messages and c section content using matchadd (works with tree-sitter)
" This runs after tree-sitter highlighting
augroup SxivaHighlights
  autocmd! * <buffer>
  autocmd BufEnter,TextChanged,TextChangedI <buffer> call s:HighlightSpecial()
augroup END

function! s:HighlightSpecial()
  " Clear previous matches for this window
  if exists('w:sxiva_error_match')
    silent! call matchdelete(w:sxiva_error_match)
    unlet w:sxiva_error_match
  endif
  if exists('w:sxiva_date_match')
    silent! call matchdelete(w:sxiva_date_match)
    unlet w:sxiva_date_match
  endif
  if exists('w:sxiva_time_match')
    silent! call matchdelete(w:sxiva_time_match)
    unlet w:sxiva_time_match
  endif

  " Highlight [ERROR] messages
  if search('\[ERROR\]', 'nw') > 0
    let w:sxiva_error_match = matchadd('SxivaError', '\[ERROR\].*', 10)
  endif

  " Highlight date header in yellow (overrides tree-sitter which may not be yellow in all themes)
  " Pattern: DayOfWeek, Month Day(st/nd/rd/th), Year
  let w:sxiva_date_match = matchadd('SxivaTime', '^\(Sunday\|Monday\|Tuesday\|Wednesday\|Thursday\|Friday\|Saturday\), \(January\|February\|March\|April\|May\|June\|July\|August\|September\|October\|November\|December\) \d\{1,2\}\(st\|nd\|rd\|th\), \d\{4\}', 10)

  " Highlight times at end of freeform/summary lines in yellow
  " Pattern: match HH:MM at end of line after [category]
  " This overrides tree-sitter @number/@type which may not be yellow
  let w:sxiva_time_match = matchadd('SxivaTime', '^\s*\[[^\]]\+\].*\zs\d\{2\}:\d\{2\}\ze\s*$', 10)
endfunction

" Initial highlight
call s:HighlightSpecial()

" Indentation settings
setlocal expandtab
setlocal tabstop=2
setlocal shiftwidth=2
setlocal softtabstop=2

" Folding (optional)
if exists('g:sxiva_enable_folding') && g:sxiva_enable_folding
  setlocal foldmethod=expr
  setlocal foldexpr=getline(v:lnum)=~'^;;;'?'>1':'='
endif

" Let Vim know this is done
let b:undo_ftplugin = "setlocal commentstring< expandtab< tabstop< shiftwidth< softtabstop<"
