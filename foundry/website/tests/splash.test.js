import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch } from "./dom.js";
import { Splash, SPLASHES, SPLASH_IDS, randomSplash } from "../html/hxh/os/splash.js";
import { CUES } from "../html/hxh/os/sound.js";

const d = setupDom();

test("three title screens, one picked at random (Andrew, 2026-09-27: try 3 styles and randomize which loads)", () => {
  assert.deepEqual(SPLASHES.map(([, n]) => n), ["Summons", "Clouds", "Night"]);
  assert.equal(randomSplash(() => 0), "summons");
  assert.equal(randomSplash(() => 0.5), "clouds");
  assert.equal(randomSplash(() => 0.9999), "night");
  assert.equal(randomSplash(() => 1), "night", "a random() of 1 stays in range");
  const seen = new Set(Array.from({ length: 60 }, (_, i) => randomSplash(() => i / 60)));
  assert.equal(seen.size, 3);
});

test("every style says Click to start, carries the title, and never moves on by itself; a click, tap or Enter / Space / Escape dismisses it", async () => {
  for (const id of SPLASH_IDS) {
    const played = [];
    const s = new Splash({ reduced: false, random: () => 0.3, sounds: { play: n => played.push(n) } }).mount(document.body);
    let done = null;
    const p = s.show(id).then(v => { done = v; });
    const el = s.el;
    assert.equal(el.hidden, false);
    assert.ok(el.classList.contains("sp-" + id));
    assert.match(el.textContent, /click to start/i, id + ": says Click to start");
    assert.match(el.textContent.toUpperCase(), /HUNTER\s*×\s*/, id + ": says Hunter ×");
    assert.match(el.textContent.toUpperCase(), /HALLOWEEN/, id + ": says Halloween");
    await new Promise(r => setTimeout(r, 30));
    assert.equal(done, null, id + ": it waits for the viewer");
    el.click();
    await p;
    assert.equal(done, id);
    assert.equal(el.hidden, true);
    assert.equal(el.children.length, 0, "cleaned up");
    assert.deepEqual(played, ["startup"], "the click plays the startup chime (Sounds decides whether it is heard)");
    s.unmount();
  }
  for (const key of ["Enter", " ", "Escape"]) {
    const s = new Splash({ reduced: true }).mount(document.body);
    const p = s.show("night");
    document.dispatchEvent(new d.win.KeyboardEvent("keydown", { key, bubbles: true }));
    assert.equal(await p, "night", JSON.stringify(key) + " dismisses");
    s.unmount();
  }
  const s = new Splash({ reduced: true }).mount(document.body);
  const p = s.show("summons");
  document.dispatchEvent(new d.win.KeyboardEvent("keydown", { key: "a", bubbles: true }));
  assert.equal(s.el.hidden, false, "other keys do nothing");
  s.el.click(); await p; s.unmount();
});

test("reduced motion: a still picture — no embers, no animation", async () => {
  const s = new Splash({ reduced: true, random: () => 0 }).mount(document.body);
  const p = s.show("summons");
  assert.ok(s.el.classList.contains("still"));
  assert.equal(s.el.querySelectorAll(".sp-embers i").length, 0);
  s.el.click(); await p;
  const moving = new Splash({ reduced: false, random: () => 0.5 }).mount(document.body);
  const q = moving.show("summons");
  assert.ok(moving.el.querySelectorAll(".sp-embers i").length > 10, "embers rise when motion is allowed");
  moving.el.click(); await q;
  s.unmount(); moving.unmount();
});

test("showing another style while one is up replaces it; an unknown style falls back to a random one", async () => {
  const s = new Splash({ reduced: true, random: () => 0.9 }).mount(document.body);
  const a = s.show("summons");
  const b = s.show("clouds");
  assert.equal(await a, "summons", "the first resolves when it is replaced");
  assert.ok(s.el.classList.contains("sp-clouds"));
  s.el.click(); assert.equal(await b, "clouds");
  const c = s.show("nope");
  assert.ok(s.el.classList.contains("sp-night"), "random() 0.9 → night");
  s.el.click(); await c; s.unmount();
});

test("the startup chime is an original cue", () => {
  assert.ok(Array.isArray(CUES.startup) && CUES.startup.length >= 3);
});
