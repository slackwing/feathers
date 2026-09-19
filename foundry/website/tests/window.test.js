import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Window, TitleBar, ChromeButton, CHROME } from "../html/hxh/os/window.js";

const { click } = setupDom();

test("a Window needs an id", () => {
  assert.throws(() => new Window({}), /needs an id/);
});

test("full chrome: title bar with the three identical buttons, hidden until opened", () => {
  const w = new Window({ id: "w1", title: "One", icon: "card", width: 500, cls: "extra" });
  w.mount(document.body);
  assert.equal(w.el.id, "w1");
  assert.equal(w.el.hidden, true);
  assert.equal(w.el.style.width, "500px");
  assert.ok(w.el.classList.contains("win") && w.el.classList.contains("extra"));
  assert.deepEqual(w.buttonKinds(), ["min", "max", "close"]);
  const btns = [...w.el.querySelectorAll(".tbar .tbtn")];
  assert.deepEqual(btns.map(b => b.textContent), [CHROME.min.glyph, CHROME.max.glyph, CHROME.close.glyph]);
  assert.deepEqual(btns.map(b => b.title), ["Minimize", "Maximize", "Close"]);
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
  assert.deepEqual(got, ["min", "max", "close"]);
  assert.equal(bodyClicks, 0);
  w.unmount();
});

test("options remove buttons: not closable / minimizable / maximizable", () => {
  const w = new Window({ id: "w3", closable: false, maximizable: false }).mount(document.body);
  assert.deepEqual(w.buttonKinds(), ["min"]);
  assert.equal(w.el.querySelectorAll(".tbtn").length, 1);
  w.unmount();
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
  w.el.querySelector(".body").dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
  assert.deepEqual(ev, ["title:New", "attention", "down"]);
  w.unmount();
});

test("the × app icon is drawn cream on the crimson bar", () => {
  const tb = new TitleBar({ title: "x", icon: "x", buttons: ["close"] }).mount(document.body);
  assert.match(tb.el.querySelector(".ico").innerHTML, /#fff6e0/);
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
