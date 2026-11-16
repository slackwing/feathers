#!/usr/bin/env bash
# Re-pull the band's catalog from YouTube into media/ (git-ignored).
# Needs yt-dlp (standalone binary is fine), ffmpeg, and node (yt-dlp's JS runtime).
# Run playlists one at a time: parallel runs get 403s from YouTube.
set -euo pipefail
cd "$(dirname "$0")/media"
Y=(yt-dlp --no-warnings --js-runtimes node --retries 10 --sleep-requests 1
   -f bestaudio -x --audio-format wav
   --replace-in-metadata title "^Haunting Ghosts - " ""
   --replace-in-metadata title " \[Official Audio\]$" "")
pl() { "${Y[@]}" -o "$1/%(playlist_index)02d - %(title)s.%(ext)s" "https://www.youtube.com/playlist?list=$2"; }
pl "Shadow Work"  OLAK5uy_l77c0Fh2iy2XhgYXB03rut8K-rfnVH2ss   # 15-track album
pl "Quincunx"     OLAK5uy_l31UW_KWs3qhAi0JDRKiFblhpTH8064qA   # EP; supersets the other singles/EPs
pl "The Trickster" OLAK5uy_ljwfD3gL04W1hYQx__zTpPOW8BZur4K8I  # Nee Heavy, Horrors of your love
# Second uploads of three songs (the release playlists point at the other upload).
"${Y[@]}" -o "alternates/%(title)s (%(upload_date)s, %(id)s).%(ext)s" \
  https://www.youtube.com/watch?v=8PeORnIcowc \
  https://www.youtube.com/watch?v=g-I8747f5KA \
  https://www.youtube.com/watch?v=iF6dLdDsZLM
