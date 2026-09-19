import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { EventBus } from "../html/hxh/os/bus.js";
import { Env } from "../html/hxh/os/env.js";
import { Window } from "../html/hxh/os/window.js";
import { WindowManager } from "../html/hxh/os/wm.js";

let d, bus, env, desktop, wm, events;
function fresh(opts = {}) {
  d = setupDom(opts);
  bus = new EventBus(); env = new Env(d.win);
  desktop = d.doc.createElement("div"); desktop.className = "desktop"; d.doc.body.append(desktop);
  wm = new WindowManager({ bus, env, desktop });
  events = [];
  for (const ev of ["window:add", "window:remove", "window:open", "window:close", "window:minimize", "window:maximize", "window:focus", "window:title", "window:attention"]) {
    bus.on(ev, p => events.push(ev + ":" + p.id));
  }
}
beforeEach(() => fresh());

test("add mounts into the desktop, wires the window, refuses duplicates", () => {
  const w = wm.add(new Window({ id: "a", title: "A" }));
  assert.equal(w.el.parentElement, desktop);
  assert.equal(w.wm, wm);
  assert.equal(wm.get("a"), w);
  assert.equal(wm.has("a"), true);
  assert.throws(() => wm.add(new Window({ id: "a" })), /already registered/);
  assert.deepEqual(events, ["window:add:a"]);
});

test("open shows, places (cascade), focuses and emits; close hides and calls onClose", async () => {
  let closed = 0;
  const a = wm.add(new Window({ id: "a", onClose: () => closed++ }));
  await wm.open("a");
  assert.equal(a.el.hidden, false);
  assert.equal(a.state.open, true);
  assert.equal(a.state.placed, true);
  assert.equal(a.el.style.left, "185px");   // 150 + (1 % 6) * 35
  assert.equal(wm.activeId, "a");
  assert.ok(events.includes("window:open:a") && events.includes("window:focus:a"));
  wm.close("a");
  assert.equal(a.el.hidden, true);
  assert.equal(a.state.open, false);
  assert.equal(closed, 1);
  assert.equal(wm.activeId, null);
  wm.close("a");   // idempotent
  assert.equal(closed, 1);
});

test("open at a position; a second open without `at` keeps the place", async () => {
  const a = wm.add(new Window({ id: "a" }));
  await wm.open("a", { x: 145.4, y: -3, w: 750 });
  assert.equal(a.el.style.left, "145px");
  assert.equal(a.el.style.top, "0px");
  assert.equal(a.el.style.width, "750px");
  wm.close("a");
  await wm.open("a");
  assert.equal(a.el.style.left, "145px");
  wm.place("a", { x: 10, y: 10 });
  assert.equal(a.el.style.left, "10px");
});

test("windows do not float on phones: no placement, scrolled into view", async () => {
  fresh({ floating: false });
  const a = wm.add(new Window({ id: "a" }));
  await wm.open("a", { x: 5, y: 5 });
  assert.equal(a.el.style.left, "");
  assert.equal(a.el.dataset.scrolled, "1");
  assert.equal(desktop.style.minHeight, "");
});

test("focus raises z-order and marks the others inactive", async () => {
  const a = wm.add(new Window({ id: "a" })), b = wm.add(new Window({ id: "b" }));
  await wm.open("a"); await wm.open("b");
  assert.ok(+b.el.style.zIndex > +a.el.style.zIndex);
  assert.ok(a.el.classList.contains("inactive"));
  assert.ok(!b.el.classList.contains("inactive"));
  wm.focus("a");
  assert.ok(+a.el.style.zIndex > +b.el.style.zIndex);
  assert.equal(wm.active, a);
  wm.focus("nope");   // ignored
  assert.equal(wm.active, a);
});

test("chrome buttons drive the manager: minimize, maximize, close", async () => {
  const a = wm.add(new Window({ id: "a" }));
  await wm.open("a");
  a.emit("chrome", "min");
  assert.equal(a.el.hidden, true);
  assert.equal(a.state.minimized, true);
  assert.ok(events.includes("window:minimize:a"));
  await wm.open("a");
  assert.equal(a.state.minimized, false);
  a.emit("chrome", "max");
  assert.equal(a.state.maximized, true);
  assert.ok(a.el.classList.contains("max"));
  a.emit("chrome", "max");
  assert.equal(a.state.maximized, false);
  a.emit("chrome", "close");
  assert.equal(a.state.open, false);
});

