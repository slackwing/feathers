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

test("cqFix: measures how far container units are off under a host (Safari applies zoom to them twice) and sets --cqk to cancel it; 1 where the engine is right", async () => {
  const { cqFix } = await import("../html/hxh/os/dom.js");
  const host = document.createElement("div"); document.body.append(host);
  const real = Element.prototype.getBoundingClientRect;
  let err = 0.6464;   // WebKit on Abi's iPad: page zoom 0.917 × binder zoom 0.705
  Element.prototype.getBoundingClientRect = function () { const w = this.tagName === "I" ? 100 * err : 100; return { width: w, height: 1, left: 0, top: 0, right: w, bottom: 1, x: 0, y: 0 }; };
  try {
    assert.equal(cqFix(host), 1.547);
    assert.equal(host.style.getPropertyValue("--cqk"), "1.547");
    assert.equal(host.children.length, 0, "the probe is gone");
    err = 1;   // Blink: right — still set, so the host overrides an inherited factor
    assert.equal(cqFix(host), 1);
    assert.equal(host.style.getPropertyValue("--cqk"), "1");
  } finally { Element.prototype.getBoundingClientRect = real; }
  assert.equal(cqFix(host), 1, "no layout (jsdom): 1");
});

test("every container-query length in the card, binder and OS styles carries the Safari correction: calc(N cqw * var(--cqk, 1))", async () => {
  const fs = await import("node:fs");
  for (const f of ["html/hxh/apps/card.css", "html/hxh/apps/binder.css", "html/hxh/os/os.css"]) {
    const css = fs.readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const all = css.match(/\d*\.?\d+cq(?:w|h|i|b|min|max)\b/g) || [];
    const fixed = css.match(/calc\(\d*\.?\d+cq(?:w|h|i|b|min|max) \* var\(--cqk, 1\)\)/g) || [];
    assert.equal(fixed.length, all.length, `${f}: every cq length wrapped (${all.length - fixed.length} bare)`);
  }
});
