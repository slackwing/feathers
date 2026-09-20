import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { skyPixel, skyColor, skyGradientCSS, clumpNoise, SKY_KEYS, SKY_VARIANTS, GRADUAL_BANDS } from "../html/hxh/os/wallpaper.js";

setupDom();   // cloud sprites reach for the global document (their canvases degrade to empty under jsdom)

const HZ = 112, W = 273;
const shades = variant => { const s = new Set(); for (let y = 0; y < HZ; y++) for (let x = 0; x < W; x++) s.add(skyPixel(variant, x, y, HZ)); return s; };
const rowShades = (variant, y) => { const s = new Set(); for (let x = 0; x < W; x++) s.add(skyPixel(variant, x, y, HZ)); return s; };
const lum = hex => parseInt(hex.slice(1, 3), 16) * 0.3 + parseInt(hex.slice(3, 5), 16) * 0.59 + parseInt(hex.slice(5, 7), 16) * 0.11;

test("skyColor runs through the five keys, zenith to horizon, brighter all the way", () => {
  assert.equal(skyColor(0), SKY_KEYS[0]);
  assert.equal(skyColor(1), SKY_KEYS[4]);
  assert.equal(skyColor(0.5), SKY_KEYS[2]);
  let prev = -1;
  for (let t = 0; t <= 1.0001; t += 0.05) { const l = lum(skyColor(t)); assert.ok(l > prev, `brighter at t=${t}`); prev = l; }
});

test("original: five linear bands, checker-dithered at the boundaries", () => {
  assert.equal(skyPixel("original", 0, 0, HZ), SKY_KEYS[0]);
  assert.equal(shades("original").size, 5);
  const boundary = Math.floor(HZ / 5) - 1;   // last row of the first band, dithered
  assert.equal(rowShades("original", boundary).size, 2);
  assert.equal(rowShades("original", 3).size, 1);
});

test("gradual: eight solid bands on the sky's curve — dark overhead, brightening faster near the horizon; no dithering", () => {
  assert.equal(shades("gradual").size, GRADUAL_BANDS);
  for (let y = 0; y < HZ; y++) assert.equal(rowShades("gradual", y).size, 1, "a row is one shade");
  // the curve: the top band is the tallest, bands get thinner toward the horizon
  const heights = []; let last = null, n = 0;
  for (let y = 0; y < HZ; y++) { const c = skyPixel("gradual", 0, y, HZ); if (c !== last) { if (last) heights.push(n); last = c; n = 0; } n++; }
  heights.push(n);
  assert.equal(heights.length, GRADUAL_BANDS);
  assert.ok(heights[0] > heights[GRADUAL_BANDS - 1] * 1.5, `top band ${heights[0]} rows, horizon band ${heights.at(-1)}`);
});

test("noisy gradual: the same bands, frayed and clumpy at their boundaries only", () => {
  assert.equal(shades("noisy-gradual").size, GRADUAL_BANDS);
  let differ = 0, mids = 0;
  const edges = []; let last = null;
  for (let y = 0; y < HZ; y++) { const c = skyPixel("gradual", 0, y, HZ); if (c !== last) { edges.push(y); last = c; } }
  for (let y = 0; y < HZ; y++) for (let x = 0; x < W; x++) {
    const same = skyPixel("noisy-gradual", x, y, HZ) === skyPixel("gradual", x, y, HZ);
    if (!same) differ++;
    const nearEdge = edges.some(e => Math.abs(y - e) <= 1) || y === 0;
    if (!same && !nearEdge) mids++;
  }
  assert.ok(differ > 300, `fraying happens (${differ} pixels differ)`);
  assert.ok(differ < W * HZ * 0.25, "but most of the sky is untouched");
  // a boundary row shows both shades, and the fray is clumpy: runs of identical decisions along x
  const edgeRow = edges[2] - 1;
  assert.equal(rowShades("noisy-gradual", edgeRow).size, 2);
  let runs = 0, prev = null;
  for (let x = 0; x < W; x++) { const c = skyPixel("noisy-gradual", x, edgeRow, HZ); if (c !== prev) runs++; prev = c; }
  assert.ok(runs < W / 2, `clumps, not a checkerboard (${runs} runs over ${W} px)`);
});

test("gradient: a shade every row; noisy gradient jitters it in clumps; hypergradient paints nothing and hands CSS the curve", () => {
  const rows = new Set(); for (let y = 0; y < HZ; y++) rows.add(skyPixel("gradient", 0, y, HZ));
  assert.ok(rows.size > HZ * 0.8, `${rows.size} distinct rows`);
  for (let y = 0; y < HZ; y++) assert.equal(rowShades("gradient", y).size, 1);
  assert.ok(rowShades("noisy-gradient", 40).size > 3, "a noisy row holds several shades");
  assert.equal(skyPixel("hypergradient", 0, 0, HZ), null);
  const css = skyGradientCSS(HZ, 180);
  assert.match(css, /^linear-gradient\(to bottom, #2456a4 0\.00%, /);
  assert.match(css, /#86c0f0 62\.22%\)$/);   // the horizon row, then the sea covers the rest
  assert.equal((css.match(/#[0-9a-f]{6}/g) || []).length, 13);
});

test("every frame starts from a cleared canvas (the hypergradient sky paints nothing, so clouds and birds would otherwise leave trails)", async () => {
  const { wallpaper } = await import("../html/hxh/os/wallpaper.js");
  const calls = [];
  const ctx2d = () => new Proxy({}, { get: (_, k) => (k === "canvas" ? null : (...a) => { calls.push(k); if (k === "getImageData") return { data: new Uint8ClampedArray(4) }; return undefined; }) });
  const canvas = { style: {}, width: 0, height: 0, getContext: () => ctx2d() };
  const doc = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d() }), hidden: false };
  const anim = wallpaper(canvas, { vw: 1366, vh: 900, reduced: true, doc, sky: "hypergradient" });
  assert.ok(anim);
  assert.match(canvas.style.background, /^linear-gradient/);
  const before = calls.length;
  anim.frame();
  assert.equal(calls[before], "clearRect");
  anim.stop();
});

test("clump noise is smooth and bounded; every variant is listed", () => {
  for (let i = 0; i < 200; i++) { const v = clumpNoise(i * 1.7, i * 0.9); assert.ok(v >= 0 && v <= 1); }
  assert.ok(Math.abs(clumpNoise(10, 10) - clumpNoise(10.5, 10)) < 0.3, "neighbouring values are close");
  assert.deepEqual(SKY_VARIANTS, ["original", "gradual", "noisy-gradual", "hypergradient", "gradient", "noisy-gradient"]);
});
