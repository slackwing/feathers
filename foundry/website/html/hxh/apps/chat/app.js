/* BeetleChat — the Hunter Website's instant messenger (spec: docs/HXH_CHAT.md).
   Named for the Beetle 07, the phone Gon and Killua carry. Launching
   opens the contacts list and the global chat; a click on a contact
   opens a chat window; messages arrive live over the hub. Attention
   the Windows way: an unread window flashes its taskbar button and a
   "new message" bubble sits in the tray until the last unread chat has
   been focused (both switchable in the Settings menu). Door sounds for
   presence, a blip for messages. Every window carries the OS-standard
   File / Edit / Settings menus (OS.appMenus). */
import { App } from "../../os/apps.js";
import { ChatClient, ChatAPI, wsURL } from "./client.js";
import { ContactsWindow } from "./contacts.js";
import { ChatWindow } from "./window.js";
import { ProfileWindow, ProfileEditor } from "./profile.js";
import { AboutWindow } from "./about.js";
import { PictureDialog } from "./picture.js";
import "./chat.css";

export const ROOM_GLOBAL = "global";
export const dmRoom = (a, b) => "dm:" + [a, b].sort().join(":");
export const NEW_TRAY_ID = "chat-new";
export const SETTING_TRAY = "chat.trayNew";   // the new-message tray bubble
export const SETTING_FLASH = "chat.flash";    // flashing taskbar buttons

export class ChatApp extends App {
  static id = "chat";
  static name = "BeetleChat";
  static longName = "BeetleChat";
  static icon = "beetle";
  static order = 15;

  constructor(os, options = {}) {
    super(os, options);
    this.contacts = new Map();
    this.windows = new Map();     // room → ChatWindow
    this.loaded = new Set();      // rooms with history loaded
    this.unread = [];             // rooms with unread messages, oldest first
    this.lastIds = new Map();     // room → newest message id the server told us of (hello.unread)
    this.client = null;
    this.api = new ChatAPI({ fetch: options.fetch || os.fetch, base: options.base });
    // "The most explicit focus is what makes something read" (Andrew,
    // 2026-09-19): only the tab the user is looking at may mark a room
    // read — another window forgotten behind it never does, even if a
    // chat is its active window. Injectable for tests.
    this.hasFocus = options.hasFocus || (() => {
      const d = os.doc;
      return !!(d?.hasFocus ? d.hasFocus() : true) && d?.visibilityState !== "hidden";
    });
  }

  /** May this user be messaged? Online or away, not offline, not without a password. */
  reachable(user) { const s = this.contacts.get(user)?.state; return s === "online" || s === "away"; }

  get me() { return this.os.user?.username || null; }
  get connected() { return !!this.client?.connected; }

  visible(user) { return !!user; }

  tray() {
    return {
      title: "BeetleChat", on: () => this.connected,
      menu: () => [
        { label: "Contacts", icon: "beetle", onclick: () => this.openContacts() },
        { label: "Global chat", icon: "comment", onclick: () => this.openRoom(ROOM_GLOBAL) },
        { label: "My profile", icon: "card", onclick: () => this.editProfile() },
        "sep",
        { label: "Sounds", icon: "comment", check: () => this.os.sounds.on, onclick: () => this.os.sounds.toggle() },
      ],
    };
  }

  /* ---------- names, colours, rooms ---------- */
  nameOf(user) { return this.contacts.get(user)?.display_name || (user === this.me ? this.os.user?.display_name : null) || user; }
  colorOf(user) { return this.contacts.get(user)?.color || (user === this.me ? this.os.user?.color : null) || "#9a9a9a"; }
  roomTitle(room) {
    if (room === ROOM_GLOBAL) return "Global chat";
    const other = room.slice(3).split(":").find(u => u !== this.me) || room;
    return this.nameOf(other);
  }

