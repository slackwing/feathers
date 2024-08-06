if type brew &>/dev/null; then
    FPATH=$(brew --prefix)/share/zsh-completions:$FPATH

    autoload -Uz compinit
    compinit -u

    source "$(brew --prefix)/opt/zsh-git-prompt/zshrc.sh"
    PROMPT='%B%m%~%b$(git_super_status) %# '
fi

################ Programs Did Everything Above ################

################ Programs Told Me To Add These ################

################         I Added These         ################

setopt no_hist_verify
source ~/.myrc
export DATASOURCE_PASSWORD='LN0d1{Rq_\bm+:hR'
export SPOTIFY_DOMAIN='gew1.spotify.net'
export OPENAI_KEY='<redacted>'
export set UUID_REGEX="([a-z0-9]{8})-?([a-z0-9]{4})-?([a-z0-9]{4})-?([a-z0-9]{4})-?([a-z0-9]{12})"
function psid() { perl -ne 's/.*'$UUID_REGEX'.*/\1\2\3\n\4\5/g && print' \
  | perl -ple 's/-//g' | while read -r hi && read -r lo ; do \
    python -c "print('{\"mostSigBits\":\"%d\",\"leastSigBits\":\"%d\"}' % (int('$hi',16),int('$lo',16)))"; done ; }

################ Program Said Put At End... No ################
eval "$(starship init zsh)"

################ Programs Did Everything Below ################


#THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
export PATH="$HOME/.jenv/bin:$PATH"
eval "$(jenv init -)"
export PATH=/opt/spotify-devex/bin:$PATH
