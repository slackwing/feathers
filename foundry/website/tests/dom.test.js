import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { h, esc, $, $$, append } from "../html/hxh/os/dom.js";

setupDom();

test("esc escapes the five HTML characters and tolerates null", () => {
  assert.equal(esc(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  assert.equal(esc(null), "");
  assert.equal(esc(5), "5");
});

test("h builds elements from an attribute bag", () => {
  let clicked = 0;
  const el = h("button", { type: "button", className: "btn x", text: "OK", dataset: { act: "go" }, style: { width: "3px" }, hidden: true, disabled: false, onclick: () => clicked++ });
  assert.equal(el.tagName, "BUTTON");
  assert.equal(el.className, "btn x");
  assert.equal(el.textContent, "OK");
  assert.equal(el.dataset.act, "go");
  assert.equal(el.style.width, "3px");
  assert.equal(el.hidden, true);
  assert.equal(el.hasAttribute("disabled"), false);
  el.click();
  assert.equal(clicked, 1);
});

test("h nests children: nodes, strings, arrays, falsy", () => {
  const el = h("div", {}, "a", [h("i", { text: "b" }), null, ["c", false]], 0);
  assert.equal(el.innerHTML, "a<i>b</i>c0");
  assert.equal(append(h("p"), ["x"]).textContent, "x");
});

test("html attribute sets innerHTML; $ and $$ query", () => {
  const el = h("div", { html: "<b>1</b><b>2</b>" });
  document.body.append(el);
  assert.equal($("b").textContent, "1");
  assert.equal($$("b", el).length, 2);
  el.remove();
});
