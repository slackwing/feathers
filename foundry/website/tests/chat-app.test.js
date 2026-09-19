import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch, tick } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { ChatApp, dmRoom, NEW_TRAY_ID, SETTING_TRAY, SETTING_FLASH } from "../html/hxh/apps/chat/app.js";
import { ContactsWindow, present } from "../html/hxh/apps/chat/contacts.js";
import { AboutWindow } from "../html/hxh/apps/chat/about.js";
import { ChatWindow } from "../html/hxh/apps/chat/window.js";
import { ProfileWindow, ProfileEditor } from "../html/hxh/apps/chat/profile.js";
import { Window } from "../html/hxh/os/window.js";

const ME = { username: "andrew", display_name: "Andrew", initial: "AC", color: "#d914e3", roles: [{ website: "hxh", role: "admin" }] };
const CONTACTS = [
  { username: "andrew", display_name: "Andrew", initial: "AC", color: "#d914e3", state: "online" },
  { username: "abi", display_name: "Abigail Goh", initial: "AG", color: "#349db2", state: "online" },
  { username: "gon", display_name: "Gon", initial: "GO", color: "#58e05c", state: "away" },
  { username: "killua", display_name: "Killua", initial: "KI", color: "#37d0ff", state: "offline" },
  { username: "leorio", display_name: "Leorio", initial: "LE", color: "#ff7518", state: "nopass" },
  { username: "alyosha", display_name: "Alyosha", initial: "AL", color: "#7c4dff", state: "online", is_bot: true },
];

function fakeWS() {
  const sockets = [];
  class WS {
    constructor(url) { this.url = url; this.sent = []; this.readyState = 0; sockets.push(this); }
    send(d) { this.sent.push(JSON.parse(d)); }
    close() { this.readyState = 3; this.onclose?.({}); }
    open() { this.readyState = 1; this.onopen?.(); }
    push(obj) { this.onmessage?.({ data: JSON.stringify(obj) }); }
  }
  return { WS, sockets };
}

