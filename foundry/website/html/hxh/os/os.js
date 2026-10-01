/* OS — the shell every hxh page runs inside. It owns what must never be
   re-added per page (Andrew's rule): the boot sequence on every cold load,
   the session lookup, the logon dialog, the wallpaper (only once logged
   in), the taskbar / Start menu / tray, and logout. Pages register apps
   and call start(); everything on screen after that is a Component, and
   everything they say to each other goes over `bus`.

   Bus events: window:add/remove/open/close/minimize/focus/title/
   attention {id}, tray:add {spec} / tray:remove {id} / tray:refresh,
   app:register / app:launch {id}, session:user {user}, crt {on}, resize,
   wake {reason} (the machine or the tab came back — see wake.js), os:ready. */
import { EventBus } from "./bus.js";
import { Live } from "./live.js";
import { Env } from "./env.js";
import { Session, Nav } from "./session.js";
import { CRT } from "./crt.js";
import { AppRegistry } from "./apps.js";
import { Desktop, Backdrop } from "./desktop.js";
import { WindowManager } from "./wm.js";
import { Taskbar } from "./taskbar.js";
import { StartMenu } from "./startmenu.js";
import { People } from "./people.js";
import { Splash, EmberBackdrop, SPLASHES, STARTUP_SPLASH } from "./splash.js";
import { Toast } from "./toast.js";
import { Boot, Badge, badgeHTML, bootLines } from "./boot.js";
import { LogonDialog, AccountDialog, AnonymousDialog } from "./logon.js";
import { Wallpaper } from "./wallpaper.js";
import { Menus } from "./menu.js";
import { Sounds } from "./sound.js";
import { Settings } from "./settings.js";
import { Profile } from "./profile.js";
import { icon } from "./icons.js";
import { SITE, ANONYMOUS, anonymous } from "./roles.js";
export { SITE, ANONYMOUS, anonymous };
import { WakeWatch } from "./wake.js";
import { Blimp } from "./blimp.js";
import { cqFix } from "./dom.js";
import { Layout } from "./layout.js";

/* Settings › Display choices (the values are what localStorage keeps). */
/** What an account with no role on SITE is told (Andrew, 2026-09-28). */
export const NO_ROLE = "No role assigned. Contact system administrator.";
export const THEME_KEY = "theme", THEME_DEFAULT = "seapumpkin";   // Andrew, 2026-09-21
export const THEME_OPTIONS = [
  ["win98", "Win98"],
  ["tropical", "Whale Island Tropical"],
  ["seapumpkin", "Whale Island Sea Pumpkin"],
  ["seapumpkin-pastel", "Whale Island Sea Pumpkin Pastel"],
];
export const SKY_KEY = "sky", SKY_DEFAULT = "hypergradient";   // Andrew, 2026-09-21
export const SKY_OPTIONS = [
  ["original", "Original"],
  ["gradual", "Gradual"],
  ["noisy-gradual", "Noisy Gradual"],
  ["hypergradient", "Hypergradient"],
  ["gradient", "Gradient"],
  ["noisy-gradient", "Noisy Gradient"],
];

/** Every face the OS and its apps draw with — ONE list, loaded by start() on every page (the desktop and the account
    pages alike), so no page's <head> can fall behind (the invite page's did: no splash faces). */
export const FONTS_URL = "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Alfa+Slab+One&family=Special+Elite&family=DotGothic16&family=Pixelify+Sans:wght@400;500;600;700&family=Bodoni+Moda:wght@700;800&family=Crimson+Pro:wght@500;600&display=swap";

