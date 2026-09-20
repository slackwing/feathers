import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Blimp, BLIMP, FLYER_TEXT } from "../html/hxh/os/blimp.js";

const d = setupDom();

test("the sprite is a rectangular grid; a flight is a sprite, a rope and the flyer, gone when its animation ends", () => {
  assert.ok(BLIMP.every(r => r.length === BLIMP[0].length));
  const b = new Blimp({ reduced: true, random: () => 0.9 }).mount(document.body);
  const el = b.launch({ dir: -1, top: 10 });
  assert.ok(el.classList.contains("blimp") && el.classList.contains("west"));
  assert.equal(el.style.top, "10%");
  assert.match(el.querySelector(".ship svg").outerHTML, new RegExp(`width="${BLIMP[0].length * 3}"`));   // the desktop icons' 3×
  assert.equal(el.querySelector(".flyer").textContent, FLYER_TEXT);
  assert.ok(el.querySelector(".rope"));
  const east = b.launch({ dir: 1 });
  assert.ok(east.classList.contains("east"));
  assert.equal(b.flights, 2);
  el.dispatchEvent(new d.win.Event("animationend"));
  assert.equal(el.isConnected, false);
  b.unmount();
});

test("flights are scheduled at random intervals; never under reduced motion", () => {
  const timers = [];
  const st = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  const b = new Blimp({ minWait: 1000, maxWait: 3000, random: () => 0.5, setTimeout: st, clearTimeout: () => {} }).mount(document.body);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 2000);
  timers[0].fn();
  assert.equal(b.flights, 1);
  assert.equal(timers.length, 2, "the next flight is booked after each one");
  b.unmount();
  const quiet = new Blimp({ reduced: true, setTimeout: st }).mount(document.body);
  assert.equal(timers.length, 2);
  quiet.unmount();
});
