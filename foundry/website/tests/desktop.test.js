import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Desktop, DesktopIcon, Backdrop } from "../html/hxh/os/desktop.js";
import { App, AppRegistry } from "../html/hxh/os/apps.js";
import { EventBus } from "../html/hxh/os/bus.js";

const d = setupDom();
class A extends App { static id = "a"; static name = "Aye"; static icon = "card"; }
class Hidden extends App { static id = "h"; static desktop = false; }
class AdminOnly extends App { static id = "adm"; static name = "Adm"; visible(u) { return !!u?.admin; } }

test("icons come from the registry and launch on press", () => {
  const reg = new AppRegistry({ bus: new EventBus() });
  reg.register(A); reg.register(Hidden); reg.register(AdminOnly);
  let user = null;
  const dt = new Desktop({ registry: reg, user: () => user }).mount(document.body);
  assert.equal(dt.el.id, "desktop");
  assert.equal(dt.iconBox.hidden, true);
  assert.equal(dt.refreshIcons(), 1);
  const ic = dt.icons.get("a");
  assert.ok(ic instanceof DesktopIcon);
  assert.equal(ic.el.dataset.act, "a");
  assert.equal(ic.el.querySelector(".cap").textContent, "Aye");
  assert.match(ic.el.querySelector(".ib").innerHTML, /<svg/);
  const launched = [];
  dt.on("launch", id => launched.push(id));
  d.click(ic.el);
  assert.deepEqual(launched, ["a"]);
  user = { admin: true };
  assert.equal(dt.refreshIcons(), 2);
  assert.equal(ic.el.isConnected, false);   // rebuilt
  assert.deepEqual([...dt.iconBox.children].map(b => b.dataset.act), ["a", "adm"]);
  dt.showIcons(true);
  assert.equal(dt.iconBox.hidden, false);
  dt.center(true);
  assert.ok(dt.el.classList.contains("center"));
  dt.unmount();
});

test("adopts an existing #desktop element", () => {
  const el = document.createElement("div"); el.id = "desktop"; el.innerHTML = "<i></i>"; document.body.append(el);
  const dt = new Desktop({ el }).mount(null);
  assert.equal(dt.el, el);
  assert.equal(el.firstChild, dt.iconBox);
  assert.equal(dt.refreshIcons(), 0);
  dt.unmount();
});

test("backdrop shows with a click handler and hides", () => {
  const b = new Backdrop().mount(document.body);
  let n = 0;
  b.show(() => n++);
  assert.ok(b.el.classList.contains("on"));
  d.click(b.el);
  assert.equal(n, 1);
  b.hide();
  d.click(b.el);
  assert.equal(n, 1);
  assert.ok(!b.el.classList.contains("on"));
  b.unmount();
});
