/* Menus — ONE implementation for every drop-down on the desktop: window
   menu bars, the Start menu's item list, and tray-icon menus.

   An item is { label, icon?, check?: () => bool, onclick?, disabled?, hidden?,
   attrs? } or "sep". `Menus` tracks whatever is open so a click anywhere
   else (or Escape) closes it, and opening one closes the rest. */
import { Component } from "./component.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";

const openSet = new Set();
const installed = new WeakSet();

export const Menus = {
  /** Anything with close() can register as open. */
  track(m) { openSet.add(m); },
  untrack(m) { openSet.delete(m); },
  closeAll(except = null) { for (const m of [...openSet]) if (m !== except) m.close(); },
  get openCount() { return openSet.size; },
  /** Document-level click/Escape → close everything (once per document). */
  install(doc = document) {
    if (installed.has(doc)) return;
    installed.add(doc);
    doc.addEventListener("click", () => Menus.closeAll());
    doc.addEventListener("keydown", e => { if (e.key === "Escape") Menus.closeAll(); });
  },
};

/** Render an item list into `container`; `onPick` runs before the item's own onclick. */
export function renderItems(items, container, onPick) {
  container.replaceChildren();
  for (const it of items || []) {
    if (it === "sep" || it?.sep) { container.append(h("hr")); continue; }
    if (it.hidden) continue;
    const b = h("button", { type: "button", disabled: !!it.disabled });
    if (it.check) { b.classList.add("chk"); b.classList.toggle("on", !!it.check()); }
    if (it.icon) b.innerHTML = icon(it.icon, 16);
    if (it.attrs) for (const [k, v] of Object.entries(it.attrs)) b.setAttribute(k, v);
    b.append(it.label);
    b.addEventListener("click", e => { e.stopPropagation(); onPick?.(it, e); it.onclick?.(e); });
    container.append(b);
  }
  return container;
}

export class Menu extends Component {
  /** props: items (array or () => array), cls ("up" pops above its anchor) */
  render() {
    const el = h("div", { className: `dd ${this.props.cls || ""}`.trim() });
    el.addEventListener("click", e => e.stopPropagation());
    return el;
  }

  itemsNow() {
    const i = this.props.items;
    return typeof i === "function" ? i() : (i || []);
  }

  refresh() {
    renderItems(this.itemsNow(), this.el, () => this.close());
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
    this.el.classList.remove("open");
    this.el.parentElement?.classList.remove("open");
    Menus.untrack(this);
    this.emit("close");
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  onUnmount() { Menus.untrack(this); }
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
