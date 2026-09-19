/* ContactsWindow — the buddy list, after AIM 4.x / MSN 4.x: a status
   banner with your avatar and "(Online)", Online / List tabs, a sunken
   tree of collapsible groups — Buddies (online/total), Bots, Offline —
   with away and offline names in grey italics, an icon toolbar (IM,
   Info, Chat Room) that acts on the selected buddy, and a status bar
   with the connection state. Single click opens a chat (Andrew's spec);
   right-click gives Send Message / Profile. */
import { Window } from "../../os/window.js";
import { h, esc } from "../../os/dom.js";
import { icon, avatar } from "../../os/icons.js";
import { Menu } from "../../os/menu.js";

export const STATE_LABEL = { online: "Online", away: "Away", offline: "Offline", nopass: "No password" };
export const STATE_TINT = { online: "#58e05c", away: "#ffd166", offline: "#9a9a9a", nopass: "#c8102e" };
export const present = state => state === "online" || state === "away";

export class ContactsWindow extends Window {
  /** props: me, menus (win => spec) */
  constructor({ me, menus } = {}) {
    super({
      id: "win-chat-contacts", title: "Beetle", icon: "beetle", width: 300, cls: "chat contacts", maximizable: false, menus,
      content: `
        <div class="banner"></div>
        <div class="ltabs"><button class="ltab on" type="button" data-tab="online">Online</button><button class="ltab" type="button" data-tab="list">List</button></div>
        <div class="tree sunken" role="tree"></div>
        <div class="tools">
          <button class="tool" type="button" data-act="im" title="Send message">${icon("comment", 16)}<span>IM</span></button>
          <button class="tool" type="button" data-act="info" title="Profile">${icon("card", 16)}<span>Info</span></button>
          <button class="tool" type="button" data-act="global" title="Global chat">${icon("beetle", 16)}<span>Global</span></button>
        </div>
        <div class="status"><span class="conn off">Offline</span><span class="count"></span></div>`,
    });
    this.me = me;
    this.contacts = new Map();
    this.tab = "online";
    this.collapsed = new Set();
    this.selected = null;
    this.connected = false;
  }

