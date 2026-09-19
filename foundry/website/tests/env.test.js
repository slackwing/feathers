import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Env, DESIGN_WIDTH, whale } from "../html/hxh/os/env.js";

test("floating is the rule; body.nofloat or body.stacked opt out (no phone breakpoint)", () => {
  const { win, doc } = setupDom({ floating: true, width: 390 });
  const env = new Env(win);
  assert.equal(env.floating(), true);   // a phone-wide view still floats — it is zoomed instead
  doc.body.classList.add("nofloat");
  assert.equal(env.floating(), false);
  doc.body.classList.remove("nofloat");
  doc.body.classList.add("stacked");
  assert.equal(env.floating(), false);
});

test("the whale rule: one fixed scale (a big screen shows more ocean, not a bigger whale), capped so the island is at most 85% of the width", () => {
  const d = whale(1366, 900);           // 5 px per art px, island 760 px = 56 %
  assert.equal(d.scale, 5);
  assert.equal(d.zoom, 1);
  assert.deepEqual([d.W, d.H], [274, 180]);
  const wide = whale(1920, 1080);       // same 5 px: island still 760 px = 40 %, more canvas around it
  assert.equal(wide.scale, 5);
  assert.equal(wide.zoom, 1);
  assert.deepEqual([wide.W, wide.H], [384, 216]);
  const huge = whale(2560, 1440);       // island 30 % of a big monitor
  assert.deepEqual([huge.scale, huge.zoom, huge.W, huge.H], [5, 1, 512, 288]);
  const small = whale(800, 600);        // 760 px would be 95 %: capped
  assert.ok(small.zoom < 1 && Math.abs(152 * small.scale / 800 - 0.85) < 1e-9);
  const phone = whale(390, 844);        // natural 4.69 would make the island 183 % wide → capped to 85 %
  assert.ok(Math.abs(phone.scale - 0.85 * 390 / 152) < 1e-9);
  assert.ok(Math.abs(phone.zoom - 0.4362) < 0.001);   // cap / 5
  assert.ok(Math.abs(152 * phone.scale / 390 - 0.85) < 1e-9);   // exactly 85 %
  assert.ok(phone.H > phone.W && phone.W === Math.ceil(390 / phone.scale));
  const square = whale(900, 900);       // 84 %: just under the cap
  assert.equal(square.zoom, 1);
  assert.equal(whale(1024, 768).zoom, 1);   // 74 %
  assert.equal(new Env(setupDom({ width: 1366, height: 900 }).win).wantedZoom(), 1);
  assert.ok(new Env(setupDom({ width: 390, height: 844 }).win).wantedZoom() < 0.5);
  assert.equal(DESIGN_WIDTH, 1366);
});

test("reduced motion, zoom and viewport size", async () => {
  const { win, media } = setupDom({ reduced: true, width: 1000, height: 500 });
  const env = new Env(win);
  assert.equal(env.reduced, true);
  media.reduced = false;
  assert.equal(env.reduced, false);
  assert.equal(env.zoom(), 1);
  assert.equal(env.width, 1000);
  assert.equal(env.height, 500);
  const t = Date.now();
  await env.wait(5);
  assert.ok(Date.now() - t >= 4);
});

test("a host without matchMedia is not reduced; zoom defaults to 1", () => {
  const env = new Env({ document: { body: { classList: { contains: () => false } } } });
  assert.equal(env.floating(), true);
  assert.equal(env.reduced, false);
  assert.equal(env.zoom(), 1);
  assert.equal(env.wantedZoom(), 1);
});
