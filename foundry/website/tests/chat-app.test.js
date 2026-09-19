import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch, tick } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { ChatApp, dmRoom, NEW_TRAY_ID } from "../html/hxh/apps/chat/app.js";
import { ContactsWindow, groupOf } from "../html/hxh/apps/chat/contacts.js";
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
  assert.equal(global.title, "Global chat");
  assert.equal(os.wm.activeId, "win-chat-contacts");   // global opened without stealing focus
  await tick();
  assert.equal(global.messageCount, 1);
  assert.equal(global.el.querySelector(".m .txt").textContent, "hello all");
  hello();
  assert.ok(os.taskbar.tray.get("chat").btn.classList.contains("on"));
  assert.equal(global.el.querySelector(".m .who").style.color, "rgb(52, 157, 178)");   // abi's colour, applied once contacts are known
  assert.equal(global.el.querySelector(".m .who").textContent, "Abigail Goh:");
});

test("contacts are grouped by presence; me on top; click opens a DM, card opens a profile", async () => {
  await os.launch("chat"); hello();
  const w = os.wm.get("win-chat-contacts");
  assert.equal(w.el.querySelector(".me .nm").textContent, "Andrew");
  const groups = [...w.el.querySelectorAll(".grp")].map(g => g.textContent);
  assert.deepEqual(groups, ["Online1", "Away1", "Offline2"]);
  const rows = [...w.el.querySelectorAll(".contact")].map(r => r.dataset.user);
  assert.deepEqual(rows, ["abi", "gon", "killua", "leorio"]);
  assert.ok(w.el.querySelector('[data-user="leorio"] .dot').classList.contains("nopass"));
  assert.equal(groupOf("nopass"), "offline");
  d.click(w.el.querySelector('[data-user="abi"] .nm'));
  const dm = os.wm.get("win-chat-dm-abi-andrew");
  assert.ok(dm && dm.state.open);
  assert.equal(dm.title, "Abigail Goh");
  assert.equal(os.wm.activeId, dm.id);
  d.click(w.el.querySelector('[data-user="abi"] [data-profile]'));
  await tick();
  const pw = os.wm.get("win-chat-profile-abi");
  assert.ok(pw instanceof ProfileWindow && pw.state.open);
  assert.equal(pw.el.querySelector(".pbody span").textContent, "lyrics");
  assert.equal(pw.el.querySelector(".pbody span").style.fontWeight, "bold");
});

test("sending: Enter sends over the socket in the sender's colour, typing is relayed, unsend takes back the last", async () => {
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
  assert.equal(g.unsendBtn.hidden, false);
  d.key(g.input, "a");
  assert.deepEqual(sockets[0].sent.at(-1), { t: "typing", room: "global" });
  sockets[0].push({ t: "typing", room: "global", user: "abi" });
  assert.equal(g.typingEl.textContent, "Abigail Goh is typing…");
  d.click(g.unsendBtn);
  assert.deepEqual(sockets[0].sent.at(-1), { t: "unsend", room: "global" });
  sockets[0].push({ t: "unsend", room: "global", id: 2 });
  assert.equal(g.el.querySelector('.m[data-id="2"]'), null);
  assert.equal(g.unsendBtn.hidden, true);
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
  assert.ok(os.taskbar.tray.has(NEW_TRAY_ID));
  assert.deepEqual(app().unread, ["dm:abi:andrew"]);
  assert.ok(os.sounds.played.includes("message"));
  sockets[0].push({ t: "msg", msg: { id: 6, room: "global", sender: "gon", body: "hey", created_at: "2026-10-31T20:03:00Z" } });
  assert.deepEqual(app().unread, ["dm:abi:andrew", "global"]);
  d.click(os.taskbar.tray.get(NEW_TRAY_ID).btn);   // focuses the oldest unread
  assert.equal(os.wm.activeId, dm.id);
  assert.equal(os.taskbar.button(dm.id).flashing, false);
  assert.deepEqual(app().unread, ["global"]);
  assert.ok(os.taskbar.tray.has(NEW_TRAY_ID));
  os.wm.focus("win-chat-global");
  assert.deepEqual(app().unread, []);
  assert.ok(!os.taskbar.tray.has(NEW_TRAY_ID));
  // a message into the window you are looking at is not "unread"
  sockets[0].push({ t: "msg", msg: { id: 7, room: "global", sender: "gon", body: "again", created_at: "2026-10-31T20:04:00Z" } });
  assert.deepEqual(app().unread, []);
  assert.equal(os.taskbar.button("win-chat-global").flashing, false);
});

test("presence updates regroup contacts and play the door sounds", async () => {
  await os.launch("chat"); hello();
  const w = os.wm.get("win-chat-contacts");
  sockets[0].push({ t: "presence", user: "killua", state: "online", last_seen_at: "2026-10-31T20:05:00Z" });
  assert.ok(w.el.querySelector('[data-user="killua"] .dot').classList.contains("online"));
  assert.equal([...w.el.querySelectorAll(".grp")][0].textContent, "Online2");
  assert.equal(os.sounds.played.at(-1), "dooropen");
  sockets[0].push({ t: "presence", user: "killua", state: "away", last_seen_at: null });
  assert.equal(os.sounds.played.at(-1), "doorclose");
  sockets[0].push({ t: "presence", user: "killua", state: "offline", last_seen_at: null });
  assert.equal(os.sounds.played.filter(s => s === "doorclose").length, 1);   // away → offline is silent
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
  assert.deepEqual([...g.el.querySelectorAll(".tbar .tbtn")].map(b => b.title), ["Minimize", "Maximize", "Close"]);
  assert.ok(os.taskbar.button("win-chat-global"));
  os.wm.focus("win-chat-global");
  d.key(document.body, "Escape");
  assert.equal(g.state.open, true);
});
