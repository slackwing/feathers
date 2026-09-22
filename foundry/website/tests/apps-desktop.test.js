import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, tick } from "./dom.js";
import { OS } from "../html/hxh/os/os.js";
import { SummonsApp, NOTICE } from "../html/hxh/apps/summons.js";
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
  assert.equal(apps.Register, undefined);   // removed 2026-09-22: claiming a card replaced registration
  assert.equal(apps.About, undefined);   // removed 2026-09-19
  assert.equal(apps.Binder, BinderApp);
  assert.ok(apps.SetPassword);
});

test("summons autostart: bare desktop, then the window at 145,24 with the notice typed", async () => {
  await os.start({ apps: [SummonsApp, BinderApp], autostart: ["summons"], start: true, boot: false });
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
  assert.deepEqual([...w.el.querySelectorAll(".mbar .menu > button")].map(b => b.textContent), ["File", "View", "Settings"]);   // no Help: About is gone
});

test("summons menus are derived from the registry", async () => {
  await os.start({ apps: [SummonsApp, BinderApp], autostart: ["summons"], boot: false });
  const w = os.wm.get("win-summons");
  const [file, view, settings] = w.menuBar.menus;
  view.open();
  assert.deepEqual([...view.el.children].map(c => c.textContent), ["Binder"]);
  settings.open();
  assert.deepEqual([...settings.el.children].map(c => c.querySelector("button").firstChild.textContent), ["Display", "Sounds"]);   // the OS Settings tree, cascading
  assert.equal(settings.el.querySelector("svg"), null);   // window menus carry no icons
  d.click(settings.el.querySelector(".menu.sub > button"));   // Display ▸
  const display = settings.subs[0];
  assert.ok(display.isOpen && settings.isOpen, "the submenu opens and keeps its parent open");
  assert.deepEqual([...display.el.querySelectorAll(":scope > button, :scope > .menu > button")].map(b => b.firstChild.textContent), ["Theme", "Sky", "Scanlines"]);
  d.click([...display.el.querySelectorAll("button")].find(b => b.textContent === "Scanlines"));
  assert.equal(os.crt.on, true);
  assert.ok(!settings.isOpen && !display.isOpen, "picking a leaf closes the chain");
  os.crt.set(false);
  file.open();
  assert.deepEqual([...file.el.children].map(c => c.tagName === "HR" ? "-" : c.textContent), ["Log out", "-", "Exit"]);
  d.click(file.el.querySelectorAll("button")[1]);   // Exit closes the window
  assert.equal(w.state.open, false);
  await os.launch("summons");
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


