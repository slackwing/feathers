import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Env, DESIGN_WIDTH } from "../html/hxh/os/env.js";

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

test("the whale rule: wanted zoom is the view's width over the design width", () => {
  assert.equal(new Env(setupDom({ width: 1366 }).win).wantedZoom(), 1);
  assert.equal(new Env(setupDom({ width: 683 }).win).wantedZoom(), 0.5);
  assert.equal(new Env(setupDom({ width: 2732 }).win).wantedZoom(), 2);
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
