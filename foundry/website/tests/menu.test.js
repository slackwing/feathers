import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Menus, Menu, MenuBar, renderItems } from "../html/hxh/os/menu.js";

const { click, key } = setupDom();
Menus.install(document);

test("renderItems: labels, icons, separators, checks, hidden, disabled, attrs, onPick before onclick", () => {
  const box = document.createElement("div");
  const order = [];
  renderItems([
    { label: "Open", icon: "folder", onclick: () => order.push("onclick") },
    "sep",
    { label: "Check", check: () => true },
    { label: "Gone", hidden: true },
    { label: "Off", disabled: true, attrs: { "data-x": "1" } },
    { sep: true },
  ], box, () => order.push("pick"));
  const kids = [...box.children];
  assert.deepEqual(kids.map(k => k.tagName), ["BUTTON", "HR", "BUTTON", "BUTTON", "HR"]);
  assert.match(kids[0].innerHTML, /<svg/);
  assert.equal(kids[0].textContent, "Open");
  assert.ok(kids[2].classList.contains("chk") && kids[2].classList.contains("on"));
  assert.equal(kids[3].disabled, true);
  assert.equal(kids[3].dataset.x, "1");
  click(kids[0]);
  assert.deepEqual(order, ["pick", "onclick"]);
});

test("Menu opens/closes, re-renders dynamic items each open, marks its .menu parent", () => {
  const wrap = document.createElement("div"); wrap.className = "menu"; document.body.append(wrap);
  let n = 0;
  const m = new Menu({ items: () => [{ label: "n=" + n++ }] }).mount(wrap);
  assert.equal(m.isOpen, false);
  m.open();
  assert.ok(m.isOpen && wrap.classList.contains("open"));
  assert.equal(m.el.textContent, "n=0");
  m.close(); m.open();
  assert.equal(m.el.textContent, "n=1");
  m.toggle();
  assert.equal(m.isOpen, false);
  assert.equal(wrap.classList.contains("open"), false);
  m.unmount(); wrap.remove();
});

test("submenus cascade: open on click or hover, keep ancestors open, one sibling at a time, a leaf closes the chain", () => {
  const wrap = document.createElement("div"); wrap.className = "menu"; document.body.append(wrap);
  const picked = [];
  const m = new Menu({ items: [
    { label: "Display", items: () => [{ label: "Theme", items: [{ label: "Win98", onclick: () => picked.push("win98") }] }, { label: "Scanlines", onclick: () => picked.push("crt") }] },
    { label: "Sounds", items: [{ label: "Sounds" }] },
    { label: "Leaf", onclick: () => picked.push("leaf") },
  ] }).mount(wrap);
  m.open();
  assert.equal(m.subs.length, 2);
  const [display, sounds] = m.subs;
  const btn = sub => sub.el.parentElement.querySelector(":scope > button");
  assert.match(btn(display).textContent, /Display▸$/);
  assert.equal(display.isOpen, false);
  click(btn(display));
  assert.ok(display.isOpen && m.isOpen, "clicking Display opens it and keeps the root");
  assert.equal(Menus.openCount, 2);
  display.el.parentElement.dispatchEvent(new window.Event("mouseenter"));   // hovering again is harmless
  sounds.el.parentElement.dispatchEvent(new window.Event("mouseenter"));
  assert.ok(sounds.isOpen && !display.isOpen && m.isOpen, "hovering a sibling swaps the open submenu");
  click(btn(display));
  const theme = display.subs[0];
  click(btn(theme));
  assert.ok(theme.isOpen && display.isOpen && m.isOpen, "three levels deep, all ancestors open");
  assert.equal(Menus.openCount, 3);
  [...display.el.querySelectorAll(":scope > button")].find(b => b.textContent === "Scanlines").dispatchEvent(new window.Event("mouseenter"));
  assert.ok(!theme.isOpen && display.isOpen, "hovering a leaf folds the sibling submenu");
  click(btn(theme));
  click(theme.el.querySelector("button"));   // Win98
  assert.deepEqual(picked, ["win98"]);
  assert.ok(!theme.isOpen && !display.isOpen && !m.isOpen, "a leaf pick closes the whole chain");
  m.open();   // re-rendered: fresh submenu instances, the old ones unmounted
  assert.equal(m.subs.length, 2);
  assert.equal(display.el.parentElement, null);
  click(btn(m.subs[0])); key(document.body, "Escape");
  assert.equal(Menus.openCount, 0);
  m.open();
  m.close();
  m.unmount(); wrap.remove();
  assert.equal(Menus.openCount, 0);
});

test("only one menu is open at a time; document click and Escape close everything", () => {
  const a = new Menu({ items: [{ label: "a" }] }).mount(document.body);
  const b = new Menu({ items: [{ label: "b" }] }).mount(document.body);
  a.open(); b.open();
  assert.equal(a.isOpen, false);
  assert.equal(b.isOpen, true);
  assert.equal(Menus.openCount, 1);
  click(document.body);
  assert.equal(b.isOpen, false);
  a.open();
  key(document.body, "Escape");
  assert.equal(a.isOpen, false);
  a.open();
  click(a.el);   // clicks inside stay open
  assert.equal(a.isOpen, true);
  click(a.el.querySelector("button"));   // picking an item closes
  assert.equal(a.isOpen, false);
  a.unmount(); b.unmount();
});

test("unmounting an open menu untracks it", () => {
  const a = new Menu({ items: [] }).mount(document.body);
  a.open();
  a.unmount();
  assert.equal(Menus.openCount, 0);
});

test("MenuBar: underlined key letter, click toggles that menu", () => {
  const bar = new MenuBar({ menus: [
    { label: "File", key: "F", items: [{ label: "Quit" }] },
    { label: "View", key: "Z", items: [] },
  ] }).mount(document.body);
  const btns = bar.el.querySelectorAll(".menu > button");
  assert.equal(btns[0].innerHTML, "<u>F</u>ile");
  assert.equal(btns[1].innerHTML, "View");   // key must be the label's first letters
  click(btns[0]);
  assert.equal(bar.menus[0].isOpen, true);
  click(btns[1]);
  assert.equal(bar.menus[0].isOpen, false);
  assert.equal(bar.menus[1].isOpen, true);
  bar.unmount();
});
