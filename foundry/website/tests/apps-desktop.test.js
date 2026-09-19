import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, tick } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { SummonsApp, NOTICE } from "../html/hxh/apps/summons.js";
import { RegisterApp, BARS, BARS_ON } from "../html/hxh/apps/register.js";
import { AboutApp } from "../html/hxh/apps/about.js";
import { BinderApp } from "../html/hxh/apps/binder.js";
import * as apps from "../html/hxh/apps/index.js";

const ME = { username: "andrew", display_name: "Andrew", roles: [{ website: "hxh", role: "admin" }] };
let d, os;
function make({ width = 1366 } = {}) {
  d = setupDom({ width });
  os = new OS({ win: d.win, fetch: async () => ({ ok: true, json: async () => ME }), env: { reduced: true, floating: () => true, zoom: () => 1, width, height: 900, wait: () => Promise.resolve() } });
  return os;
}
beforeEach(() => make());

test("the index page's app set is exported under short names", () => {
  assert.equal(apps.Summons, SummonsApp);
  assert.equal(apps.Register, RegisterApp);
  assert.equal(apps.About, AboutApp);
  assert.equal(apps.Binder, BinderApp);
  assert.ok(apps.SetPassword);
});

test("summons autostart: bare desktop, then the window at 145,24 with the notice typed", async () => {
  await os.start({ apps: [SummonsApp, BinderApp, RegisterApp, AboutApp], autostart: ["summons"], start: true, boot: false });
  const w = os.wm.get("win-summons");
  assert.equal(w.title, "Hunter × Halloween");
  assert.equal(w.el.style.width, "750px");
  assert.equal(w.el.style.left, "145px");
  assert.equal(w.el.style.top, "24px");
  assert.equal(w.state.open, true);
  assert.ok(w.el.classList.contains("summons"));
  const text = w.$("#vn-text").textContent;
  assert.match(text, /289th Hunter Exam — Halloween Phase/);
  assert.match(text, /618 Bushwick Ave/);
  assert.match(text, /Oct 31, 2026/);
  assert.equal(w.$("#vn-text b").textContent, NOTICE[1].t);
  assert.ok(w.$("#vn").classList.contains("done"));   // reduced motion: typed instantly
  assert.deepEqual([...w.el.querySelectorAll(".mbar .menu > button")].map(b => b.textContent), ["File", "View", "Help"]);
});

test("summons menus are derived from the registry", async () => {
  await os.start({ apps: [SummonsApp, BinderApp, RegisterApp, AboutApp], autostart: ["summons"], boot: false });
  const w = os.wm.get("win-summons");
  const [file, view, help] = w.menuBar.menus;
  view.open();
  assert.deepEqual([...view.el.children].map(c => c.tagName === "HR" ? "-" : c.textContent), ["Binder", "Registration", "-", "Scanlines", "Sounds"]);
  help.open();
  assert.deepEqual([...help.el.children].map(c => c.textContent), ["About Hunter Website"]);
  d.click(help.el.querySelector("button"));
  assert.equal(os.wm.get("win-about").state.open, true);
  file.open();
  assert.equal(file.el.textContent, "Log out");
  view.open();
  d.click(view.el.querySelector("button"));   // Binder
  assert.equal(os.wm.get("win-binder").state.open, true);
});

test("the summons CTA launches the Binder; clicking the notice skips typing; relaunch just reopens", async () => {
  await os.start({ apps: [SummonsApp, BinderApp], autostart: ["summons"], boot: false });
  const w = os.wm.get("win-summons");
  d.click(w.$('[data-act="binder"]'));
  assert.equal(os.wm.get("win-binder").state.open, true);
  os.wm.close("win-summons");
  await os.launch("summons");
  assert.equal(w.state.open, true);
  assert.equal(w.el.style.left, "145px");
  d.click(w.$("#vn"));
});

test("registration: OPENS SOON, 7 of 20 bars, beside the summons on wide screens, below on narrow", async () => {
  make({ width: 1500 });   // 145 + 750 + 30 + 450 + 30 = 1405 needed for side by side
  await os.start({ apps: [SummonsApp, RegisterApp], autostart: ["summons"], boot: false });
  await os.launch("register");
  const w = os.wm.get("win-register");
  assert.equal(w.title, "Registration");
  assert.equal(w.$(".stamp").textContent, "OPENS SOON");
  assert.equal(w.el.querySelectorAll(".prog i").length, BARS);
  assert.equal(w.el.querySelectorAll(".prog i.on").length, BARS_ON);
  assert.equal(w.el.style.left, "925px");
  assert.equal(w.el.style.top, "24px");
  os.wm.close("win-register");
  w.el.style.left = "3px";
  await os.launch("register");
  assert.equal(w.el.style.left, "3px");   // never moved once placed
  make({ width: 1366 });
  await os.start({ apps: [SummonsApp, RegisterApp], autostart: ["summons"], boot: false });
  await os.launch("register");
  const n = os.wm.get("win-register");
  assert.equal(n.el.style.left, "200px");
  assert.equal(n.el.style.top, "12px");   // summons offset* are 0 in jsdom
});

test("about: a popup that OK closes and Escape closes", async () => {
  await os.start({ apps: [AboutApp], boot: false });
  await os.launch("about");
  const w = os.wm.get("win-about");
  assert.ok(w.props.popup);
  assert.equal(w.el.style.width, "475px");
  assert.match(w.body.textContent, /v2\.0/);
  d.click(w.$('[data-act="ok"]'));
  assert.equal(w.state.open, false);
  await os.launch("about");
  d.key(document.body, "Escape");
  assert.equal(w.state.open, false);
  await tick();
});
