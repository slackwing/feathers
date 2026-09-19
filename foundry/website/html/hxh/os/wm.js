/* WindowManager — the only thing that opens, closes, focuses, minimizes,
   places and drags windows. Windows talk to it through their
   "chrome" / "pointerdown" events; it talks to everyone else through the OS
   bus: window:add, window:remove, window:open, window:close,
   window:minimize, window:focus, window:title,
   window:attention, window:calm (each payload carries the window id). */
export class WindowManager {
  constructor({ bus, env, desktop }) {
    this.bus = bus;
    this.env = env;
    this.desktop = desktop;
    this.wins = new Map();
    this.zTop = 10;
    this.activeId = null;
  }

  get(id) { return this.wins.get(id); }
  has(id) { return this.wins.has(id); }
  all() { return [...this.wins.values()]; }
  get active() { return this.activeId ? this.wins.get(this.activeId) : null; }

  /** Register a Window: mount it on the desktop and wire its chrome. */
  add(win) {
    if (this.wins.has(win.id)) throw new Error(`window "${win.id}" already registered`);
    if (!win.el) win.mount(this.desktop);
    else if (!win.el.isConnected) this.desktop.append(win.el);
    win.wm = this;
    win.on("chrome", kind => {
      if (kind === "close") this.close(win.id);
      else if (kind === "min") this.minimize(win.id);
    });
    win.on("pointerdown", () => this.focus(win.id));
    win.on("title", title => this.bus.emit("window:title", { id: win.id, title }));
    win.on("attention", () => this.bus.emit("window:attention", { id: win.id }));
    win.on("calm", () => this.bus.emit("window:calm", { id: win.id }));
    if (!win.static && win.titleBar) this.drag(win, win.titleBar.el);
    this.wins.set(win.id, win);
    this.bus.emit("window:add", { id: win.id });
    return win;
  }

  /** Close, unmount and forget a window. */
  remove(id) {
    const w = this.wins.get(id);
    if (!w) return;
    if (w.state.open) this.close(id);
    this.wins.delete(id);
    w.wm = null;
    w.unmount();
    this.bus.emit("window:remove", { id });
  }

  focus(id) {
    const w = this.wins.get(id);
    if (!w || w.el.hidden) return;
    if (this.activeId !== id) {
      for (const x of this.wins.values()) x.el.classList.add("inactive");
      w.el.classList.remove("inactive");
      this.activeId = id;
    }
    if (!w.static) w.el.style.zIndex = ++this.zTop;
    w.el.classList.remove("flash");
    this.bus.emit("window:focus", { id });
  }

  /**
   * Show a window. `at` = {x, y, w} places it (desktop only). jank paints
   * the empty frame first, the menu bar ~90 ms later, the body ~200 ms in —
   * a 90s machine drawing a window. Resolves once the content is visible.
   */
  async open(id, at = null, { scroll = true, jank = false } = {}) {
    const w = this.wins.get(id);
    if (!w) throw new Error(`no window "${id}"`);
    const wasHidden = w.el.hidden;
    const animate = jank && !this.env.reduced;
    if (animate) w.el.classList.add("loading");
    w.el.hidden = false;
    w.state.open = true; w.state.minimized = false;
    if (this.env.floating() && !w.static) {
      if (at) this.placeEl(w, at);
      else if (!w.state.placed) this.placeEl(w, { x: 150 + (this.wins.size % 6) * 35, y: 30 + (this.wins.size % 6) * 35 });
    }
    this.focus(id);
    this.fit();
    this.bus.emit("window:open", { id, first: wasHidden });
    if (scroll && !this.env.floating() && wasHidden && !w.el.classList.contains("profile")) {
      w.el.scrollIntoView?.({ block: "start", behavior: this.env.reduced ? "auto" : "smooth" });
    }
    if (animate) {
      await this.env.wait(90);
      w.el.classList.replace("loading", "loading2");
      await this.env.wait(110);
      w.el.classList.remove("loading2");
    }
    return w;
  }

  close(id) {
    const w = this.wins.get(id);
    if (!w || !w.state.open) return;
    w.el.hidden = true;
    w.state.open = false; w.state.minimized = false;
    if (this.activeId === id) { this.activeId = null; this.focusTop(); }
    this.fit();
    this.bus.emit("window:close", { id });
    w.props.onClose?.(w);
    w.emit("close");
  }

  minimize(id) {
    const w = this.wins.get(id);
    if (!w || !w.state.open) return;
    w.el.hidden = true;
    w.state.minimized = true;
    if (this.activeId === id) { this.activeId = null; this.focusTop(); }
    this.fit();
    this.bus.emit("window:minimize", { id });
  }

  focusTop() {
    let best = null;
    for (const w of this.wins.values()) {
      if (w.el.hidden || w.static) continue;
      if (!best || +w.el.style.zIndex > +best.el.style.zIndex) best = w;
    }
    if (best) this.focus(best.id);
  }

  /** Position a window (open or not) so a later open lands there. */
  place(id, at) {
    const w = this.wins.get(id);
    if (w && at && this.env.floating() && !w.static) this.placeEl(w, at);
  }

  placeEl(w, { x, y, w: width }) {
    if (width) w.el.style.width = width + "px";
    w.el.style.left = Math.max(0, Math.round(x)) + "px";
    w.el.style.top = Math.max(0, Math.round(y)) + "px";
    w.state.placed = true;
  }

  /** Move `win` by dragging `handle`; `allow(e)` may veto a press (a chromeless window dragged by its margins only). */
  drag(win, handle, { allow = null } = {}) {
    const el = win.el;
    let sx, sy, ox, oy, moving = false;
    handle.addEventListener("pointerdown", e => {
      if (e.button !== 0 || e.target.closest?.(".tbtn") || !this.env.floating() || win.static) return;
      if (allow && !allow(e)) return;
      moving = true; sx = e.clientX; sy = e.clientY; ox = el.offsetLeft; oy = el.offsetTop;
      handle.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener("pointermove", e => {
      if (!moving) return;
      const snap = v => Math.round(v / 4) * 4, z = this.env.zoom();
      const x = snap(ox + (e.clientX - sx) / z), y = snap(oy + (e.clientY - sy) / z);
      el.style.left = Math.min(this.desktop.clientWidth - 80, Math.max(80 - el.offsetWidth, x)) + "px";
      el.style.top = Math.max(0, y) + "px";
    });
    const end = () => { if (!moving) return; moving = false; this.fit(); };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  /** Grow the desktop so the page scrolls to the lowest window. */
  fit() {
    if (!this.desktop) return;
    if (!this.env.floating()) { this.desktop.style.minHeight = ""; return; }
    let bottom = 0;
    for (const w of this.wins.values()) {
      if (w.el.hidden || w.static) continue;
      bottom = Math.max(bottom, w.el.offsetTop + w.el.offsetHeight);
    }
    this.desktop.style.minHeight = Math.max(this.env.height, bottom + 24 + 48) + "px";
  }

  relayout() {
    if (!this.env.floating()) { this.fit(); return; }
    for (const w of this.wins.values()) {
      if (w.static || w.el.hidden) continue;
      const maxX = this.desktop.clientWidth - 80;
      if (w.el.offsetLeft > maxX) w.el.style.left = Math.max(0, this.desktop.clientWidth - w.el.offsetWidth - 16) + "px";
    }
    this.fit();
  }

  /** Escape: close the active popup window, if any. */
  handleEscape() {
    const w = this.active;
    if (w && w.state.open && w.props.closable && !w.static && w.props.popup) this.close(w.id);
  }
}
