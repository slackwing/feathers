# hxh

Subdirectory of the source-controlled website, published to `andrewcheong.com/hxh`.

## Project summary

Website for a **Hunter x Hunter–themed Halloween party**. Guests visit the
site to register, claim the character they'll dress up as, and (eventually)
more fun stuff. Framed in-universe as the **Hunter Website** — the
license-only site from the show — rendered as a late-90s OS desktop.

## Current state (as of 2026-09-18)

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
  machinery `/admin/assets/setpw.js`: the `SetPassword` app
  (`apps/setpw.js`) builds its dialog on the logon's own frame, `AccountDialog` in
  `os/logon.js` (DRY, Andrew 2026-09-28 — title "Hunter × Halloween — <heading>", the logotype, heading
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
- **BeetleChat** (2026-09-18) — the instant messenger, see its section
  below. Desktop icon, Start menu, tray icon with a menu.
- **roster.html / Roster DB app — REMOVED 2026-09-18** (Andrew: it
  didn't work — opening it cleared the other apps — and it isn't
  needed). The `/hxh/api/roster` endpoints stay for the push script.
- **Boot**: owned by the OS shell, every cold load (see below):
  HunterOS 99 BIOS lines with the "a purple square production" badge
  (bare blocky violet tee, `tee` icon) in the lower right; click skips.
  After logon the desktop comes up EMPTY (icons + taskbar only); ~0.4s later
  the summons window paints in jankily — frame first, menu bar ~90ms
  later, body ~200ms in (`wm.open(id, at, {jank: true})`) — and the
  notice types. Roster and Registration are pre-positioned but closed
  until opened (CTA, icons, Start menu). The Start menu has a Windows
  style user header (initials avatar from shared-auth `initial` +
  `color`, plus display name); nothing user-related in the tray.

## The OS (`os/`) — everything is a Component, pages register apps

Andrew's rules (2026-09-17/18): cross-page behaviour lives in ONE shell,
never re-added per page; and "everything is component-ized … an
extremely pedantic object-oriented component-driven architecture so we
are maximally DRY", event-driven, with test coverage as part of normal
development. So since 2026-09-18 the source is ES modules under
`os/` (the shell) and `apps/` (what runs on it), bundled by esbuild into
ONE served file per page (`hxh.js`, global `HxH`, plus `hxh.css`) — see
"Build, tests, dev loop" below. The old retro.js / binder.js /
pwpage.js / retro.css / binder.css are gone; the plan and code review
that led here is `foundry/website/docs/HXH_REFACTOR.md`.

A page is now three lines:

```html
<link rel="stylesheet" href="hxh.css?v=N">
<script src="hxh.js?v=N"></script>
<script>HxH.start({ apps: [HxH.apps.Summons, HxH.apps.Binder, HxH.apps.About],
                    autostart: ["summons"], wallpaper: true, start: true, gate: true });</script>
```

`HxH.start(opts)` = `new OS().start(opts)`, which:

1. registers the apps (`AppRegistry`; an entry may be `[AppClass,
   options]`), builds the chrome (`setup()`: Desktop, WindowManager,
   Toast, Boot, Backdrop, and — unless `taskbar: false` — the Taskbar
   with its Start button, StartMenu and the scanlines TrayIcon), hides
   the taskbar while booting;
2. **boots on every cold load** — refresh, typed URL, logout — HunterOS
   99 lines + the purple-square badge, ~2.5 s, click skips. The ONLY
   loads that skip it are navigations started from inside the OS via
   `os.go(url)` (`Nav`), which leaves a one-shot `sessionStorage
   hxh.warm` flag the next page consumes. Logging in happens in-page,
   so it never reboots; `os.logout()` cold-loads `/hxh/`, which boots
   and shows the logon — like a real machine. Use `os.go`, never a bare
   link, between OS pages;
3. looks up the session (`Session.me()` → `GET /admin/api/me`);
4. when `gate: true` and logged out, shows the `LogonDialog` (a static
   Window: "Hunter × Halloween — Log in", logotype, one line, Applicant
   + Password, "Forgot password?" → `POST /admin/api/forgot`) alone on
   the bare ink desktop with the badge (`Badge`, kept on the invite
   splash too, removed once the desktop is up; `body.logon` hides
   everything else meanwhile);
5. `setUser(me)` → `session:user` on the bus, desktop icons and tray
   icons rebuilt from the registry for that user;
6. `Wallpaper` only now, i.e. only once logged in (`wallpaper: true`);
   taskbar shown; desktop icons shown (`icons`, defaults to `taskbar`);
7. emits `os:ready`, then launches each `autostart` app with
   `{ autostart: true }`.

Options: `apps, autostart, gate, taskbar, wallpaper, boot, start
(Start button + menu), icons, bootLines`. index: `{wallpaper, start,
gate}` + autostart summons; `_invite/` / `_reset/`: `{taskbar: false,
wallpaper: false, gate: false, splash: true, badge: false, backdrop:
"embers"}` + autostart `setpw` — ONE constant, `ACCOUNT_PAGE` in
apps/setpw.js, via `HxH.accountPage(words)`; the two pages pass only their
words. Boot, the Summons splash, then the account dialog over the
Summons' embers (`EmberBackdrop`), no badge (Andrew, 2026-09-28). Pages carry NO font links:
`start()` loads the one list (`FONTS_URL`, `loadFonts` in os.js). Plain admin pages (`_email/`) are outside
the OS.

### The pieces (one class each, `os/*.js`)

- `Component` (`component.js`) — base of everything drawn: `render()`
  returns the root `el`; `mount(parent, {before})`, `unmount()` (tears
  down `listen()` bus subscriptions and `adopt()`ed children), a private
  `events` bus (`on/once/emit`), `onMount/onUnmount` hooks.
- `EventBus` (`bus.js`) — `on` returns an unsubscribe; handlers are
  isolated (one throwing never stops the rest). The OS bus carries:
  `window:add/remove/open/close/minimize/maximize/focus/move/title/attention
  {id}`, `tray:add {spec} / tray:remove {id} / tray:refresh`,
  `app:register / app:launch {id}`, `session:user {user}`, `crt {on}`,
  `resize`, `wake {reason}`, `os:ready`. Components never call each
  other across the taskbar/app boundary — they emit and listen.
- `Window` (`window.js`) — THE window class. `chrome: "full"` (title
  bar + identical min/max/close `ChromeButton`s, draggable), `"static"`
  (in-flow dialog, no taskbar entry), `"none"` (chromeless; `buttons:
  ["min", "close"]` float at the top right — the binder). Options:
  `id, title, icon, width, closable, minimizable, maximizable, task,
  popup` (Escape closes), `cls, menus` (a `MenuBar` spec), `content`
  (html | element | fn(body, win)), `onClose`. It only emits
  (`chrome`, `pointerdown`, `title`, `attention`); the manager acts.
- `WindowManager` (`wm.js`) — `add/remove/get/all/active`, `open(id,
  at, {scroll, jank})` (jank = frame → menu bar → body, 90/110 ms;
  default cascade `150+35n, 30+35n`; phones scroll it into view),
  `close/minimize/toggleMax/focus/focusTop/place/drag` (4 px snap,
  zoom-divided, desktop only; `drag(win, handle, {allow, threshold})` —
  a threshold > 0 keeps a short press a click and swallows the click
  that ends a real drag), `fit/relayout`, `handleEscape` (active
  popup). Every change is announced on the bus.
- `Splash` (`splash.js` + `splash.css`, `os.showSplash(id)`) — the
  title screen on a COLD load of a page that passes `splash: true`
  (index, _invite/, _reset/; a warm navigation skips it with the boot).
  ORDER — one pattern for every page (Andrew, 2026-09-28): boot, splash,
  and only on clicking to start what the page is for: the desktop when
  signed in; the logon when signed out (then straight to the desktop, no
  second splash); the choose-a-password / reset dialog on the account
  pages. The startup splash is ALWAYS the Summons (`STARTUP_SPLASH` —
  Andrew, 2026-09-27: the site's anchor); Player Select is the Heavens
  Arena placeholder (`apps/arena.js`: the app has no window, it shows
  Player Select with `prompt: "COMING SOON"`, `chime: false`, closed by a
  click); Night is found only in Settings › Other › Splash screen. Three
  styles (`SPLASHES`): Summons (the first
  landing page, tag `hxh-pre-retro`, revived: Alfa Slab logotype,
  pulsing ✕, embers), Player Select (a retro fighting game's select
  screen: chrome-gradient italic pixel type over Andrew's key-art
  backdrop (`img/select-bg.jpg`, 1920×1080, under a navy veil that
  darkens to the edges, plus scanlines), 12 random Binder characters'
  avatars — smooth, NOT pixelated (Andrew, 2026-09-27) — read from
  /hxh/api/db/binder at show time, red 1P / blue 2P cursors hopping as
  in attract mode, the big portraits and name plates they point at —
  2P mirrored — and CREDIT 01; ??? silhouettes without a roster; it
  replaced a Win98 "Clouds" style the same day), Night (an arcade
  attract screen at the wallpaper's 5-px grain: PURPLE SQUARE PRESENTS,
  stars, a harvest moon whose road on the sea starts nearly the moon's
  width and thins in density going down — not a Christmas tree — its
  glints each re-rolling on their own staggered `GLINT_CYCLE` (3.2 s) so
  only ~7% change per frame, calm rather than static noise — and
  Abi's blimp crossing; a PURPLE sea (`SEA_BANDS`: the sky's purples
  mirrored and much darker, lightest under the horizon and almost black
  in the foreground — not blue, Andrew 2026-09-27); the moon road a WIDE
  trapezoid (half-width 0.8→3.0 moon radii) and sparse (density falling
  as (1−d)^2.6), its glints on a 4.5 s staggered cycle; and the desktop's Whale Island PIXEL FOR PIXEL —
  Night uses the wallpaper's own `geometry()` and `islandLayer()` (the
  wallpaper's island code, extracted verbatim and checked identical by
  pixel hash), maps every day colour through `NIGHT_ISLAND` to a
  shadowy moonlit purple, and lights ~80% of the town's windows
  (`litWindows`, stable per visit) with their reflections on the water;
  the title sits up in the sky and CLICK TO START over the sea so the
  island shows between them). It NEVER moves on by itself: "Click to start"
  on every style; click, tap, Enter, Space or Escape dismisses it — but
  never the SECOND click of a double-click (`e.detail > 1`), since desktop
  icons open on one click and a double-click on Heavens Arena would
  otherwise open and close it at once — and
  plays the original `startup` chime when Sounds are on. Settings ›
  Other › Splash screen ▸ shows any style over the desktop until
  clicked. Sized only in container units of the full-screen root
  (`container-type: size`) so the desktop's zoom can't distort it;
  z-index 90 — over the desktop and taskbar, under the CRT scanlines.
  Still pictures under reduced motion. Fonts: Alfa Slab One and Special
  Elite added to index.html's Google Fonts link.
