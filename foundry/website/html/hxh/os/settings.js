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
  /** String-valued settings (a radio group: theme, sky…). */
  getStr(key, def = "") {
    try { const v = this.storage?.getItem(this.prefix + key); return v == null ? def : v; } catch { return def; }
  }
  setStr(key, value) { try { this.storage?.setItem(this.prefix + key, String(value)); } catch {} return value; }
  /** A radio group as menu items: one check mark, on the current value. */
  radio({ key, def, options, onChange } = {}) {
    return options.map(([value, label]) => ({ label, check: () => this.getStr(key, def) === value, onclick: () => { this.setStr(key, value); onChange?.(value); } }));
  }
  /** A checkable menu item bound to `key`. */
  item({ key, label, icon, def = true, onChange } = {}) {
    return { label, icon, check: () => this.get(key, def), onclick: () => onChange?.(this.toggle(key, def)) };
  }
}
