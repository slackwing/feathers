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
import { Toast } from "./toast.js";
import { Boot, Badge, badgeHTML, bootLines } from "./boot.js";
import { LogonDialog } from "./logon.js";
import { Wallpaper } from "./wallpaper.js";
import { Menus } from "./menu.js";
import { Sounds } from "./sound.js";
import { Settings } from "./settings.js";
import { WakeWatch } from "./wake.js";
import { Blimp } from "./blimp.js";
import { Layout } from "./layout.js";

/* Settings › Display choices (the values are what localStorage keeps). */
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
    this.crt = new CRT({ body: this.doc.body, storage: win.localStorage, bus: this.bus });
    this.sounds = new Sounds({ storage: win.localStorage, AudioContext: win.AudioContext || win.webkitAudioContext });
    this.settings = new Settings({ storage: win.localStorage });
    this.layout = new Layout({ os: this, storage: win.localStorage });
    this.registry = new AppRegistry(this);
    this.user = null;
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
        this.startMenu = new StartMenu({ items: () => this.startItems(), user: () => this.user }).mount(body);
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

  isAdmin(site = "hxh") {
    return (this.user?.roles || []).some(r => r.website === site && r.role === "admin");
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
      dlg.on("login", me => {
        this.wm.remove(dlg.id);
        this.desktop.center(false);
        this.doc.body.classList.remove("logon");
        res(me);
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
  async start({ apps = [], autostart = [], gate = true, taskbar = true, wallpaper = false, boot = true, start = false, icons = taskbar, bootLines: extra = [] } = {}) {
    for (const a of apps) Array.isArray(a) ? this.registry.register(a[0], a[1]) : this.registry.register(a);
    this.setup({ start, taskbar });
    const warm = this.nav.consumeWarm();
    const pending = this.session.me();
    if (boot && !warm) await this.boot.run({ badge: badgeHTML(), lines: bootLines(extra), speed: 9, tail: 420 });
    let me = await pending;
    if ((!me && gate) || !taskbar) this.showBadge();   // splash screens keep the badge
    if (!me && gate) me = await this.logon();
    if (taskbar) this.hideBadge();
    this.setUser(me);
    if (me && wallpaper) this.startWallpaper();       // Whale Island only once you're in
    if (this.taskbar) this.taskbar.el.hidden = false;
    if (icons) this.desktop.showIcons(true);
    this.ready = true;
    this.bus.emit("os:ready", { user: me });
    const restored = await this.layout.restore();
    if (!restored) for (const id of autostart) await this.launch(id, { autostart: true });
    return this;
  }

  launch(id, opts = {}) { return this.registry.launch(id, opts); }

  /** Navigate to another OS page without rebooting. */
  go(url) { this.nav.go(url); }

  async logout() {
    await this.session.logout();
    this.nav.cold();   // cold load: boots, then the logon screen
  }
}