  /* ---------- connection ---------- */
  connect() {
    if (this.client) return this.client;
    const os = this.os;
    const c = this.client = new ChatClient({ url: this.options.url || wsURL(os.win.location), WebSocket: this.options.WebSocket || os.win.WebSocket, ...(this.options.client || {}) });
    c.on("hello", ({ contacts, unread }) => { this.setContacts(contacts); this.onUnread(unread || []); });
    c.on("msg", m => this.onMessage(m));
    c.on("read", ({ room, id }) => this.onReadElsewhere(room, id));
    c.on("typing", ({ room, user }) => this.windows.get(room)?.showTyping(this.nameOf(user)));
    c.on("presence", p => this.onPresence(p));
    c.on("state", ({ connected }) => { os.bus.emit("tray:refresh", { id: this.id }); this.contactsWin?.setConnected(connected); });
    c.on("reconnect", () => this.resync("reconnect"));
    this.stopWake = os.bus.on("wake", ({ reason }) => this.onWake(reason));
    c.on("error", e => {
      if (e.code === "rate") os.toast.show("Slow down.");
      else if (e.code === "offline") os.toast.show(`${this.nameOf(this.otherOf(e.room))} is offline.`);
      else if (e.code === "image") os.toast.show("That picture can't be sent.");
    });
    this.stopFocus = os.bus.on("window:focus", ({ id }) => this.onFocus(id));
    // the tab itself regaining focus is what turns "shown" into "read"
    this._onTabFocus = () => this.onTabFocus();
    os.win?.addEventListener("focus", this._onTabFocus);
    os.doc?.addEventListener("visibilitychange", this._onTabFocus);
    c.connect();
    return c;
  }

  setContacts(list) {
    this.contacts = new Map((list || []).map(c => [c.username, { ...c }]));
    this.contactsWin?.setContacts(list);
    for (const [room, w] of this.windows) { w.setTitle(this.roomTitle(room)); w.refreshNames(); this.syncCanSend(room, w); }
  }

  /** A DM's compose follows the buddy's reachability. */
  syncCanSend(room, w = this.windows.get(room)) {
    const other = this.otherOf(room);
    if (!w || !other) return;
    w.setCanSend(this.reachable(other), `${this.nameOf(other)} is offline.`);
  }

  onPresence({ user, state, last_seen_at }) {
    const c = this.contacts.get(user);
    const prev = c?.state;
    if (c) { c.state = state; c.last_seen_at = last_seen_at; }
    this.contactsWin?.setPresence(user, state, last_seen_at);
    if (this.me) this.syncCanSend(dmRoom(this.me, user));
    if (user !== this.me && prev && prev !== state) {
      if (state === "online") this.os.sounds.play("dooropen");
      else if (prev === "online") this.os.sounds.play("doorclose");
    }
  }

  /* ---------- menus (Andrew's layout, 2026-09-19; no icons — 90s menus had none) ---------- */
  /** BeetleChat's Settings: checkable, remembered per browser. */
  settingsItems() {
    const os = this.os;
    return [
      os.settings.item({ key: SETTING_FLASH, label: "Flash on new" }),
      os.settings.item({ key: SETTING_TRAY, label: "Systray alert", onChange: () => this.syncNewIcon() }),
      { label: "Sounds", check: () => os.sounds.on, onclick: () => os.sounds.toggle() },
    ];
  }
  get traySetting() { return this.os.settings.get(SETTING_TRAY, true); }
  get flashSetting() { return this.os.settings.get(SETTING_FLASH, true); }

  /** The BeetleChat window: File (About, Update, Exit), Edit (Profile…), Settings. */
  contactsMenus(win) {
    return this.os.appMenus(win, {
      file: () => [{ label: "About", onclick: () => this.about() }, { label: "Update", disabled: true }],
      edit: () => [{ label: "Profile…", onclick: () => this.editProfile() }],
      settings: () => this.settingsItems(),
    });
  }

  /** A chat: File (Exit) only in the global room; a buddy's chat adds View (Profile). */
  roomMenus(win, room) {
    const other = this.otherOf(room);
    return this.os.appMenus(win, {
      view: other ? () => [{ label: "Profile", onclick: () => this.viewProfile(other) }] : null,
    });
  }

