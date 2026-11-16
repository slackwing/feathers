# hg-transitions

Backing tracks for transitions between songs at Haunting Ghosts live shows.

- Large media lives in `media/` — git-ignored, never committed. Anything
  that must reach GitHub goes outside `media/`.
- `fetch-media.sh` re-pulls the catalog from YouTube (channel @hgh0sts)
  as 48 kHz WAV: `media/Shadow Work/`, `media/Quincunx/`,
  `media/The Trickster/`, `media/alternates/`. Run it sequentially —
  parallel yt-dlp runs get 403s.
- `setlist.RPP` is the live project; edit it in place (markers carry the
  song keys). `make-setlist.py` only builds a fresh one and would drop them.
  Keys and transition notes: `keys.md`.
