/* Window — THE window class. Chrome is an option, not a copy:
     chrome: "full"   title bar with minimize / close, draggable
     chrome: "static" title bar (optionally a close), sits in flow — dialogs
     chrome: "none"   no title bar; optional float buttons at the top right
                      (the binder: minimize + close)
   A window knows nothing about z-order or the taskbar: it emits "chrome"
   (which button), "pointerdown", "title" and "attention" on its own bus and
   the WindowManager does the rest. */
import { Component } from "./component.js";
import { h, esc } from "./dom.js";
import { icon } from "./icons.js";
import { MenuBar } from "./menu.js";

/* Windows are a set size — no maximize anywhere (Andrew, 2026-09-19:
   "maximize adds too many headaches"). */
export const CHROME = {
  min:   { cls: "min",   glyph: "_", title: "Minimize" },
  close: { cls: "close", glyph: "×", title: "Close" },
};

export class ChromeButton extends Component {
  /** props: kind — "min" | "max" | "close" */
  render() {
    const c = CHROME[this.props.kind];
    if (!c) throw new Error(`unknown chrome button "${this.props.kind}"`);
    return h("button", {
      type: "button", className: `tbtn ${c.cls}`, title: c.title, text: c.glyph,
      onclick: e => { e.stopPropagation(); this.emit("press", this.props.kind); },
    });
  }
}

export class TitleBar extends Component {
  /** props: title, icon, buttons: ["min", "max", "close"] */
  render() {
    const { title = "", icon: ic = "x", buttons = [] } = this.props;
    const tb = h("div", { className: "tbar" });
    // The crimson × app icon would vanish on a crimson title bar, so on a
    // title bar it takes the title's own colour, whatever the theme.
    tb.append(h("span", { className: "ico", html: icon(ic, 16, ic === "x" ? { r: "currentColor", k: "currentColor" } : null) }));
    this.ttl = h("span", { className: "ttl", text: title });
    tb.append(this.ttl);
    if (buttons.length) {
      const cluster = h("span", { className: "tbtns" });
      for (const kind of buttons) {
        const b = this.adopt(new ChromeButton({ kind }), cluster);
        b.on("press", k => this.emit("press", k));
      }
      tb.append(cluster);
    }
    return tb;
  }
  setTitle(t) { this.ttl.textContent = t; }
}

export class Window extends Component {
  /**
   * props: id, title, icon = "x", width, chrome = "full" | "static" | "none",
   *        closable = true, minimizable = true,
   *        task = true (taskbar button), popup = false (Escape closes),
   *        cls = "", buttons (chromeless float buttons, e.g. ["min", "close"]),
   *        menus (a MenuBar spec, or win => spec — see OS.appMenus),
   *        content (html | element | fn(body, win)), onClose
   */
  constructor(props = {}) {
    if (!props.id) throw new Error("Window needs an id");
    super({ chrome: "full", icon: "x", closable: true, minimizable: true, task: true, popup: false, cls: "", ...props });
    this.state = { open: false, minimized: false, placed: false };
    this.wm = null;
  }

  get id() { return this.props.id; }
  get title() { return this.props.title || ""; }
  get icon() { return this.props.icon; }
  get static() { return this.props.chrome === "static"; }
  get chromeless() { return this.props.chrome === "none"; }
  get hasTask() { return !!this.props.task && !this.static; }

  /** Which chrome buttons this window shows, from its options. */
  buttonKinds() {
    const p = this.props;
    if (this.static) return p.closable && p.buttons !== undefined ? p.buttons : (p.closable && p.staticClose ? ["close"] : []);
    if (this.chromeless) return p.buttons ?? [];
    return [...(p.minimizable ? ["min"] : []), ...(p.closable ? ["close"] : [])];
  }

  render() {
    const p = this.props;
    const cls = ["win", this.static && "static", this.chromeless && "chromeless", p.popup && "popup", p.cls].filter(Boolean).join(" ");
    const el = h("div", { className: cls, id: p.id });
    el.hidden = true;
    if (p.width) el.style.width = p.width + "px";
    if (!this.chromeless) {
      this.titleBar = this.adopt(new TitleBar({ title: this.title, icon: p.icon, buttons: this.buttonKinds() }), el);
      this.titleBar.on("press", k => this.emit("chrome", k));
    } else if (this.buttonKinds().length) {
      const f = h("div", { className: "fbtns" });
      for (const kind of this.buttonKinds()) this.adopt(new ChromeButton({ kind }), f).on("press", k => this.emit("chrome", k));
      el.append(f);
    }
    if (p.menus) this.menuBar = this.adopt(new MenuBar({ menus: typeof p.menus === "function" ? p.menus(this) : p.menus }), el);
    this.body = h("div", { className: "body" });
    el.append(this.body);
    this.setContent(p.content);
    el.addEventListener("pointerdown", () => this.emit("pointerdown"), true);
    return el;
  }

  setContent(c) {
    if (c == null) return;
    if (typeof c === "string") this.body.innerHTML = c;
    else if (typeof c === "function") c(this.body, this);
    else this.body.replaceChildren(c);
  }

  setTitle(t) {
    this.props.title = t;
    this.titleBar?.setTitle(t);
    this.emit("title", t);
  }

  /** Ask for the user's eye: the title bar blinks (until focused) and the taskbar button flashes. */
  requestAttention() { this.el?.classList.add("flash"); this.emit("attention"); }
  /** Never mind: stop blinking without being focused (the thing was seen elsewhere — another tab). */
  calm() { if (!this.flashing) return; this.el?.classList.remove("flash"); this.emit("calm"); }
  get flashing() { return !!this.el?.classList.contains("flash"); }

  /** Convenience passthroughs when managed. */
  open(at, opts) { return this.wm?.open(this.id, at, opts); }
  close() { return this.wm?.close(this.id); }
  minimize() { return this.wm?.minimize(this.id); }
  focus() { return this.wm?.focus(this.id); }

  $(sel) { return this.el?.querySelector(sel); }
}

export { esc };