  otherOf(room) { return room === ROOM_GLOBAL ? null : room.slice(3).split(":").find(u => u !== this.me); }

  /* ---------- windows ---------- */
  /**
   * Launch: contacts and the global chat, as always. Then the hello
   * tells us what is unread: every such DM opens behind (flashing) and
   * the global chat comes to the front LAST, so being focused it is
   * read at once — Andrew wants global, which nearly always has news,
   * to flash the least.
   */
  launch({ autostart = false } = {}) {
    this.launching = true;
    this.connect();
    const contacts = this.openContacts();
    this.openRoom(ROOM_GLOBAL, { focus: false });
    void autostart;
    return contacts;
  }

  /** hello.unread (every connect): surface the rooms with news. */
  onUnread(list) {
    const rooms = list.filter(u => u.count > 0).map(u => u.room);
    for (const u of list) if (u.last_id) this.lastIds.set(u.room, Math.max(u.last_id, this.lastIds.get(u.room) || 0));
    for (const room of rooms) if (room !== ROOM_GLOBAL) this.surface(room);
    const global = rooms.includes(ROOM_GLOBAL);
    if (this.launching) {
      this.launching = false;
      if (global && !this.unread.includes(ROOM_GLOBAL)) this.unread.push(ROOM_GLOBAL);
      this.openRoom(ROOM_GLOBAL, { focus: true });   // focus → read, if this tab is the one being looked at
      if (this.unread.includes(ROOM_GLOBAL)) this.flag(ROOM_GLOBAL);   // it was not: flash like the others
    } else if (global) {
      this.surface(ROOM_GLOBAL);
    }
  }

  /** An unread room: its window open behind the active one, flashing, in the tray bubble. */
  surface(room) {
    const w = this.openRoom(room, { focus: false });
    const seen = this.os.wm.activeId === w.id && w.state.open && !w.state.minimized && this.hasFocus();
    if (seen) this.markRead(room); else this.flag(room, w);
  }

  flag(room, w = this.windows.get(room)) {
    if (this.flashSetting) w?.requestAttention();
    if (!this.unread.includes(room)) this.unread.push(room);
    this.syncNewIcon();
  }

  openContacts() {
    const os = this.os;
    if (!this.contactsWin) {
      const w = this.contactsWin = new ContactsWindow({ me: os.user, menus: win => this.contactsMenus(win) });
      os.wm.add(w);
      w.on("chat", ({ user }) => this.openChat(user));
      w.on("profile", ({ user }) => (user === this.me ? this.editProfile() : this.viewProfile(user)));
      w.on("global", () => this.openRoom(ROOM_GLOBAL));
      w.setContacts([...this.contacts.values()]);
      w.setConnected(this.connected);
    }
    const at = this.contactsWin.state.placed ? null : (os.env.floating() ? { x: Math.max(16, os.env.width - 300 - 30), y: 24 } : null);
    os.wm.open(this.contactsWin.id, at);
    return this.contactsWin;
  }

  openChat(user) { return this.openRoom(dmRoom(this.me, user)); }

  /** The window for a room, created on demand; focus=false keeps the current window active (an incoming message). */
  openRoom(room, { focus = true } = {}) {
    const os = this.os;
    let w = this.windows.get(room);
    if (!w) {
      const other = this.otherOf(room);
      w = new ChatWindow({ room, title: this.roomTitle(room), me: this.me, nameOf: u => this.nameOf(u), colorOf: u => this.colorOf(u),
        menus: win => this.roomMenus(win, room), profile: !!other, large: room === ROOM_GLOBAL, imageURL: id => this.api.imageURL(id), clipboard: this.options.clipboard });
      os.wm.add(w);
      this.windows.set(room, w);
      w.on("send", ({ body, image }) => this.send(room, body, image));
      w.on("image-file", ({ file }) => this.attachFile(w, file));
      w.on("image-dialog", () => this.pictureDialog(w));
      w.on("clip-fail", () => os.toast.show("Nothing to paste."));
      w.on("typing", () => this.client?.typing(room));
      w.on("profile", () => other && this.viewProfile(other));
      w.on("close", () => { this.markRead(room); });
      this.syncCanSend(room, w);
      this.loadHistory(room, w);
    }
    if (w.state.open && !w.state.minimized && !focus) return w;
    const active = os.wm.activeId;
    const at = w.state.placed ? null : this.cascade();
    os.wm.open(w.id, at, { scroll: focus });
    if (!focus && active && active !== w.id) os.wm.focus(active);
    if (focus) w.focusInput();
    return w;
  }

