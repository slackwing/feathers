/* Profile — every preference, kept per USER on this browser (Andrew,
   2026-09-28: "can we save these profiles per username so on one computer
   multiple users can have different preferences/profile").

   A Storage-shaped wrapper (getItem / setItem / removeItem) that Settings,
   the CRT and Sounds are handed instead of localStorage itself, so none of
   them needs to know about users: their keys land under
   `hxh.u.<username>:<key>`. Signed out (the boot, the splash, the logon,
   the account pages) there is no profile — reads get the defaults and
   writes stay in memory — so nobody's picks leak onto a shared screen.

   The old per-browser keys (hxh.set.*, hxh.crt, hxh.sound) are simply
   dropped at the first sign-in: nobody can say whose they were, and
   handing them to whoever signed in first gave a brand-new user someone
   else's Tropical theme (Andrew, 2026-09-28: "make sure the default theme
   is sea pumpkin all first time users!!"). Everyone starts on the
   defaults. */
export const PROFILE_PREFIX = "hxh.u.";
/** The per-browser keys from before profiles: exact names, or a prefix ending in "." */
export const LEGACY_KEYS = ["hxh.set.", "hxh.crt", "hxh.sound"];

export class Profile {
  constructor({ storage = globalThis.localStorage } = {}) {
    this.storage = storage;
    this.user = null;
    this.memory = new Map();   // signed out: this page only
  }

  key(k) { return `${PROFILE_PREFIX}${this.user}:${k}`; }

  getItem(k) {
    if (!this.user) return this.memory.has(k) ? this.memory.get(k) : null;
    try { return this.storage?.getItem(this.key(k)) ?? null; } catch { return null; }
  }
  setItem(k, v) {
    if (!this.user) { this.memory.set(k, String(v)); return; }
    try { this.storage?.setItem(this.key(k), String(v)); } catch {}
  }
  removeItem(k) {
    if (!this.user) { this.memory.delete(k); return; }
    try { this.storage?.removeItem(this.key(k)); } catch {}
  }

  /** Switch to a user's profile (null: signed out). Returns true when the user changed. */
  setUser(username) {
    const next = username || null;
    if (next === this.user) return false;
    this.user = next;
    this.memory.clear();
    if (next) this.dropLegacy();
    return true;
  }

  /** Remove the old per-browser keys: they belong to no one in particular. */
  dropLegacy() {
    const s = this.storage;
    if (!s) return;
    try {
      const all = Array.from({ length: s.length }, (_, i) => s.key(i)).filter(Boolean);
      for (const k of all) if (LEGACY_KEYS.some(l => (l.endsWith(".") ? k.startsWith(l) : k === l))) s.removeItem(k);
    } catch {}
  }
}
