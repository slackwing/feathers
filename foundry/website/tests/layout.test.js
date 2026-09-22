import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch, tick } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { App } from "../html/hxh/os/apps.js";
import { Window } from "../html/hxh/os/window.js";
import { Layout, DESK_PREFIX } from "../html/hxh/os/layout.js";

const ME = { username: "andrew", display_name: "Andrew", initial: "AC", color: "#d914e3", roles: [{ website: "hxh", role: "admin" }] };
const GUEST = { ...ME, username: "abi", roles: [{ website: "hxh", role: "guest" }] };
let d;
beforeEach(() => { d = setupDom(); });

/* Notes: a main window plus pages (sub-windows keyed by a page name) — the shape of the chat (rooms) and the roster (characters). */
class Notes extends App {
  static id = "notes"; static name = "Notes"; static icon = "card"; static order = 10;
  constructor(os, o) { super(os, o); this.launches = []; }
  launch({ restore = false, autostart = false } = {}) { this.launches.push(restore ? "restore" : autostart ? "autostart" : "launch"); return this.show("win-notes"); }
  show(id, key, at) {
    let w = this.os.wm.get(id);
    if (!w) { w = new Window({ id, title: id }); w.page = key; this.os.wm.add(w); }
    return this.os.wm.open(id, at);
  }
  key(w) { return w.page ?? null; }
  async reopen(id, key) {
    if (id === "win-notes") return super.reopen(id, key);
    if (id.startsWith("win-notes-page-") && key) { await this.show(id, key, { x: 999, y: 999 }); return true; }   // its own placement loses to the hint
    return false;
  }
}
class Other extends App { static id = "other"; static name = "Other"; static icon = "book"; static order = 20; launch() { return this.show(); } show() { if (!this.os.wm.has("win-other")) this.os.wm.add(new Window({ id: "win-other", title: "Other" })); return this.os.wm.open("win-other"); } }
class Admin extends App { static id = "adm"; static name = "Adm"; static icon = "db"; static order = 30; visible(u) { return (u?.roles || []).some(r => r.role === "admin"); } launch() { if (!this.os.wm.has("win-adm")) this.os.wm.add(new Window({ id: "win-adm", title: "Adm" })); return this.os.wm.open("win-adm"); } }

