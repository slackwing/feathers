/* People — THE place that decides how a member looks on this site
   (Andrew, 2026-09-27: "why is my start menu avatar still a green AC even
   though i claimed chrollo? … the avatar determination should have been
   centralized somewhere").

   A member is their shared-auth profile (username, display_name, initial,
   color — /admin/api/me for you, the chat's contacts for everyone) with
   this site's overrides on top: a claimed character's short name and its
   avatar picture (the colour stays the member's own). The overrides come
   from ONE server function, ClaimOverrides, by two roads that carry the
   same data:
     - GET /hxh/api/db/people at login and after your own claim changes
       (so the Start menu is right without the chat ever opening);
     - the chat's contacts frames, which the server re-sends to everyone
       whenever anyone's claim changes (so it stays live).
   Every avatar and every "Character (Name)" label the page draws goes
   through `of()` / `avatar()` / `label()` here —
   never `icons.avatar(profile)` on a raw profile, which is how the Start
   menu went stale. The bus hears "people" when anything changes. */
import { avatar as avatarHTML } from "./icons.js";

export const PEOPLE_URL = "/hxh/api/db/people";
export const CONTACTS_URL = "/hxh/api/chat/contacts";

export class People {
  /** { fetch, bus, user: () => the signed-in account | null } */
  constructor({ fetch, bus, user } = {}) {
    this.fetch = fetch;
    this.bus = bus;
    this.user = user || (() => null);
    this.profiles = new Map();    // username → shared profile (display_name, initial, color, …)
    this.overrides = new Map();   // username → { character, avatar_url }
  }

  /** A member as this site shows them: profile + override. `who` is a username or an account-shaped object. */
  of(who) {
    const username = typeof who === "string" ? who : who?.username;
    const me = this.user();
    const base = (typeof who === "object" && who) || this.profiles.get(username) || (me && me.username === username ? me : null)
      || { username, display_name: username, initial: (username || "?").slice(0, 2).toUpperCase(), color: "#9a9a9a" };
    const o = username ? this.overrides.get(username) : null;
    if (!o) return { ...base, character: undefined, avatar_url: undefined };
    return { ...base, character: o.character || undefined, avatar_url: o.avatar_url || undefined };
  }

  /** A member's name as this site shows it: "Chrollo (Andrew C)" once they have claimed a character, else their own name. */
  label(who) {
    const m = this.of(who);
    const name = m.display_name || m.username || "";
    return m.character ? `${m.character} (${name})` : name;
  }

  /** The avatar HTML for a member (icons.avatar on `of(who)`). */
  avatar(who, cls = "") { return avatarHTML(this.of(who), cls); }

  /** The chat's contacts: profiles and overrides for everyone, straight from the server's own merge. */
  setContacts(list) {
    let changed = false;
    for (const c of list || []) {
      if (!c?.username) continue;
      const { character, avatar_url, ...profile } = c;
      const prev = this.profiles.get(c.username) || {}, next = { ...prev, ...profile };
      if (JSON.stringify(next) !== JSON.stringify(prev)) changed = true;   // a name or colour is news too, not only a claim
      this.profiles.set(c.username, next);
      changed = this.put(c.username, { character, avatar_url }) || changed;   // a released claim arrives without one: put() drops it
    }
    if (changed) this.bus?.emit("people", {});
    return changed;
  }

  /** Fetch the overrides (login, and after your own claim changes). Resolves true when anything changed; a failure keeps what we had. */
  async load() {
    if (!this.fetch) return false;
    let data;
    try {
      const r = await this.fetch(PEOPLE_URL, { credentials: "same-origin" });
      if (!r.ok) return false;
      data = await r.json();
    } catch { return false; }
    let changed = false;
    const next = new Map(Object.entries(data || {}));
    for (const u of [...this.overrides.keys()]) if (!next.has(u)) { this.overrides.delete(u); changed = true; }
    for (const [u, o] of next) changed = this.put(u, o) || changed;
    if (changed) this.bus?.emit("people", {});
    return changed;
  }

  /** Everyone's profile + claim from the chat's contacts, without the chat open (e.g. About names Andrew). Resolves true when anything changed. */
  async loadContacts() {
    if (!this.fetch) return false;
    try {
      const r = await this.fetch(CONTACTS_URL, { credentials: "same-origin" });
      if (!r.ok) return false;
      const data = await r.json();
      return this.setContacts(data?.contacts);
    } catch { return false; }
  }

  put(username, { character, avatar_url } = {}) {
    const prev = this.overrides.get(username);
    if (!character && !avatar_url) { if (prev) { this.overrides.delete(username); return true; } return false; }
    if (prev && prev.character === character && prev.avatar_url === avatar_url) return false;
    this.overrides.set(username, { character, avatar_url });
    return true;
  }
}
