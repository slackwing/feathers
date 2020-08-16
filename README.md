## Home

_TODO_

#### TODOs

| Part | Id | Description | Impact | Effort | Status |
| - | -: | - | -: | -: | -: |
| Tooling | SFT001 | Roughly write a first installer in install-karabiner-settings.tcl. | M | M | Done |
| Tooling | SFT002 | Factor out installer utils from install-karabiner-settings.tcl. | M | M | |
| Tooling | SFT003 | Add confirm-diff logic to installer. (Write to /tmp first before backing up. Then diff and confirm. Then backup and move. Don't bother to reuse the non-confirm path for backup-and-write.) | M | M | |
| Tooling | SFT004 | Consolidate all tooling environment variables somewhere. | L | M | |
| Tooling | SFT005 | Tmp file cleanup. | L |L | |
| Tooling | SFT006 | Global switch to redirect output for tooling functions, i.e. disable "puts" by switch. | L | L | |
| Tooling | SFT007 | Output for tooling functions to have indent levels. | L | L | |
| Tooling | SFT008 | Fix zsh instructions to start with the `cp`; then refer back to it in case of changes outside the local machine. Also hardlink and check in _~/.oh-my-zsh/*_ and _~/.p10k.zsh_ and leave similar guidance. | M | L | |
| Tooling | SFT009 | Port bash aliases and test them. | H | L | |

#### Patterns

1. Less READMEs, share by default, split when necessary; but always split decision logs.
1. Tooling: Always `install-foo.tcl`; always run-from-anywhere; built-in pre-reqs check (system, dependencies, paths, configs); auto-backup any modified files.
1. Automate lazily; vigilance against pre-mature optimization; e.g. avoid key remappings that won't be used >100 times a day.

#### Reading Log

- http://zpalexander.com/switching-to-zsh/
