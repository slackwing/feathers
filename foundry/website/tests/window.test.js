import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Window, TitleBar, ChromeButton, CHROME } from "../html/hxh/os/window.js";

const { click } = setupDom();

test("a Window needs an id", () => {
  assert.throws(() => new Window({}), /needs an id/);
});

test("full chrome: title bar with the two identical buttons (no maximize anywhere), hidden until opened", () => {
  const w = new Window({ id: "w1", title: "One", icon: "card", width: 500, cls: "extra" });
  w.mount(document.body);
  assert.equal(w.el.id, "w1");
  assert.equal(w.el.hidden, true);
  assert.equal(w.el.style.width, "500px");
  assert.ok(w.el.classList.contains("win") && w.el.classList.contains("extra"));
  assert.deepEqual(w.buttonKinds(), ["min", "close"]);
  const btns = [...w.el.querySelectorAll(".tbar .tbtns .tbtn")];
  assert.deepEqual(btns.map(b => b.textContent), [CHROME.min.glyph, CHROME.close.glyph]);
  assert.deepEqual(btns.map(b => b.title), ["Minimize", "Close"]);
  assert.equal(CHROME.max, undefined);
  assert.equal(w.el.querySelector(".tbar .ttl").textContent, "One");
  assert.equal(w.hasTask, true);
  w.unmount();
});

test("chrome buttons emit 'chrome' with their kind and do not bubble to the window", () => {
  const w = new Window({ id: "w2", title: "Two" }).mount(document.body);
  const got = [];
  w.on("chrome", k => got.push(k));
  let bodyClicks = 0;
  document.body.addEventListener("click", () => bodyClicks++);
  for (const b of w.el.querySelectorAll(".tbtn")) click(b);
  assert.deepEqual(got, ["min", "close"]);
  assert.equal(bodyClicks, 0);
  w.unmount();
});

test("options remove buttons: not closable / not minimizable", () => {
  const w = new Window({ id: "w3", closable: false }).mount(document.body);
  assert.deepEqual(w.buttonKinds(), ["min"]);
  assert.equal(w.el.querySelectorAll(".tbtn").length, 1);
  const v = new Window({ id: "w3b", minimizable: false }).mount(document.body);
  assert.deepEqual(v.buttonKinds(), ["close"]);
  w.unmount(); v.unmount();
});

test("static chrome: in-flow dialog, no buttons, no task", () => {
  const w = new Window({ id: "w4", chrome: "static", closable: false, task: false }).mount(document.body);
  assert.equal(w.static, true);
  assert.ok(w.el.classList.contains("static"));
  assert.deepEqual(w.buttonKinds(), []);
  assert.equal(w.hasTask, false);
  w.unmount();
});

test("chromeless: no title bar, float buttons as asked", () => {
  const w = new Window({ id: "w5", chrome: "none", buttons: ["min", "close"], popup: true }).mount(document.body);
  assert.equal(w.chromeless, true);
  assert.equal(w.el.querySelector(".tbar"), null);
  const f = w.el.querySelector(".fbtns");
  assert.deepEqual([...f.querySelectorAll(".tbtn")].map(b => b.className), ["tbtn min", "tbtn close"]);
  assert.ok(w.el.classList.contains("popup"));
  const got = [];
  w.on("chrome", k => got.push(k));
  click(f.querySelector(".close"));
  assert.deepEqual(got, ["close"]);
  w.unmount();
});

test("menus may be a function of the window (OS.appMenus style)", () => {
  const w = new Window({ id: "mf", menus: win => [{ label: "File", key: "F", items: () => [{ label: "Exit", onclick: () => win.emit("chrome", "close") }] }] }).mount(document.body);
  assert.equal(w.menuBar.menus.length, 1);
  let closed = 0;
  w.on("chrome", k => { if (k === "close") closed++; });
  w.menuBar.menus[0].open();
  click(w.menuBar.menus[0].el.querySelector("button"));
  assert.equal(closed, 1);
  w.unmount();
});

test("content: html, element or function; menus render a menu bar", () => {
  const a = new Window({ id: "a", content: "<p>hi</p>" }).mount(document.body);
  assert.equal(a.body.innerHTML, "<p>hi</p>");
  const el = document.createElement("i");
  const b = new Window({ id: "b", content: el }).mount(document.body);
  assert.equal(b.body.firstChild, el);
  const c = new Window({ id: "c", content: (body, win) => { body.textContent = win.id; }, menus: [{ label: "File", key: "F", items: [] }] }).mount(document.body);
  assert.equal(c.body.textContent, "c");
  assert.equal(c.el.querySelector(".mbar .menu > button").innerHTML, "<u>F</u>ile");
  assert.equal(c.$(".mbar").tagName, "DIV");
  for (const w of [a, b, c]) w.unmount();
});

test("setTitle updates the bar and emits; requestAttention emits; pointerdown emits", () => {
  const w = new Window({ id: "t", title: "Old" }).mount(document.body);
  const ev = [];
  w.on("title", t => ev.push("title:" + t));
  w.on("attention", () => ev.push("attention"));
  w.on("pointerdown", () => ev.push("down"));
  w.setTitle("New");
  assert.equal(w.title, "New");
  assert.equal(w.el.querySelector(".ttl").textContent, "New");
  w.requestAttention();
  assert.equal(w.flashing, true);   // the title bar blinks until focused
  w.el.querySelector(".body").dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
  assert.deepEqual(ev, ["title:New", "attention", "down"]);
  w.unmount();
});

test("the × app icon takes the title bar's own text colour (cream on crimson, ink on a pastel theme)", () => {
  const tb = new TitleBar({ title: "x", icon: "x", buttons: ["close"] }).mount(document.body);
  assert.match(tb.el.querySelector(".ico").innerHTML, /fill="currentColor"/);
  assert.doesNotMatch(tb.el.querySelector(".ico").innerHTML, /#c8102e/);
  tb.unmount();
  assert.throws(() => new ChromeButton({ kind: "nope" }).mount(document.body), /unknown chrome button/);
});

test("passthroughs are no-ops until a window manager adopts the window", () => {
  const w = new Window({ id: "p" }).mount(document.body);
  assert.equal(w.open(), undefined);
  assert.equal(w.close(), undefined);
  assert.equal(w.minimize(), undefined);
  assert.equal(w.focus(), undefined);
  w.unmount();
});
