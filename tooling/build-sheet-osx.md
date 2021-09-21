# Build Sheet (OSX)

## Bare Minimum

### Remap ⌘ to restore Spotlight and Copy & Paste ASAP

- Install iTerm2.

    - Preferences > Profiles > Colors > Foreground > 0, 240, 0


- Clone feathers.

      mkdir -p ~/src/slackwing
      cd ~/src/slackwing
      git clone https://github.com/slackwing/feathers.git


- Install Karabiner.

    - Open and grant system security privileges.

    - Run

          ./feathers/install-karabiner-settings.tcl

    - Karabiner > Complex Modifications > Add Rule > Enable All


### Restore Window Snapping

- Install BetterSnapTool.

    - Open and grant system security privileges.

    - Configure keyboard shortcuts for maximize (⌘↑ showing as ⌥⌘↑), left and right halves, and quarters (_e.g._ ^⌥⌘↑).

        - Why are we setting keyboard shortcuts to the output of Karabiner keyboard shortcuts? We want to use ⌘ for window snapping (because it reminds us of ⊞ in Windows), but we've mapped ours to a hyper key (^⌥⌘). Meaning, we can't add on _another_ modifier for the quarter-window shortcuts. By _demoting_ the hyper key by one modifier (^) _in the presence of an arrow key_, we can do what we like. (The other way to do this is to map arrow key shortcuts _before_ mapping the hyperkey. Not sure which feels less exceptional.)

## Secondary

### Shell & Environment

- Follow the rest of [tooling](https://github.com/slackwing/feathers/tree/master/tooling).

- Download [configuration snapshots](https://github.com/slackwing/feathers/tree/master/tooling/snapshots).

### Display

- Position Dock to the left.

- Install ResolutionTab.

### Applications

- Sign into Chrome.

    - New Tab Start Page: https://stackoverflow.com/questions/tagged?abfocus&uqlId=26753.


- Install Atom.

    - Install Command Line Developer Tools.


- Install Evernote.

    - Help > Keyboard Shortcuts: Global New (^⌥N), Global Search (^⌥Z)


- Follow Spotify's Backend Golden Path to install IntelliJ IDEA, Docker, etc.

    - In IntelliJ, update "Shell path" to /bin/zsh, update "Console Font" to MesloLGC NF, and restart.

    - Download colors.jar from https://github.com/adilosa/base16-jetbrains and import it via Preferences > Editor > Color Scheme, then select Base16 PhD.


- Install Ableton Live Standard and activate via acheong87@gmail.com.

### Privacy

- Preferences > General > Recent items > None

### Other

- Create or import //Desktop/Unorganized and //Desktop/Organized.