- `People` (`people.js`, `os.people`) — THE place a member's look is
  decided: the shared-auth profile with this site's overrides on top
  (a claim: the character's short name and avatar picture; the colour
  stays the member's). The overrides come from ONE server function,
  `ClaimOverrides` (hobby-server `internal/hxh/rosterdb.go`), by two
  roads: `GET /hxh/api/db/people` at sign-in and after your own claim
  (Binder `stampSel`), and the chat's contacts frames, which the server
  re-sends to everyone on any claim. Draw every avatar with
  `os.people.avatar(who)` / `os.people.of(who)`, and every site name
  with `os.people.label(who)` ("Chrollo (Andrew C)" once claimed —
  the Start menu header and the chat's lines; the buddy list keeps
  plain names) — never
  `icons.avatar()` on a raw profile: the Start menu did that and kept
  showing Andrew's green AC after he claimed Chrollo (2026-09-27, "the
  avatar determination should have been centralized"). The Start menu,
  the buddy list's banner and every chat line go through it.
- `Layout` (`layout.js`) — the desktop as you left it (Andrew,
  2026-09-22: "like they just woke up their desktop computer"). Records
  which app windows are open, where, in what stacking order, which is
  minimized and which is active — nothing of what is IN them — in
  localStorage `hxh.desk.<username>` (per browser, per user, beside
  the settings), debounced on every window event (`window:move` is
  emitted at the end of a drag) and flushed on `pagehide`. `OS.start`
  calls `restore()` once the user is known: when a record exists (even
  an empty one) the page's `autostart` is skipped and each window comes
  back bottom to top through its app's `reopen(id, key)`, with
  `wm.hint(id, {x, y, min})` telling the manager where the FIRST open
  of that window lands (the hint beats the app's own `at`, is clamped
  to the desktop, then forgotten; `min` re-minimizes it). Apps: `owns(id)`
  (default: `win-<app>` and `win-<app>-…`), `key(win)` (a token to
  rebuild a sub-window: the chat's room, the roster's character id),
  **and a `reopen` that brings the window back FULLY**: the base
  `reopen` calls `launch({ restore: true })`, so anything an app only
  does on the boot arrival (`autostart: true`) is skipped on a restore.
  The Summons typed its notice only under `autostart`, so once Andrew
  had a saved desktop the window came back with an empty notice on
  every load and a hard reload never helped (2026-09-27, the text never
  started typing). Reproduce this class of bug by seeding
  `hxh.desk.<user>` in localStorage before the page loads — a fresh
  account has no record and takes the autostart path instead, so it
  looks fine. `launch()` now fills the notice on every path.
  `reopen(id, key)` (default: only the main window, via
  `launch({ restore: true })`; return false for dialogs and transient
  views — they are dropped from the record, as are windows of apps the
  user cannot see). Chat restores the buddy list and rooms, the roster
  its list and character windows; the cracktro, profiles, requests and
  crop windows do not come back.
- `Taskbar` (`taskbar.js`) = `StartButton` + one `TaskButton` per open
  window (kept in step from the bus: press = minimize if active else
  restore; `flash()` on `window:attention` until focused — the chat
  app's cue) + `Tray` (`TrayIcon`s — `{id, icon, title, on, onClick,
  menu}`; a `menu` pops a `Menu` upward — then `Clock` last).
- `StartMenu` (`startmenu.js`) — user header (initials `avatar` +
  name), the vertical band, items from `os.startItems()`: apps, sep,
  Scanlines + system-group apps, sep, Log out.
- `Menus` / `Menu` / `MenuBar` / `renderItems` (`menu.js`) — ONE menu
  implementation for window menu bars, the Start menu and tray menus.
  Items: `{label, icon, check, onclick, disabled, hidden, attrs}` or
  `"sep"`; one open at a time; document click / Escape close all.
- `App` / `AppRegistry` (`apps.js`) — an app declares statics `id,
  name, icon, desktop, menuable, group ("apps" | "system"), order,
  longName`, implements `launch(opts)`, optionally `visible(user)` and
  `tray()`. Desktop icons, the Start menu and tray icons are all
  DERIVED from the registry — nothing lists apps by hand.
  `os.launch(id)`, `os.appItems(group)`. (The Summons is the one
  window with no derived menus: File > Exit alone, 2026-09-27.)
- `Desktop` / `DesktopIcon` / `Backdrop` (`desktop.js`), `Toast`
  (`toast.js`, `os.toast.show(msg)`), `Boot` / `Badge` / `bootLines`
  (`boot.js`), `type()` (`typewriter.js`), `Session` / `Nav`
  (`session.js`, fetch/storage injectable), `LogonDialog` (`logon.js`,
  a Window subclass), `CRT` (`crt.js`, `localStorage hxh.crt`),
  `Sounds` (`sound.js`, WebAudio cues, `localStorage hxh.sound`),
  `Settings` (`settings.js`, per-browser checkable options + the
  standard menu item for them; `OS.appMenus(win, {file, edit, view,
  settings, help})` builds the File/Edit/View/Settings/Help bar every
  app window shares — File always ends with Exit), `ScrollPane`
  (`scrollpane.js`), `WakeWatch` (`wake.js`: browsers have no "woke
  from sleep" event, so the OS emits `wake {reason}` on the proxies —
  `visible`, `online`, `focus`, and `sleep` when a 15 s heartbeat
  arrives > 45 s late while the tab is visible; debounced 2 s; hidden
  tabs' slowed timers are ignored), the chiptune tracker in `Sounds`
  (`playTune` / `stopTune`, `TUNES`, `noteFreq`),
  `Env` (`env.js`: `floating()`, `reduced`, `zoom()`, `width/height`,
  `wait`), `icons.js` (`icon`, `sprite`, `avatar`, `textColorFor`,
  `ICONS` incl. `comment` for chat — see "Icon sizes"), `dom.js` (`h()`, `esc`),
  `wallpaper.js` (below), `os.js` (`OS`), `index.js` (the bundle entry
  and `HxH.*` exports), `os.css` (the chrome).
- **Report a Bug** (`apps/bugs/`, Andrew 2026-09-27): any member reports a
  bug — text and at most one picture in BeetleChat's own compose box (the
  shared `Composer`, `apps/chat/composer.js`: Paste / Image / Emoji tools,
  the field, one attached picture, Send; it does no I/O, it emits `send`,
  `image-file`, `image-dialog`, `clip-fail`, `typing` and its owner uploads
  via `ChatAPI.uploadImage` and hands back `attachImage(ref)`; ChatWindow
  adopts it and forwards its events, so chat code is unchanged). Sending
  POSTs `/hxh/api/bugs` with `bugContext(os)` — page, browser, viewport,
  zoom, theme, sky, open windows, bundle version — so a report can be
  reproduced. Admins get a tray bug with a red count badge (TrayIcon
  `badge`, re-read every minute) that opens Bug Reports (`list.js`:
  Pending / Resolved / All, Resolve / Reopen). Server: hobby-server
  `internal/hxh/bugs.go` (table `hxh_bug_report`, changeset 019); a
  report's picture is a chat picture that admins may also see. Claude's
  side: `hxh-roster/roster.py bugs | bug-image | bug-resolve --note`.
- Apps (`apps/*.js`, each with its own `.css` if it has one): `Summons`
  (window + File > Exit alone + typewriter notice + CTA; EVERY path that
  opens it must fill the notice — see the reopen note above),
  `Binder`, `Chat` (BeetleChat, `apps/chat/`; a buddy chat is 565 wide,
  the global room's window 705 with a 1.5× log and compose — `large`), `About` (group
  "system"), `SetPassword` (desktop/menuable false; its words come in
  as options). `apps/index.js` exports them as `HxH.apps.*`.

Adding an app = one class in `apps/` (statics + `launch`), export it
from `apps/index.js`, list it in the page's `apps`. It gets its icon,
Start / View menu entries and (if `tray()`) its tray icon for free.
Never call `boot`, build a login form, or list apps in a page.

## Build, tests, dev loop (`foundry/website/`)

- `npm run build` (esbuild, `scripts/build.mjs`) bundles
  `html/hxh/os/index.js` + everything it imports (JS and the `.css`
  imports) into `html/hxh/hxh.js` (IIFE, global `HxH`) + `hxh.css` +
  source maps. Unminified, deterministic, COMMITTED — the server is a
  static mirror. Never edit `hxh.js` / `hxh.css` by hand.
- `npm test` runs `node --test tests/` (jsdom, no browser) — one test
  file per module: bus, component, dom, env, icons, menu, window, wm,
  taskbar, startmenu, apps, desktop, toast, typewriter, boot, session,
  crt, logon, os (the whole start flow: cold/warm boot, gate, splash,
  logout), binder (pagination, layout maths, the window, cards, D-pad,
  claim), apps-desktop (summons/about), setpw, wallpaper (pure
  maths), sound, chat-client / chat-app / chat-runs (BeetleChat), and
  `bundle.test.js`, which FAILS when the committed bundle is stale. `tests/dom.js` is the harness (`setupDom({floating,
  reduced, width})`, `fakeFetch`); `tests/loader.mjs` makes `.css`
  imports empty modules under Node.
- **`npm run check` = build + test. Run it before every `ws_prod`**,
  and add/extend a test with every infrastructure change (Andrew:
  "test coverage as part of normal development"). Playwright
  end-to-end tests are a later step; the screenshot harness below
  stays the visual check.
- `node_modules/` is git-ignored; `npm install` once per machine.

## Local e2e stack (rebuilt 2026-09-22)

Docker postgres `hobby-test-pg` on :5434 (dbs `hobby_server_test` +
`hxh_test`, migrated with hobby-server's `hobby-liquibase` image per its
AGENTS.md), the server built from hobby-server and run with its
`config.test.yaml` on :5099, and `foundry/website/scripts/preview.mjs`
(`PROXY=http://127.0.0.1:5099 node scripts/preview.mjs 8768`) serving
`html/` and proxying `/<site>/api/*` → `/api/<site>/*` with the Host
preserved (the hub checks Origin against Host) and the WebSocket
tunnelled. Log in through `POST /admin/api/login` (users andrew / abi /
gon / killua / kurapika, password hunterhunter). Playwright
(playwright-core on system Chrome) drives two contexts; those scripts
are throwaway and live in the session scratchpad.

## BeetleChat — the chat app (`apps/chat/`)

Andrew's spec (items 1–19, 2026-09-18) is `foundry/website/docs/HXH_CHAT.md`;
the name is the Beetle 07 phone from the show. An AIM/MSN-era
messenger on the desktop, and the first app to exercise the whole
component architecture (many windows, tray icons + menus, the bus).

- **Backend** (hobby-server, `internal/hxh/chat.go` + `hub.go`): REST
  under `/hxh/api/chat/` — `contacts`, `history?room=`,
  `profile/{user}` (GET) / `profile` (PUT) — and the WebSocket hub at
  `/hxh/api/chat/ws` (Apache `mod_proxy_wstunnel`). Frames: in `msg`,
  `typing`, `unsend`, `ping`; out `hello {me, contacts}`, `msg`,
  `typing`, `unsend`, `presence`, `pong`, `error`. Any role on hxh may
  chat. Messages are kept forever (`hxh_chat_message`; unsend =
  `deleted_at`); rooms are `global` and `dm:<a>:<b>` (sorted). A user
  only sees messages written after `activated_at` (first password),
  enforced in the history query. Presence from the shared
  `last_seen_at` (every authed request, throttled) + live sockets:
  online < 1 min, away < 1 h, offline, `nopass` (red) = no password.
  Server rate limit 10 msg/s per connection.
- **Frontend**: `apps/chat/app.js` `ChatApp` (id `chat`, name
  "BeetleChat", icon `beetle`, order 15; `tray()` → the app's tray icon,
  lit while connected, with a menu: Contacts, Global chat, My profile,
  — Sounds — Exit (closes every BeetleChat window; the connection and
  the tray icon stay — closing the buddy list alone never exits); the icon is the Beetle 07 phone from the show — a red beetle-
  shaped flip phone with a black head and two antennae). `launch()`
  connects and opens the **buddy list**
  (`contacts.js`, window title just "BeetleChat", tall/narrow at the right
  edge, drawn after AIM 4.x / MSN 4.x from screenshots Andrew asked me
  to study, then toned down at his request ("modeling this on real
  UIs back then just looks too shitty for modern day"): a status
  banner (grey, your avatar, "(Online)"), Online / List tabs
  (`.ltabs` — the binder owns `.tabs` unscoped), a sunken list box
  with a real scrollbar of two collapsible groups — Buddies
  (present/total) and Offline — coloured status DOTS (green/yellow/
  grey/red), grey away/offline names with "(Away)" / "(No password)"
  suffixes, a toolbar IM / Profile / Global acting on the selected
  buddy, and a status bar "Connected · n of m online". Bots are
  indistinguishable from people here (Andrew). One click on a name
  selects it AND opens a chat; right-click gives Send Message /
  Profile) and the **global chat** (behind the contacts, not focused).
  Menus (Andrew's layout): BeetleChat — File (About, Update greyed, —,
  Exit), Edit (Profile…), Settings (✓ Flash on new, ✓ Systray alert,
  ✓ Sounds — `os.settings`, localStorage `hxh.set.*`); global chat —
  File (Exit); a buddy's chat — File (Exit), View (Profile), and a
  Profile button beside Send. File › About opens the **cracktro**
  (`apps/chat/about.js`): ASCII beetle, scrolling greetz, credits to
  purple square, and "Beetle 07", an ORIGINAL chiptune from the OS
  tracker (`Sounds.playTune`, `TUNES` in `os/sound.js`) — Andrew asked
  for Hunter × Hunter MIDI, but those compositions are copyrighted, so
  the music is ours; it stops when the window closes. `window.js` `ChatWindow` — one
  per room (`win-chat-<room>`): the log, the "<name> is typing…" line,
  the compose box (Enter sends, Shift+Enter breaks; no unsend — Andrew
  dropped it as anachronistic). `client.js`
  `ChatClient` — the socket: ping every 25 s; a ping still unanswered
  after `grace` (12.5 s) marks the link dead and `drop()` replaces the
  socket at once — no waiting for a close handshake that a dead link
  never finishes, and measured from the ping (not the last pong) so a
  hidden tab whose timers run once a minute is not mistaken for dead;
  reconnect with backoff (1/2/5/10/30 s); `open {reconnect}` and a
  distinct `reconnect` event after every re-open; `nudge()` on an OS
  `wake`: a known-stale socket is replaced now, a pending backoff is
  skipped, a healthy-looking one is probed (ping; 3 s of silence
  condemns it — a laptop's socket dies in its sleep without any event);
  queue while offline, ≤ 10 messages/s, typing at most every 2 s per
  room; `ChatAPI` for the REST calls.
- **The log (2026-09-22)** — Abi found the AIM-style `name (HH:MM): text`
  lines too text-heavy, so a message row is a grid: a 40 px avatar
  (`os/icons.js` `avatar()` — the initial on a plain disc of the
  member's colour, or, when the contact carries `avatar_url`, a circle
  crop of that picture, `.avatar.pic`; no borders on either — Andrew
  dropped the ring 2026-09-22), a header line
  (`.hd`: `.who` bold in the colour, `.ts` HH:MM), and the body
  (`.bd > .txt`, `.pic`). A run of messages from one sender within
  `GROUP_MS` (5 min) on the same day shows the avatar and header ONCE;
  the rest are `.m.cont` bare lines whose time is a `title` tooltip.
  A new calendar day (reader's zone) gets a centred `.day` line
  between rules, "Tuesday, Sep 22" (`dayLabel`; no year). A claimed
  member's name in the log is "<character> (<display name>)"
  (`ChatApp.chatNameOf`); the buddy list and window titles keep the
  plain name. Contacts arrive in `hello` and again in a `contacts`
  frame whenever a claim is made or released (the server's
  `Contact.character` / `avatar_url` are hxh's overrides of the shared
  profile; `setContacts` re-renders names, avatars and the banner).
- **Resync (2026-09-19)** — Andrew's laptop slept overnight; on wake the
  socket reconnected and new messages arrived, but the night's messages
  never showed until a refresh. Now `ChatApp.resync()` runs on every
  `reconnect` (and after a `sleep`/`online` wake whose probe passed):
  it refetches history for every OPEN room and `ChatWindow.
  mergeMessages()` folds the gap in by id (known ids stay, the log is
  re-laid in id order, capped at 500). A mere `focus`/`visible` wake on
  a healthy socket is one probe ping and no fetch. `profile.js` — `ProfileWindow` (view) and
  `ProfileEditor` (WYSIWYG via `execCommand`: font, size, colour,
  highlight, B/I/U, live count vs 1024). `runs.js` — the profile
  format `{t, b, i, u, font, size, color, bg}[]`, normalised
  identically on both ends and rendered with textContent — never HTML.
- **Read = explicit focus (Andrew, 2026-09-19; NOT how AIM worked).**
  "The most explicit focus is what makes something read": a message
  is read only when it was shown in the ACTIVE window of the TAB THE
  USER IS LOOKING AT (`document.hasFocus()` and visible — injectable
  as `options.hasFocus`). A forgotten browser window behind the others
  never reads anything, even if a chat is its active window. Read
  markers live on the server (`hxh_chat_read`, changeset 008): the
  client sends `{t:"read", room, id}` from `ChatApp.markRead()` (OS
  window focus, tab focus/visibility, a message landing in the active
  window of a focused tab); the server echoes `read` to the user's
  OTHER tabs, which `calm()` the window (flash off without focus,
  `window:calm`) and drop the bubble when nothing newer is showing.
  Every `hello` carries `unread: [{room, count, last_id}]`: each
  unread DM opens BEHIND the active window, flashing; on launch the
  global chat comes to the front LAST (`launching` flag in
  `onUnread`), so being focused it is read at once — global nearly
  always has news after a while and should flash the least. The
  `launch` test asserts this order.
- **Never hand `null` to the DOM's own `append()`** — it prints the word
  "null" (an image-only message did, 2026-09-21). Use the `append()` /
  `h()` helpers in `os/dom.js`, which skip null, or branch first.
- **Presence: a click or key is a person.** `ChatApp.noteInput()`
  (document-level pointerdown/keydown) makes the heartbeats focused for
  a minute and pings at once (throttled 15 s), whatever
  `document.hasFocus()` claims — Abi read a message and never showed
  online (2026-09-21).
- **Presence = focus + keepalive (2026-09-21).** Andrew: an instance
  open in a background tab must stay AWAY, never offline (bots would
  stop DMing), and must not look online either. Two signals on the
  server: FOCUS (a person there — a ping from a focused, visible tab,
  a message, typing, a read marker, a profile or picture save, a page
  load via the shared `/admin/api/me`; NOT Beetle's own socket
  handshake or history/contacts fetches, which use `PeekSession` and
  touch nothing) and KEEPALIVE (an instance open — a live socket, or
  one that dropped < 2 min ago, so reconnects don't flap). online =
  focus < 1 min; away = focus < 1 h OR an instance open; offline
  otherwise. The client's heartbeat carries `focus: true` only when
  `hasFocus()` (`ChatClient({focus})`); a tab focus/visibility change
  pings at once so the buddy list turns green without waiting.
- **You can message the online and the away, not the offline** (nor
  the password-less): the buddy list's IM button and context item are
  disabled for them, a DM window still opens (history is readable) but
  its compose is off with a status note ("Killua is offline";
  `ChatWindow.setCanSend`), and the hub refuses anyway with error code
  `offline` (toast). Bots follow the same rule (`reachable()` in
  `internal/bots/chatbots.go`), so while you are logged out nobody DMs
  you — global is where the news accumulates.
- **Pictures and emoji (2026-09-19)**: compose tools above the box —
  clipboard (pastes text at the caret or attaches a picture via the
  async Clipboard API; Ctrl+V with a picture attaches too), image (the
  Insert Image window: clipboard preview + Insert from Clipboard, or
  Upload…), emoji (a palette, `apps/chat/emoji.js`; any emoji works
  regardless — `--font-emoji` falls back per glyph to the system's
  colour emoji face). ONE picture per message, shown as a block under
  the text, scaled to fit (`.m .pic img`). Bytes live in the DATABASE
  (`hxh_chat_image`, changeset 009), never on disk: `POST
  /chat/image` decodes, scales to ≤ 1600 px and re-encodes (JPEG when
  opaque, else PNG) so what is served is always the server's own
  encoding; `GET /chat/image/{id}` serves it only to its uploader or to
  someone who may read the room it hangs on; the `msg` frame carries
  `image_id`, refused unless it is yours and unsent (`error image`).
  An offline buddy's compose is greyed and says "Abi is offline." in
  italics inside the field.
- **Attention, the Windows way**: a message into a window that is not
  active (or into an unfocused tab) calls `win.requestAttention()` →
  the taskbar button flashes until focused (`window:attention` →
  `TaskButton.flash`), and a "new message" bubble (`tray:add {id:
  "chat-new", icon: "comment"}`) sits in the tray until the last unread
  room has been read; a click on it focuses the oldest unread. An
  incoming DM opens its window WITHOUT stealing focus. Sounds (`os/sound.js`, WebAudio
  synthesis, `localStorage hxh.sound`, toggle in Start / View / tray
  menus): `message`, `sent`, `dooropen` (someone comes online),
  `doorclose` (online → away/offline); never for yourself.
- Tests: `tests/chat-client.test.js` (fake socket + manual clock),
  `tests/chat-app.test.js` (the whole app under the OS with a fake
  socket and fetch), `tests/chat-runs.test.js`, `tests/sound.test.js`;
  Go: `internal/hxh/hub_test.go`. End-to-end: the scratchpad
  Playwright script drives Andrew in Chrome and Abi over a raw socket
  against the LOCAL stack (Postgres in docker + `go run` hobby-server
  + the harness proxying `/*/api/` incl. the WebSocket) — the way to
  screenshot a conversation.
- Cross-repo (hobby-server AGENTS.md N5): the wire format lives in
  `hub.go`'s header comment and `client.js`; change both.

## The Binder (`apps/binder.js` + `apps/binder.css`)

- 2026-09-21: page tabs are smooth (not pixel art) in the binder's own
  blues — `--navy-2` at rest, the open page's tab taller in `--navy-hi`
  with a lit top edge and a glow; Zen Kaku Gothic New 12 px. A card's
  plaque prints the SHORT name (`first`, e.g. "Gon"); the full name
  stays on the screen's info line. The device screen is small type
  (13 px DotGothic, 15 px top line, 9 px Press Start name). A card's
  description is `DESC_MAX` 5.2cqw, and `fitBlock()` (apps/card.js)
  steps it down to `DESC_MIN` only for a text that will not fit its
  box — cards are fitted again after `showPage` (a card mounts before
  its sleeve is in the page, so the mount-time fit sees no width). At
  the Binder's 150 px card that is ~195 characters at full size; the
  six longest descriptions were trimmed to fit (via `roster.py patch`,
  versioned). Check every card with the scratchpad `cards_fit.mjs`
  after changing the type.

The roster as a Greed Island card binder, modelled on Andrew's
screenshots from the show (E66/E67): navy boards with gold clasps; the
left page holds sleeved cards; the right side is a teal control panel —
black display screen on top, two mint keys, a big dial, a square touch
pad with tick marks, a red D-pad. Andrew's spec (2026-09-17):

- Opens from the "Binder" icon / Start / View menu / the summons CTA as a
  **chromeless window** (`chrome: "none"`: managed, in the taskbar,
  Escape closes, but no title bar or frame). The window's minimize +
  close buttons — the same `ChromeButton`s every title bar has — float
  at the book's top-right ("that's where people would look" — Andrew;
  2026-09-18: minimize added with the refactor). Starts CLOSED — front
  cover only (ring emblem, title, BINDER) — click to open.
- **The page turn (2026-09-18):** the cover is the front face of a
  `.flap` hinged at the spine's centre (`transform-origin: left`,
  `perspective: 1800px` on `.book`, `preserve-3d`). Opening rotates it
  −180° over .85s: the free edge flares toward the viewer (the 2.5-D
  trapezoid), the right-hand page with the screen is visible underneath
  the whole time (a `.shade` over the panel fades out as the cover
  lifts), and past 90° the flap's BACK face — the actual card `.page`,
  with a half-spine strip — comes into view and lands on the left. On
  `transitionend` the app moves `.page` into `.leaf` so the open book
  is plain flow layout; `shut()` puts it back on the flap and swings it
  home. Phones and reduced-motion skip the 3-D and just switch. Freeze
  any angle for screenshots with the harness `?demo=binderfreeze&deg=N`.
- **Tabs on top of the left page, one per page**, coloured by Nen type
  with a 2-letter code (EN TR CO EM MA SP), wrapping into a second row
  UPWARD when they overflow. A type never shares a page (9 cards per
  page, 3×3 like the show — Andrew, so cards are taller); a type with
  more than 9 gets more tabs of the same colour (hover title says
  "page n of m"). So the type isn't
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
- Size: fills the screen with slim margins — `binderLayout(vw, vh)` sets
  `--bw/--bh` to the midpoint between the first sizing (≤1180×780) and
  the full desktop above the taskbar (Andrew: "fill halfway the
  margins"; ~1273×815 at 1366×900, leaving room for the tab row) and
  returns the window position; 9 sleeves per page (3×3), sprites 96px
  (6×) on desktop. Closed, the cover sits over the RIGHT page's spot
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
- Data (2026-09-19): the Roster DB — `GET /hxh/api/db/binder`, the
  ACCEPTED characters only, printed by `apps/card.js` (GICard, spec
  `docs/GI_CARD.md`: the real Greed Island card, measured; English
  names that shrink to fit; `card_description` in the box, else the
  profile's first sentence; the 16:9 card picture, else the avatar).
  The card is the ANCHOR: `binderLayout` builds the page as exactly
  3 × 3 cards and the book as two pages + spine in BOOK pixels, then
  shows it all at one CSS zoom that fills 85 % of the desktop (Andrew:
  "the binder is tiny!" on his big monitor); the band's foil is marbled in
  the picture's own saturated hues (skin, white, black discounted),
  weighed by a tight spotlight on the lower third of the frame
  (`CENTER_SIGMA`, `FOCUS` in `card.js`; Andrew 2026-09-22: True
  Bisky's band came out sky-blue because the whole 16:9 frame voted —
  "pink should win for her"; the spotlight sits where a portrait's
  outfit hangs, below the face, so a sky that fills the edges loses).
  Tabs come from `groupCards` (one per group that has cards — one
  character, one tab; Andrew has "a better idea for the tabs" to come).
  A change of SCALE (the Binder's zoom or the desktop's, e.g. an iPad
  turning) rebuilds the current page's cards (`layout()` → `showPage(page,
  sel)`): Abi's iPad once drew every card at about half size inside
  full-size slots after a rotation (2026-09-27). Chrome and Firefox
  measure right; the suspect is Safari keeping the cards' `cqw` from the
  old zoom (a card's width in book pixels never changes). Precautionary,
  unconfirmed — if it recurs, add a debug overlay and measure on the iPad.
  While a leaf turns (opening or closing) the window carries `.turning`
  and the float buttons are hidden, fading back in when it lands
  (`settle`; Andrew, 2026-09-27: they stayed put over the turning cover
  and ruined the page turn).
  TABS are 31 book px wide (40 until 2026-09-27) so fourteen fit one row
  of the page's 474; past that they wrap upward. The CLAIMED pages
  (`paginate`'s third group: claimed cards in card-number order, nine to
  a page, at least one) sit all the way right (`.tab.claimed.first`
  margin-left:auto) with a thick red checkmark (`icon("check")`); a claim
  or release re-paginates like a bookmark does.
  The book's margins drag the window, and so does the whole closed
  cover (Andrew, 2026-09-27): `WindowManager.drag` with an `allow`
  predicate (never a card or a control) and `threshold: DRAG_SLOP`
  (5 screen px) — a press that wanders less stays a click, so a still
  click on the cover opens the book and a travelling one moves it; the
  click the browser sends after a real drag is swallowed so the drag
  never also opens it. The open book shuts from the left page's left
  edge (`.page .edge`, the border plus PAD, cursor pointer, tooltip
  "Close" — the hinge side, where you would take hold of the leaf;
  2026-09-27); it is part of the draggable margin, so the same slop
  applies. The page label ("1 / 10", "Bookmarks", "Claimed") is 16 px,
  centred between the card slots' bottom and the binder's outer bottom
  edge (2026-09-27: first too high, then too low). Claim plates land
  with their bottom-right corner at x 84–91 %, y 78–85 % of the
  description band, ±6° (`PLATE_X/PLATE_Y/PLATE_ROT`), so the whole
  plate sits on the white description box; hxh changeset 020 moved the
  plates stamped before that (they reached 100 × 102 % and lost their
  bottom edge). A pick fills the screen in order (`play`, Andrew 2026-09-27:
  "start with the enlarged card first … then scroll down to do the
  typing"): the whole printed card first (`printed(c)`, the sleeve's
  GICard, stamps included), ABOVE the profile, at BIG_W of the screen's
  width but never taller than it, painting in top to bottom in bands
  over REVEAL_MS (`@keyframes modem`, clip-path — "like images used to
  load with slow modems"); after GLIDE_PAUSE the screen glides down to
  the profile (`.prof`, given a screenful of min-height so its top can
  reach the top) and types it at `TYPE_MS` (4 ms a character). The
  typing follows the reader only while they are at the bottom
  (PIN_SLACK): scroll up to the card and it types on below without
  pulling them back; scroll back down and it follows again. Each own
  follow scroll is recognised by its one event (`run.expect`), never by
  position — a reader returning to the same spot is a reader. A reader
  who scrolls during the paint-in is not glided. Reduced motion: no
  paint-in, no glide, the text typed at once under the card. The
  profile's rules are scoped to `.prof` so they cannot restyle the
  card's own `.name` panel. The float
  buttons (`.fbtns`, os.css) are 14×11 at right 2 px, top
  2 × --px (one simulated pixel below the book's border, not fused
  with it), so they clear the gold rivet 17 px in; the
  chromeless window has no `max-width` (the binder fits itself by its
  zoom — the generic cap, measured inside that zoom, cut the book short
  at 1024 px and stranded the buttons mid-cover). `roster.json` is DEPRECATED — kept for reference
  and as the skill's cross-check, read by nothing.
- Old data: `roster.json` — 198 characters, the complete named cast of the
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
- Pure and tested: `paginate`, `binderLayout`, `TYPES`, `ARCS`,
  `LIMIT`, `PER_PAGE` are exports; the window is built on first launch.

## Music (`apps/music.js`, 2026-09-28)

A player window holding the YouTube embed of one video (VIDEO
`lMmoUqf4Ags`, Wilty's "Hunter x Hunter Lofi … Killua Tokyo Night Mix"),
privacy-enhanced (youtube-nocookie), `autoplay=1`, looping (a single
video loops only as its own `playlist`). A first visit autostarts it
BEFORE the Summons (`autostart: ["music", "summons"]`): the player opens
and plays, then the Summons lands on top, active, its right edge
covering `OVERLAP` = 38 px of the player's left edge — the whole
title-bar icon, none of "Music" — `DROP` px lower (`besideSummons(width)`
lines it up with `SUMMONS_AT` / `SUMMONS_W`, exported by summons.js;
narrower desktops narrow it to `MIN_W` before tucking more under).
No menu bar (File › Exit only repeated the ×, and the overlap cut
"File" to a stray "e"). Sound works because the title screen's click
is a user gesture on the page and the iframe carries
`allow="autoplay"` — verified in Chrome with its real policy
(`--autoplay-policy=document-user-activation-required`): playing,
unmuted. Safari is stricter with sound in embedded players and may show
YouTube's play button instead (unverified: the Playwright WebKit build
here cannot decode YouTube video). Closing the window removes the
iframe (silence); minimizing keeps it playing; the saved desktop
restores an open player, which plays again. YouTube refuses embeds that
send no referrer, hence `referrerpolicy`. On a portrait phone the
window cap (`max-width: 100vw - 40px`) narrows the Summons, so the two
sit side by side instead of overlapping.

## The whale rule — one zoom for the whole site (2026-09-19)

Andrew's final wording: "don't let the whale ever take any more than
85% of the width. so in mobile, i want some ocean shown on each side …
when there is enough real estate naturally that the whale is under
that limit, i want it to scale whatever its natural intent was." So:

- `Env.whale(vw, vh)`: the art is drawn at ONE fixed scale, 5 screen px
  per art px (what a 1366×900 screen showed: island 760 px wide), so a
  big monitor gets the same-sized whale and windows with more ocean and
  sky around them ("when resolution is large, i want it to feel like a
  large resolution desktop" — 40 % of 1920, 30 % of 2560); the cap is
  `0.85·vw/152`; scale = min of the two; `zoom = scale / 5` (1 unless
  the cap bites: 0.44 on a 390×844 phone, 0.75 on a 1024-wide tablet,
  0.89 at 800 px).
- The canvas is exactly the columns and rows the view needs at that
  scale (`geometry(vw, vh)`: island art centred, horizon at 62 %, extra
  sky above and sea below on tall views, clouds spread with the sky,
  glitter hanging from the horizon). It repaints on the OS `resize`
  event.
- `OS.applyZoom()` sets `--zoom` on `<html>`; `body { zoom }` scales
  every window, icon, menu and the taskbar with it. `Env.width/height`
  are in design pixels, so layout code never sees the zoom.
- There is NO phone breakpoint any more: `Env.floating()` is true
  everywhere (opt out with `body.nofloat` / `body.stacked`); the old
  stacking rules live on as `body.stacked …` selectors in os.css,
  binder.css and chat.css, unused. A phone shows the desktop at ≈0.29×
  — Andrew's intent ("for things that are unreadable we'll override
  the style as needed for mobile. but start with that rule").
- Type scale after his second look ("a little too small"): --fs-ui 15,
  --fs-title 15, --fs-body 18, --fs-small 13, --fs-caption 14, kicker
  11, heading 20 — all at zoom 1.

## Wallpaper

`os/wallpaper.js` (`Wallpaper` component → `wallpaper(canvas, {vw, vh})`)
paints an ORIGINAL pixel-art Whale Island on a 304 × (aspect) canvas
(`<canvas class="wall">`, fixed, `object-fit: fill`, `image-rendering:
pixelated`; see the whale rule above), created by the shell once logged in
(never on the logon or invite splash): banded dithered sky, a broad forested hump left of centre,
a low back with the harbour houses and pier — just above the
rooftops, held level right into the tail so there is no dip before
it — that lifts at the tip into a hill-sized fluke with a pale rock
spire (top three rows left off) standing on it, foot sunk into the
green (Andrew, 2026-09-18:
the reference's tail is a white rock structure, not a lighthouse, and
the spire must not look like it floats; a later measured-from-the-
title-card silhouette was rejected — "go back to the previous whale
shape. it was cuter" — so the hump/neck/fluke profile is the keeper),
banded sea
with a reflection. Animated at 8 fps: glitter (after Andrew's anime-sea
gif, measured 2026-09-18) as a NARROW inverted gaussian bell hanging
from the horizon (σ = 12% of the width — Andrew: "not full page width")
— ~65% of the sea deep at the centre, nothing at the sides, a short
strip along the horizon; candidate pixels each twinkling on a 2–4
frame clock, brightest and clumpy at the top and centre, easing off
with depth (peak 0.55, (1−t)^1.4 — a pixel-art density lower than the
gif's 17%, which "looks like too much"), plus stragglers scattered past
the curve that thin with distance so the edge isn't perfect; clouds
(after his pixel-sky jpg) via `cloudSprite(lobes, {scale})` —
the sprite sizes its own canvas from the lobes, because a lobe clipped
by the canvas edge reads as "a piece missing"; six hand-written
shapes after the reference (`SHAPES`: wide cumulus, tall stacked,
one with a long thin tail, a long low bank, a wisp, a tiny puff — keep
every lobe r ≥ 4 unscaled with spacing ≤ r or thin parts fragment into
dots), drawn at scale .6 and placed with wide gaps (Andrew: "smaller
so there's more space between them"): a
cluster of a few LARGE overlapping lobes, top and bottom (scalloped
underside, never a flat base), treated as a bumpy dome — a metaball-
style smooth union so lobes bridge instead of creasing — whose surface
normal is dotted with ONE light from the upper right and quantised to
four tones (white / pale lilac / lilac / lilac-grey). So the white sits
in broad regions on the sides that face the light and the grey along
the underside and lower left, connected and following the silhouette
(Andrew: per-lobe highlights "look like polka dots"; "figure out an
algorithm, test it out yourself first, compare with the reference" —
compare on a scratch test page rendering the sprites beside the
reference crop before changing tones or lobes), drifting very slowly; a flock of birds every 12–40 s; one
static frame under prefers-reduced-motion. Inspired by the anime's
island silhouette but drawn procedurally — no copyrighted image is
used. The pure parts (`islandHeight`, `cloudBounds`, `glints`, the
`SHAPES`) are exported and characterised in `tests/wallpaper.test.js`. Desktop icon labels carry a 1px ink outline to stay readable
over the sky.

## Settings, themes, skies, the blimp (2026-09-19, Andrew's batch)

- **One Settings tree** — `OS.settingsItems({icons})` — is rendered by
  the Start menu (Settings ▸), the tray gear (`icon: "gear"`, replaced
  the scanlines icon) and any app window's Settings menu (window menus pass
  `icons: false`; the Summons has none — File › Exit alone): Display ▸ (Theme ▸, Sky ▸, Scanlines), Sounds ▸ (Sounds), Windows ▸
  (Show all / Hide all / Close all windows) and, last, Other ▸ (Fly the
  blimp, Splash screen ▸ Summons / Player Select / Night) — Andrew, 2026-09-27. Andrew: "keep all our experiments in
  the UI as settings people can toggle". Add a knob there, nowhere
  else. Scanlines is OFF by default (`hxh.crt` in localStorage
  remembers an override). Fly the blimp (2026-09-24, "would help with
  testing") launches one now, greyed while a ship is up or launched
  and still off the edge (`Blimp.flying`, which purges overdue flights
  first) and absent under reduced motion; the splashes stay (they are
  stills there). Windows ▸ acts on `wm.appWindows()` — windows with a
  taskbar button, never static dialogs or popups — via `wm.showAll()`
  (minimized ones back in place, in stacking order), `wm.hideAll()`
  (show-the-desktop; it lets go of the active window FIRST, because
  minimizing one at a time refocuses and lifts the next window, and Show
  all would bring the wrong one back on top) and `wm.closeAll()`
  (minimized ones too, through `wm.close`, so onClose hooks run); each
  item greys when there is nothing for it to do. (A Blimp ▸ Original |
  Pixelated submenu existed 2026-09-24..27; the stale `hxh.set.blimp`
  key in browsers is simply ignored.)
- **Submenus** are a menu-item feature: `{ label, items }` cascades to
  the right (Windows style: hover or click, one sibling open at a
  time, ancestors stay open, a leaf pick closes the chain; up-menus
  like the tray's cascade LEFT and bottom-aligned). `Settings.radio()`
  makes a one-check group; string settings via `getStr/setStr`.
- **Themes** (`os.css`, "THEME TOKENS" + "THEMES"): the chrome uses only
  `--win-*`, `--tb-*` (title bar), `--tbtn-*`, `--btn-*` / `--strong-*`
  (default vs the window's one STRONG action, `.btn.primary`),
  `--menu-*`, `--sel-*`, `--tk-*` (taskbar — a separate control from
  the title bar), `--field-*`, `--dim-fg`. `:root` holds the Win98
  values; a theme is one `html[data-theme="…"]` block (`OS.applyTheme`
  sets it, `Settings › Display › Theme` picks it, remembered per
  browser). Whale Island Tropical / Sea Pumpkin / Sea Pumpkin Pastel
  share a flat construction (thin ink outlines, hard offset shadow,
  DotGothic16 chrome) after the pastel OS Abi found. Brand pieces (logo,
  summons stamp, the Beetle) stay on the brand palette on purpose. To
  add a theme: a block of overrides + an entry in `THEME_OPTIONS`.
  App CSS must use the tokens for anything chrome-like (buttons, tabs,
  banners) — the buddy list does.
- **Sky** (`os/wallpaper.js`, `skyPixel`): original (five linear bands
  + checker dither), gradual (8 bands), noisy gradual (clumpy fray),
  hypergradient (CSS gradient through a transparent canvas), gradient
  (a shade per row), noisy gradient. All but the original follow
  t = (y/HZ)^1.6. The wallpaper repaints on the bus's `sky`.
- **The blimp** (`os/blimp.js`): Netero's airship with a HUNTER ×
  HALLOWEEN banner, every 4–9 min, 50 s across (`FLIGHT_MS`; was 100 s
  until Andrew asked for more speed, 2026-09-27),
  `HxH.os.blimp.launch()` on demand; z-order above the wallpaper, below
  icons and windows. The ship is ABI'S DRAWING — `img/blimp.png`, a
  1289×955 transparent PNG, side view flying WEST (shark nose, ✕✕
  plate, propeller masts, lit cabin, engine pod, stern prop) — shown
  smooth at `SHIP_W` = 240 px (half the first 480: "way too big",
  2026-09-24) by `airshipHTML()`; `.blimp.east .ship` flips it to fly
  east. It replaced the vector SVG ship (2026-09-24). A pixelated
  sprite variant lived 2026-09-24..27 and is gone. The art's
  measurements live beside the code (`ART_W/H`, `ART_LINE_Y/W` = the
  stern's axis line, alpha-weighted, from the PNG): the flyer's
  `margin-top` (`FLYER_TOP`, whole px) + the bridle's start height
  (`ROPE_Y`, the fraction) put the bridle exactly on that line, AND
  hang the cloth so that line meets its midline — re-measure if the
  drawing changes. The banner is an all-orange cloth (`#ffb266`, no
  blue lip), whose cloth and lettering ripple via SMIL `<animate>` on
  path `d` (three phases, looping) — `bannerSVG(text, rope)` builds it
  with the bridle on the trailing side so the letters never mirror.
  The lettering (bold smooth sans, all caps) is centred by its CAPS:
  the textPath's baseline rides the cloth's midline plus half a cap
  height (`LETTER_PX * CAP / 2`), not `dominant-baseline`, which Safari
  ignores on a textPath. The BRIDLE (Andrew, 2026-09-27: "2 coming out
  from the same point… one toward the top of the banner… the other
  toward the bottom… kind of like a triangle") is two `ropePath(rope,
  yq)` lines sharing one start: `OVERLAP` px inside the ship's box ON
  the art's axis line — same ink `#231f20`, `ROPE_W` = the measured
  line's thickness as drawn, softened (`ROPE_SOFT`) to the downsampled
  art's edge — a shared horizontal stretch, then each bends through a
  cubic whose first two control points lie on the line (zero curvature
  leaving the drawing: "smooth derivatives from the image to the
  string") and whose last sits on its straight run's line, ending
  straight at `BRIDLE` = exactly the cloth's top / bottom leading
  corner. The cloth's ripple is HELD at that edge (`ripple(..., held)`:
  amplitude climbs from 0 over `HOLD` px on a smoothstep) so the corners
  never leave the line ends — with a uniform ripple they slid ±2 px
  past them and the lines read as not touching (Andrew, 2026-09-27). Check joins with the zoomed
  screenshot recipe (a DPR-4 clip at the ship's edge, column-by-column
  centre/thickness), not by eye at 1×.
  The wallpaper's frame loop must `clearRect` first: the hypergradient
  sky paints nothing, and without the clear clouds and birds left
  trails (2026-09-20).
