#!/bin/bash
alias x='vim ~/.bashrc'
alias y='source ~/.bashrc'
alias z='cat ~/.bashrc'
alias yay="xargs printf '%b\n'"
alias h='history'
alias hg='history | grep'
alias ll='ls -alohF'
alias lt='ls -lt | head -n 10'
alias gs='git status'
alias gc='git checkout'
alias g-='git checkout -'
alias gm='git checkout master'
alias gd='git diff --inter-hunk-context=0'
# alias gp='git pull';
alias greset='git checkout -- .'
# alias gsu='git reset HEAD . ; git stash'
alias gq='git add . ; git diff --staged ; git commit -m"fix"'
alias cc='mvn clean compile'
alias cct='mvn clean compile test-compile'
alias mi='mvn install -DskipTests'
alias mip='mvn install package -DskipTests'
alias s='vim ~/.sed'
alias silt='sed -f ~/.sed'
alias siff='git diff `git merge-base master HEAD`'
alias mdaw='mvn dependency:analyze | tee /dev/tty | wc'
alias pretty='tail -n 1 | sed s/[\\]x0a//g | sed s/^..// | sed s/..$// | python -m json.tool'
alias k='kubectl'
alias lg='grpcurl -plaintext localhost:5990'
alias kf='s -ef | grep -i forticlient | awk '{print $2}' | xargs sudo kill -9'
alias clientsrc='cd ~/hack/2021/client-web/node_modules/open/web-player/src'
yo() {
    $@ 2>&1 | gsed 's/\\n/\n/g' | gsed 's/\\t/\t/g'
}
partner() {
    jhurl --site services.gew1 --method GET "hm://partner-userid/encrypted/adstudio-salesforce/$1"
}
killp() {
    ps -ef | grep -i $1 | awk {'print $2'} | xargs sudo kill -9
}
mbdiff() {
    git diff `git merge-base master $1`..$1
}

# holy hell this is an amazing function! check out anyone's pr by number! e.g. `copr 123`
copr() { git fetch origin "refs/pull/$1/head:acheong/$1" && git checkout "acheong/$1"; }
checkoutpr() { git fetch origin "refs/pull/$1/head:pr/$1" && git checkout "pr/$1"; }

filestamp() { echo $(date "+%Y%m%d-%H:%M:%S"); }

tdlogs() {
    source ~/src/dev-workflow/env/profile-utils.sh;
    mkdir -p ~/blackstar/;
    dlogs | tee ~/blackstar/dlogs-`filestamp`;
}

ddlogsraw() {
    diff <(sed 's/[0-9]//g' `ls -t ~/blackstar/dlogs-* | head -n 2 | tail -n 1`) <(sed 's/[0-9]//g' `ls -t ~/blackstar/dlogs-* | head -n 1`) 
}
ddlogs() {
    diff <(sed 's/[0-9]//g' `ls -t ~/blackstar/dlogs-* | head -n 2 | tail -n 1` | sort | uniq) <(sed 's/[0-9]//g' `ls -t ~/blackstar/dlogs-* | head -n 1` | sort | uniq) 
}
mtree() {
    mkdir -p ~/blackstar/;
    mvn dependency:tree | grep '^\[INFO\] [|+]' | tee ~/blackstar/mtree-`filestamp`;
}
dmtree() {
    vimdiff <(sed 's/^\[INFO\] [^a-zA-Z]*//g' `ls -t ~/blackstar/mtree-* | head -n 2 | tail -n 1`) <(sed 's/^\[INFO\] [^a-zA-Z]*//g' `ls -t ~/blackstar/mtree-* | head -n 1`)
}
# brew install tree
ftree() {
    mkdir -p ~/blackstar/;
    tree | tee ~/blackstar/ftree-`filestamp`;
}
dftree() {
    vimdiff `ls -t ~/blackstar/ftree-* | head -n 2 | tail -n 1` `ls -t ~/blackstar/ftree-* | head -n 1`
}
mda() {
    mkdir -p ~/blackstar/;
    mvn dependency:analyze | tee ~/blackstar/mda-`filestamp`;
}
dmda() {
    vimdiff `ls -t ~/blackstar/mda-* | head -n 2 | tail -n 1` `ls -t ~/blackstar/mda-* | head -n 1`
}
ldlogs() {
    cat `ls -t ~/blackstar/dlogs-* | head -n 1`
}
lmtree() {
    cat `ls -t ~/blackstar/mtree-* | head -n 1`
}
lftree() {
    cat `ls -t ~/blackstar/ftree-* | head -n 1`
}
lmda() {
    cat `ls -t ~/blackstar/mda-* | head -n 1`
}
alias neat="sed 's/^\[INFO\][ \t]*//g' | sed 's/^\[WARNING\][ \t]*//g' | sed 's/^\[ERROR\][ \t]*//g'"
alias 2xml="sed 's/\([a-zA-Z][a-zA-Z0-9.-]*\):\([a-zA-Z0-9.-]*\):jar:\([0-9][a-zA-Z0-9.-]*\)\(:\([a-z]*\)\)*/<dependency><groupId>\1<\/groupId><artifactId>\2<\/artifactId><\/dependency>/g'"
alias 2xmlv="sed 's/\([a-zA-Z][a-zA-Z0-9.-]*\):\([a-zA-Z0-9.-]*\):jar:\([0-9][a-zA-Z0-9.-]*\)\(:\([a-z]*\)\)*/<dependency><groupId>\1<\/groupId><artifactId>\2<\/artifactId><version>\3<\/version><scope>\5<\/scope><\/dependency>/g'"

# smartling
smartling() {
    mvn clean compile test-compile
    # todo - detect which directory has the i18n files
    read -n 1 -p "press any key to continue with \`cd adstudio-bff-common\'" asdf
    cd adstudio-bff-common
    read -n 1 -p "press any key to continue with the smartling stuff" asdf
    mvn exec:java -Dexec.mainClass=com.spotify.i18n.smartling.v1.SmartlingTool -Dexec.classpathScope=test -Dexec.args="sync"
}


# So just `git push -u` works.
git config --global push.default current

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

export YVM_DIR=/Users/acheong/.yvm/.yarn
[ -r $YVM_DIR/yvm.sh ] && . $YVM_DIR/yvm.sh
