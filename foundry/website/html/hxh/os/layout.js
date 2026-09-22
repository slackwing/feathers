/* Layout — the desktop as you left it (Andrew, 2026-09-22: "when they
   return to the site it's like they just woke up their desktop
   computer"). What is kept: which app windows were open, where they
   were, their stacking order, which was minimized and which was active.
   What is NOT kept: anything that was IN them — every app reloads from
   scratch; a window only gets its place back. Per browser and per user
   (localStorage `hxh.desk.<username>`), beside the settings.

   Recording: every window event on the bus schedules a save (debounced),
   and `pagehide` flushes. Restoring: OS.start asks `restore()` once the
   user is known; when a desktop was saved — even an empty one — it is
   rebuilt window by window, bottom to top, through each app's
   `reopen(id, key)` with the saved place handed to the window manager
   as a hint (`wm.hint`), and the page's autostart list is skipped. */
export const DESK_PREFIX = "hxh.desk.";
export const SAVE_DELAY = 300;
export const DESK_VERSION = 1;

export class Layout {
  constructor({ os, storage = globalThis.localStorage, delay = SAVE_DELAY } = {}) {
    this.os = os; this.storage = storage; this.delay = delay;
    this.armed = false;       // saves only once restore() has run for a user
    this.restoring = false;   // no saves while the desktop is being rebuilt
    this.timer = null;
  }

  get key() { const u = this.os.user?.username; return u ? DESK_PREFIX + u : null; }

  /** Start recording: window events schedule a save; leaving the page flushes one. */
  watch() {
    for (const ev of ["window:open", "window:close", "window:minimize", "window:focus", "window:move", "window:remove"]) this.os.bus.on(ev, () => this.schedule());
    this.os.win?.addEventListener?.("pagehide", () => this.flush());
    return this;
  }

  schedule() {
    if (!this.armed || this.restoring) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(), this.delay);
    this.timer.unref?.();
  }

  flush() { if (!this.armed || this.restoring) return; clearTimeout(this.timer); this.save(); }

  /** The app that owns a window, if any (dialogs and the logon box have none). */
  appOf(winId) { return this.os.registry.all().find(a => a.owns(winId)) || null; }

  /** Every open (or minimized) app window, bottom to top, with its place. */
  snapshot() {
    const wm = this.os.wm;
    const wins = wm.all().filter(w => w.state.open && !w.static && this.appOf(w.id))
      .sort((a, b) => (+a.el.style.zIndex || 0) - (+b.el.style.zIndex || 0));
    const windows = wins.map(w => {
      const app = this.appOf(w.id), key = app.key(w);
      return { id: w.id, app: app.id, ...(key != null ? { key } : {}), x: parseInt(w.el.style.left) || 0, y: parseInt(w.el.style.top) || 0, ...(w.state.minimized ? { min: true } : {}) };
    });
    const active = wm.activeId && windows.some(s => s.id === wm.activeId) ? wm.activeId : null;
    return { v: DESK_VERSION, active, windows };
  }

  save() {
    const k = this.key;
    if (!k) return null;
    const snap = this.snapshot();
    try { this.storage?.setItem(k, JSON.stringify(snap)); } catch {}
    return snap;
  }

  /** The saved desktop for the current user, or null (none, another version, garbage). */
  load() {
    const k = this.key;
    if (!k) return null;
    try {
      const raw = this.storage?.getItem(k);
      if (raw == null) return null;
      const d = JSON.parse(raw);
      return d && d.v === DESK_VERSION && Array.isArray(d.windows) ? d : null;
    } catch { return null; }
  }

  clear() { const k = this.key; if (k) try { this.storage?.removeItem(k); } catch {} }

  /**
   * Rebuild the saved desktop. Resolves true when there was one (the
   * page's autostart is then skipped, even if nothing was open), false
   * on a first visit. Windows whose app is gone, hidden from this user,
   * or unwilling to bring them back are dropped from the record.
   */
  async restore() {
    const os = this.os, wm = os.wm;
    if (!os.user) return false;
    const saved = this.load();
    this.armed = true;
    if (!saved) return false;
    this.restoring = true;
    try {
      for (const s of saved.windows) {
        if (!s || typeof s.id !== "string") continue;
        const app = os.registry.get(s.app);
        if (!app || !app.owns(s.id) || !app.visible(os.user)) continue;
        wm.hint(s.id, { x: +s.x || 0, y: +s.y || 0, min: !!s.min });
        try { await app.reopen(s.id, s.key); }
        catch (err) { console.warn(`[hxh] could not bring back ${s.id}:`, err); }
        wm.unhint(s.id);
      }
      const a = saved.active ? wm.get(saved.active) : null;
      if (a && a.state.open && !a.state.minimized) wm.focus(a.id);
      else wm.focusTop();
    } finally { this.restoring = false; }
    this.save();
    return true;
  }
}
