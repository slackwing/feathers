import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom, tick } from "./dom.js";
import { Toast } from "../html/hxh/os/toast.js";

setupDom();

test("toast is a mini window that shows a message and slides away", async () => {
  const t = new Toast().mount(document.body);
  assert.equal(t.el.id, "toast");
  assert.equal(t.el.querySelector(".tbar .ttl").textContent, "Hunter Website");
  assert.equal(t.el.querySelectorAll(".tbtn").length, 0);
  t.show("Hello", 10);
  assert.equal(t.visible, true);
  assert.equal(t.body.textContent, "Hello");
  t.show("Again", 10);
  await tick(25);
  assert.equal(t.visible, false);
  t.unmount();
});