/** The tab's icon: the Start button's pumpkin (Andrew, 2026-09-29), drawn by the same sprite, set by every OS page. */
export function faviconHref() {
  const svg = icon("pumpkin", 64).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" ');
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

/** Put the favicon link in <head> once. */
export function loadFavicon(doc) {
  if (!doc?.head || doc.querySelector("link[data-os-icon]")) return;
  const l = doc.createElement("link");
  l.setAttribute("rel", "icon"); l.setAttribute("type", "image/svg+xml"); l.setAttribute("href", faviconHref()); l.setAttribute("data-os-icon", "");
  doc.head.append(l);
}

/** Put the font links in <head> once. */
export function loadFonts(doc) {
  if (!doc?.head || doc.querySelector("link[data-os-fonts]")) return;
  const link = (attrs) => { const l = doc.createElement("link"); for (const [k, v] of Object.entries(attrs)) l.setAttribute(k, v); doc.head.append(l); return l; };
  link({ rel: "preconnect", href: "https://fonts.googleapis.com" });
  link({ rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" });
  link({ rel: "stylesheet", href: FONTS_URL, "data-os-fonts": "" });
}

export class OS {
  constructor({ win = globalThis.window, fetch, session, env, nav } = {}) {
    this.win = win;
    this.doc = win.document;
    this.bus = new EventBus();
    this.live = new Live({ doc: win?.document });
    this.env = env || new Env(win);
    this.fetch = fetch || win.fetch?.bind(win) || globalThis.fetch?.bind(globalThis);
    this.session = session || new Session({ fetch: this.fetch });
    this.nav = nav || new Nav({ storage: win.sessionStorage, location: win.location });
    /** This OS is inside another page — the site opened in HunterNet (apps/browser.js). */
    this.framed = (() => { try { return win.top !== win; } catch { return true; } })();
    this.profile = new Profile({ storage: win.localStorage });   // every preference, per user (os/profile.js)
    this.crt = new CRT({ body: this.doc.body, storage: this.profile, bus: this.bus });
    this.sounds = new Sounds({ storage: this.profile, AudioContext: win.AudioContext || win.webkitAudioContext });
    this.settings = new Settings({ storage: this.profile });
    this.layout = new Layout({ os: this, storage: win.localStorage });
    this.registry = new AppRegistry(this);
    this.user = null;
    this.people = new People({ fetch: this.fetch, bus: this.bus, user: () => this.user });   // every avatar and site name goes through here
    this.ready = false;
  }

  /** Build the chrome. Idempotent. */
  setup({ start = false, taskbar = true } = {}) {
    if (this.wm) return;
    const body = this.doc.body;
    Menus.install(this.doc);
    this.crt.apply();
    this.applyTheme();

    const existing = this.doc.getElementById("desktop");
    this.desktop = new Desktop({ registry: this.registry, user: () => this.user, el: existing });
    this.desktop.mount(existing ? null : body);
    this.desktop.on("launch", id => this.launch(id));
    this.wm = new WindowManager({ bus: this.bus, env: this.env, desktop: this.desktop.el });
    this.layout.watch();

    this.toast = new Toast().mount(body);
    this.boot = new Boot({ env: this.env }).mount(body);
    this.backdrop = new Backdrop().mount(body);

    if (taskbar) {
      this.taskbar = new Taskbar({ bus: this.bus, wm: this.wm, start }).mount(body);
      this.taskbar.el.hidden = true;   // nothing else on screen while booting / logging on
      if (start) {
        this.startMenu = new StartMenu({ items: () => this.startItems(), user: () => this.user && this.people.of(this.user), label: () => this.user && this.people.label(this.user) }).mount(body);
        this.taskbar.on("start", () => this.startMenu.toggle());
        this.startMenu.on("open", () => this.taskbar.startButton.setPressed(true));
        this.startMenu.on("close", () => this.taskbar.startButton.setPressed(false));
      }
      // the gear: the same Settings tree the Start menu shows, popping up from the tray
      this.taskbar.tray.add({ id: "settings", icon: "gear", title: "Settings", on: true, menu: () => this.settingsItems() });
    }

    this.doc.addEventListener("keydown", e => { if (e.key === "Escape") this.wm.handleEscape(); });
    this.wake = new WakeWatch({ win: this.win, bus: this.bus }).start();
    this.applyZoom();
    let rt;
    this.win.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => { this.applyZoom(); this.wm.relayout(); this.bus.emit("resize"); }, 120);
    });
  }

  /** The whale rule: zoom the whole desktop so the island is the middle half of the view. */
  applyZoom() {
    const z = this.env.wantedZoom?.() ?? 1;
    this.doc.documentElement.style.setProperty("--zoom", String(z));
    if (this.doc.body) cqFix(this.doc.body);   // Safari scales container units by the zoom again: cancel it (os/dom.js)
    return z;
  }

  /**
   * THE Settings tree (Andrew, 2026-09-19: "keep all our experiments in
   * the UI as settings people can toggle") — one source rendered by the
   * Start menu (Settings ▸), the tray gear, and any app's Settings menu.
   * Cascading submenus, Windows style. Choices persist per browser
   * (`Settings`, localStorage); Scanlines is off by default. Window menus
   * carry no icons (90s menus didn't), so `icons: false` strips them.
   */
  settingsItems({ icons = true } = {}) {
    const st = this.settings;
    const items = [
      { label: "Display", icon: "crt", items: () => [
        { label: "Theme", items: () => st.radio({ key: THEME_KEY, def: THEME_DEFAULT, options: THEME_OPTIONS, onChange: v => this.applyTheme(v) }) },
        { label: "Sky", items: () => st.radio({ key: SKY_KEY, def: SKY_DEFAULT, options: SKY_OPTIONS, onChange: v => this.applySky(v) }) },
        { label: "Scanlines", check: () => this.crt.on, onclick: () => this.crt.toggle() },
      ] },
      { label: "Sounds", icon: "sound", items: () => [
        { label: "Sounds", check: () => this.sounds.on, onclick: () => this.sounds.toggle() },
      ] },
      // Windows ▸ (Andrew, 2026-09-27): the desktop's app windows — each greyed when there is nothing for it to do
      { label: "Windows", icon: "windows", items: () => {
        const ws = this.wm.appWindows().filter(w => w.state.open), hidden = ws.filter(w => w.state.minimized).length;
        return [
          { label: "Show all windows", disabled: !hidden, onclick: () => this.wm.showAll() },
          { label: "Hide all windows", disabled: hidden === ws.length, onclick: () => this.wm.hideAll() },
          { label: "Close all windows", disabled: !ws.length, onclick: () => this.wm.closeAll() },
        ];
      } },
      // Other ▸ — last (Andrew, 2026-09-27). Fly the blimp (2026-09-24, "would help with testing"): greyed while one is up or
      // launched and still at the edge, absent under reduced motion. Splash screen ▸ any of the title screens again, over the
      // desktop, until clicked.
      { label: "Other", icon: "other", items: () => [
        ...(this.env.reduced ? [] : [{ label: "Fly the blimp", disabled: !!this.blimp?.flying, onclick: () => this.blimp?.launch() }]),
        { label: "Splash screen", items: () => SPLASHES.map(([id, label]) => ({ label, onclick: () => this.showSplash(id) })) },
        ...(this.registry.has("about") ? [{ label: "About", onclick: () => this.launch("about") }] : []),   // its only door (Andrew, 2026-10-01)
      ] },
    ];
    const strip = list => list.map(it => (it === "sep" ? it : { ...it, icon: undefined, items: it.items ? () => strip(typeof it.items === "function" ? it.items() : it.items) : undefined }));
    return icons ? items : strip(items);
  }

  /** The current theme / sky (Settings › Display), applied to the page. */
  get theme() { return this.settings.getStr(THEME_KEY, THEME_DEFAULT); }
  get sky() { return this.settings.getStr(SKY_KEY, SKY_DEFAULT); }
  /** Choose (persist) and apply; unknown names fall back to the default. */
  applyTheme(name = this.theme) {
    if (!THEME_OPTIONS.some(([v]) => v === name)) name = THEME_DEFAULT;
    this.settings.setStr(THEME_KEY, name);
    this.doc.documentElement.dataset.theme = name;
    this.bus.emit("theme", { name });
    return name;
  }
  applySky(name = this.sky) {
    if (!SKY_OPTIONS.some(([v]) => v === name)) name = SKY_DEFAULT;
    this.settings.setStr(SKY_KEY, name);
    this.bus.emit("sky", { name });
    return name;
  }

  /**
   * The standard menu bar every app window shares (Andrew: "File menu
   * etc. should be a standard part of the OS"): File always ends with
   * Exit (closes the window); Edit / View / Settings / Help appear when
   * the app supplies them. Sections are arrays or functions returning
   * arrays, evaluated when the menu opens.
   */
  appMenus(win, { file, edit, view, settings, help } = {}) {
    const call = x => (typeof x === "function" ? x() : x) || [];
    const menus = [{ label: "File", key: "F", items: () => { const f = call(file); return [...f, ...(f.length ? ["sep"] : []), { label: "Exit", onclick: () => win.close() }]; } }];
    if (edit) menus.push({ label: "Edit", key: "E", items: () => call(edit) });
    if (view) menus.push({ label: "View", key: "V", items: () => call(view) });
    if (settings) menus.push({ label: "Settings", key: "S", items: () => call(settings) });
    if (help) menus.push({ label: "Help", key: "H", items: () => call(help) });
    return menus;
  }

  /** Apps by group: [{ label, icon, onclick }] for menus. */
  appItems(group = "apps", { except = null, long = false, icons = true } = {}) {
    return this.registry.visible(this.user, { desktop: false, menuable: true })
      .filter(a => (a.constructor.group || "apps") === group && a.id !== except)
      .map(a => ({ label: long ? (a.constructor.longName || a.name) : a.name, ...(icons ? { icon: a.icon } : {}), onclick: () => this.launch(a.id) }));
  }

  /** The Start menu: every desktop app (derived from the registry, like the icons), Settings ▸, system apps, Log out. */
  startItems() {
    return [
      ...this.appItems("apps"),
      "sep",
      { label: "Settings", icon: "gear", items: () => this.settingsItems() },
      ...this.appItems("system"),
      "sep",
      { label: "Log out", icon: "door", onclick: () => this.logout() },
    ];
  }

  setUser(user) {
    this.user = user || null;
    if (this.profile.setUser(this.user?.username)) { this.applyTheme(); this.crt.apply(); }   // their own picks, now that we know who
    if (this.user) this.people.load();   // the site's overrides (a claim) — the Start menu reads them on open
    this.bus.emit("session:user", { user: this.user });
    this.desktop?.refreshIcons();
    this.syncTray();
  }

  /** Give every visible app that asks for one a tray icon. */
  syncTray() {
    if (!this.taskbar) return;
    for (const app of this.registry.all()) {
      const spec = app.visible(this.user) ? app.tray() : null;
      const has = this.taskbar.tray.has(app.id);
      if (spec && !has) this.bus.emit("tray:add", { id: app.id, icon: app.icon, title: app.name, ...spec });
      else if (!spec && has) this.bus.emit("tray:remove", { id: app.id });
    }
  }

  /** The signed-in account is the anonymous viewer. */
  get anonymous() { return anonymous(this.user); }

  /** Any role on the site: a member. */
  member(user = this.user, site = SITE) { return (user?.roles || []).some(r => r.website === site); }

  /** The gate for an account with no role here: a message in the logon's frame, and Log out. The desktop never comes up. */
  noRole() {
    this.desktop.center(true);
    this.doc.body.classList.add("logon");
    const dlg = new AccountDialog({ id: "win-norole", subtitle: "No role", lead: `<p>${NO_ROLE}</p>`,
      body: `<div class="actions"><button class="btn primary wide" type="button" data-act="logout">Log out</button></div>` });
    this.wm.add(dlg);
    dlg.el.querySelector('[data-act="logout"]').addEventListener("click", () => this.logout());
    this.wm.open(dlg.id, null, { scroll: false, jank: true });
    return this;
  }

  isAdmin(site = SITE) {
    return (this.user?.roles || []).some(r => r.website === site && r.role === "admin");
  }

  /** The Summons splash's ink and rising embers, without its title, under the windows (os/splash.js EmberBackdrop). */
  showEmbers() {
    if (this.embers) return;
    const body = this.doc.body;
    this.embers = new EmberBackdrop({ reduced: !!this.env.reduced }).mount(body, { before: body.firstChild });
  }

  showBadge() { if (!this.badge) this.badge = new Badge().mount(this.doc.body); }
  hideBadge() { this.badge?.unmount(); this.badge = null; }

  startWallpaper() {
    if (this.wallpaper) return;
    const body = this.doc.body;
    this.wallpaper = new Wallpaper({ env: this.env, bus: this.bus, sky: () => this.sky }).mount(body, { before: body.firstChild });
    // Netero's blimp crosses the sky now and then: above the wallpaper, below icons and windows
    this.blimp = new Blimp({ reduced: !!this.env.reduced }).mount(body, { before: this.wallpaper.el.nextSibling });
  }

  /** The logon dialog, alone on the bare desktop. Resolves with the account. */
  logon() {
    return new Promise(res => {
      this.desktop.center(true);
      this.doc.body.classList.add("logon");
      const dlg = new LogonDialog({ session: this.session });
      this.wm.add(dlg);
      const done = me => {
        for (const id of [dlg.id, "win-anon"]) if (this.wm.has(id)) this.wm.remove(id);
        this.desktop.center(false);
        this.doc.body.classList.remove("logon");
        res(me);
      };
      dlg.on("login", done);
      // "View site anonymously": a warning to confirm, then in as the shared anonymous account (os/roles.js)
      dlg.on("anonymous", () => {
        const anon = new AnonymousDialog();
        this.wm.add(anon);
        this.wm.close(dlg.id);
        anon.on("back", () => { this.wm.remove(anon.id); this.wm.open(dlg.id, null, { scroll: false }).then(() => dlg.focusUser()); });
        anon.on("enter", async () => {
          try { done(await this.session.login(ANONYMOUS.username, ANONYMOUS.password)); }
          catch (err) { anon.fail(err.message); }
        });
        this.wm.open(anon.id, null, { scroll: false }).then(() => anon.focusEnter());
      });
      this.wm.open(dlg.id, null, { scroll: false, jank: true }).then(() => dlg.focusUser());
    });
  }

  /**
   * start({ apps, autostart, gate, taskbar, wallpaper, boot, start, icons,
   *         bootLines }) — register apps, build the chrome, boot (cold loads
   * only), look up the session, log on if gated, then bring up the desktop
   * as it was left (`Layout.restore`) or, on a first visit, launch the
   * autostart apps. Resolves with the OS once ready.
   */
  async start({ apps = [], autostart = [], gate = true, taskbar = true, wallpaper = false, boot = true, splash = false, start = false, badge = true, backdrop = null, signOut = false, restore = true, icons = taskbar, bootLines: extra = [] } = {}) {
    loadFonts(this.doc);
    loadFavicon(this.doc);
    for (const a of apps) Array.isArray(a) ? this.registry.register(a[0], a[1]) : this.registry.register(a);
    this.setup({ start, taskbar });
    const warm = this.nav.consumeWarm();   // false | true (skip boot and splash) | "splash" (skip the boot only)
    const pending = this.session.me();
    // the user's own preferences as soon as we know who it is — before the splash's chime asks whether Sounds are on
    // (not on a page that signs whoever it is out: an account page shows the defaults)
    if (!signOut) pending.then(me => { if (me && this.profile.setUser(me.username)) { this.applyTheme(); this.crt.apply(); } }, () => {});
    if (boot && !warm) await this.boot.run({ badge: badgeHTML(), lines: bootLines(extra), speed: 9, tail: 420 });
    // the title screen (os/splash.js) right after the boot screen, on EVERY page that asks for it — signed in or not,
    // the desktop or an account page — and only then what the page is for: the logon, the choose-a-password dialog,
    // the desktop (Andrew, 2026-09-28: "show the splash first, and on clicking to start, show the login / choose
    // password / etc. make this the general pattern for these special pages"). Always the Summons: the site's anchor.
    // "splash" warmth: arriving from an account page, whose click cannot carry over to this page in Firefox — the
    // splash's click is what lets the music play (Andrew, 2026-09-29: "auto-play… not for a brand new test user")
    if (splash && boot && (!warm || warm === "splash")) await this.showSplash(STARTUP_SPLASH);
    let me = await pending;
    // an account page (an invite or reset link) signs out whoever was signed in: the link is for its own account, and a
    // signed-in visitor's saved desktop took the page over (Andrew, 2026-09-29: "invite link invalidate current session")
    if (signOut && me) { try { await this.session.logout(); } catch {} me = null; }
    if (backdrop === "embers") this.showEmbers();       // the account pages: the dialog over the Summons' embers
    if (badge && ((!me && gate) || !taskbar)) this.showBadge();
    if (!me && gate) me = await this.logon();
    // signed in is not enough: the account needs a role on this site. Without one it gets a message and Log out —
    // login and invites are the shared system's, so an account with no hxh role could get this far (Andrew, 2026-09-28)
    if (me && gate && !this.member(me)) return this.noRole();
    if (taskbar) this.hideBadge();
    this.setUser(me);
    if (me && wallpaper) this.startWallpaper();       // Whale Island only once you're in
    if (this.taskbar) this.taskbar.el.hidden = false;
    if (icons) this.desktop.showIcons(true);
    this.ready = true;
    this.bus.emit("os:ready", { user: me });
    const restored = restore ? await this.layout.restore() : false;   // an account page neither restores nor saves a desktop
    if (!restored) for (const id of autostart) await this.launch(id, { autostart: true });
    return this;
  }

  /** The title screen (os/splash.js): `id` one of SPLASHES, or a style at random; `opts` { prompt, chime }. Resolves when the viewer clicks it away. */
  showSplash(id = null, opts = {}) {
    if (!this.splash) this.splash = new Splash({ reduced: !!this.env.reduced, sounds: this.sounds, fetch: this.fetch, small: () => !!this.env.small }).mount(this.doc.body);
    return this.splash.show(id, opts);
  }

  launch(id, opts = {}) { return this.registry.launch(id, opts); }

  /** Navigate to another OS page without rebooting. */
  go(url, opts) { this.nav.go(url, opts); }

  async logout() {
    await this.session.logout();
    this.nav.cold();   // cold load: boots, then the logon screen
  }
}
