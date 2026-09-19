/* Beetle — the Hunter Website's instant messenger (spec: docs/HXH_CHAT.md).
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
import "./chat.css";

export const ROOM_GLOBAL = "global";
export const dmRoom = (a, b) => "dm:" + [a, b].sort().join(":");
export const NEW_TRAY_ID = "chat-new";
export const SETTING_TRAY = "chat.trayNew";   // the new-message tray bubble
export const SETTING_FLASH = "chat.flash";    // flashing taskbar buttons

export class ChatApp extends App {
  static id = "chat";
  static name = "Beetle";
  static longName = "Beetle Messenger";
  static icon = "beetle";
  static order = 15;

  constructor(os, options = {}) {
    super(os, options);
    this.contacts = new Map();
    this.windows = new Map();     // room → ChatWindow
    this.loaded = new Set();      // rooms with history loaded
    this.unread = [];             // rooms with unread messages, oldest first
    this.client = null;
    this.api = new ChatAPI({ fetch: options.fetch || os.fetch, base: options.base });
  }

  get me() { return this.os.user?.username || null; }
  get connected() { return !!this.client?.connected; }

  visible(user) { return !!user; }

  tray() {
    return {
      title: "Beetle", on: () => this.connected,
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
    c.on("hello", ({ contacts }) => this.setContacts(contacts));
    c.on("msg", m => this.onMessage(m));
    c.on("typing", ({ room, user }) => this.windows.get(room)?.showTyping(this.nameOf(user)));
    c.on("presence", p => this.onPresence(p));
    c.on("state", ({ connected }) => { os.bus.emit("tray:refresh", { id: this.id }); this.contactsWin?.setConnected(connected); });
    c.on("error", e => { if (e.code === "rate") os.toast.show("Slow down."); });
    this.stopFocus = os.bus.on("window:focus", ({ id }) => this.onFocus(id));
    c.connect();
    return c;
  }

  setContacts(list) {
    this.contacts = new Map((list || []).map(c => [c.username, { ...c }]));
    this.contactsWin?.setContacts(list);
    for (const [room, w] of this.windows) { w.setTitle(this.roomTitle(room)); w.refreshNames(); }
  }

  onPresence({ user, state, last_seen_at }) {
    const c = this.contacts.get(user);
    const prev = c?.state;
    if (c) { c.state = state; c.last_seen_at = last_seen_at; }
    this.contactsWin?.setPresence(user, state, last_seen_at);
    if (user !== this.me && prev && prev !== state) {
      if (state === "online") this.os.sounds.play("dooropen");
      else if (prev === "online") this.os.sounds.play("doorclose");
    }
  }

  /* ---------- menus ---------- */
  /** The Settings menu shared by every Beetle window. */
  settingsItems() {
    const os = this.os;
    return [
      os.settings.item({ key: SETTING_TRAY, label: "New message icon", icon: "comment", onChange: () => this.syncNewIcon() }),
      os.settings.item({ key: SETTING_FLASH, label: "Flash taskbar", icon: "crt" }),
      { label: "Sounds", icon: "comment", check: () => os.sounds.on, onclick: () => os.sounds.toggle() },
    ];
  }
  get traySetting() { return this.os.settings.get(SETTING_TRAY, true); }
  get flashSetting() { return this.os.settings.get(SETTING_FLASH, true); }

  contactsMenus(win) {
    return this.os.appMenus(win, {
      edit: () => [{ label: "Profile", icon: "card", onclick: () => this.editProfile() }],
      settings: () => this.settingsItems(),
    });
  }

  roomMenus(win, room) {
    const other = room === ROOM_GLOBAL ? null : room.slice(3).split(":").find(u => u !== this.me);
    return this.os.appMenus(win, {
      edit: () => [
        ...(other ? [{ label: `${this.nameOf(other)}'s profile`, icon: "card", onclick: () => this.viewProfile(other) }] : []),
        { label: "My profile", icon: "card", onclick: () => this.editProfile() },
      ],
      settings: () => this.settingsItems(),
    });
  }

  /* ---------- windows ---------- */
  launch({ autostart = false } = {}) {
    this.connect();
    const contacts = this.openContacts();
    this.openRoom(ROOM_GLOBAL, { focus: false });
    void autostart;
    return contacts;
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
      const other = room === ROOM_GLOBAL ? null : room.slice(3).split(":").find(u => u !== this.me);
      w = new ChatWindow({ room, title: this.roomTitle(room), me: this.me, nameOf: u => this.nameOf(u), colorOf: u => this.colorOf(u),
        menus: win => this.roomMenus(win, room), info: !!other });
      os.wm.add(w);
      this.windows.set(room, w);
      w.on("send", ({ body }) => this.send(room, body));
      w.on("typing", () => this.client?.typing(room));
      w.on("info", () => other && this.viewProfile(other));
      w.on("close", () => { this.markRead(room); });
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

  async loadHistory(room, w) {
    if (this.loaded.has(room)) return;
    this.loaded.add(room);
    try {
      const { messages } = await this.api.history(room);
      w.setMessages(messages);
    } catch { this.loaded.delete(room); }
  }

  send(room, body) {
    if (!this.client?.sendMessage(room, body)) { this.os.toast.show("Slow down."); return false; }
    this.os.sounds.play("sent");
    return true;
  }

  /* ---------- incoming ---------- */
  onMessage(m) {
    const os = this.os;
    const w = this.openRoom(m.room, { focus: false });
    w.addMessage(m);
    if (m.sender === this.me) return;
    const seen = os.wm.activeId === w.id && w.state.open && !w.state.minimized;
    if (!seen) {
      if (this.flashSetting) w.requestAttention();
      if (!this.unread.includes(m.room)) this.unread.push(m.room);
      this.syncNewIcon();
    }
    os.sounds.play("message");
  }

  onFocus(id) {
    for (const [room, w] of this.windows) if (w.id === id) this.markRead(room);
  }

  markRead(room) {
    const i = this.unread.indexOf(room);
    if (i >= 0) { this.unread.splice(i, 1); this.syncNewIcon(); }
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