- **About is gone** (app, Start entry, Summons' Help). `HxH.os` exposes
  the running OS for demos and screenshots.
- **Defaults (2026-09-21): theme Whale Island Sea Pumpkin, sky
  Hypergradient** (`THEME_DEFAULT`, `SKY_DEFAULT`). Win98 is a choice.
- **Submenus stay on screen**: `Menu.fit()` shifts a cascade up (or
  flips it left) when it would leave the viewport — the Start menu's
  Settings sit at the bottom, so its third level used to vanish under
  the taskbar. Offsets are divided by `--zoom`.
- **The active window's taskbar button is sunken and darker** in every
  theme (`--tk-btn-pressed` = the button colour mixed toward dark), never
  the accent colour. The minimize glyph is a CSS bar (`.tbtn.min::before`)
  with clearance under it, not an underscore on the edge; chromeless
  windows' float buttons (the Binder) are 20×17 in the very corner.

## Icon sizes — one grid, three scales (2026-09-19)

Andrew's rule after seeing 3, 4 and 6 px pixels side by side on the
desktop: pixelation is a system property, like the type scale.

- **Every icon in `ICONS` is a 16×16 grid.** `tests/icons.test.js`
  enforces it. Draw with detail — at the small size every art pixel is
  one screen pixel.
- **Small icons draw at 16 px** (1×, "full resolution", unrealistically
  crisp on purpose): taskbar buttons, tray icons, Start menu and menu
  items, window title bars. `icon(name, 16)`.
- **Desktop icons draw at 60 px from their own 20×20 grids** (2026-09-27,
  Andrew: "25% larger, same pixel granularity … recreate all the icons
  with more pixels"): `DESK` in `os/icons.js`, drawn at `DESK_SCALE` 3
  — the same 3 px cells as the old 48 px icons, about half the
  wallpaper's 5 px whale scale. `Desktop` uses `desktopIcon(a.icon)` in
  a 60 px `.ib`; an app with no 20-grid falls back to its 16-grid at 3×.
  Every desktop app keeps its 16-grid too (taskbar, tray, menus, title
  bars), drawn to the SAME design: the binder is a tall, SIMPLE cover
  — two blues, two gold tabs and only the green emblem, ~37 % down as on
  the app's cover (Andrew: the plate, the BINDER line and corner rivets
  were "too faithful"); the Beetle is the Beetle 07 phone in red (split
  egg shell, dark eyes, Y antenna, all on ONE centre column — odd body
  width); Heavens Arena is a Super Famicom pad (the tower read as a
  pointed hood), mirror-symmetric with equal D-pad arms; the Roster DB
  is a 3D database drum (oval top, curved seams, curved bottom). Odd
  widths where something must sit on a centre line. `tests/icons.test.js`
  holds the size rules and the Beetle's and pad's symmetry.
- **Two exceptions, on purpose**: the Start button's pumpkin (12×12 at
  2× = 24 px — "the pumpkin is unique") and the boot badge's tee (18×14
  at 4×). Don't reuse them elsewhere.
