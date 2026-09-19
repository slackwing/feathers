# hxh front-end — code review and refactor plan (2026-09-18)

> **Status: shipped 2026-09-18.** Everything in §2–§4 landed in one
> commit: `html/hxh/os/*` (OS), `html/hxh/apps/*` (apps), the esbuild
> bundle `hxh.js`/`hxh.css`, 117 jsdom tests under
> `foundry/website/tests/`, `npm run check`. `retro.js`, `binder.js`,
> `pwpage.js`, `retro.css`, `binder.css` and `roster.html` (the Roster
> DB app, item 20) are deleted. The living reference is now
> `html/hxh/CLAUDE.md` ("The OS", "Build, tests, dev loop"); this file
> stays as the record of why. Deltas from the plan: `App.group`
> ("apps" | "system") and `longName` were added so the Start menu and
> the summons View/Help menus can be derived from the registry; the
> `SetPassword` machinery is reached as a free identifier (it is a
> top-level `const`, not a window property); `Env`, `Session`, `Nav`
> and `fetch` are injectable so the whole `OS.start()` flow runs under
> jsdom.

Andrew: "a consistent user and developer experience for this whole
site … refactor the entire codebase so that everything is
component-ized … extremely pedantic object oriented component-driven
architecture so we are maximally DRY … an app registry … event-driven
… test coverage as part of normal development."

## 1. Review of what exists

`html/hxh/retro.js` (957 lines, one IIFE, one global `Retro`),
`binder.js` (276, global `Binder`), `pwpage.js` (41, global `PwPage`),
`index.html` (207, ~130 lines of inline page script), `roster.html`
(160, its own copy of the OS boot), `retro.css`, `binder.css`.

What is wrong, concretely:

- **One bag of functions.** `retro.js` mixes the window manager, the
  taskbar, menus, the start menu, boot, session, the logon dialog, the
  wallpaper, icons, toast, typewriter and the OS orchestration in one
  closure with shared mutable state (`wins`, `activeId`, `taskbar`,
  `startmenu`, `menuItems`, `currentUser` …). Nothing is instantiable
  or testable in isolation.
- **Windows are DOM conventions, not objects.** A window is a `.win`
  div with `data-*` attributes; `register()` reads them and builds a
  title bar with `innerHTML`; `spawn()` is a second way to make one.
  The binder makes its own chromeless window and its own ✕ button.
  Min / max / close are three ad-hoc `<button>`s whose handlers close
  over ids.
- **The taskbar re-renders everything.** `renderTasks()` wipes and
  rebuilds all task buttons on every focus/open/close; there is no
  task-button object to flash later (chat spec item 14), and the tray
  is a hard-coded scanlines toggle + clock string in `innerHTML`.
- **Menus are three implementations.** Window menu bars (`wireMenus`
  over HTML), the start menu (`renderStart`), and nothing yet for tray
  menus. Items are HTML in the page for menu bars and objects for the
  start menu.
- **Apps are not a concept.** index.html hand-lists desktop icons, the
  start menu, the View menu and the `ACT` map — four places that must
  agree about which apps exist. Summons / Register / About live as
  static HTML in the page; Binder is a module; the password dialog is a
  third pattern (`PwPage`). roster.html copied the OS bootstrap and
  broke it (opening it "clears all other apps").
- **Communication is direct calls.** Apps reach into `Retro.*`; there is
  no bus, so the taskbar cannot react to an app event (a new message)
  without being edited.
- **No tests, no build.** Cache-busting is a hand-bumped `?v=` on each
  page; three script globals depend on load order.

What is right and should survive unchanged in spirit: the retro CSS
and its class vocabulary (`.win .tbar .tbtn .mbar .dd .taskbar .tray
.startmenu .boot .badge .avatar`, phone rules), the wallpaper painter
and `cloudSprite`, the boot / logon / warm-navigation behaviour, the
binder's page turn and card layout, the `SetPassword` machinery in
`/admin/assets/setpw.js` (shared with other sites — outside this
refactor).

## 2. Target architecture

