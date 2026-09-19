import { test } from "node:test";
import assert from "node:assert/strict";
import { EventBus } from "../html/hxh/os/bus.js";
import { App, AppRegistry } from "../html/hxh/os/apps.js";

class A extends App { static id = "a"; static name = "Aye"; static icon = "card"; static order = 20; launch(o) { return "launched:" + JSON.stringify(o); } }
class B extends App { static id = "b"; static name = "Bee"; static order = 10; visible(u) { return !!u?.admin; } tray() { return { title: "Bee tray" }; } }
class C extends App { static id = "c"; static name = "Cee"; static desktop = false; static menuable = false; static order = 10; }
class NoId extends App {}

function os() { return { bus: new EventBus() }; }

test("register by class (with options) or instance; ids must be unique and present", () => {
  const o = os(), reg = new AppRegistry(o);
  const seen = [];
  o.bus.on("app:register", p => seen.push(p.id));
  const a = reg.register(A, { k: 1 });
  assert.equal(a.os, o);
  assert.deepEqual(a.options, { k: 1 });
  assert.equal(a.id, "a"); assert.equal(a.name, "Aye"); assert.equal(a.icon, "card"); assert.equal(a.order, 20);
  const b = reg.register(new B(o));
  assert.equal(reg.get("b"), b);
  assert.throws(() => reg.register(A), /already registered/);
  assert.throws(() => reg.register(NoId), /no static id/);
  assert.deepEqual(seen, ["a", "b"]);
  assert.equal(reg.has("a"), true);
});

test("all() sorts by order then registration; visible() filters by user, desktop and menuable", () => {
  const reg = new AppRegistry(os());
  reg.register(A); reg.register(B); reg.register(C);
  assert.deepEqual(reg.all().map(a => a.id), ["b", "c", "a"]);
  assert.deepEqual(reg.visible(null).map(a => a.id), ["a"]);
  assert.deepEqual(reg.visible({ admin: true }).map(a => a.id), ["b", "a"]);
  assert.deepEqual(reg.visible({ admin: true }, { desktop: false }).map(a => a.id), ["b", "c", "a"]);
  assert.deepEqual(reg.visible({ admin: true }, { desktop: false, menuable: true }).map(a => a.id), ["b", "a"]);
});

test("launch routes to the app and announces on the bus; unknown ids throw", () => {
  const o = os(), reg = new AppRegistry(o);
  reg.register(A);
  const seen = [];
  o.bus.on("app:launch", p => seen.push(p));
  assert.equal(reg.launch("a", { x: 1 }), 'launched:{"x":1}');
  assert.deepEqual(seen, [{ id: "a", opts: { x: 1 } }]);
  assert.throws(() => reg.launch("zzz"), /no app/);
});

test("App defaults: visible, no tray, launch is a no-op, class name as fallback name", () => {
  class Plain extends App { static id = "plain"; }
  const p = new Plain(os());
  assert.equal(p.visible(null), true);
  assert.equal(p.tray(), null);
  assert.equal(p.launch(), undefined);
  assert.equal(p.name, "Plain");
});
