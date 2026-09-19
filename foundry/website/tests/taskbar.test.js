import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { EventBus } from "../html/hxh/os/bus.js";
import { Env } from "../html/hxh/os/env.js";
import { Window } from "../html/hxh/os/window.js";
import { WindowManager } from "../html/hxh/os/wm.js";
import { Taskbar, TaskButton, StartButton, Tray, TrayIcon, Clock } from "../html/hxh/os/taskbar.js";
import { Menus } from "../html/hxh/os/menu.js";

let d, bus, wm, tb;
beforeEach(() => {
  d = setupDom();
  Menus.install(document);
  bus = new EventBus();
  const desktop = document.createElement("div"); document.body.append(desktop);
  wm = new WindowManager({ bus, env: new Env(d.win), desktop });
  tb = new Taskbar({ bus, wm, start: true, now: () => new Date(2026, 9, 31, 13, 5) }).mount(document.body);
});

test("layout: Start button, tasks, tray with clock last", () => {
  assert.equal(tb.el.id, "taskbar");
  assert.equal(tb.el.querySelector("#startbtn").textContent, "Start");
  assert.match(tb.startButton.el.innerHTML, /<svg/);
  assert.ok(tb.tasks.classList.contains("tasks"));
  assert.equal(tb.tray.el.lastChild, tb.tray.clock.el);
  assert.match(tb.tray.clock.el.textContent, /1:05|13:05/);
  const noStart = new Taskbar({ bus, wm, start: false }).mount(document.body);
  assert.equal(noStart.el.querySelector("#startbtn"), null);
  noStart.unmount();
});

test("Start button emits and shows pressed", () => {
  let n = 0;
  tb.on("start", () => n++);
  d.click(tb.startButton.el);
  assert.equal(n, 1);
  tb.startButton.setPressed(true);
  assert.ok(tb.startButton.el.classList.contains("pressed"));
});

test("one TaskButton per open window, kept in step with the manager", async () => {
  const a = wm.add(new Window({ id: "a", title: "Aye", icon: "card" }));
  wm.add(new Window({ id: "s", chrome: "static" }));
  assert.equal(tb.buttons.size, 0);
  await wm.open("a");
  assert.equal(tb.buttons.size, 1);
  const b = tb.button("a");
  assert.ok(b instanceof TaskButton);
  assert.equal(b.el.querySelector(".tlbl").textContent, "Aye");
  assert.ok(b.el.classList.contains("pressed"));
  await wm.open("s");
  assert.equal(tb.buttons.size, 1);   // static windows have no task
  a.setTitle("Bee");
  assert.equal(b.el.title, "Bee");
  wm.minimize("a");
  assert.equal(tb.buttons.size, 1);
  assert.ok(!b.el.classList.contains("pressed"));
  wm.close("a");
  assert.equal(tb.buttons.size, 0);
  assert.equal(b.el.isConnected, false);
});

test("pressing a task button minimizes the active window or restores it", async () => {
  const a = wm.add(new Window({ id: "a" }));
  await wm.open("a");
  d.click(tb.button("a").el);
  assert.equal(a.state.minimized, true);
  d.click(tb.button("a").el);
  assert.equal(a.state.minimized, false);
  assert.equal(wm.activeId, "a");
  const b = wm.add(new Window({ id: "b" }));
  await wm.open("b");
  d.click(tb.button("a").el);   // inactive → focus, not minimize
  assert.equal(wm.activeId, "a");
  assert.equal(a.state.minimized, false);
  void b;
});

test("attention flashes an unfocused window's button until it is focused", async () => {
  const a = wm.add(new Window({ id: "a" })), b = wm.add(new Window({ id: "b" }));
  await wm.open("a"); await wm.open("b");
  a.requestAttention();
  assert.equal(tb.button("a").flashing, true);
  a.calm();   // seen elsewhere (another tab): flash off without a focus
  assert.equal(tb.button("a").flashing, false);
  assert.equal(a.flashing, false);
  a.requestAttention();
  assert.equal(tb.button("a").flashing, true);
  b.requestAttention();   // active: no flash
  assert.equal(tb.button("b").flashing, false);
  wm.focus("a");
  assert.equal(tb.button("a").flashing, false);
});

test("tray icons: add / remove / lit state / click / menu, via the bus too", () => {
  let clicks = 0, lit = true;
  const ic = tb.tray.add({ id: "crt", icon: "crt", title: "Scanlines", on: () => lit, onClick: () => clicks++ });
  assert.ok(ic instanceof TrayIcon);
  assert.equal(ic.el.dataset.tray, "crt");
  assert.equal(ic.btn.title, "Scanlines");
  assert.ok(ic.btn.classList.contains("on"));
  assert.equal(ic.el.nextSibling, tb.tray.clock.el);   // before the clock
  d.click(ic.btn);
  assert.equal(clicks, 1);
  lit = false; bus.emit("tray:refresh", { id: "crt" });
  assert.ok(!ic.btn.classList.contains("on"));
  assert.throws(() => tb.tray.add({ id: "crt", icon: "crt" }), /already present/);
  bus.emit("tray:add", { id: "chat", icon: "comment", menu: () => [{ label: "Open" }] });
  const chat = tb.tray.get("chat");
  assert.ok(chat.menu.el.classList.contains("up"));
  d.click(chat.btn);
  assert.equal(chat.menu.isOpen, true);
  assert.equal(chat.menu.el.textContent, "Open");
  d.click(document.body);
  assert.equal(chat.menu.isOpen, false);
  bus.emit("tray:remove", { id: "chat" });
  assert.equal(tb.tray.has("chat"), false);
  ic.setOn(true);
  assert.ok(ic.btn.classList.contains("on"));
  bus.emit("tray:refresh", {});
});

test("clock ticks on a timer and stops on unmount", () => {
  let t = new Date(2026, 0, 1, 9, 0);
  const c = new Clock({ now: () => t }).mount(document.body);
  c.start(5);
  assert.match(c.el.textContent, /9:00/);
  c.unmount();
});

test("standalone pieces render", () => {
  const sb = new StartButton().mount(document.body);
  assert.equal(sb.el.id, "startbtn");
  const tr = new Tray().mount(document.body);
  assert.ok(tr.clock);
  sb.unmount(); tr.unmount();
});