Source is ES modules under `html/hxh/os/` (the OS) and `html/hxh/apps/`
(the apps), bundled by esbuild into ONE served file `html/hxh/hxh.js`
(+ `hxh.css`, + source maps), so a page loads one script with one `?v=`
and Node tests import the same modules directly.

```
os/bus.js         EventBus — on/off/once/emit; handlers isolated
os/component.js   Component — el, props, render(), mount/unmount, listen(bus) auto-cleanup, own events
os/dom.js         h(), esc(), $()
os/env.js         Env — floating(), zoom(), reduced, wait(), matchMedia-safe
os/icons.js       ICONS grids, icon(), sprite(), avatar(), textColorFor()
os/window.js      ChromeButton, TitleBar, Window (chrome: full | static | none; float buttons for chromeless)
os/wm.js          WindowManager — the only thing that opens/closes/focuses/places; emits window:* on the bus
os/menu.js        Menu (items → DOM, check/sep/disabled), MenuBar, Menus (global close)
os/taskbar.js     Taskbar = StartButton + TaskButton[] (one per window, updated by bus) + Tray (TrayIcon[], Clock)
os/startmenu.js   StartMenu = user header + band + Menu
os/apps.js        App (base) + AppRegistry — the single source for desktop icons, start menu, View menus, tray icons
os/desktop.js     Desktop (icons from the registry), Backdrop
os/toast.js       Toast
os/typewriter.js  type()
os/boot.js        Boot + Badge
os/session.js     Session (fetch-injectable), nav.go()/warm
os/logon.js       LogonDialog (a static Window)
os/crt.js         CRT toggle (storage-injectable)
os/wallpaper.js   wallpaper(), cloudSprite()
os/os.js          OS — wires the above; start({apps, autostart, gate, taskbar, wallpaper, boot})
os/index.js       bundle entry: exports + window.HxH
apps/summons.js   SummonsApp (menu bar derived from the registry)
apps/binder.js    BinderApp (chromeless window with float minimize + close)
apps/register.js  RegisterApp
apps/about.js     AboutApp
apps/setpw.js     SetPasswordApp (the _invite/ and _reset/ skin)
```

Rules:
- Every visible thing is a `Component` subclass with `render()`; no
  `innerHTML` of whole regions from outside the component.
- Cross-component communication goes over the `EventBus` (`window:open`,
  `window:close`, `window:minimize`, `window:focus`, `window:maximize`,
  `window:title`, `window:attention`, `tray:add`, `tray:remove`,
  `app:launch`, `session:user`, `crt`). The taskbar never calls an app;
  an app never touches the taskbar.
- Apps subclass `App` (`id`, `name`, `icon`, `desktop`, `launch()`,
  optional `tray()` / `visible(user)`), registered once; icons, menus and
  tray derive from the registry.
- One window class; chrome variants are options, not copies. The
  binder's ✕ becomes the chromeless float cluster (minimize + close).
- Pages contain no app code: `HxH.start({...})`.

## 3. Testing

`foundry/website/package.json`: `npm test` = `node --test` over
`tests/*.test.js` with jsdom (fast — no browser); `npm run build` =
esbuild; `npm run check` = both. A test compares the committed bundle
with a fresh build so a stale `hxh.js` fails `npm test`. Tests cover the
infrastructure (bus, component, window, wm, taskbar, tray, menus, start
menu, registry, session, boot, typewriter, toast, OS start flow) and the
binder's pure logic (pagination, layout). Playwright later.

Developer loop: edit → `npm run check` → screenshot with the harness →
commit (bundle included) → `ws_prod`.

## 4. Steps
1. Tooling: package.json, build script, gitignore, tests/dom.js.
2. Port `retro.js` into `os/*` as classes; port CSS moves (retro.css →
   os/os.css, binder.css → apps/binder.css, bundled to hxh.css).
3. Apps: Summons, Binder (+ float min/close), Register, About, SetPassword.
4. Pages: index, _invite, _reset rewritten to `HxH.start`; roster.html
   and the Roster DB app removed (Andrew, item 20; the server API stays
   for the roster push).
5. Tests, build, harness screenshots (desktop, binder, logon, invite,
   phone), deploy, docs, memory.
