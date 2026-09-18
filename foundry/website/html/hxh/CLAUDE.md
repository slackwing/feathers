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
- **index.html** — login-gated by the OS shell (see below). Logged in:
  the Summons window (logotype, kana, typewriter
  notice in a visual-novel box, CTA), the Binder (see below), and
  Registration ("OPENS SOON" stamp + stuck progress bar) — plus desktop
  icons, an About window, and a taskbar. Every logged-in load boots (see Boot below).
  Notice: Site 618 Bushwick Ave, Commences Oct 31, 2026 (no time), no
  "failure to commit" line (Andrew, 2026-09-17). Window title
  "Hunter × Halloween" (the special ×); login dialog likewise.
  The gate is client-side UX only; static HTML remains fetchable.
- **_invite/** and **_reset/** — the invite and password-reset pages at
  the standard cross-project paths, as hxh SKINS over the shared
  machinery `/admin/assets/setpw.js`: `pwpage.js` builds one
  Windows-logon-style dialog (title "Hunter × Halloween", heading
  "Choose a password" / "Reset your password", Applicant + Password,
  button "Accept summons" / "Reset password"; "password" never
  "passphrase"; no lede, no hints) on the bare desktop after the OS
  boots (no taskbar, no wallpaper, purple-square badge). Each page only
  passes its words. Both need `?code=`; without one the form is
  disabled with a one-line note; a code of the wrong kind (invite code
  on the reset page) shows the void message.
- **_email/** — hxh's email templates (standard cross-project dir):
  `templates.json` (invite → mints a 7-day link; account-created → sent
  automatically when an invite is accepted; reset → mints a 1-hour
  link), `_layout.html` (THE frame: crimson title bar, kicker,
  heading, footer "HUNTER × HALLOWEEN · year" — change it once for every
  email), and body fragments `invite.html`, `account-created.html`,
  `reset.html` (table-based, inline-styled, Courier). Wording per
  Andrew (2026-09-18): no avatar / applicant / ID block; invite says
  "choose your own secure password*" with a "VIEW SUMMONS" button and
  a footnote describing the real hashing (HTTPS → Argon2id 19 MiB / 2
  passes / 16-byte salt → hash only, in Cloud SQL Postgres on a private
  network); account-created is the "Accounts Department" / "ACCOUNT
  CREATED" note with the fixed welcome text; no "unofficial fan party".
  `index.html` — an admin-only preview page in the PLAIN admin-console
  style, deliberately not the site theme; inert frame, no metadata
  beyond template / subject / to; `?template=&user=` for the console's
  Preview; "send test to me".
- **roster.html** — admin-only Roster DB view (see below), one static
  full-width window.
- **Boot**: owned by the OS shell, every cold load (see below):
  HunterOS 99 BIOS lines with the "a purple square production" badge
  (bare blocky violet tee, `tee` icon) in the lower right; click skips.
  After logon the desktop comes up EMPTY (icons + taskbar only); ~0.4s later
  the summons window paints in jankily — frame first, menu bar ~90ms
  later, body ~200ms in (`Retro.open(..., {jank: true})`) — and the
  notice types. Roster and Registration are pre-positioned but closed
  until opened (CTA, icons, Start menu). The Start menu has a Windows
  style user header (initials avatar from shared-auth `initial` +
  `color`, plus display name); nothing user-related in the tray.

## The OS shell (`Retro.os`) — pages are apps

Andrew's rule (2026-09-17): cross-page behaviour lives in ONE shell, never
re-added per page. Every retro page starts with
`const me = await Retro.os({ wallpaper, taskbar, start, gate, boot })`:

1. `init()` — chrome, registers the page's `.win[data-title]` windows.
2. **Boot on every cold load** — refresh, typed URL, logout — HunterOS
   lines + the purple-square badge, ~2.5 s, skippable. The ONLY loads
   that skip it are navigations started from inside the OS via
   `Retro.go(url)`, which leaves a one-shot `sessionStorage hxh.warm`
   flag the next page consumes (desktop → Roster DB, roster → site,
   invite "Enter the exam site"). Logging in happens in-page, so it never
   reboots; `Retro.logout()` does a cold load of `/hxh/`, which boots and
   shows the logon — like a real machine. Use `Retro.go`, never a bare
   link, for links between OS pages.
3. **Session** — `GET /admin/api/me`.
4. **Logon** (when `gate: true` and logged out) — the shared dialog
   (`Retro.logon()`: title "Hunter × Halloween — Log in", logotype, one
   line, Applicant + Password, "Forgot password?" → `POST
   /admin/api/forgot`, no "restricted site" line) alone on the
   bare ink desktop with the purple-square badge in the lower right
   (`.os-badge`, also kept on the invite splash, removed once the
   desktop is up); the page's own windows/icons are hidden meanwhile
   (`body.logon`). Resolves with the account.
5. **Wallpaper** starts only now, i.e. only once logged in (`wallpaper:
   true`); logon and invite splashes stay on the ink × tiles.
6. Taskbar shown (`taskbar: true`), Start menu user header set.

- index: `os({ wallpaper, start, gate })` then the empty-desktop → janky
  summons sequence. roster.html: same, then loads data. `_invite/`:
  `os({ wallpaper: false, taskbar: false, gate: false, boot: !preview })`
  — it is itself a logon-style splash. Plain admin pages (`_email/`,
  `_invite/preview.html`) are outside the OS.
- Adding a page = call `os()`, then open windows. Never call `Retro.boot`
  or build a login form in a page.

## The Binder (`binder.js` + `binder.css`)

The roster as a Greed Island card binder, modelled on Andrew's
screenshots from the show (E66/E67): navy boards with gold clasps; the
left page holds sleeved cards; the right side is a teal control panel —
black display screen on top, two mint keys, a big dial, a square touch
pad with tick marks, a red D-pad. Andrew's spec (2026-09-17):

- Opens from the "Binder" icon / Start / View menu / the summons CTA as a
  **chromeless window** (`data-chromeless`: registered, in the taskbar,
  Escape closes, but no title bar or frame). Starts CLOSED — front cover
  only (ring emblem, title, BINDER) — click to open (3-step flip).
- **Tabs on top of the left page, one per page**, coloured by Nen type
  with a 2-letter code (EN TR CO EM MA SP). A type never shares a page
  (12 cards per page); a type with more than 12 gets more tabs of the
  same colour (hover title says "page n of m"). So the type isn't
  repeated under every card — Abi's idea. Characters with NO stated Nen
  type (most of the 198) are filed by the arc they first appear in, on
  muted arc-tinted tabs (EX ZO HA YN GI CA EL) — 23 tabs in all. On
  phones only the open tab shows its label.
- **Cards** copy the show's layout: three cream header boxes (No., short
  name, type code), a tinted art panel (pixelated emoji sprite on a
  Nen-hue dither), and a pink-framed text box (first sentence).
- **Screen** shows the selected card: number + full name, Nen line
  (coloured), Arms, and the description typed out (scrolls to follow the
  cursor). Idle = the ring emblem. Keys: CLAIM (toast + opens
  Registration), CLOSE (back to the cover). D-pad: ◀ ▶ page, ▲ ▼ card.
  Dial and pad are decoration.
- Size: fills the screen with slim margins — `Binder.layout()` sets
  `--bw/--bh` to the midpoint between the first sizing (≤1180×780) and
  the full desktop above the taskbar (Andrew: "fill halfway the
  margins"; ~1273×815 at 1366×900, leaving room for the tab row) and
  returns the window position; 12 sleeves per page (3×4), sprites 80px
  (5×) on desktop. Closed, the cover sits over the RIGHT page's spot
  with the spine to its left, so opening doesn't recentre the book.
- Everything in the chrome is 25% larger than the first build (Andrew,
  2026-09-17: "actual math, not scale"): DotGothic body 20px, Press
  Start labels 10px, taskbar 45px, windows 750/450/475/500 wide, icons
  48px, tee badge 72px; hairlines and dither patterns unchanged. Phone: page and panel stack, the spine
  turns horizontal, 2 columns.
- Fidelity comes from Andrew's Netflix screenshots (E66 Strategy × and
  × Scheme, E67 15 × 15): rivets and hinge lines on the boards, grooved
  gold clasps, the cream nameplate, the ring emblem (the show's idle
  screen), rounded header boxes, the hatched pink text frame, the bezelled
  screen, the dial with its notch, the tick-marked pad, two-tone D-pad.
  Japanese is mixed in where the show has it: 「name_ja」 on the screen's
  top line, the kana given name on the card art, tab titles / page
  footer with the Nen type in kanji, and a status line in the show's
  style (所持者 0名 ／ 残り N枚 — holders / remaining, from the rank limit).
- Data: `roster.json` — 198 characters, the complete named cast of the
  2011 anime through the Election arc (researched 2026-09-17 by eight
  parallel agents following CHARACTER.md; Japanese names verbatim from
  the Fandom infoboxes). The master copy, schema v2 (2026-09-17): `no`
  (card number, assigned by build.py), `slug`, `name`, `name_ja`,
  `first`, `glyph`, `rank` (S/A/B/C → claim limit 1/2/3/4, proposed),
  `nen_types`, `affiliation`, `weapons`, `arcs`, `description`,
  `images`. Rules and the per-character checklist:
  `foundry/website/hxh-roster/CHARACTER.md`; `validate.py` checks a
  file, `build.py` orders it and assigns `no`. Follow the checklist for
  EVERY character (Andrew's ask: one consistent procedure).
- `Binder.mount({ desktop, claim })` must run BEFORE `Retro.os()` so the
  shell registers the window.

## Wallpaper

`Retro.wallpaper(canvas)` paints an ORIGINAL pixel-art Whale Island on a
320×180 canvas (`<canvas class="wall">`, fixed, `object-fit: cover`,
`image-rendering: pixelated`), created by the shell once logged in
(never on the logon or invite splash): banded dithered sky, a broad forested hump left of centre,
a low tail with the harbour houses, pier and lighthouse, banded sea
with a reflection. Animated at 8 fps: a dense glitter band just below
the horizon fanning out toward the viewer (after Andrew's anime-sea
reference, 2026-09-18; ~190 glints, a few as small crosses), pixel
cumulus clouds (flat base, rounded lobes, shadowed underside, inner
highlight — after his pixel-sky reference) drifting very slowly, a
flock of birds every 12–40 s; one static frame under
prefers-reduced-motion. Inspired by the anime's
island silhouette but drawn procedurally — no copyrighted image is
used. Desktop icon labels carry a 1px ink outline to stay readable
over the sky.

## Retro chrome (shared files)

- `retro.css` — tokens (same five colours as before, plus `--ink-4` for
  muted text on cream), window/bevel/button/field styles, taskbar, Start
  menu, menus, toast, boot overlay, scanlines, phone stacking rules.
- `binder.js` / `binder.css` — the Binder app (see above).
- `retro.js` — `Retro` module: the OS shell (`os`, `go`, `session`,
  `login`, `logout`, `logon`, `wallpaper`), window manager (`register`, `spawn`,
  `open`, `close`, `minimize`, `focus`, `toggleMax`, `fit`), drag (desktop
  only, 4px snap), taskbar + clock, `startMenu(items|fn)`, menu bars,
  `type(el, runs, {speed, onDone, instant})` typewriter,
  `boot({badge, splash, lines, speed, tail})`, `place(id, at)`,
  `open(id, at, {scroll, jank})`, `toast(msg)`, `setCRT(on)`
  (persisted in `localStorage hxh.crt`), `avatar(acct)` + `setUser(acct)`
  (Start menu user header), `icon(name, size)` (ASCII-grid pixel icons → SVG,
  integer-scaled), and
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
  URLs, hotlinked; since changeset 004 also card_no, name_ja, first,
  glyph, rank, affiliation — the Binder's card fields) + `hxh_arcs`
  (7 anime arcs, seeded by Liquibase).
- Curation loop: edit `roster.json` (kept in this dir, master copy of
  the data) following `foundry/website/hxh-roster/CHARACTER.md`, run
  `validate.py` + `build.py`, deploy, then push with
  `PUT /hxh/api/roster/characters?replace=1` (admin session; without
  Andrew's password, create a throwaway admin via psql on the VM, mint
  it a token, log in, PUT, delete it). Characters were compiled from
  hunterxhunter.fandom.com (the MediaWiki API `action=parse&prop=wikitext`
  works when page fetches are blocked); expect correction rounds.
- The Binder on index reads this same `roster.json` (with its `glyph`
  and `first` fields), so the roster is defined in one place.

## Open questions (ask Andrew before building)

- **Party time** — the notice gives 618 Bushwick Ave and Oct 31; no time
  yet, by Andrew's choice.
- **Email sending** needs the `email:` block in the VM's hobby-server
  config (Gmail app password); until then the console's Send buttons
  say "email not configured".
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

## Keep these three in sync

The site chrome (`retro.css`/`retro.js` + pages), the set-password
pages (`_invite/`, `_reset/` via `pwpage.js`), and the emails
(`_email/_layout.html` + bodies) are one look (the `_email/index.html`
preview page is the exception — keep it plain). A theme
change is not done until all three match — change them in the same
commit, and re-screenshot `_email/` and `_invite/` alongside the
desktop. The emails can't load the web fonts or the shared CSS, so
their look is hand-mirrored with inline styles: same palette
(`#0b0a08` ink, `#e8dcc3` cream, `#c8102e` crimson, `#ff7518` pumpkin,
`#5c5340` muted), a crimson title-bar row, a 2px ink frame with a
hard shadow, and the user's avatar circle.

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