- **Digits (2026-09-21).** Pixelify Sans's own 2 and 5 read as S and Ƨ
  at 13–16 px, worst on a Mac (no hinting). The Win98 chrome stack is
  `"HxH Digits", "Pixelify Sans", …`: a self-hosted, digits-only subset
  of Jersey 15 (`fonts/jersey15-digits.ttf`, OFL, `unicode-range`
  U+0030–0039, native at 15 px) draws every digit, Pixelify the rest.
  The Whale Island themes use DotGothic16, a 16 px bitmap face, so
  their chrome sizes are ALL 16 px (`--fs-ui/title/small/caption`) —
  any other size lands the dots between pixels. Fonts are external to
  the CSS bundle (`scripts/build.mjs`, `external: ["*.ttf"]`).
- The `x` is the show's bold red × (ink-edged); title bars recolour it
  cream via the palette override in `window.js`.
- **Vector icons** (`VICONS` / `vicon(name, size)` in `os/icons.js`):
  smooth 24-grid, 2 px strokes in currentColor, for things that are
  not part of the desktop's pixel world — the Roster DB's crop / paint
  tools (marquee, brush, bucket, dropper, undo, redo, revert, expand,
  crop). Andrew: those must look like standard editor icons.
- Taskbar button labels are `.tlbl`, NOT `.lbl` — `.lbl` is the OS form
  label (uppercase, grey, `margin: 16px 0 6px`) and once styled the
  taskbar by accident, which is why those labels sat 5 px low. Same
  trap as `.ltab`/`.glbl` in the buddy list: check `os.css` before
  reusing a short class name.

