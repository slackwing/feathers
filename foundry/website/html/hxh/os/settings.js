/* Settings — per-browser preferences (localStorage), and the standard
   "checkable menu item" for them. Apps ask the OS for `settings.item()`
   and get a menu entry whose check reflects the stored value. Nothing
   here touches the server. */
export class Settings {
  constructor({ storage = globalThis.localStorage, prefix = "hxh.set." } = {}) {
    this.storage = storage; this.prefix = prefix;
  }
  get(key, def = true) {
    try {
      const v = this.storage?.getItem(this.prefix + key);
      return v == null ? def : v === "1";
    } catch { return def; }
  }
  set(key, on) {
    try { this.storage?.setItem(this.prefix + key, on ? "1" : "0"); } catch {}
    return !!on;
  }
  toggle(key, def = true) { return this.set(key, !this.get(key, def)); }
  /** A checkable menu item bound to `key`. */
  item({ key, label, icon, def = true, onChange } = {}) {
    return { label, icon, check: () => this.get(key, def), onclick: () => onChange?.(this.toggle(key, def)) };
  }
}
