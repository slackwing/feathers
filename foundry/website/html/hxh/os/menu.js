/* Menus — ONE implementation for every drop-down on the desktop: window
   menu bars, the Start menu's item list, and tray-icon menus.

   An item is { label, icon?, check?: () => bool, onclick?, disabled?, hidden?,
   attrs?, items? } or "sep". `items` (an array or a function) makes the
   item a SUBMENU that cascades to the right, Windows style: it opens on
   hover or click, only one sibling submenu is open at a time, and picking
   a leaf anywhere closes the whole chain. `Menus` tracks whatever is open
   so a click anywhere else (or Escape) closes it; opening a menu closes
   every other one except its own ancestors. */
import { Component } from "./component.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";

const openSet = new Set();
const installed = new WeakSet();

export const Menus = {
  /** Anything with close() can register as open. */
  track(m) { openSet.add(m); },
  untrack(m) { openSet.delete(m); },
  closeAll(except = null) { for (const m of [...openSet]) if (m !== except && !isAncestor(m, except)) m.close(); },
  get openCount() { return openSet.size; },
  /** Document-level click/Escape → close everything (once per document). */
  install(doc = document) {
    if (installed.has(doc)) return;
    installed.add(doc);
    doc.addEventListener("click", () => Menus.closeAll());
    doc.addEventListener("keydown", e => { if (e.key === "Escape") Menus.closeAll(); });
  },
};

/** Is `m` an ancestor menu of `of`? */
function isAncestor(m, of) {
  for (let p = of?.props?.parent; p; p = p.props?.parent) if (p === m) return true;
  return false;
}

/**
 * Render an item list into `container`; `onPick` runs before a leaf's own
 * onclick. `parent` is the menu that owns the list (submenus need it to
 * keep their ancestors open). Returns the submenus created, so the owner
 * can unmount them on its next render.
 */
export function renderItems(items, container, onPick, parent = null) {
  container.replaceChildren();
  const subs = [];
  for (const it of items || []) {
    if (it === "sep" || it?.sep) { container.append(h("hr")); continue; }
    if (it.hidden) continue;
    const b = h("button", { type: "button", disabled: !!it.disabled });
    if (it.check) { b.classList.add("chk"); b.classList.toggle("on", !!it.check()); }
    if (it.icon) b.innerHTML = icon(it.icon, 16);
    if (it.attrs) for (const [k, v] of Object.entries(it.attrs)) b.setAttribute(k, v);
    b.append(it.label);
    if (it.items) {
      const wrap = h("div", { className: "menu sub" });
      b.append(h("span", { className: "arr", text: "▸" }));
      wrap.append(b);
      const sub = new Menu({ items: it.items, cls: "sub", parent });
      sub.onPick = onPick;
      sub.mount(wrap);
      b.addEventListener("click", e => { e.stopPropagation(); sub.toggle(); });
      wrap.addEventListener("mouseenter", () => { if (!it.disabled) sub.open(); });
      container.append(wrap);
      subs.push(sub);
      continue;
    }
    b.addEventListener("mouseenter", () => { if (parent) Menus.closeAll(parent); });   // hovering a leaf folds the sibling submenu
    b.addEventListener("click", e => { e.stopPropagation(); onPick?.(it, e); it.onclick?.(e); });
    container.append(b);
  }
  return subs;
}

export class Menu extends Component {
  /** props: items (array or () => array), cls ("up" pops above its anchor; "sub" cascades right), parent (the owning menu, for submenus) */
  render() {
    const el = h("div", { className: `dd ${this.props.cls || ""}`.trim() });
    el.addEventListener("click", e => e.stopPropagation());
    this.subs = [];
    return el;
  }

  itemsNow() {
    const i = this.props.items;
    return typeof i === "function" ? i() : (i || []);
  }

  /** The root menu of a cascade closes the whole chain when a leaf is picked. */
  get root() { let m = this; while (m.props.parent) m = m.props.parent; return m; }

  refresh() {
    for (const s of this.subs) s.unmount();
    this.subs = renderItems(this.itemsNow(), this.el, this.onPick || (() => this.root.close()), this);
  }

  get isOpen() { return !!this.el?.classList.contains("open"); }

  open() {
    Menus.closeAll(this);
    this.refresh();
    this.el.classList.add("open");
    this.el.parentElement?.classList.contains("menu") && this.el.parentElement.classList.add("open");
    Menus.track(this);
    this.emit("open");
  }

  close() {
    if (!this.isOpen) return;
    for (const s of this.subs) s.close();
    this.el.classList.remove("open");
    this.el.parentElement?.classList.remove("open");
    Menus.untrack(this);
    this.emit("close");
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  onUnmount() { for (const s of this.subs || []) s.unmount(); Menus.untrack(this); }
}

/** A window's menu bar: [{ label: "File", key: "F", items }] */
export class MenuBar extends Component {
  render() {
    const bar = h("div", { className: "mbar" });
    this.menus = [];
    for (const m of this.props.menus || []) {
      const wrap = h("div", { className: "menu" });
      const btn = h("button", { type: "button" });
      const key = m.key && m.label.startsWith(m.key) ? m.key : "";
      btn.innerHTML = key ? `<u>${key}</u>${m.label.slice(key.length)}` : m.label;
      wrap.append(btn);
      const menu = this.adopt(new Menu({ items: m.items }), wrap);
      btn.addEventListener("click", e => { e.stopPropagation(); menu.toggle(); });
      this.menus.push(menu);
      bar.append(wrap);
    }
    return bar;
  }
}
