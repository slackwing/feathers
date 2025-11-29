" Filetype detection for SXIVA time-tracking files
" Detects .sxiva files and sets the filetype

autocmd BufRead,BufNewFile *.sxiva setfiletype sxiva
