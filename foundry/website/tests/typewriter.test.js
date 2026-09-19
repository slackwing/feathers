import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom, tick } from "./dom.js";
import { type } from "../html/hxh/os/typewriter.js";

setupDom();

test("types runs one character at a time, then renders them as nodes", async () => {
  const el = document.createElement("p");
  let done = 0;
  const t = type(el, ["ab", { t: "c", tag: "b", cls: "k", title: "T" }], { speed: 1, onDone: () => done++ });
  assert.ok(el.classList.contains("cur"));
  await tick(30);
  assert.equal(t.done, true);
  assert.equal(el.innerHTML, '<span>ab</span><b class="k" title="T">c</b>');
  assert.ok(!el.classList.contains("cur"));
  assert.equal(done, 1);
});

test("skip finishes at once; instant and reduced render immediately", () => {
  const el = document.createElement("p");
  const t = type(el, ["hello"], { speed: 1000 });
  t.skip(); t.skip();
  assert.equal(el.textContent, "hello");
  assert.equal(type(el, ["x"], { instant: true }).done, true);
  assert.equal(type(el, ["y"], { reduced: true }).done, true);
  assert.equal(el.textContent, "y");
});
