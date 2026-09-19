import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { ScrollPane, STEP } from "../html/hxh/os/scrollpane.js";
import { h } from "../html/hxh/os/dom.js";

const d = setupDom();

/** jsdom has no layout: fake the scroll geometry on the content element. */
function pane({ scrollHeight = 1000, clientHeight = 200, trackHeight = 160 } = {}) {
  const content = h("div");
  let top = 0;
  Object.defineProperty(content, "scrollHeight", { get: () => scrollHeight });
  Object.defineProperty(content, "clientHeight", { get: () => clientHeight });
  Object.defineProperty(content, "scrollTop", { get: () => top, set: v => { top = Math.max(0, Math.min(scrollHeight - clientHeight, v)); content.dispatchEvent(new d.win.Event("scroll")); } });
  const p = new ScrollPane({ content }).mount(document.body);
  Object.defineProperty(p.track, "clientHeight", { get: () => trackHeight });
  Object.defineProperty(p.thumb, "offsetHeight", { get: () => parseInt(p.thumb.style.height) || 0 });
  p.update();
  return { p, content };
}

test("wraps the content, hides the native bar and draws its own", () => {
  const { p, content } = pane();
  assert.ok(content.classList.contains("sp-content"));
  assert.equal(p.el.querySelector(".sp-content"), content);
  assert.deepEqual([...p.el.querySelectorAll(".sp-btn")].map(b => b.textContent), ["▲", "▼"]);
  assert.equal(p.scrollable, true);
  assert.equal(p.thumb.style.height, "32px");   // 160 × 200/1000
  assert.equal(p.thumb.style.top, "0px");
  p.unmount();
});

test("arrows and track paging scroll the content; the thumb follows", () => {
  const { p, content } = pane();
  d.click(p.down);
  assert.equal(content.scrollTop, STEP);
  assert.equal(p.thumb.style.top, Math.round((160 - 32) * (STEP / 800)) + "px");
  d.click(p.up);
  assert.equal(content.scrollTop, 0);
  p.track.dispatchEvent(new d.win.MouseEvent("mousedown", { bubbles: true, clientY: 500 }));
  assert.equal(content.scrollTop, 200);   // a page down
  content.scrollTop = 800;
  assert.equal(p.thumb.style.top, "128px");   // at the bottom of the track
  p.unmount();
});

test("nothing to scroll: the thumb hides", () => {
  const { p } = pane({ scrollHeight: 100, clientHeight: 200 });
  assert.equal(p.scrollable, false);
  assert.ok(p.el.classList.contains("sp-none"));
  p.unmount();
});
