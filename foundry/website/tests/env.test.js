import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Env } from "../html/hxh/os/env.js";

test("floating follows the media query and the nofloat class", () => {
  const { win, media, doc } = setupDom({ floating: true });
  const env = new Env(win);
  assert.equal(env.floating(), true);
  doc.body.classList.add("nofloat");
  assert.equal(env.floating(), false);
  doc.body.classList.remove("nofloat");
  media.floating = false;
  assert.equal(env.floating(), false);
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

test("a host without matchMedia is not floating and not reduced", () => {
  const env = new Env({ document: { body: { classList: { contains: () => false } } } });
  assert.equal(env.floating(), false);
  assert.equal(env.reduced, false);
  assert.equal(env.zoom(), 1);
});
