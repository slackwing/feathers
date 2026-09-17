# hxh

Subdirectory of the source-controlled website, published to `andrewcheong.com/hxh`.

## Project summary

Website for a **Hunter x Hunter–themed Halloween party**. Guests visit the
site to register, claim the character they'll dress up as, and (eventually)
more fun stuff. Framed in-universe as the **Hunter Website** — the
license-only site from the show — rendered as a late-90s OS desktop.

## Current state (as of 2026-09-17)

- **Retro "Hunter Website" theme** (2026-09-17, requested by Abi from a
  Pinterest board of 90s pixel-art UI: Win98 desktops, PostPet, GBA/Famicom
  title screens). Ink desktop with a faint tiled `×` wallpaper, cream
  bevelled windows, crimson title bars, pixel fonts, taskbar + Start menu,
  CRT scanlines. The pre-retro site is tagged `hxh-pre-retro` in git —
  `git checkout hxh-pre-retro -- foundry/website/html/hxh` reverts it.
- **index.html** — login-gated. Logged out: a centered "Hunter Website —
  Log in" dialog. Logged in: three windows — Summons (logotype, kana,
  typewriter notice in a visual-novel box, CTA), Roster (16 character
  tiles → per-character Profile windows with a CLAIM button), Registration
  ("OPENS SOON" stamp + stuck progress bar) — plus desktop icons, an About
  window, and a taskbar. A fake boot sequence plays after an explicit login
  (not on returning sessions). Party date/venue are still `TBD` placeholders.
  The gate is client-side UX only; static HTML remains fetchable.
- **invite.html** — set-password page for invite links
  (`/hxh/invite.html?code=...`), one static dialog in the same chrome.
- **roster.html** — admin-only Roster DB view (see below), one static
  full-width window.

## Retro chrome (shared files)

- `retro.css` — tokens (same five colours as before, plus `--ink-4` for
  muted text on cream), window/bevel/button/field styles, taskbar, Start
  menu, menus, toast, boot overlay, scanlines, phone stacking rules.
- `retro.js` — `Retro` module: window manager (`register`, `spawn`,
  `open`, `close`, `minimize`, `focus`, `toggleMax`, `fit`), drag (desktop
  only, 4px snap), taskbar + clock, `startMenu(items|fn)`, menu bars,
  `type(el, runs, {speed, onDone, instant})` typewriter, `boot(lines)`,
  `toast(msg)`, `setCRT(on)` (persisted in `localStorage hxh.crt`),
  `icon(name, size)` (ASCII-grid pixel icons → SVG, integer-scaled), and
  `sprite(emoji)` (emoji drawn on a 16px canvas, alpha-thresholded and
  snapped to the web-safe palette, upscaled with `image-rendering:
  pixelated` — our copyright-free "pixel art").
- Windows are `.win[data-title][data-icon][data-width]` with an optional
  `.mbar` and a `.body`; `Retro.init()` builds the title bar. `data-static`
  = in-flow, no taskbar entry (dialogs); `.popup` = Escape closes it;
  `.profile` = fixed modal on phones. Buttons/menu items use `data-act`
  handled by an `ACT` map per page; `[data-crt]` toggles scanlines.
- Breakpoint: `>= 900px` windows float and drag; below, they stack in DOM
  order, min/max buttons hide, desktop icons hide, Start menu is the nav.
- Fonts: **Press Start 2P** (logotype, title bars, buttons, small caps
  labels at 8px) and **DotGothic16** (all body text, always 16px — it is a
  16px bitmap font and blurs at other sizes; it also renders the kana).
  Logotype sizes via container-query units and breaks onto two lines in
  windows narrower than 440px.

## Previewing / screenshots