function make({ me = ME } = {}) {
  const fetch = fakeFetch({ "GET /admin/api/me": me ? [200, me] : [401, {}] }, []);
  const os = new OS({ win: d.win, fetch, env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  os.layout.delay = 5;   // a quick debounce for the tests
  return os;
}
const saved = (user = "andrew") => JSON.parse(d.win.localStorage.getItem(DESK_PREFIX + user));
const preset = (windows, active = null, user = "andrew") => d.win.localStorage.setItem(DESK_PREFIX + user, JSON.stringify({ v: 1, active, windows }));
const z = w => +w.el.style.zIndex;

test("a first visit autostarts, and from then on every change to the desktop is recorded: which windows, where, in what order, minimized, active", async () => {
  const os = make();
  await os.start({ apps: [Notes, Other, Admin], autostart: ["notes"], boot: false });
  const notes = os.registry.get("notes");
  assert.deepEqual(notes.launches, ["autostart"]);
  assert.equal(saved(), null, "nothing written until something changes after the restore pass");
  await tick(20);
  let s = saved();
  assert.ok(s, "the autostart window is on record");
  assert.deepEqual(s.windows.map(w => w.id), ["win-notes"]);
  assert.equal(s.active, "win-notes");
  await notes.show("win-notes-page-todo", "todo", { x: 300, y: 200 });
  await os.launch("other");
  os.wm.minimize("win-notes");
  await tick(20);
  s = saved();
  assert.deepEqual(s.windows, [
    { id: "win-notes", app: "notes", x: 185, y: 65, min: true },          // the cascade put it there; it sits in the taskbar
    { id: "win-notes-page-todo", app: "notes", key: "todo", x: 300, y: 200 },
    { id: "win-other", app: "other", x: 255, y: 135 },
  ], "bottom to top, with the page's key and the minimized flag");
  assert.equal(s.active, "win-other");
  // focus changes the order; a drag's end (window:move) is recorded; closing removes
  os.wm.focus("win-notes-page-todo");
  os.wm.get("win-notes-page-todo").el.style.left = "40px";
  os.bus.emit("window:move", { id: "win-notes-page-todo" });
  os.wm.close("win-other");
  await tick(20);
  s = saved();
  assert.deepEqual(s.windows.map(w => [w.id, w.x]), [["win-notes", 185], ["win-notes-page-todo", 40]]);
  assert.equal(s.active, "win-notes-page-todo");
  assert.equal(s.v, 1);
});

test("a saved desktop comes back — windows in order with their places, the minimized one in the taskbar, the active one on top — and autostart is skipped; what cannot come back is dropped", async () => {
  preset([
    { id: "win-notes-page-p2", app: "notes", key: "p2", x: 500, y: 40 },
    { id: "win-notes", app: "notes", x: 20, y: 30, min: true },
    { id: "win-other", app: "other", x: 2000, y: -50 },          // from a wider screen: clamped
    { id: "win-notes-dialog", app: "notes", x: 1, y: 1 },        // the app declines it
    { id: "win-ghost", app: "ghost", x: 0, y: 0 },               // an app that no longer exists
    { id: "win-other-2", app: "notes", x: 0, y: 0 },             // not that app's window
  ], "win-other");
  const os = make();
  await os.start({ apps: [Notes, Other, Admin], autostart: ["notes"], boot: false });
  const notes = os.registry.get("notes"), wm = os.wm;
  assert.deepEqual(notes.launches, ["restore"], "the main window came back through launch({ restore }), not the autostart");
  const page = wm.get("win-notes-page-p2"), main = wm.get("win-notes"), other = wm.get("win-other");
  assert.ok(page.state.open && !page.state.minimized);
  assert.equal(page.page, "p2", "rebuilt from its key");
  assert.equal(page.el.style.left + " " + page.el.style.top, "500px 40px", "the saved place wins over the app's own placement");
  assert.ok(main.state.open && main.state.minimized && main.el.hidden, "minimized, in the taskbar");
  assert.equal(main.el.style.left + " " + main.el.style.top, "20px 30px");
  assert.equal(other.el.style.left + " " + other.el.style.top, "1286px 0px", "clamped to the desktop (1366 − 80) and the top");
  assert.ok(z(other) > z(page), "stacking order kept");
  assert.equal(wm.activeId, "win-other");
  assert.ok(!wm.has("win-notes-dialog") && !wm.has("win-ghost") && !wm.has("win-other-2"));
  const s = saved();
  assert.deepEqual(s.windows.map(w => w.id), ["win-notes", "win-notes-page-p2", "win-other"], "the record is rewritten without the dropped ones (a minimized window sinks to the bottom: the taskbar holds it, its stacking is moot)");
  assert.equal(s.active, "win-other");
});

test("the saved active window ends on top even when it was reopened first; an empty saved desktop restores nothing and still skips autostart", async () => {
  preset([{ id: "win-other", app: "other", x: 10, y: 10 }, { id: "win-notes", app: "notes", x: 50, y: 50 }], "win-other");
  let os = make();
  await os.start({ apps: [Notes, Other], autostart: ["notes"], boot: false });
  assert.equal(os.wm.activeId, "win-other");
  assert.ok(z(os.wm.get("win-other")) > z(os.wm.get("win-notes")));
  d = setupDom();
  preset([], null);
  os = make();
  await os.start({ apps: [Notes, Other], autostart: ["notes"], boot: false });
  assert.deepEqual(os.registry.get("notes").launches, []);
  assert.equal(os.wm.all().filter(w => w.state.open).length, 0, "they closed everything; that is what they get back");
});

test("the record is per user and per browser; garbage or another version is ignored; a hidden app's windows are skipped", async () => {
  preset([{ id: "win-other", app: "other", x: 10, y: 10 }], "win-other", "abi");
  let os = make();
  await os.start({ apps: [Notes, Other], autostart: ["notes"], boot: false });
  assert.deepEqual(os.registry.get("notes").launches, ["autostart"], "abi's desktop is not andrew's");
  assert.ok(!os.wm.has("win-other"));
  d = setupDom();
  d.win.localStorage.setItem(DESK_PREFIX + "andrew", "{oops");
  os = make();
  await os.start({ apps: [Notes, Other], autostart: ["notes"], boot: false });
  assert.deepEqual(os.registry.get("notes").launches, ["autostart"]);
  d = setupDom();
  preset([{ id: "win-notes", app: "notes", x: 1, y: 1 }], null);
  d.win.localStorage.setItem(DESK_PREFIX + "andrew", JSON.stringify({ v: 99, windows: [{ id: "win-notes", app: "notes", x: 1, y: 1 }] }));
  os = make();
  await os.start({ apps: [Notes, Other], autostart: ["notes"], boot: false });
  assert.deepEqual(os.registry.get("notes").launches, ["autostart"], "another version of the record is not trusted");
  d = setupDom();
  preset([{ id: "win-adm", app: "adm", x: 1, y: 1 }, { id: "win-notes", app: "notes", x: 1, y: 1 }], "win-adm", "abi");
  os = make({ me: GUEST });
  await os.start({ apps: [Notes, Other, Admin], autostart: ["notes"], boot: false });
  assert.ok(!os.wm.has("win-adm"), "an app this user cannot see stays closed");
  assert.equal(os.wm.activeId, "win-notes");
  assert.deepEqual(saved("abi").windows.map(w => w.id), ["win-notes"]);
});

test("nobody logged in: nothing is restored or recorded; a snapshot leaves out dialogs and windows no app owns", async () => {
  const os = make({ me: null });
  await os.start({ apps: [Notes, Other], autostart: [], gate: false, boot: false });
  assert.equal(await os.layout.restore(), false);
  os.wm.add(new Window({ id: "dlg-x", title: "x", chrome: "static" }));
  await os.wm.open("dlg-x");
  os.wm.add(new Window({ id: "win-stray", title: "stray" }));
  await os.wm.open("win-stray");
  await tick(20);
  assert.ok(!Object.keys(d.win.localStorage).some(k => k.startsWith(DESK_PREFIX)), "no desk record without a user (the settings may write theirs)");
  os.user = ME;
  assert.deepEqual(os.layout.snapshot().windows, [], "a dialog and a window no app owns are nobody's business");
  // pagehide flushes (once armed)
  os.layout.armed = true;
  await os.launch("other");
  d.win.dispatchEvent(new d.win.Event("pagehide"));
  assert.deepEqual(saved().windows.map(w => w.id), ["win-other"]);
});

test("Layout on its own: the default App hooks — owns by id convention, no key, reopen only the main window", async () => {
  const os = make();
  await os.start({ apps: [Notes, Other], autostart: [], boot: false });
  const other = os.registry.get("other");
  assert.ok(other.owns("win-other") && other.owns("win-other-thing") && !other.owns("win-others") && !other.owns("win-notes"));
  assert.equal(other.key(os.wm.get("win-other") || new Window({ id: "win-other" })), null);
  assert.equal(await other.reopen("win-other-thing"), false);
  assert.equal(await other.reopen("win-other"), true);
  assert.ok(os.wm.get("win-other").state.open);
  assert.ok(os.layout instanceof Layout);
});
