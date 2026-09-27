import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom, fakeFetch } from "./dom.js";
import { Splash, SPLASHES, SPLASH_IDS, randomSplash, selectRoster, SELECT_TILES, moonRoad, GLINT_CYCLE, NIGHT_ISLAND, townWindows, litWindows, WINDOW_LIT, SEA_BANDS, SEA_HORIZON } from "../html/hxh/os/splash.js";
import { CUES } from "../html/hxh/os/sound.js";
import { readFileSync } from "node:fs";
import { TOWN_X, house, ISLAND_H } from "../html/hxh/os/wallpaper.js";

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

test("Night's moon road: nearly the moon's width at the top, thinning with depth, and calm — only a small share of glints change from one frame to the next (Andrew, 2026-09-27: too random and chaotic)", () => {
  const geo = { H: 180, HZ: 130, MX: 230, MR: 20 }, key = p => p[0] + "," + p[1];
  const road = moonRoad(geo, 3.1);
  const rows = y => road.filter(p => p[1] === y);
  const span = ys => { const xs = road.filter(p => ys.includes(p[1])).map(p => p[0]); return Math.max(...xs) - Math.min(...xs); };
  assert.ok(span([131, 132, 133]) >= geo.MR * 1.4, "the top is nearly as wide as the moon: " + span([131, 132, 133]));
  const top = [131, 132, 133, 134, 135].reduce((n, y) => n + rows(y).length, 0), bottom = [175, 176, 177, 178, 179].reduce((n, y) => n + rows(y).length, 0);
  assert.ok(top > bottom * 3, `densest at the top, thinning down: ${top} vs ${bottom}`);
  const tick = 0.18, trials = [1.3, 4.7, 9.1, 22.6];   // the painter's interval, at a few moments
  for (const t0 of trials) {
    const a = new Set(moonRoad(geo, t0).map(key)), b = new Set(moonRoad(geo, t0 + tick).map(key));
    let changed = 0; for (const k of a) if (!b.has(k)) changed++; for (const k of b) if (!a.has(k)) changed++;
    assert.ok(changed / a.size < 0.15, `at t=${t0}: ${changed} of ${a.size} glints changed in one frame`);
  }
  const a = new Set(moonRoad(geo, 5).map(key)), later = new Set(moonRoad(geo, 5 + GLINT_CYCLE * 2).map(key));
  assert.ok([...a].filter(k => !later.has(k)).length > a.size * 0.3, "over a couple of cycles the whole road has moved on: it shimmers");
});

test("Night's island is the desktop's, pixel for pixel, at night: every colour the wallpaper paints the island with has a night tone; most of the town's windows are lit (Andrew, 2026-09-27)", () => {
  const src = readFileSync(new URL("../html/hxh/os/wallpaper.js", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("export function islandLayer"), src.indexOf("/* ---------- glitter"));
  const used = new Set((body.match(/#[0-9a-f]{6}/gi) || []).map(c => c.toLowerCase()));
  for (const c of used) assert.ok(NIGHT_ISLAND[c], "no night tone for the island's " + c);
  for (const [day, night] of Object.entries(NIGHT_ISLAND)) {
    const lum = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)).reduce((a, b) => a + b);
    assert.ok(lum(night) < lum(day) || lum(night) - lum(day) <= 12, `${day} → ${night} is darker (near-black ink may only shift hue)`);
  }
  const wins = townWindows();
  assert.equal(wins.length, TOWN_X.length * 3, "three windows a house");
  TOWN_X.forEach((x, i) => {
    const { w, top } = house(x, i);
    for (const [wx, wy] of wins.filter(([a]) => a >= x && a < x + w)) {
      assert.ok(wy > top && wy <= ISLAND_H - 2, "a window is in the wall, under the roof");
      assert.ok(!(wx === x + 1 && wy === ISLAND_H - 2), "not the door");
    }
  });
  const lit = litWindows();
  assert.ok(lit.length >= wins.length * (WINDOW_LIT - 0.15) && lit.length < wins.length, `most, not all, are lit: ${lit.length} of ${wins.length}`);
  assert.deepEqual(litWindows(), lit, "the same windows every visit");
});

test("the night sea is purple like the sky, not blue, and darker: lightest under the horizon, darkening toward us (Andrew, 2026-09-27)", () => {
  const rgb = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  for (const c of [...SEA_BANDS, SEA_HORIZON]) { const [r, g, b] = rgb(c); assert.ok(r > g && b > r, c + " is a purple (red over green, blue on top)"); }
  const lum = h => rgb(h).reduce((a, b) => a + b);
  for (let i = 1; i < SEA_BANDS.length; i++) assert.ok(lum(SEA_BANDS[i]) < lum(SEA_BANDS[i - 1]), "darker toward us");
  assert.ok(lum(SEA_BANDS[0]) < lum("#321a60"), "the sea is darker than the sky at the horizon");
});

test("a double-click that opened a splash does not close it: its second click (detail 2) is ignored; a single click then dismisses", async () => {
  const s = new Splash({ reduced: true }).mount(document.body);
  const p = s.show("select", { prompt: "COMING SOON" });
  s.el.dispatchEvent(new d.win.MouseEvent("click", { bubbles: true, detail: 2 }));
  assert.equal(s.el.hidden, false, "the double-click's second click lands on the splash and is ignored");
  s.el.dispatchEvent(new d.win.MouseEvent("click", { bubbles: true, detail: 1 }));
  assert.equal(await p, "select");
  assert.equal(s.el.hidden, true);
  s.unmount();
});
