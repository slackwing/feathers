/* Profile — every preference, kept per USER on this browser (Andrew,
   2026-09-28: "can we save these profiles per username so on one computer
   multiple users can have different preferences/profile").

   A Storage-shaped wrapper (getItem / setItem / removeItem) that Settings,
   the CRT and Sounds are handed instead of localStorage itself, so none of
   them needs to know about users: their keys land under
   `hxh.u.<username>:<key>`. Signed out (the boot, the splash, the logon,
   the account pages) there is no profile — reads get the defaults and
   writes stay in memory — so nobody's picks leak onto a shared screen.

   The first time a user signs in on a browser that still holds the old
   per-browser keys (hxh.set.*, hxh.crt, hxh.sound), they are moved into
   that user's profile and removed, so the next person starts clean. */
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
    if (next) this.adoptLegacy();
    return true;
  }

  /** Move the old per-browser keys into this user's profile, once — only when the profile is still empty. */
  adoptLegacy() {
    const s = this.storage;
    if (!s) return;
    try {
      const all = Array.from({ length: s.length }, (_, i) => s.key(i)).filter(Boolean);
      const mine = `${PROFILE_PREFIX}${this.user}:`;
      const legacy = all.filter(k => LEGACY_KEYS.some(l => (l.endsWith(".") ? k.startsWith(l) : k === l)));
      if (!legacy.length) return;
      if (!all.some(k => k.startsWith(mine))) for (const k of legacy) s.setItem(mine + k, s.getItem(k));
      for (const k of legacy) s.removeItem(k);
    } catch {}
  }
}
