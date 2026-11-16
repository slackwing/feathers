# hg-transitions

Backing tracks for transitions between songs at Haunting Ghosts live shows.

- Large media lives in `media/` — git-ignored, never committed. Anything
  that must reach GitHub goes outside `media/`.
- `fetch-media.sh` re-pulls the catalog from YouTube (channel @hgh0sts)
  as 48 kHz WAV: `media/Shadow Work/`, `media/Quincunx/`,
  `media/The Trickster/`, `media/alternates/`. Run it sequentially —
  parallel yt-dlp runs get 403s.
- `setlist.RPP` is the live project; edit it in place via `gen/project.py`
  (markers carry the song keys; two transition options per gap live on
  "Transitions 1"/"Transitions 2"). `make-setlist.py` only builds a fresh
  one and would drop all of that. Keys, BPMs, option layout: `keys.md`.
- Generation v2: `gen/recipes.py [gap ...]` renders three distinct pieces
  per gap from `gen/sources.py` ingredients (soundfont via tinysoundfont +
  `media/sf2/MuseScore_General.sf2`, paulstretch of the song's own ending,
  synth drums/wind/chimes/bells, reverbs, ffmpeg FX) and updates the project
  items in place. Guitar takes come from `gen/melody_for.py GAP E|F`
  (musicgen-stereo-melody, ~9 min each on CPU). v1 scripts (`build.py`,
  `stage2.py`) are superseded. `.venv` holds CPU torch + transformers.
- Andrew's rules for transitions: rhythms stay steady (no speed-ups),
  pieces must differ a lot from each other, 4/4 beats with heavy
  reverb/industrial feel are welcome, end on a preview of the next song's
  opening chord.
