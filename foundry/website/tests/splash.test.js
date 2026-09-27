import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch } from "./dom.js";
import { Splash, SPLASHES, SPLASH_IDS, randomSplash, selectRoster, SELECT_TILES } from "../html/hxh/os/splash.js";
import { CUES } from "../html/hxh/os/sound.js";

const d = setupDom();

test("three title screens, one picked at random (Andrew, 2026-09-27: try 3 styles and randomize which loads)", () => {
  assert.deepEqual(SPLASHES.map(([, n]) => n), ["Summons", "Player Select", "Night"]);   // Clouds made way for Player Select (Andrew, 2026-09-27)
  assert.equal(randomSplash(() => 0), "summons");
  assert.equal(randomSplash(() => 0.5), "select");
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
  const b = s.show("select");
  assert.equal(await a, "summons", "the first resolves when it is replaced");
  assert.ok(s.el.classList.contains("sp-select"));
  s.el.click(); assert.equal(await b, "select");
  const c = s.show("nope");
  assert.ok(s.el.classList.contains("sp-night"), "random() 0.9 → night");
  s.el.click(); await c; s.unmount();
});

test("the startup chime is an original cue", () => {
  assert.ok(Array.isArray(CUES.startup) && CUES.startup.length >= 3);
});

const BINDER = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, first: "Char" + (i + 1), name: "Character " + (i + 1), avatar_image_id: i % 5 === 4 ? null : 100 + i }));
const binderFetch = (list = BINDER) => async url => { assert.equal(url, "/hxh/api/db/binder"); return { ok: true, json: async () => list }; };

test("Player Select reads the roster: up to 12 random characters that have an avatar, names in capitals, thumbnails; none when it cannot be read", async () => {
  const picked = await selectRoster(binderFetch(), () => 0.3);
  assert.equal(picked.length, SELECT_TILES);
  assert.ok(picked.every(f => /^CHAR\d+$/.test(f.name) && /^\/hxh\/api\/db\/images\/\d+\/thumb$/.test(f.src)));
  assert.equal(new Set(picked.map(f => f.name)).size, SELECT_TILES, "no fighter twice");
  const withAvatar = new Set(BINDER.filter(c => c.avatar_image_id).map(c => "CHAR" + c.id));
  assert.ok(picked.every(f => withAvatar.has(f.name)), "only characters with an avatar");
  const other = await selectRoster(binderFetch(), () => 0.8);
  assert.notDeepEqual(other.map(f => f.name), picked.map(f => f.name), "a different shuffle for a different draw");
  assert.deepEqual(await selectRoster(async () => ({ ok: false, json: async () => ({}) })), []);
  assert.deepEqual(await selectRoster(async () => { throw new Error("offline"); }), []);
  assert.deepEqual(await selectRoster(null), []);
});

test("Player Select looks the part: PLAYER SELECT, the title, a 12-tile grid, 1P and 2P cursors on different tiles, two fighters with name plates, CREDIT 01, CLICK TO START", async () => {
  const s = new Splash({ reduced: true, random: () => 0.3, fetch: binderFetch() }).mount(document.body);
  const p = s.show("select");
  const el = s.el;
  assert.match(el.textContent, /PLAYER SELECT/);
  assert.match(el.textContent, /HUNTER\s*×\s*HALLOWEEN/);
  assert.match(el.textContent, /CLICK TO START/);
  assert.match(el.textContent, /CREDIT 01/);
  assert.equal(el.querySelectorAll(".sp-grid .sp-tile").length, 12);
  assert.equal(el.querySelectorAll(".sp-tile.p1").length, 1);
  assert.equal(el.querySelectorAll(".sp-tile.p2").length, 1);
  assert.notEqual(el.querySelector(".sp-tile.p1"), el.querySelector(".sp-tile.p2"));
  assert.equal(el.querySelectorAll(".sp-fighter .sp-plate").length, 2);
  await new Promise(r => setTimeout(r, 20));   // the roster arrives; names come with it (pictures once their images load)
  assert.ok([...el.querySelectorAll(".sp-plate")].every(n => /^(CHAR\d+|\?\?\?)$/.test(n.textContent)), [...el.querySelectorAll(".sp-plate")].map(n => n.textContent).join());
  el.click(); await p; s.unmount();
  const bare = new Splash({ reduced: true }).mount(document.body);   // no roster: silhouettes and ???
  const q = bare.show("select");
  assert.equal(bare.el.querySelectorAll(".sp-grid .sp-sil").length, 12);
  assert.ok([...bare.el.querySelectorAll(".sp-plate")].every(n => n.textContent === "???"));
  bare.el.click(); await q; bare.unmount();
});

test("Night: PURPLE SQUARE PRESENTS", async () => {
  const s = new Splash({ reduced: true }).mount(document.body);
  const p = s.show("night");
  assert.match(s.el.textContent, /PURPLE SQUARE PRESENTS/);
  assert.doesNotMatch(s.el.textContent, /HUNTER ASSOCIATION PRESENTS/);
  s.el.click(); await p; s.unmount();
});
