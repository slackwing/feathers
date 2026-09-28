import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom, tick } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { SetPasswordApp } from "../html/hxh/apps/setpw.js";
import { Nav } from "../html/hxh/os/session.js";
import { AccountDialog, LogonDialog } from "../html/hxh/os/logon.js";

const WORDS = { heading: "Choose a password", submit: "Accept summons", done: "Welcome, {name}. Your license is in order.", invalid: "Void.", nocode: "Open this page from the link in your summons email." };

function make(machinery) {
  const d = setupDom();
  const loc = { href: "" };
  const nav = new Nav({ storage: d.win.sessionStorage, location: loc });
  const os = new OS({ win: d.win, nav, fetch: async () => ({ ok: false, status: 401, json: async () => ({}) }), env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  return { d, os, loc, start: (extra = { boot: false }) => os.start({ apps: [[SetPasswordApp, { ...WORDS, machinery }]], autostart: ["setpw"], taskbar: false, wallpaper: false, gate: false, ...extra }) };
}

test("the logon's own frame (AccountDialog) on a centred bare desktop, wired to the machinery's hooks (Andrew, 2026-09-28: \"why is the invite page not using the default theming? it should have been DRY\")", async () => {
  const mounted = [];
  const machinery = { mount: async root => { mounted.push(root); return { state: "ok" }; } };
  const { d, os, start } = make(machinery);
  await start();
  const w = os.wm.get("win-pw");
  assert.equal(mounted[0], w.el);
  assert.ok(w.static && !w.hasTask && w.state.open);
  const logon = new LogonDialog({ session: {} });
  assert.equal(w.props.width, logon.props.width, "the logon's width");
  assert.equal(w.title, "Hunter × Halloween — Choose a password");
  assert.equal(w.icon, logon.icon, "the logon's icon");
  assert.ok(w instanceof AccountDialog && w.el.classList.contains("logon"), "the logon's frame and styling");
  assert.match(w.$(".logo").textContent, /HUNTER×HALLOWEEN/, "the logotype");
  assert.ok(os.desktop.el.classList.contains("center"));
  assert.ok(document.querySelector(".os-badge"));
  assert.equal(w.$(".dialog-h").textContent, "Choose a password");
  assert.equal(w.$('[data-pw="submit"]').textContent, "Accept summons");
  assert.equal(w.$('[data-pw="nocode"]').textContent, WORDS.nocode);
  assert.equal(w.$('[data-pw="done"] .ok').innerHTML, 'Welcome, <b data-pw="name"></b>. Your license is in order.');
  assert.equal(document.activeElement, w.$('[data-pw="password"]'));
  assert.equal(os.registry.get("setpw").state.state, "ok");
  assert.equal(os.desktop.iconBox.hidden, true);
  assert.equal(os.registry.visible(null).length, 0);   // never an icon or menu entry
  void d;
});

test("'Enter the exam site' warms the next page instead of rebooting; no machinery → nocode", async () => {
  const { d, os, loc, start } = make(null);
  await start();
  assert.equal(os.registry.get("setpw").state.state, "nocode");
  const w = os.wm.get("win-pw");
  d.click(w.$('[data-pw="enter"]'));
  assert.equal(loc.href, "/hxh/");
  assert.equal(d.win.sessionStorage.getItem("hxh.warm"), "1");
  await tick();
});

test("the account pages follow the site's pattern: boot, the Summons splash, and only on clicking to start the dialog (Andrew, 2026-09-28)", async () => {
  const machinery = { mount: async () => ({ state: "ok" }) };
  const { os, start } = make(machinery);
  let ready = false;
  const p = start({ splash: true }).then(() => { ready = true; });
  await new Promise(r => setTimeout(r, 40));
  const sp = document.querySelector(".splashscreen");
  assert.ok(sp && !sp.hidden && sp.dataset.style === "summons", "the splash first");
  assert.equal(os.wm.get("win-pw")?.state.open ?? false, false, "the dialog waits");
  sp.click();
  await p;
  assert.ok(ready && os.wm.get("win-pw").state.open, "then choose a password");
});