  cascade() {
    const os = this.os;
    if (!os.env.floating()) return null;
    const n = this.windows.size;
    return { x: Math.max(16, Math.min(os.env.width - 500, 430 + (n % 5) * 30)), y: 120 + (n % 5) * 30 };
  }

  /** The laptop woke, the tab came back or the network returned (OS `wake`):
      the client replaces a dead socket now — its hello and "reconnect" then
      resync — or probes a live-looking one. After a sleep or an outage the
      history is refetched regardless, in case the socket only looks alive. */
  onWake(reason) {
    if (!this.client) return;
    if (!this.client.nudge() && (reason === "sleep" || reason === "online")) this.resync(reason);
  }

  /** Whatever was said while the socket was down: refetch every open room's
      history and fold the gap in (ids dedupe; the hello refreshed contacts). */
  async resync(reason = "") {
    this.resyncs = (this.resyncs || 0) + 1;
    this.lastResync = reason;
    let added = 0;
    for (const [room, w] of this.windows) {
      if (!w.state.open || !this.loaded.has(room)) continue;
      try { const { messages } = await this.api.history(room); added += w.mergeMessages(messages); } catch {}
    }
    return added;
  }

  async loadHistory(room, w) {
    if (this.loaded.has(room)) return;
    this.loaded.add(room);
    try {
      const { messages } = await this.api.history(room);
      w.setMessages(messages);
    } catch { this.loaded.delete(room); }
  }

  send(room, body, image = null) {
    if (!this.client?.sendMessage(room, body, image?.id || 0)) { this.os.toast.show("Slow down."); return false; }
    this.os.sounds.play("sent");
    return true;
  }

  /* ---------- pictures ---------- */
  /** Upload a picture (any Blob) and hang it on the window's next message. */
  async attachFile(w, file) {
    try {
      const ref = await this.api.uploadImage(file);
      w.attachImage({ ...ref, url: this.api.imageURL(ref.id) });
      return ref;
    } catch (err) {
      this.os.toast.show("That picture didn't take.");
      return null;
    }
  }

  /** What picture, if any, the clipboard holds (needs the async Clipboard API and a user gesture). */
  async clipboardImage() {
    const cb = this.options.clipboard || this.os.win?.navigator?.clipboard;
    try {
      for (const item of await cb.read()) {
        const type = item.types.find(t => t.startsWith("image/"));
        if (type) return await item.getType(type);
      }
    } catch {}
    return null;
  }

  /** The Insert Image window for a chat: previews the clipboard's picture, offers an upload. */
  async pictureDialog(w) {
    const os = this.os;
    if (!this.pictureWin) {
      this.pictureWin = new PictureDialog({ objectURL: this.options.objectURL, revoke: this.options.revokeURL });
      os.wm.add(this.pictureWin);
      this.pictureWin.on("insert", ({ file }) => this.attachFile(this.pictureFor || w, file));
    }
    this.pictureFor = w;
    this.pictureWin.setClipboard(await this.clipboardImage());
    os.wm.open(this.pictureWin.id);
    return this.pictureWin;
  }

  /* ---------- incoming ---------- */
  onMessage(m) {
    const os = this.os;
    const w = this.openRoom(m.room, { focus: false });
    w.addMessage(m);
    this.lastIds.set(m.room, Math.max(m.id, this.lastIds.get(m.room) || 0));
    if (m.sender === this.me) return;
    const seen = os.wm.activeId === w.id && w.state.open && !w.state.minimized && this.hasFocus();
    if (seen) this.client?.read(m.room, m.id); else this.flag(m.room, w);
    os.sounds.play("message");
  }

