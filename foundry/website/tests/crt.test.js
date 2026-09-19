import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { CRT, CRT_KEY } from "../html/hxh/os/crt.js";
import { EventBus } from "../html/hxh/os/bus.js";

const d = setupDom();

test("defaults OFF (Andrew, 2026-09-19), remembers an override in localStorage, toggles the body class and announces", () => {
  const bus = new EventBus(), seen = [];
  bus.on("crt", p => seen.push(p.on));
  const crt = new CRT({ body: document.body, storage: d.win.localStorage, bus });
  assert.equal(crt.on, false);
  crt.apply();
  assert.ok(!document.body.classList.contains("crt"));
  assert.equal(crt.toggle(), true);
  assert.ok(document.body.classList.contains("crt"));
  assert.equal(d.win.localStorage.getItem(CRT_KEY), "1");
  assert.equal(new CRT({ body: document.body, storage: d.win.localStorage }).on, true);   // the browser remembers
  crt.set(false);
  assert.equal(d.win.localStorage.getItem(CRT_KEY), "0");
  assert.deepEqual(seen, [true, false]);
});

test("a broken storage still toggles", () => {
  const bad = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } };
  const crt = new CRT({ body: document.body, storage: bad });
  assert.equal(crt.on, false);
  assert.equal(crt.set(true), true);
  assert.ok(document.body.classList.contains("crt"));
  crt.set(false);
});
