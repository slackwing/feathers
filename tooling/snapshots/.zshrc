if type brew &>/dev/null; then
    FPATH=$(brew --prefix)/share/zsh-completions:$FPATH

    autoload -Uz compinit
    compinit -u

    source "$(brew --prefix)/opt/zsh-git-prompt/zshrc.sh"
    PROMPT='%B%m%~%b$(git_super_status) %# '
fi

################ Programs Did Everything Above ################

################ Programs Told Me To Add These ################

export PYENV_ROOT="$HOME/.pyenv"
eval "$(pyenv init -)"

export CLAUDE_CODE_USE_VERTEX=1
export ANTHROPIC_SMALL_FAST_MODEL='claude-3-5-haiku@20241022'
export CLOUD_ML_REGION='europe-west1'
export VERTEX_REGION_CLAUDE_4_0_OPUS='europe-west4'
export VERTEX_REGION_CLAUDE_4_5_SONNET='global'
export ANTHROPIC_VERTEX_PROJECT_ID=spotify-claude-code-trial

################         I Added These         ################

setopt no_hist_verify
source ~/.myrc
export SPRING_CLOUD_GCP_SQL_ENABLED='true'
export SPRING_CLOUD_GCP_SQL_INSTANCECONNECTIONNAME='spotify-ads-api:europe-west1:ads-api-data-model-sandbox'
export DATAMODEL_DATASOURCE_URL='jdbc:postgresql://localhost:5433/data-model'
export SALESFORCE_USERNAME=adstudio.integration@spotify.com.fullcopy
export SPOTIFYB2B_SALESFORCE_PORTCULLIS_TOKEN_PROD='dummy'
export SPOTIFY_DOMAIN='gew1.spotify.net'
export OPENAI_KEY='<redacted>'
export set UUID_REGEX="([a-z0-9]{8})-?([a-z0-9]{4})-?([a-z0-9]{4})-?([a-z0-9]{4})-?([a-z0-9]{12})"
function psid() { perl -ne 's/.*'$UUID_REGEX'.*/\1\2\3\n\4\5/g && print' \
  | perl -ple 's/-//g' | while read -r hi && read -r lo ; do \
    python -c "print('{\"mostSigBits\":\"%d\",\"leastSigBits\":\"%d\"}' % (int('$hi',16),int('$lo',16)))"; done ; }
export PATH=/Users/acheong/.local/share/nvim/mason/bin:$PATH
export PATH=$PATH:$(go env GOPATH)/bin

# Makes copies from (n)vim copy to system clipboard.
set clipboard=unnamed

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

. "$HOME/.atuin/bin/env"

eval "$(atuin init zsh --disable-up-arrow)"