test("closing the active window focuses the top remaining one", async () => {
  const a = wm.add(new Window({ id: "a" })), b = wm.add(new Window({ id: "b" }));
  await wm.open("a"); await wm.open("b");
  wm.close("b");
  assert.equal(wm.activeId, "a");
  wm.minimize("a");
  assert.equal(wm.activeId, null);
  void b;
});

test("pointerdown on a window focuses it; title and attention are relayed on the bus", async () => {
  const a = wm.add(new Window({ id: "a" })), b = wm.add(new Window({ id: "b" }));
  await wm.open("a"); await wm.open("b");
  a.emit("pointerdown");
  assert.equal(wm.activeId, "a");
  b.setTitle("Bee");
  b.requestAttention();
  assert.ok(events.includes("window:title:b") && events.includes("window:attention:b"));
});

test("jank paints frame → menu bar → body with the loading classes", async () => {
  const a = wm.add(new Window({ id: "a" }));
  const p = wm.open("a", null, { jank: true });
  assert.ok(a.el.classList.contains("loading"));
  await p;
  assert.ok(!a.el.classList.contains("loading") && !a.el.classList.contains("loading2"));
});

test("reduced motion skips the jank", async () => {
  fresh({ reduced: true });
  const a = wm.add(new Window({ id: "a" }));
  const p = wm.open("a", null, { jank: true });
  assert.ok(!a.el.classList.contains("loading"));
  await p;
});

test("remove closes, unmounts and forgets", async () => {
  const a = wm.add(new Window({ id: "a" }));
  await wm.open("a");
  wm.remove("a");
  assert.equal(wm.has("a"), false);
  assert.equal(a.el.isConnected, false);
  assert.ok(events.includes("window:close:a") && events.includes("window:remove:a"));
  wm.remove("a");   // no-op
});

test("static windows are never placed, never task, never raised", async () => {
  const s = wm.add(new Window({ id: "s", chrome: "static" }));
  await wm.open("s", { x: 9, y: 9 });
  assert.equal(s.el.style.left, "");
  assert.equal(s.el.style.zIndex, "");
  assert.equal(s.hasTask, false);
});

test("Escape closes only an active popup", async () => {
  const p = wm.add(new Window({ id: "p", popup: true })), n = wm.add(new Window({ id: "n" }));
  await wm.open("n"); await wm.open("p");
  wm.handleEscape();
  assert.equal(p.state.open, false);
  assert.equal(wm.activeId, "n");
  wm.handleEscape();
  assert.equal(n.state.open, true);
});

test("open throws for unknown ids", async () => {
  await assert.rejects(() => wm.open("zzz"), /no window/);
});

test("drag moves a window with 4px snapping, only from the title bar and only when floating", async () => {
  Object.defineProperty(desktop, "clientWidth", { value: 1366 });   // jsdom has no layout
  const a = wm.add(new Window({ id: "a" }));
  await wm.open("a", { x: 100, y: 100 });
  for (const [k, v] of [["offsetLeft", 100], ["offsetTop", 100], ["offsetWidth", 700]]) Object.defineProperty(a.el, k, { value: v });
  const bar = a.titleBar.el;
  const down = (x, y, extra = {}) => bar.dispatchEvent(Object.assign(new d.win.Event("pointerdown", { bubbles: true }), { button: 0, clientX: x, clientY: y, pointerId: 1 }, extra));
  const move = (x, y) => bar.dispatchEvent(Object.assign(new d.win.Event("pointermove", { bubbles: true }), { clientX: x, clientY: y }));
  const up = () => bar.dispatchEvent(new d.win.Event("pointerup", { bubbles: true }));
  down(100, 100); move(133, 150); up();
  assert.equal(a.el.style.left, "132px");   // snap(100 + 33) = 132
  assert.equal(a.el.style.top, "152px");    // snap(100 + 50) = 152
  down(0, 0, { button: 2 }); move(500, 500); up();   // right button: no drag
  assert.equal(a.el.style.left, "132px");
  d.media.floating = false;                           // phones: no drag
  down(0, 0); move(500, 500); up();
  assert.equal(a.el.style.left, "132px");
});