let d, os, sockets, log, api;
beforeEach(async () => {
  d = setupDom();
  const ws = fakeWS(); sockets = ws.sockets; log = [];
  api = {
    "GET /admin/api/me": [200, ME],
    "GET /hxh/api/chat/history?room=global": [200, { room: "global", messages: [{ id: 1, room: "global", sender: "abi", body: "hello all", created_at: "2026-10-31T20:00:00Z" }] }],
    "GET /hxh/api/chat/history?room=dm%3Aabi%3Aandrew": [200, { room: "dm:abi:andrew", messages: [] }],
    "GET /hxh/api/chat/profile/abi": [200, { username: "abi", runs: [{ t: "lyrics", b: true }] }],
    "GET /hxh/api/chat/profile/andrew": [200, { username: "andrew", runs: [] }],
    "PUT /hxh/api/chat/profile": [200, { username: "andrew", runs: [{ t: "me" }] }],
  };
  os = new OS({ win: d.win, fetch: fakeFetch(api, log), env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  os.sounds.AC = class { constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; } createOscillator() { return { frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; } createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } };
  await os.start({ apps: [[ChatApp, { WebSocket: ws.WS, url: "ws://test/ws", client: { setTimeout: () => 0, clearTimeout: () => {} } }]], boot: false, start: true });
});

const app = () => os.registry.get("chat");
const hello = () => { sockets[0].open(); sockets[0].push({ t: "hello", me: "andrew", contacts: CONTACTS }); };

test("the app is on the desktop and in the tray with a menu", () => {
  assert.equal(app().name, "Beetle");
  assert.ok(os.desktop.icons.get("chat"));
  const tray = os.taskbar.tray.get("chat");
  assert.ok(tray);
  assert.ok(!tray.btn.classList.contains("on"));   // not connected yet
  assert.deepEqual(tray.menu.itemsNow().map(i => i === "sep" ? "-" : i.label), ["Contacts", "Global chat", "My profile", "-", "Sounds"]);
});

test("launch connects, opens contacts (right side) and the global chat with history", async () => {
  await os.launch("chat");
  assert.equal(sockets.length, 1);
  assert.equal(sockets[0].url, "ws://test/ws");
  const contacts = os.wm.get("win-chat-contacts"), global = os.wm.get("win-chat-global");
  assert.ok(contacts instanceof ContactsWindow && contacts.state.open);
  assert.ok(global instanceof ChatWindow && global.state.open);
  assert.equal(contacts.el.style.left, (1366 - 330) + "px");
  assert.equal(contacts.title, "Beetle");
  assert.equal(global.title, "Global chat");
  assert.equal(global.el.style.width, "705px");   // the global room is 1.5× a buddy chat
  assert.ok(global.el.classList.contains("large"));
  assert.equal(os.wm.activeId, "win-chat-contacts");   // global opened without stealing focus
  await tick();
  assert.equal(global.messageCount, 1);
  assert.equal(global.el.querySelector(".m .txt").textContent, "hello all");
  hello();
  assert.ok(os.taskbar.tray.get("chat").btn.classList.contains("on"));
  assert.equal(contacts.connEl.textContent, "Connected");
  assert.equal(global.el.querySelector(".m .who").style.color, "rgb(52, 157, 178)");   // abi's colour, applied once contacts are known
  assert.equal(global.el.querySelector(".m .who").textContent, "Abigail Goh");
});

test("buddy list: banner, tabs, two groups (bots are just buddies), dots, click opens a DM, Profile shows a profile", async () => {
  await os.launch("chat"); hello();
  const w = os.wm.get("win-chat-contacts");
  assert.equal(w.el.querySelector(".banner .who b").textContent, "Andrew");
  assert.equal(w.el.querySelector(".banner .st").textContent, "(Online)");
  const groups = [...w.el.querySelectorAll(".grp .glbl")].map(g => g.textContent);
  assert.deepEqual(groups, ["Buddies (3/5)", "Offline (2/5)"]);   // alyosha (a bot) sits among the buddies
  const rows = [...w.el.querySelectorAll(".contact")].map(r => r.dataset.user);
  assert.deepEqual(rows, ["abi", "alyosha", "gon", "killua", "leorio"]);
  assert.equal(w.el.querySelector('[data-user="gon"] .st').textContent, "(Away)");
  assert.ok(w.el.querySelector('[data-user="gon"] .dot').classList.contains("away"));
  assert.ok(w.el.querySelector('[data-user="leorio"] .dot').classList.contains("nopass"));
  assert.equal(w.el.querySelector(".fig"), null);   // dots, not figures
  assert.equal(w.el.querySelector('[data-user="alyosha"]').title, "");   // nothing marks a bot
  assert.equal(w.countEl.textContent, "2 of 5 online");
  assert.equal(present("nopass"), false);
  assert.ok(w.pane.el.classList.contains("scrollpane") && w.pane.el.querySelector(".sp-bar"));   // a real scrollbar
  // collapse a group
  d.click(w.el.querySelector('.grp[data-group="offline"]'));
  assert.equal(w.el.querySelector('[data-user="killua"]'), null);
  assert.equal(w.el.querySelector('.grp[data-group="offline"] .tri').textContent, "▶");
  d.click(w.el.querySelector('.grp[data-group="offline"]'));
  assert.ok(w.el.querySelector('[data-user="killua"]'));
  // the List tab is flat and alphabetical
  d.click(w.el.querySelector('[data-tab="list"]'));
  assert.deepEqual([...w.el.querySelectorAll(".contact")].map(r => r.dataset.user), ["abi", "alyosha", "gon", "killua", "leorio"]);
  assert.equal(w.el.querySelector(".grp"), null);
  d.click(w.el.querySelector('[data-tab="online"]'));
  // click = select + open a DM
  d.click(w.el.querySelector('[data-user="abi"] .nm'));
  const dm = os.wm.get("win-chat-dm-abi-andrew");
  assert.ok(dm && dm.state.open);
  assert.equal(dm.title, "Abigail Goh");
  assert.equal(os.wm.activeId, dm.id);
  assert.ok(w.el.querySelector('[data-user="abi"]').classList.contains("sel"));
  // Profile acts on the selection
  d.click(w.el.querySelector('[data-act="profile"]'));
  await tick();
  const pw = os.wm.get("win-chat-profile-abi");
  assert.ok(pw instanceof ProfileWindow && pw.state.open);
  assert.equal(pw.el.querySelector(".pbody span").textContent, "lyrics");
  assert.equal(pw.el.querySelector(".pbody span").style.fontWeight, "bold");
  // right-click: context menu
  w.el.querySelector('[data-user="gon"]').dispatchEvent(new d.win.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  assert.equal(w.menu.isOpen, true);
  assert.deepEqual([...w.menu.el.querySelectorAll("button")].map(b => b.textContent), ["Send Message", "Profile"]);
  d.click(w.menu.el.querySelectorAll("button")[0]);
  assert.ok(os.wm.get("win-chat-dm-andrew-gon").state.open);
  // Global tool
  os.wm.close("win-chat-global");
  d.click(w.el.querySelector('[data-act="global"]'));
  assert.equal(os.wm.get("win-chat-global").state.open, true);
});

test("menus: Beetle File/Edit/Settings as specified, chats File(+View), no icons, check marks", async () => {
  await os.launch("chat"); hello();
  const w = os.wm.get("win-chat-contacts");
  assert.deepEqual([...w.el.querySelectorAll(".mbar .menu > button")].map(b => b.textContent), ["File", "Edit", "Settings"]);
  const [file, edit, settings] = w.menuBar.menus;
  file.open();
  const fitems = [...file.el.children];
  assert.deepEqual(fitems.map(c => c.tagName === "HR" ? "-" : c.textContent), ["About", "Update", "-", "Exit"]);
  assert.equal(fitems[1].disabled, true);
  assert.equal(file.el.querySelector("svg"), null);   // no icons in window menus
  edit.open();
  assert.deepEqual([...edit.el.children].map(c => c.textContent), ["Profile…"]);
  settings.open();
  const items = [...settings.el.children];
  assert.deepEqual(items.map(c => c.textContent), ["Flash on new", "Systray alert", "Sounds"]);
  assert.ok(items[0].classList.contains("chk") && items[0].classList.contains("on") && items[1].classList.contains("on"));
  assert.equal(settings.el.querySelector("svg"), null);
  d.click(items[1]);
  assert.equal(os.settings.get(SETTING_TRAY), false);
  assert.equal(d.win.localStorage.getItem("hxh.set." + SETTING_TRAY), "0");
  d.click(edit.el.querySelector("button"));
  await tick();
  assert.equal(os.wm.get("win-chat-profile-edit").state.open, true);
  // About: the cracktro with music
  file.open();
  d.click(file.el.querySelectorAll("button")[0]);
  const about = os.wm.get("win-chat-about");
  assert.ok(about instanceof AboutWindow && about.state.open);
  assert.match(about.el.querySelector(".art").textContent, /_/);
  assert.match(about.el.querySelector(".credits").textContent, /purple square/);
  assert.equal(os.sounds.tunePlaying, true);
  d.click(about.el.querySelector('[data-act="music"]'));
  assert.equal(os.sounds.tunePlaying, false);
  d.click(about.el.querySelector('[data-act="music"]'));
  assert.equal(os.sounds.tunePlaying, true);
  d.click(about.el.querySelector('[data-act="ok"]'));
  assert.equal(about.state.open, false);
  assert.equal(os.sounds.tunePlaying, false);   // closing stops the tune
  file.open();
  d.click(file.el.querySelectorAll("button")[2]);   // Exit
  assert.equal(w.state.open, false);
  // chats: global has File only; a buddy's chat adds View > Profile and a Profile button
  const g = os.wm.get("win-chat-global");
  assert.deepEqual([...g.el.querySelectorAll(".mbar .menu > button")].map(b => b.textContent), ["File"]);
  g.menuBar.menus[0].open();
  assert.deepEqual([...g.menuBar.menus[0].el.children].map(c => c.textContent), ["Exit"]);
  assert.equal(g.el.querySelector('[data-act="profile"]'), null);
  const dm = app().openChat("abi");
  assert.equal(dm.el.style.width, "470px");
  assert.deepEqual([...dm.el.querySelectorAll(".mbar .menu > button")].map(b => b.textContent), ["File", "View"]);
  dm.menuBar.menus[1].open();
  assert.deepEqual([...dm.menuBar.menus[1].el.children].map(c => c.textContent), ["Profile"]);
  assert.equal(dm.el.querySelector('[data-act="profile"]').textContent, "Profile");
  d.click(dm.el.querySelector('[data-act="profile"]'));
  await tick();
  assert.equal(os.wm.get("win-chat-profile-abi").state.open, true);
  assert.ok(dm.pane.el.querySelector(".sp-bar"));
});

test("sending: Enter sends over the socket in the sender's colour; typing is relayed", async () => {
  await os.launch("chat"); hello();
  const g = os.wm.get("win-chat-global");
  g.input.value = "yo";
  d.key(g.input, "Enter");
  assert.deepEqual(sockets[0].sent.at(-1), { t: "msg", room: "global", body: "yo" });
  assert.equal(g.input.value, "");
  sockets[0].push({ t: "msg", msg: { id: 2, room: "global", sender: "andrew", body: "yo", created_at: "2026-10-31T20:01:00Z" } });
  const mine = g.el.querySelector('.m[data-id="2"]');
  assert.ok(mine.classList.contains("mine"));
  assert.equal(mine.querySelector(".who").style.color, "rgb(217, 20, 227)");
  assert.match(mine.querySelector(".ts").textContent, /^ \(.*\):$/);
  d.key(g.input, "a");
  assert.deepEqual(sockets[0].sent.at(-1), { t: "typing", room: "global" });
  sockets[0].push({ t: "typing", room: "global", user: "abi" });
  assert.equal(g.typingEl.textContent, "Abigail Goh is typing…");
  assert.ok(os.sounds.played.includes("sent"));
});

test("an incoming DM opens its window behind the active one, flashes it, adds the tray bubble until focused", async () => {
  await os.launch("chat"); hello();
  os.wm.focus("win-chat-contacts");
  sockets[0].push({ t: "msg", msg: { id: 5, room: dmRoom("andrew", "abi"), sender: "abi", body: "psst", created_at: "2026-10-31T20:02:00Z" } });
  const dm = os.wm.get("win-chat-dm-abi-andrew");
  assert.ok(dm.state.open);
  assert.equal(os.wm.activeId, "win-chat-contacts");   // no focus steal
  assert.equal(os.taskbar.button(dm.id).flashing, true);
  assert.equal(dm.flashing, true);   // the title bar blinks too
  assert.ok(os.taskbar.tray.has(NEW_TRAY_ID));
  assert.deepEqual(app().unread, ["dm:abi:andrew"]);
  assert.ok(os.sounds.played.includes("message"));
  sockets[0].push({ t: "msg", msg: { id: 6, room: "global", sender: "gon", body: "hey", created_at: "2026-10-31T20:03:00Z" } });
  assert.deepEqual(app().unread, ["dm:abi:andrew", "global"]);
  d.click(os.taskbar.tray.get(NEW_TRAY_ID).btn);   // focuses the oldest unread
  assert.equal(os.wm.activeId, dm.id);
  assert.equal(os.taskbar.button(dm.id).flashing, false);
  assert.equal(dm.flashing, false);
  assert.deepEqual(app().unread, ["global"]);
  assert.ok(os.taskbar.tray.has(NEW_TRAY_ID));
  os.wm.focus("win-chat-global");
  assert.deepEqual(app().unread, []);
  assert.ok(!os.taskbar.tray.has(NEW_TRAY_ID));
  // a message into the window you are looking at is not "unread"
  sockets[0].push({ t: "msg", msg: { id: 7, room: "global", sender: "gon", body: "again", created_at: "2026-10-31T20:04:00Z" } });
  assert.deepEqual(app().unread, []);
  assert.equal(os.taskbar.button("win-chat-global").flashing, false);
  // settings off: no flash, no bubble
  os.settings.set(SETTING_TRAY, false); os.settings.set(SETTING_FLASH, false);
  os.wm.focus("win-chat-contacts");
  sockets[0].push({ t: "msg", msg: { id: 8, room: "global", sender: "gon", body: "quiet", created_at: "2026-10-31T20:05:00Z" } });
  assert.deepEqual(app().unread, ["global"]);
  assert.equal(os.taskbar.button("win-chat-global").flashing, false);
  assert.equal(os.wm.get("win-chat-global").flashing, false);
  assert.ok(!os.taskbar.tray.has(NEW_TRAY_ID));
  os.settings.set(SETTING_TRAY, true);
  app().syncNewIcon();
  assert.ok(os.taskbar.tray.has(NEW_TRAY_ID));
});

test("presence updates regroup contacts and play the door sounds", async () => {
  await os.launch("chat"); hello();
  const w = os.wm.get("win-chat-contacts");
  sockets[0].push({ t: "presence", user: "killua", state: "online", last_seen_at: "2026-10-31T20:05:00Z" });
  const row = w.el.querySelector('[data-user="killua"]');
  assert.ok(row.classList.contains("online"));
  assert.equal(row.previousElementSibling.dataset.user, "gon");   // now under Buddies, after Gon
  assert.equal(w.el.querySelector('.grp[data-group="buddies"] .glbl').textContent, "Buddies (4/5)");
  assert.equal(os.sounds.played.at(-1), "dooropen");
  sockets[0].push({ t: "presence", user: "killua", state: "away", last_seen_at: null });
  assert.equal(w.el.querySelector('[data-user="killua"] .st').textContent, "(Away)");
  assert.equal(os.sounds.played.at(-1), "doorclose");
  sockets[0].push({ t: "presence", user: "killua", state: "offline", last_seen_at: null });
  assert.equal(os.sounds.played.filter(s => s === "doorclose").length, 1);   // away → offline is silent
  assert.equal(w.el.querySelector('.grp[data-group="offline"] .glbl').textContent, "Offline (2/5)");   // killua back among the two
  sockets[0].push({ t: "presence", user: "andrew", state: "away", last_seen_at: null });
  assert.equal(os.sounds.played.filter(s => s === "doorclose").length, 1);   // never for yourself
});

test("profile editor: loads, counts, saves normalized runs; refuses over the limit", async () => {
  await os.launch("chat"); hello();
  const exec = [];
  app().options.editor = { exec: (cmd, v) => exec.push([cmd, v]) };
  const w = await app().editProfile();
  assert.ok(w instanceof ProfileEditor && w.state.open);
  assert.equal(w.countEl.textContent, "0 / 1024");
  w.editor.innerHTML = "<b>me</b>";
  w.update();
  assert.equal(w.countEl.textContent, "2 / 1024");
  d.click(w.el.querySelector('[data-cmd="bold"]'));
  assert.deepEqual(exec.at(-1), ["bold", undefined]);
  d.click(w.el.querySelector('[data-act="save"]'));
  await tick();
  assert.deepEqual(log.at(-1).body, { runs: [{ t: "me", b: true }] });
  assert.equal(w.state.open, false);
  assert.equal(os.toast.body.textContent, "Profile saved.");
  await app().editProfile();
  w.editor.textContent = "x".repeat(1025);
  d.click(w.el.querySelector('[data-act="save"]'));
  assert.ok(w.countEl.classList.contains("over"));
  assert.match(os.toast.body.textContent, /limit is 1024/);
  assert.equal(w.state.open, true);
  d.click(w.el.querySelector('[data-act="cancel"]'));
  assert.equal(w.state.open, false);
});

test("rate-limited sends and server errors toast", async () => {
  await os.launch("chat"); hello();
  const g = os.wm.get("win-chat-global");
  for (let i = 0; i < 10; i++) { g.input.value = "spam"; d.key(g.input, "Enter"); }
  g.input.value = "spam"; d.key(g.input, "Enter");
  assert.equal(os.toast.body.textContent, "Slow down.");
  os.toast.body.textContent = "";
  sockets[0].push({ t: "error", code: "rate", room: "global" });
  assert.equal(os.toast.body.textContent, "Slow down.");
});

test("windows are plain Windows: chrome, taskbar, Escape does not close chats", async () => {
  await os.launch("chat"); hello();
  const g = os.wm.get("win-chat-global");
  assert.ok(g instanceof Window);
  assert.deepEqual([...g.el.querySelectorAll(".tbar .tbtn")].map(b => b.title), ["Minimize", "Close"]);
  assert.ok(os.taskbar.button("win-chat-global"));
  os.wm.focus("win-chat-global");
  d.key(document.body, "Escape");
  assert.equal(g.state.open, true);
});
