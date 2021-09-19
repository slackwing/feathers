" See Vundle installation guide regarding this section:

    set nocompatible              " be iMproved, required
    filetype off                  " required
    set rtp+=~/.vim/bundle/Vundle.vim
    call vundle#begin()
    Plugin 'VundleVim/Vundle.vim'
    Plugin 'leafgarland/typescript-vim'
    call vundle#end()            " required
    filetype plugin indent on    " required

"
"     Title   : andrew.cheong .vimrc
"
"     Modification History
"
"     Date    : April 27th, 2009
"     Author  : Andrew Cheong
"     Change  : New file.
"
"     Date    :
"     Author  : Andrew Cheong
"     Change  : Auto-trim trailing whitespace.
"
"     Date    :
"     Author  : Andrew Cheong
"     Change  : Added a colorscheme.
"
"     Date    : July 21st, 2017
"     Author  : Andrew Cheong
"     Change  : Silence colorscheme errors.
"
"     Date    :
"     Author  :
"     Change  :
"

" standard

    set expandtab               " et    converts tabs to spaces
    set shiftwidth=4            " sw    shift width to four spaces
    set tabstop=4               " ts    tab width to four spaces
    set softtabstop=4           " sts   backspace through tabs
    set backspace=2             " bs    backspace through all buffers
    set autoindent              " ai    automatic indentation
    set smartindent             " si    smart indentation
    set nocompatible            " nocp
    set ruler                   " ru    line and column report
    set showcmd                 " sc    partial command report
    set scrolloff=4             " so    threshold of scrolling
    set hlsearch                " hls   search highlighting
    set showmatch               " sm    briefly highlight matching parentheses

    syntax on                   "       syntax highlighting
    set bg=dark
    set t_Co=256

" extensions

    map qq :'a,'f
    map qT :set ai:set si
    map qF :set noai:set nosi
    map q8 :match ErrorMsg '\%>80v.\+'


" optional

    " set incsearch             " is    search-as-you-type
    " set ignorecase            " ic    case-insensitive search
    " set smartcase             " scs   smart extension to ic

" site-specific

    " set term=xterm-color        " term  x-term colors
    " set background=dark         " bg    adjusted colors