## Retro chrome (CSS vocabulary)

- `os/os.css` — tokens (same five colours as before, plus `--ink-4` for
  muted text on cream), window/bevel/button/field styles, taskbar,
  Start menu, menus (`.dd.open`, `.dd.up` for tray menus), toast, boot
  overlay, scanlines, `.task.flash`, phone stacking rules. App-specific
  rules live with the app: `apps/summons.css` (the `.vn` visual-novel
  box), `apps/binder.css`. (`apps/register.*` — the registration
  progress window — was removed 2026-09-22: claiming a card in the
  Binder is the registration now.)
- Class vocabulary: `.win[.static|.chromeless|.popup|.max|.inactive]
  > .tbar (.ico .ttl .tbtn.min/.maxb/.close) + .mbar (.menu > button +
  .dd) + .body`; chromeless windows get `.fbtns` instead of `.tbar`;
  `.taskbar > #startbtn + .tasks (.btn.task) + .tray (.trayicon >
  button + .dd.up, .clock)`; `.startmenu (.user .band .items)`;
  `.icons > .icon (.ib .cap)`; `.boot`, `.badge.os-badge`, `.win.toast`,
  `.backdrop`. `.profile` = fixed modal on phones.
- Breakpoint: `>= 900px` windows float and drag; below, they stack in DOM
  order, min/max buttons hide, desktop icons hide, Start menu is the nav.