There is no local backend. To screenshot the logged-in state, run a stub
server that serves `html/` and fakes `GET /admin/api/me` (200 with
`roles:[{website:"hxh",role:"admin"}]`, or 401 for the gate),
`POST /admin/api/login|logout`, `GET /admin/api/token-info`,
`POST /admin/api/set-password`, and `GET /hxh/api/roster` (wrap
`roster.json` as `{arcs, characters}`). Then
`google-chrome-stable --headless=new --screenshot=... --window-size=1366,900
--virtual-time-budget=20000 URL` (virtual time fast-forwards the
typewriter). Inject a `<script>` that clicks tiles / the Start button to
capture interactive states. Check 1366 (side-by-side), 1100 (cascade) and
390@2x (phone).

## Auth: the SHARED system (as of 2026-09-05)

hxh logs in via the shared cross-website auth system — the `admin`
project in [`slackwing/hobby-server`](https://github.com/slackwing/hobby-server)
(`internal/shared/`), console at `/admin/`. One account per person,
SSO cookie `hobby_session` (Path=/), per-website roles
(`hxh` roles: `admin`, `guest`). Frontend calls `/admin/api/*`.
See `../admin/CLAUDE.md`.

The hxh hobby-server project serves DATA endpoints at `/hxh/api/*`
(no auth floor of its own — role checks go through the shared
system). Tables carry the `hxh_` prefix (AGENTS.md N7 standard).

## Roster (character database, 2026-09-05)

- **roster.html** — admin-only view (role `admin` on `hxh`) reached
  via the Roster DB desktop icon / Start menu / View menu on index.
  Renders `GET /hxh/api/roster`: per character an image strip, Nen-type
  chips (double types supported), weapon slugs, arc chips, description.
- Data: `hxh_characters` (slug PK; nen_types/weapons/arcs are
  comma-separated slug strings; images JSONB array of Fandom-wiki
  URLs, hotlinked) + `hxh_arcs` (7 anime arcs, seeded by Liquibase).
- Curation loop: edit `roster.json` (kept in this dir, master copy of
  the data) and push with
  `PUT /hxh/api/roster/characters?replace=1` (admin session).
  Characters were compiled from hunterxhunter.fandom.com; expect
  iterative correction rounds with Andrew.
- The 16 tiles on index (names, Nen types, emoji glyphs, one-line blurbs)
  are still hard-coded in index.html, separate from roster.json.

## Open questions (ask Andrew before building)

- **Party date / time / venue** — placeholders in the notice right now.
- **Character exclusivity** — first-come-first-serve claims (no duplicate
  costumes) or can multiple guests pick the same character?
- **Registration friction** — name-only, or name + email? Any login at all,
  or one-tap claim with an edit token?
- **Fun-idea backlog** (Andrew said "other fun ideas"; candidates to pitch):
  - Nen water-divination quiz that assigns your Nen type on registration
  - Generated Hunter License ID card per guest (shareable image)
  - Costume contest voting page (night-of)
  - Greed Island–style "party quest" card checklist
  - Phantom Troupe counter ("13 spiders" — first 13 to register?)

## Design direction

- Retro OS / pixel-art, in-universe as the Hunter Website. Colours: ink
  `#0b0a08` desktop, cream `#e8dcc3` windows, crimson `#c8102e` title bars
  and primary buttons, Nen green `#58e05c` for focus/selection, pumpkin
  `#ff7518` for Halloween accents; the `×` from the logo as the app icon.
- Nen-type hues colour the roster tiles (dithered aura behind each sprite).
- No copyrighted art: sprites are pixelated emoji, icons are hand-drawn
  ASCII grids in `retro.js`.
- Must work well on phones — guests will register from their phones.
- UI copy stays terse (see the hub CLAUDE.md UI-writing rule); the retro
  chrome is allowed to be decorative (menu bars, fake progress bar, clock).

## Publishing

See `../CLAUDE.md` for the `ws_prod` deploy alias (must be run from the
`html/` directory, master branch only); `ws_stag` publishes the same tree
under `/.staging/` for previews. Bump the `?v=` on `retro.css`/`retro.js`
when they change. Don't deploy prod without Andrew's say-so while the page
still has TBD placeholders.
