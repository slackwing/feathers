import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { StartMenu } from "../html/hxh/os/startmenu.js";
import { Menu, Menus } from "../html/hxh/os/menu.js";

const d = setupDom();
Menus.install(document);

test("renders the user header, band and items fresh on every open", () => {
  let user = null, n = 0;
  const sm = new StartMenu({ items: () => [{ label: "Item " + n++ }, "sep", { label: "Log out", icon: "door" }], user: () => user }).mount(document.body);
  assert.equal(sm.el.id, "startmenu");
  sm.open();
  assert.equal(sm.isOpen, true);
  assert.equal(sm.el.querySelector(".user"), null);
  assert.equal(sm.el.querySelector(".band").textContent, "HUNTER×HALLOWEEN");
  assert.equal(sm.el.querySelector(".items").firstChild.textContent, "Item 0");
  sm.close();
  user = { initial: "AC", color: "#d914e3", display_name: "Andrew <C>" };
  sm.open();
  const head = sm.el.querySelector(".user");
  assert.match(head.innerHTML, /avatar lg/);
  assert.equal(head.querySelector(".name").textContent, "Andrew <C>");
  assert.equal(sm.el.querySelector(".items").firstChild.textContent, "Item 1");
  sm.unmount();
});

test("picking an item closes; opening closes other menus and vice versa; Escape closes", () => {
  const sm = new StartMenu({ items: () => [{ label: "Go" }] }).mount(document.body);
  const other = new Menu({ items: [{ label: "x" }] }).mount(document.body);
  other.open(); sm.open();
  assert.equal(other.isOpen, false);
  d.click(sm.el);   // inside: stays
  assert.equal(sm.isOpen, true);
  d.click(sm.el.querySelector(".items button"));
  assert.equal(sm.isOpen, false);
  sm.toggle();
  other.open();
  assert.equal(sm.isOpen, false);
  sm.open();
  d.key(document.body, "Escape");
  assert.equal(sm.isOpen, false);
  let ev = [];
  sm.on("open", () => ev.push("open")); sm.on("close", () => ev.push("close"));
  sm.toggle(); sm.toggle(); sm.close();
  assert.deepEqual(ev, ["open", "close"]);
  sm.unmount(); other.unmount();
});