  /** An OS window came to the front: if it is a chat and this tab is being looked at, it is read. */
  onFocus(id) {
    for (const [room, w] of this.windows) if (w.id === id) this.markRead(room);
  }

  /** The tab itself came to the front: whatever chat is active is now read. */
  onTabFocus() {
    if (!this.hasFocus()) return;
    const id = this.os.wm.activeId;
    for (const [room, w] of this.windows) if (w.id === id && w.state.open && !w.state.minimized) this.markRead(room);
  }

  /**
   * Read = shown in the active window of the tab the user is looking at.
   * Tells the server (which tells our other tabs) and clears the flash
   * and the tray bubble. An unfocused tab never reads.
   */
  markRead(room) {
    if (!this.hasFocus()) return false;
    const w = this.windows.get(room);
    const id = Math.max(w?.lastId || 0, this.lastIds.get(room) || 0);
    if (id && this.unread.includes(room)) this.client?.read(room, id);
    this.clearUnread(room);
    return true;
  }

  /** Another tab of ours read `room` up to `id`: nothing newer here means we are calm too. */
  onReadElsewhere(room, id) {
    const w = this.windows.get(room);
    const newest = Math.max(w?.lastId || 0, this.lastIds.get(room) || 0);
    if (newest <= id) this.clearUnread(room);
  }

  clearUnread(room) {
    const i = this.unread.indexOf(room);
    if (i >= 0) { this.unread.splice(i, 1); this.syncNewIcon(); }
    this.windows.get(room)?.calm();
  }

  /** The "new message" tray bubble: present while anything is unread (and the setting is on); a click focuses the oldest. */
  syncNewIcon() {
    const os = this.os;
    const has = os.taskbar?.tray.has(NEW_TRAY_ID);
    const want = this.unread.length && this.traySetting;
    if (want && !has) {
      os.bus.emit("tray:add", { id: NEW_TRAY_ID, icon: "comment", title: "New message", on: true, onClick: () => this.focusOldestUnread() });
    } else if (!want && has) {
      os.bus.emit("tray:remove", { id: NEW_TRAY_ID });
    }
  }

  focusOldestUnread() {
    const room = this.unread[0];
    if (room) this.openRoom(room, { focus: true });
  }

  /* ---------- about ---------- */
  about() {
    const os = this.os;
    let w = os.wm.get("win-chat-about");
    if (!w) { w = new AboutWindow({ sounds: os.sounds }); os.wm.add(w); }
    os.wm.open(w.id);
    w.startMusic();
    return w;
  }

  /* ---------- profiles ---------- */
  async viewProfile(user) {
    const os = this.os;
    const id = "win-chat-profile-" + user.replace(/[^a-z0-9]+/gi, "-");
    let w = os.wm.get(id);
    if (!w) { w = new ProfileWindow({ user, name: this.nameOf(user) }); os.wm.add(w); }
    w.setRuns([]);
    os.wm.open(id);
    try { const { runs } = await this.api.profile(user); w.setRuns(runs); } catch {}
    return w;
  }

  async editProfile() {
    const os = this.os;
    let w = os.wm.get("win-chat-profile-edit");
    if (!w) {
      w = new ProfileEditor(this.options.editor || {});
      os.wm.add(w);
      w.on("cancel", () => w.close());
      w.on("save", async ({ runs }) => {
        try { await this.api.saveProfile(runs); os.toast.show("Profile saved."); w.close(); }
        catch (err) { os.toast.show(String(err.message || err)); }
      });
      w.on("error", ({ error }) => os.toast.show(error));
    }
    os.wm.open(w.id);
    try { const { runs } = await this.api.profile(this.me); w.setRuns(runs); } catch { w.setRuns([]); }
    w.focusEditor();
    return w;
  }
}
