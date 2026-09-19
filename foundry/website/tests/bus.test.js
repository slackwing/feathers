import { test } from "node:test";
import assert from "node:assert/strict";
import { EventBus } from "../html/hxh/os/bus.js";

test("on/emit delivers payloads and counts handlers", () => {
  const bus = new EventBus();
  const got = [];
  bus.on("x", p => got.push(p));
  bus.on("x", p => got.push(p * 2));
  assert.equal(bus.emit("x", 2), 2);
  assert.deepEqual(got, [2, 4]);
  assert.equal(bus.count("x"), 2);
  assert.equal(bus.emit("nothing"), 0);
});

test("on returns an unsubscribe; off removes; clear empties", () => {
  const bus = new EventBus();
  let n = 0;
  const off = bus.on("x", () => n++);
  bus.emit("x"); off(); bus.emit("x");
  assert.equal(n, 1);
  const fn = () => n++;
  bus.on("y", fn); bus.off("y", fn); bus.emit("y");
  assert.equal(n, 1);
  bus.on("z", fn); bus.clear();
  assert.equal(bus.count("z"), 0);
});

test("once fires a single time", () => {
  const bus = new EventBus();
  let n = 0;
  bus.once("x", () => n++);
  bus.emit("x"); bus.emit("x");
  assert.equal(n, 1);
});

test("a throwing handler does not stop the others", () => {
  const bus = new EventBus();
  const errors = [];
  const orig = console.error; console.error = (...a) => errors.push(a);
  let ran = false;
  bus.on("x", () => { throw new Error("boom"); });
  bus.on("x", () => { ran = true; });
  assert.equal(bus.emit("x"), 1);
  console.error = orig;
  assert.equal(ran, true);
  assert.equal(errors.length, 1);
});

test("non-function handlers are rejected", () => {
  assert.throws(() => new EventBus().on("x", "nope"), TypeError);
});
