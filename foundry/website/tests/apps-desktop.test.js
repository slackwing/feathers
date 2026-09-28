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
  assert.equal(apps.About?.id, "about");   // removed 2026-09-19; back 2026-09-27 as the prompts' About (apps/about)
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
  assert.match(text, /Commences: Oct 31, 2026\nTime: TBD\n/);
  assert.equal(w.$("#vn-text b").textContent, NOTICE[1].t);
  assert.ok(w.$("#vn").classList.contains("done"));   // reduced motion: typed instantly
  assert.deepEqual([...w.el.querySelectorAll(".mbar .menu > button")].map(b => b.textContent), ["File"]);   // File › Exit and nothing else (Andrew, 2026-09-27)
});

test("the summons menu is File › Exit alone — no View, no Settings (Andrew, 2026-09-27: the notice is a poster, not a workbench)", async () => {
  await os.start({ apps: [SummonsApp, BinderApp], autostart: ["summons"], boot: false });
  const w = os.wm.get("win-summons");
  assert.equal(w.menuBar.menus.length, 1);
  const [file] = w.menuBar.menus;
  assert.equal(file.props.label ?? "File", "File");
  file.open();
  assert.deepEqual([...file.el.children].map(c => c.tagName === "HR" ? "-" : c.textContent), ["Exit"]);   // no Log out, so no rule above it
  assert.equal(file.el.querySelector("svg"), null);   // window menus carry no icons
  d.click(file.el.querySelector("button"));
  assert.equal(w.state.open, false, "Exit closes the window");
});

test("a restored Summons types its notice: the saved desktop reopens the window, which must not come back blank (Andrew, 2026-09-27)", async () => {
  await os.start({ apps: [SummonsApp, BinderApp], boot: false });   // no autostart: this is the reopen path
  const app = os.registry.get("summons");
  assert.equal(await app.reopen("win-summons", null), true);
  const w = os.wm.get("win-summons");
  assert.equal(w.state.open, true);
  assert.equal(w.$("#vn-text").textContent, NOTICE.map(r => typeof r === "string" ? r : r.t).join(""), "the notice is filled, not empty");
  assert.ok(w.$("#vn").classList.contains("done"));
  assert.equal(await app.reopen("win-other", null), false, "only its own window");
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


