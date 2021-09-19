## Tooling

1. Install `zsh`:
    - https://github.com/ohmyzsh/ohmyzsh#basic-installation
    - https://github.com/romkatv/powerlevel10k#manual
    - https://github.com/romkatv/powerlevel10k#meslo-nerd-font-patched-for-powerlevel10k
1. `echo setopt no_hist_verify >> ~/.zshrc`
1. `git config --global diff.context 0`.
1. `brew install watch`
1. `brew install gnu-sed`
    - OSX `sed` can't do `| sed 's/\\n/\n/g'`.
    - `yo() { $@ 2>&1 | gsed 's/\\n/\n/g' | gsed 's/\\t/\t/g' }`
    - `yo !!`

### .myrc

    alias x='vim ~/.myrc'
    alias y='source ~/.myrc'
    alias z='cat ~/.myrc'
    
    alias h='history'
    alias hg='history | grep'
    alias ll='ls -alohF'
    alias lt='ls -lt | head -n 10'
    
    alias gq='git add . ; git diff --staged ; git commit -m"fix"'
    alias greset='git checkout -- .' # as opposed to stashing
    
    alias cc='mvn clean compile test-compile'
    alias mi='mvn install -DskipTests'
    alias mip='mvn install package -DskipTests'

### Log

_**2020 Aug 07.** Let's give zsh a shot. There's no reason not to. I can always develop shell scripts in and for bash if I wanted to._

_**2020 Jul 27.** Choosing [Tcl](https://en.wikipedia.org/wiki/Tcl) over [Python](https://en.wikipedia.org/wiki/Python_(programming_language)) because (1) it's ridiculously [minimal](https://www.tcl.tk/man/tcl8.6/TclCmd/contents.htm), (2) it's remained the same (8.x) since 1997, and (3) it's a unique language to practice in 2020, I think._