  render() {
    const el = super.render();
    this.banner = el.querySelector(".banner");
    this.tree = el.querySelector(".tree");
    this.countEl = el.querySelector(".count");
    this.connEl = el.querySelector(".conn");
    el.querySelector(".ltabs").addEventListener("click", e => {
      const t = e.target.closest("[data-tab]");
      if (!t) return;
      this.tab = t.dataset.tab;
      for (const b of el.querySelectorAll(".ltab")) b.classList.toggle("on", b === t);
      this.renderTree();
    });
    this.tree.addEventListener("click", e => {
      const grp = e.target.closest(".grp");
      if (grp) { const g = grp.dataset.group; this.collapsed.has(g) ? this.collapsed.delete(g) : this.collapsed.add(g); this.renderTree(); return; }
      const row = e.target.closest("[data-user]");
      if (row) { this.select(row.dataset.user); this.emit("chat", { user: row.dataset.user }); }
    });
    this.tree.addEventListener("contextmenu", e => {
      const row = e.target.closest("[data-user]");
      if (!row) return;
      e.preventDefault();
      this.select(row.dataset.user);
      this.contextMenu(row);
    });
    this.tree.addEventListener("keydown", e => {
      const row = e.target.closest("[data-user]");
      if (row && e.key === "Enter") this.emit("chat", { user: row.dataset.user });
    });
    el.querySelector(".tools").addEventListener("click", e => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "global") this.emit("global");
      else if (act === "im" && this.selected) this.emit("chat", { user: this.selected });
      else if (act === "info") this.emit("profile", { user: this.selected || this.me?.username });
    });
    this.menu = this.adopt(new Menu({ items: () => this.selected ? [
      { label: "Send Message", icon: "comment", onclick: () => this.emit("chat", { user: this.selected }) },
      { label: "Profile", icon: "card", onclick: () => this.emit("profile", { user: this.selected }) },
    ] : [] }), el);
    this.menu.el.classList.add("ctx");
    this.renderBanner();
    this.renderTree();
    return el;
  }

  contextMenu(row) {
    const m = this.menu;
    m.el.style.top = (row.offsetTop + row.offsetHeight + this.tree.offsetTop - this.tree.scrollTop) + "px";
    m.el.style.left = (this.tree.offsetLeft + 24) + "px";
    m.open();
  }

  setMe(acct) { this.me = acct; this.renderBanner(); this.renderTree(); }
  setConnected(on) {
    this.connected = !!on;
    if (this.connEl) { this.connEl.textContent = on ? "Connected" : "Offline"; this.connEl.classList.toggle("off", !on); }
    this.renderBanner();
  }

  renderBanner() {
    if (!this.banner) return;
    const me = this.me;
    this.banner.innerHTML = me
      ? `${avatar(me)}<span class="who"><b>${esc(me.display_name || me.username)}</b><span class="st">(${this.connected ? "Online" : "Offline"})</span></span>`
      : "";
  }

  setContacts(list) {
    this.contacts = new Map();
    for (const c of list || []) this.contacts.set(c.username, { ...c });
    this.renderTree();
  }

  setPresence(user, state, lastSeen) {
    const c = this.contacts.get(user);
    if (!c) return false;
    c.state = state;
    if (lastSeen !== undefined) c.last_seen_at = lastSeen;
    this.renderTree();
    return true;
  }

  get(user) { return this.contacts.get(user); }

  select(user) {
    this.selected = user;
    for (const r of this.tree.querySelectorAll("[data-user]")) r.classList.toggle("sel", r.dataset.user === user);
  }

  /** Everyone but me, grouped for the Online tab: buddies (people present), bots present, offline. */
  groups() {
    const mine = this.me?.username;
    const all = [...this.contacts.values()].filter(c => c.username !== mine);
    const byName = (a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username);
    const people = all.filter(c => !c.is_bot), bots = all.filter(c => c.is_bot);
    const g = [
      { key: "buddies", label: "Buddies", rows: people.filter(c => present(c.state)).sort(byName), total: people.length },
    ];
    if (bots.length) g.push({ key: "bots", label: "Bots", rows: bots.filter(c => present(c.state)).sort(byName), total: bots.length });
    g.push({ key: "offline", label: "Offline", rows: all.filter(c => !present(c.state)).sort(byName), total: all.length, off: true });
    return g;
  }

  row(c, { flat = false } = {}) {
    const state = c.state || "offline";
    const row = h("div", { className: `contact ${state}${c.username === this.selected ? " sel" : ""}`, dataset: { user: c.username }, role: "treeitem", tabindex: "0",
      title: state === "nopass" ? "Hasn't set a password yet" : (c.is_bot ? "Bot" : "") });
    row.style.setProperty("--c", c.color || "#9a9a9a");
    row.append(h("span", { className: "fig", html: icon("buddy", 16, { g: STATE_TINT[state] || STATE_TINT.offline }) }),
      h("span", { className: "nm", text: c.display_name || c.username }));
    if (state === "away" || state === "nopass" || (flat && state !== "online")) row.append(h("span", { className: "st", text: `(${STATE_LABEL[state]})` }));
    return row;
  }

  renderTree() {
    const box = this.tree;
    if (!box) return;
    box.replaceChildren();
    const mine = this.me?.username;
    if (this.tab === "list") {
      const all = [...this.contacts.values()].filter(c => c.username !== mine).sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username));
      for (const c of all) box.append(this.row(c, { flat: true }));
      if (this.countEl) this.countEl.textContent = `${all.length} buddies`;
      return;
    }
    let online = 0, total = 0;
    for (const g of this.groups()) {
      const open = !this.collapsed.has(g.key);
      const shown = g.off ? `${g.rows.length}/${g.total}` : `${g.rows.length}/${g.total}`;
      box.append(h("div", { className: `grp${g.off ? " off" : ""}${open ? "" : " closed"}`, dataset: { group: g.key } },
        h("span", { className: "tri", text: open ? "▼" : "▶" }), h("span", { className: "lbl", text: `${g.label} (${shown})` })));
      if (open) for (const c of g.rows) box.append(this.row(c));
      if (!g.off) { online += g.rows.filter(c => c.state === "online").length; total += g.total; }
    }
    if (this.countEl) this.countEl.textContent = `${online} of ${total} online`;
  }
}
