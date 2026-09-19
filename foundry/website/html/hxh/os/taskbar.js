/* Taskbar = StartButton + one TaskButton per open window + Tray (TrayIcon
   components + Clock). It never calls an app: it watches the OS bus for
   window:* events and keeps its buttons in step; tray icons are added by
   the OS from the app registry (or by anyone, via tray:add / tray:remove). */
import { Component } from "./component.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { Menu } from "./menu.js";

export class StartButton extends Component {
  render() {
    return h("button", {
      type: "button", className: "btn start", id: "startbtn", html: `${icon("pumpkin", 24)}<span>Start</span>`,
      onclick: e => { e.stopPropagation(); this.emit("press"); },
    });
  }
  setPressed(on) { this.el.classList.toggle("pressed", !!on); }
}

export class TaskButton extends Component {
  /** props: win */
  render() {
    const w = this.props.win;
    const b = h("button", {
      type: "button", className: "btn task", title: w.title,
      html: `${icon(w.icon, 16)}<span class="tlbl"></span>`,   // .tlbl, not .lbl (the OS form label: uppercase, grey, margins)
      onclick: () => this.emit("press"),
    });
    this.lbl = b.querySelector(".tlbl");
    this.lbl.textContent = w.title;
    return b;
  }
  get id() { return this.props.win.id; }
  setActive(on) { this.el.classList.toggle("pressed", !!on); }
  setTitle(t) { this.lbl.textContent = t; this.el.title = t; }
  /** The 90s "you have a message" cue: the button blinks until focused. */
  flash(on = true) { this.el.classList.toggle("flash", !!on); }
  get flashing() { return this.el.classList.contains("flash"); }
}

export class Clock extends Component {
  /** props: now: () => Date (injectable for tests) */
  render() { return h("span", { className: "clock" }); }
  tick(date = (this.props.now || (() => new Date()))()) {
    this.el.textContent = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  start(ms = 1000) { this.tick(); this.timer = setInterval(() => this.tick(), ms); this.timer.unref?.(); }
  onUnmount() { clearInterval(this.timer); }
}

export class TrayIcon extends Component {
  /**
   * props: id, icon, title, on (bool | () => bool — lit vs dimmed),
   *        onClick, menu (() => items — opens a Menu above the tray instead)
   */
  render() {
    const p = this.props;
    const wrap = h("span", { className: "trayicon", dataset: { tray: p.id } });
    this.btn = h("button", {
      type: "button", title: p.title || p.id, html: icon(p.icon, 16),
      onclick: e => { e.stopPropagation(); this.press(); },
    });
    wrap.append(this.btn);
    if (p.menu) this.menu = this.adopt(new Menu({ items: p.menu, cls: "up" }), wrap);
    this.refresh();
    return wrap;
  }
  get id() { return this.props.id; }
  press() {
    if (this.menu) this.menu.toggle();
    this.props.onClick?.(this);
    this.emit("press");
  }
  /** Re-evaluate the lit state. */
  refresh() {
    const on = typeof this.props.on === "function" ? this.props.on() : this.props.on;
    this.btn.classList.toggle("on", on === undefined ? true : !!on);
  }
  setOn(v) { this.props.on = v; this.refresh(); }
}

export class Tray extends Component {
  render() {
    const el = h("div", { className: "tray" });
    this.icons = new Map();
    this.clock = this.adopt(new Clock({ now: this.props.now }), el);
    return el;
  }
  add(spec) {
    const ti = spec instanceof TrayIcon ? spec : new TrayIcon(spec);
    if (this.icons.has(ti.id)) throw new Error(`tray icon "${ti.id}" already present`);
    this.adopt(ti, this.el, { before: this.clock.el });
    this.icons.set(ti.id, ti);
    return ti;
  }
  get(id) { return this.icons.get(id); }
  has(id) { return this.icons.has(id); }
  remove(id) {
    const ti = this.icons.get(id);
    if (!ti) return;
    this.drop(ti);
    this.icons.delete(id);
  }
}

export class Taskbar extends Component {
  /** props: bus, wm, start (show the Start button), now (clock) */
  render() {
    const el = h("div", { className: "taskbar", id: "taskbar" });
    if (this.props.start) {
      this.startButton = this.adopt(new StartButton(), el);
      this.startButton.on("press", () => this.emit("start"));
    }
    this.tasks = h("div", { className: "tasks" });
    el.append(this.tasks);
    this.buttons = new Map();
    this.tray = this.adopt(new Tray({ now: this.props.now }), el);
    return el;
  }

  onMount() {
    const { bus } = this.props;
    for (const ev of ["window:add", "window:remove", "window:open", "window:close", "window:minimize", "window:focus"]) {
      this.listen(bus, ev, () => this.sync());
    }
    this.listen(bus, "window:title", ({ id, title }) => this.buttons.get(id)?.setTitle(title));
    this.listen(bus, "window:attention", ({ id }) => {
      const b = this.buttons.get(id);
      if (b && this.props.wm.activeId !== id) b.flash(true);
    });
    this.listen(bus, "window:calm", ({ id }) => this.buttons.get(id)?.flash(false));
    this.listen(bus, "tray:add", spec => { if (!this.tray.has(spec.id)) this.tray.add(spec); });
    this.listen(bus, "tray:remove", ({ id }) => this.tray.remove(id));
    this.listen(bus, "tray:refresh", ({ id }) => (id ? this.tray.get(id)?.refresh() : this.tray.icons.forEach(t => t.refresh())));
    this.tray.clock.start();
    this.sync();
  }

  /** Reconcile task buttons with the window manager's state. */
  sync() {
    const wm = this.props.wm;
    if (!wm) return;
    const want = wm.all().filter(w => w.hasTask && w.state.open);
    for (const [id, b] of [...this.buttons]) {
      if (!want.some(w => w.id === id)) { this.drop(b); this.buttons.delete(id); }
    }
    for (const w of want) {
      let b = this.buttons.get(w.id);
      if (!b) {
        b = this.adopt(new TaskButton({ win: w }), this.tasks);
        b.on("press", () => {
          if (wm.activeId === w.id && !w.state.minimized) wm.minimize(w.id);
          else wm.open(w.id);
        });
        this.buttons.set(w.id, b);
      }
      const active = wm.activeId === w.id && !w.state.minimized;
      b.setActive(active);
      if (active) b.flash(false);
    }
  }

  button(id) { return this.buttons.get(id); }
}
