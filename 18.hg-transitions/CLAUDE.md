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
- Generation: `gen/build.py bases` (deterministic layers, fast) then
  `gen/stage2.py A B EF` (MusicGen layers, CPU, ~1-2 h, resumable via
  `media/transitions/.done/`). `.venv` holds CPU torch + transformers.
