/* ContactsWindow — the buddy list: you at the top, then everyone with
   a role on hxh grouped Online / Away / Offline (no password yet shows
   red under Offline). One click on a name opens a chat; the little card
   opens their profile. Tall and narrow, like the original. */
import { Window } from "../../os/window.js";
import { h, esc } from "../../os/dom.js";
import { icon, avatar } from "../../os/icons.js";

export const GROUPS = [["online", "Online"], ["away", "Away"], ["offline", "Offline"]];
export const groupOf = state => (state === "online" || state === "away") ? state : "offline";

export class ContactsWindow extends Window {
  constructor({ me } = {}) {
    super({
      id: "win-chat-contacts", title: "Beetle — Contacts", icon: "beetle", width: 300, cls: "chat contacts", maximizable: false,
      content: `<div class="me"></div><div class="tools"><button class="btn sm" type="button" data-act="global">${icon("comment", 12)}Global chat</button></div><div class="groups"></div>`,
    });
    this.me = me;
    this.contacts = new Map();
  }

  render() {
    const el = super.render();
    this.meBox = el.querySelector(".me");
    this.groupsBox = el.querySelector(".groups");
    this.meBox.addEventListener("click", e => { if (e.target.closest("[data-act=myprofile]")) this.emit("myprofile"); });
    el.querySelector('[data-act="global"]').addEventListener("click", () => this.emit("global"));
    this.groupsBox.addEventListener("click", e => {
      const row = e.target.closest("[data-user]");
      if (!row) return;
      if (e.target.closest("[data-profile]")) this.emit("profile", { user: row.dataset.user });
      else this.emit("chat", { user: row.dataset.user });
    });
    this.renderMe();
    return el;
  }

  setMe(acct) { this.me = acct; this.renderMe(); }

  renderMe() {
    const box = this.meBox;
    if (!box) return;
    const me = this.me;
    box.innerHTML = me ? `${avatar(me)}<span class="nm">${esc(me.display_name || me.username)}</span><button class="btn sm" type="button" data-act="myprofile" title="Edit my profile">${icon("card", 12)}Profile</button>` : "";
  }

  setContacts(list) {
    this.contacts = new Map();
    for (const c of list || []) this.contacts.set(c.username, { ...c });
    this.renderGroups();
  }

  setPresence(user, state, lastSeen) {
    const c = this.contacts.get(user);
    if (!c) return false;
    c.state = state;
    if (lastSeen !== undefined) c.last_seen_at = lastSeen;
    this.renderGroups();
    return true;
  }

  get(user) { return this.contacts.get(user); }

  renderGroups() {
    const box = this.groupsBox;
    if (!box) return;
    box.replaceChildren();
    const mine = this.me?.username;
    for (const [key, label] of GROUPS) {
      const rows = [...this.contacts.values()].filter(c => c.username !== mine && groupOf(c.state) === key);
      const grp = h("div", { className: "grp", dataset: { group: key } }, h("span", { text: label }), h("span", { className: "n", text: String(rows.length) }));
      box.append(grp);
      for (const c of rows) {
        const row = h("div", { className: "contact", dataset: { user: c.username }, role: "button", tabindex: "0", title: c.state === "nopass" ? "Hasn't set a password yet" : "" });
        row.style.setProperty("--c", c.color || "#9a9a9a");
        row.append(h("i", { className: "dot " + c.state }), h("span", { className: "nm", text: c.display_name || c.username }),
          h("button", { type: "button", className: "pf", title: "Profile", dataset: { profile: "1" }, html: icon("card", 12) }));
        row.addEventListener("keydown", e => { if (e.key === "Enter") this.emit("chat", { user: c.username }); });
        box.append(row);
      }
    }
  }
}