- **Type system (2026-09-19, Andrew: "the proportion of fonts don't
  make sense throughout the system … research the actual default
  perceived font sizes for Windows 98/XP and make it systematically
  inherited").** Windows 98 drew all chrome — menus, buttons, title
  bars (bold), icon captions, tray, clock — in MS Sans Serif 8 pt
  (11 px at 96 dpi); XP kept Tahoma 8 pt everywhere with a Trebuchet
  10 pt bold title (≈13 px). Ours is that scale ×1.2, declared ONCE in
  `os/os.css` and used everywhere as `font: var(--t-*)`:
  `--t-ui` 13 px / `--t-ui-bold` (Pixelify Sans, a proportional pixel
  face — title bars are NOT monospace), `--t-title` 13 px bold,
  `--t-body` DotGothic16 (bitmap, native 16 px; renders the kana),
  `--t-chat` (chat messages and the compose box, at DotGothic's native
  16 px — a notch under body, Andrew), `--t-small` (status bars, time
  stamps), `--t-caption` (desktop icons), `--t-kicker` / `--t-heading`
  (Press Start 2P, display only: logotype, stamps, kickers). Current
  numbers are in the `--fs-*` variables. App stylesheets never write font sizes or families; the
  binder's device art (its own fonts) is the one exception. "Realistic
  but if too shitty, a little modernized" — Andrew.
- **No maximize anywhere** (2026-09-19): windows are a set size; title
  bars carry minimize + close in a `.tbtns` cluster with a 2 px gap.
  `requestAttention()` blinks the title bar (`.win.flash`) as well as
  the taskbar button until the window is focused.
- Window menus carry no icons (90s menus had none); the Start menu and
  tray menus keep theirs. Checkable items show a plain ✓ when on and
  nothing when off. Disabled items are grey.
- `ScrollPane` (`os/scrollpane.js`) wraps any scrolling box with an
  always-visible bevelled scrollbar (overlay scrollbars hide; a 90s
  list box never did); the buddy list and chat logs use it.
- Logotype sizes via container-query units and breaks onto two lines in
  windows narrower than 440px.
- Icons are hand-drawn ASCII grids in `os/icons.js` (→ integer-scaled
  SVG); sprites are emoji drawn on a 16px canvas, alpha-thresholded and
  snapped to the web-safe palette — our copyright-free "pixel art".

## Safari: container units under zoom (2026-09-27)

WebKit (Safari, every iPad) applies CSS `zoom` a SECOND time to
container-query units: under a total zoom z, `100cqw` is z × the
container. The page zooms (the whale rule, body `zoom`) and the binder
zooms on top, so on Abi's 820-wide iPad the cards' artwork (all cqw in
`apps/card.css`) drew at 0.917 × 0.705 = 0.646 of the sleeves, on every
load. Blink and Gecko are right. The fix: `cqFix(host)` (`os/dom.js`)
measures the error with a probe and sets `--cqk` = 1 / error on the
host (always set, 1 where the engine is right, so a host overrides what
it inherits); `OS.applyZoom` runs it on `<body>`, the binder on its
window whenever it is shown or re-laid out. EVERY container length is
written `calc(N cqw * var(--cqk, 1))` — `tests/dom.test.js` fails on a
bare one in card.css, binder.css or os.css. (`os/splash.css` still has
bare ones: its layouts are off by the page zoom on narrow screens in
Safari until they are wrapped too.) WebKit also scales `offsetTop` by
the page zoom: use scroll metrics (`scrollHeight - clientHeight`) for
scroll targets, not offsets.

Testing in WebKit here (Arch, no sudo): Playwright's WebKit build
(`npx playwright-core install webkit`, the Ubuntu 24.04 fallback)
needs ICU 74, libxml2 .so.2, flite, harfbuzz-icu, manette, enchant-2,
hyphen (unpacked from Ubuntu noble .debs), libjxl .so.0.8 (a symlink
to Arch's 0.12 works) and libbacktrace (built from
github.com/ianlancetaylor/libbacktrace). They live in
`~/.cache/ms-playwright/webkit-2359/minibrowser-{wpe,gtk}/sys/lib`,
which the MiniBrowser wrapper already puts on its library path; then
`webkit.launch()` just works (it reports WebKit 26.6).

## Previewing / screenshots

There is no local backend. To screenshot the logged-in state, run a stub
server that serves `html/` and fakes `GET /admin/api/me` (200 with
`roles:[{website:"hxh",role:"admin"}]`, or 401 for the gate),
`POST /admin/api/login|logout`, `GET /admin/api/token-info`,
`POST /admin/api/set-password`. Then
`google-chrome-stable --headless=new --screenshot=... --window-size=1366,900
--virtual-time-budget=20000 URL` (virtual time fast-forwards the
typewriter). Inject a `<script>` that clicks tiles / the Start button to
capture interactive states — but the OS builds the whole DOM after
boot + logon, so poll until `#win-summons` exists and has painted
before clicking anything. Check 1366 (side-by-side), 1100 (cascade) and
390@2x (phone). Unit tests (`npm test`) cover behaviour; screenshots
cover looks — do both before shipping.

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

- The admin-only Roster DB page (`roster.html`) was removed 2026-09-18;
  `GET /hxh/api/roster` and the PUT below still exist for the push
  script.
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

The site chrome (`os/os.css` + `os/*.js` + `apps/*`), the set-password
pages (`_invite/`, `_reset/` via `apps/setpw.js`), and the emails
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
  ASCII grids in `os/icons.js`.
- Must work well on phones — guests will register from their phones.
- UI copy stays terse (see the hub CLAUDE.md UI-writing rule); the retro
  chrome is allowed to be decorative (menu bars, fake progress bar, clock).

## Publishing

See `../CLAUDE.md` for the `ws_prod` deploy alias (must be run from the
`html/` directory, master branch only); `ws_stag` publishes the same tree
under `/.staging/` for previews. Before deploying: `cd
foundry/website && npm run check` (rebuilds `hxh.js`/`hxh.css` and
runs the tests), then bump the `?v=` on `hxh.js`/`hxh.css` in
`index.html`, `_invite/index.html` and `_reset/index.html`.

## Roster DB (2026-09-19)

The curated character base, rebuilt from scratch one character at a
time (Andrew: the 2026-09-17 automated roster lost too much quality;
`roster.json` is now only a cross-check). Two halves:

- **The app** `apps/roster/` — a desktop app for hxh admins (and the
  site-wide `admin` role) only. Andrew: Abi will do a lot of the
  cropping, so it must be in theme and fun, not a plain admin page.
  `app.js` (RosterApp, icon `db`) opens the list (`list.js`: 90s
  details view, 1280 wide so nothing clips; the header row sits INSIDE
  the sunken list so it lines up with the rows; every verdict shows,
  pending first, then accepted, then rejected, View narrows; Pics is
  one count per category in category order; Enter or double-click
  opens), one window
  per character (`character.js`: avatar 1:1 + card 2:3 slots; a Review
  group box — verdict, version, reason, log with owners, Accept /
  Reject… (reason optional) / Pending; the profile as a dialog form
  saved on change, arms / description / notes in the smaller DotGothic
  size; Pictures: every category always listed — Random (found by the
  skill), Uploaded, Cropped, Pixel art, Upscaled, Transparent — with
  square thumbnail slots: between 2:3 and 3:2 the picture shows whole
  at its own proportion, beyond that the short side shows and `<<`/`>>`
  chevrons mark the cut; toolbar on the selected tile: Set as Avatar
  (1:1 only), Set as Card (2:3 only), Crop, Open in New Tab, Delete
  (asks), Upload…; drop files to upload; double-click a tile to crop),
  one crop window per picture (`crop.js` on `paint.js`: the picture on
  a canvas, always shown whole; tools marquee / brush / bucket (exact
  match) / eyedropper, brush size, the 16 Paint colours + the
  browser's picker, undo / redo / revert (asks) on a whole-state
  history (PaintDoc), expand canvas (+20 px white each side); ratio
  buttons 1:1 Avatar, 2:3 Card, … start a centred selection; status
  bar reads the box or the picture size; Save (also File › Save)
  sends the box to the server untouched or uploads the painted pixels,
  then the window closes, and a 1:1 or 16:9 result fills an EMPTY
  avatar or card slot by itself), 90s message boxes (`dialogs.js`), and
  `busy.js` — every database call freezes its window under an
  hourglass. `fields.js` is the ONE place field labels (Name … Card
  Rank … Notes) and picture categories (Random, Uploaded, Edited, …)
  are spelled; the list headers and the form labels both read it.
  Thumbnails show whole between 16:9 and 9:16, chevrons beyond. A
  ratio button pressed again cancels the selection. Every change bumps the character's version; a verdict
  is logged against the version it judged. Backend: hobby-server
  `internal/hxh/rosterdb.go`, tables `hxh_char`, `hxh_char_image`,
  `hxh_char_review` (changesets 006–007; `owner` on all three), API
  `/hxh/api/db/*`. Tests: `tests/roster-app.test.js`,
  `tests/roster-geometry.test.js`.
- **The skill** `.claude/skills/hxh-character/SKILL.md` (repo root)
  is the process for adding ONE character as pending, acting as the
  shared-auth bot user **claude** (admin on the `admin` website; owns
  what it finds), with tools in `foundry/website/hxh-roster/`:
  `roster.py` (the API; `claude_access.sh [--local]` writes its
  login to `~/.claude/hxh-roster.env`) and `wiki.py` (Fandom via the
  MediaWiki API, incl. a numbered contact sheet — LOOK before choosing
  pictures). Reviews feed back into the skill text — that is the
  point. `CHARACTER.md` there is the superseded roster.json checklist.

Pictures are anime stills from the wiki (and Andrew's / Abi's own
uploads), so the "no copyrighted art" line under Design direction no
longer holds for character pictures; the site chrome stays original.

## Preferences are per user (2026-09-28)

Settings, Scanlines and Sounds all read and write through `os.profile`
(`os/profile.js`), a Storage-shaped wrapper: keys land under
`hxh.u.<username>:<key>` in localStorage, so users sharing a browser keep
their own picks. Signed out there is no profile: defaults only, writes
stay in memory. The old per-browser keys (`hxh.set.*`, `hxh.crt`,
`hxh.sound`) are dropped at the first sign-in, never adopted: adopting
them handed a new user someone else's Tropical theme — every first-time
user starts on the defaults (Sea Pumpkin). `setUser` re-applies the theme and scanlines. Never hand a
new store `localStorage` directly — hand it `os.profile`.

## Phones (2026-09-28)

- `Env.small`: the screen's shorter side under `SMALL_SCREEN` (600 CSS px)
  — a phone either way up, never a tablet. Roster DB on a phone shows a
  `MessageDialog` ("needs a tablet or desktop screen") instead of its list
  and is not restored by the saved desktop; every splash adds
  `BEST_VIEWED` ("Best viewed on a tablet or computer") at its foot.
- Window drags (`wm.drag`) divide the pointer by the page zoom AND the
  window's own `style.zoom` (the Binder scales itself), and start from the
  window's own `style.left/top` — WebKit scales `offsetLeft/Top` by the
  zoom. The Binder's `.book` is `touch-action: none` (a drag handle, like
  a title bar) or the browser turns a finger drag into a page scroll.
- The Summons types its notice again on every opening.
- Chat logs stay pinned to the newest line (`stickToBottom`: a
  ResizeObserver and picture loads rescroll unless the reader scrolled up).
- Music on phones: browsers may refuse autoplay with sound; accepted
  (Andrew: "it's okay if phones block music").
