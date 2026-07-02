# Fun stuff section — plan

Section lives on `index.html` between the hero and the SVG map. Wraps
in a container with its own header so it visually reads as a distinct
band. Content is a series of "tiles" — each tile is one interactive
thing. Kept lightweight and playful; not meant to be exhaustive.

## Tile roadmap

Order = rough build order. Each tile has an "auth needed?" note so we
can defer the ones with real backend work.

### 1. Spotify playlist (built 2026-07-02)

- Playlist: <https://open.spotify.com/playlist/7sojJGhCG1KfFl07gep59P>
- Anyone with the link can add songs — invite friends to.
- Embed the official Spotify iframe widget so people can play it right
  from the page without leaving.
- No backend, no auth. Just an `<iframe>` + a "add songs to the queue"
  link that opens Spotify.

### 2. "Now playing" indicator (deferred)

- Show whichever song we're actually listening to in the RV.
- **Constraint:** Spotify Web API's `GET /me/player/currently-playing`
  is per-user. It needs Andrew (or Abi) to have OAuth'd their Spotify
  account so the server can hold a refresh token and poll it. That's
  real work — new Spotify app registration, a `/rv/api/spotify/*`
  route to store tokens + proxy the current-track fetch, a background
  refresher, and rate-limit awareness.
- Alternative: skip the OAuth and just link to the playlist. Realistic
  MVP is "we listened to N songs from the playlist so far" if we can
  scrape it, but even that needs auth.
- **Decision for now:** just the playlist widget. Revisit if we
  actually want live-track presence.

### 3. Dunkin' bet chart (built 2026-07-02)

Bets: Andrew 43, Abi 48, Hayoung 30, Keunwoo 85. Header button
(DD wordmark + count chip) increments the running total via
POST /rv/api/dunkin with an empty body — server auto-increments.
Chart in the right fun tile: line segments between logged points,
🚐 emoji on the latest, dotted extrapolation to trip end.
Andrew + Abi use avatar photos; Hayoung + Keunwoo use letter chips
until real photos land.

**Original design notes below (kept for future reference):**


- **Wager:** three people (Andrew, Abi, +1 friend? +2?) each guessed
  a total Dunkin' count for the whole trip. Along the way we log the
  running count and see who's closest.
- **Chart:**
  - Y-axis right side: each person's face avatar aligned to their
    guessed value (like a Bloomberg-style label).
  - X-axis: calendar dates from trip start → end.
  - Each log entry = a dot on today's column at the running count.
  - Dotted line from the last logged point projecting to the trip
    end, using either (a) a simple linear extrapolation from the
    running rate, or (b) an even simpler avg-per-day-so-far ×
    days-remaining. Start with (b).
- **Data:**
  - Static: participants list (id, name, avatar path, guess).
  - Dynamic: `dunkin_log` table — `(id, seen_at TIMESTAMPTZ, running_count INT, note TEXT, created_by TEXT)`.
  - API: `GET /rv/api/dunkin` public (list logs + participants),
    `POST /rv/api/dunkin` auth (add a log entry).
- **UI:** rendered as an SVG chart. Small (~360px tall, full width of
  the section). Log button + notes are for logged-in users only.
- Photos supplied later by user.

### 4. Audiobooks list (deferred)

- List of audiobooks we've queued for the trip with a progress bar per
  book.
- **Data:** `audiobook` table — `(id, title, author, cover_url,
  minutes_total INT, minutes_listened INT)`.
- API: `GET /rv/api/audiobooks` public, `PATCH /rv/api/audiobooks/{id}`
  auth to bump progress.
- **UI:** stacked cards, one per book. Cover thumbnail, title,
  author, `[▓▓▓▓░░░░]` bar + "3h12m of 8h" text. Optional "finished"
  celebration when a book hits 100%.

### 5. Ideas for later (not committed)

- Live location dot on the map — we DIY'd a phone → API push, or use
  Google Timeline export.
- Cumulative miles / states counter.
- Photo drop of the day.
- Weather-station-style badge for "coldest night so far."
- Guess-the-restaurant tile — same shape as Dunkin'.

## Visual design notes

- Section header: something playful like "🎵 Fun stuff along the way"
  in the same serif as the rest of the site.
- Tiles render as loose cards on light background. On mobile they
  stack; on desktop they lay out in a soft grid (2-3 columns).
- Each tile is self-contained CSS + a small JS module if it needs
  behavior. Keep dependencies minimal so the fun stuff doesn't slow
  page load (defer any heavy iframes).

## Data-model conventions

- All new tables live in the hobby-server `rv` project (single DB,
  per-project prefix). Migrations `009-` onward.
- Public read, auth write — matches prep + notes.
- Use the same rv_session cookie; no separate auth surface.
