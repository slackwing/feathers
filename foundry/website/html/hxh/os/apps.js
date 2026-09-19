/* Apps — the single source of truth for what is on this desktop. An App
   subclass declares its identity as statics (id, name, icon, desktop,
   order, menuable) and implements launch(); the AppRegistry holds one
   instance of each, and desktop icons, the Start menu, View menus and tray
   icons are all DERIVED from it — nothing lists apps by hand. Registering
   an app therefore puts it on the desktop AND in the Start menu's app
   section at once (Andrew, 2026-09-19), which is why `register` insists
   on an icon that draws at both sizes. */
import { hasIconPair } from "./icons.js";

export class App {
  static id = "";          // unique, used for data-act and launch()
  static name = "";        // label on icons and menus
  static icon = "x";       // pixel icon name
  static desktop = true;   // has a desktop icon
  static menuable = true;  // listed in Start / View menus
  static order = 100;      // sort key for icons and menus

  constructor(os, options = {}) {
    this.os = os;
    this.options = options;
  }

  get id() { return this.constructor.id; }
  get name() { return this.constructor.name_ || this.constructor.name; }
  get icon() { return this.constructor.icon; }
  get order() { return this.constructor.order; }

  /** Whether this user sees the app at all (icons, menus). */
  visible(user) { void user; return true; }

  /** Open the app (called by icons, menus, autostart). Return a promise or the window. */
  launch(opts = {}) { void opts; }

  /** Optional tray presence: { icon, title, on, onClick, menu: () => items }. */
  tray() { return null; }
}

export class AppRegistry {
  constructor(os) {
    this.os = os;
    this.apps = new Map();
    this.seq = 0;
  }

  /** Register an App class (with optional constructor options) or a ready instance. */
  register(AppClass, options = {}) {
    const app = AppClass instanceof App ? AppClass : new AppClass(this.os, options);
    const id = app.id;
    if (!id) throw new Error(`app ${app.constructor.name} has no static id`);
    if (this.apps.has(id)) throw new Error(`app "${id}" already registered`);
    // desktop icon (48 px) and Start-menu / taskbar icon (16 px) are one 16×16 grid; both are derived from it
    if (!hasIconPair(app.icon)) throw new Error(`app "${id}" needs a 16×16 icon (draws its desktop and menu icons); "${app.icon}" is not one`);
    app._seq = this.seq++;
    this.apps.set(id, app);
    this.os.bus?.emit("app:register", { id });
    return app;
  }

  get(id) { return this.apps.get(id); }
  has(id) { return this.apps.has(id); }

  /** All apps, by order then registration. */
  all() {
    return [...this.apps.values()].sort((a, b) => a.order - b.order || a._seq - b._seq);
  }

  /** Apps that belong on the desktop / in menus for this user. */
  visible(user, { desktop = true, menuable = false } = {}) {
    return this.all().filter(a => (!desktop || a.constructor.desktop) && (!menuable || a.constructor.menuable) && a.visible(user));
  }

  launch(id, opts = {}) {
    const app = this.apps.get(id);
    if (!app) throw new Error(`no app "${id}"`);
    this.os.bus?.emit("app:launch", { id, opts });
    return app.launch(opts);
  }
}
