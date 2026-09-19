import { test } from "node:test";
import assert from "node:assert/strict";
import { fromAnchor, fitAround, refit, moveTo, resize, fitZoom, cropCanvas, roundBox } from "../html/hxh/apps/roster/geometry.js";

const W = 1920, H = 1080;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test("drawing from an anchor: free boxes clamp to the picture, ratio boxes hold their ratio", () => {
  assert.deepEqual(fromAnchor(W, H, 0, 100, 100, 400, 300), { x: 100, y: 100, w: 300, h: 200 });
  assert.deepEqual(fromAnchor(W, H, 0, 400, 300, 100, 100), { x: 100, y: 100, w: 300, h: 200 });   // dragged up-left
  assert.deepEqual(fromAnchor(W, H, 0, 1800, 1000, 3000, 3000), { x: 1800, y: 1000, w: 120, h: 80 });   // past the edge
  const b = fromAnchor(W, H, 1, 100, 100, 500, 200);
  assert.ok(near(b.w, b.h) && b.w === 400, `1:1 follows the longer drag: ${JSON.stringify(b)}`);
  const c = fromAnchor(W, H, 2 / 3, 1800, 100, 1900, 900);
  assert.ok(near(c.w / c.h, 2 / 3) && c.x + c.w <= W, `2:3 shrinks to stay inside: ${JSON.stringify(c)}`);
  const d = fromAnchor(W, H, 16 / 9, 0, 1000, 1900, 1079);
  assert.ok(near(d.w / d.h, 16 / 9) && d.y + d.h <= H, `16:9 near the bottom edge: ${JSON.stringify(d)}`);
});

test("fitAround centres and clamps; refit keeps the centre and shrinks to the new ratio", () => {
  assert.deepEqual(fitAround(W, H, 0, 50, 50, 200, 100), { x: 0, y: 0, w: 200, h: 100 });
  const sq = fitAround(W, H, 1, 960, 540, 4000, 4000);
  assert.deepEqual(sq, { x: 420, y: 0, w: 1080, h: 1080 });
  const r = refit(W, H, 2 / 3, { x: 100, y: 100, w: 600, h: 600 });
  assert.ok(near(r.w / r.h, 2 / 3) && r.h === 600 && near(r.x + r.w / 2, 400), JSON.stringify(r));
  assert.deepEqual(refit(W, H, 0, { x: 1, y: 2, w: 3, h: 4 }), { x: 1, y: 2, w: 3, h: 4 });
});

test("moving clamps inside the picture", () => {
  const b = { x: 0, y: 0, w: 300, h: 200 };
  assert.deepEqual(moveTo(W, H, b, -50, -50), { ...b, x: 0, y: 0 });
  assert.deepEqual(moveTo(W, H, b, 5000, 5000), { ...b, x: 1620, y: 880 });
});

test("resizing by edges and corners, free and ratio-locked", () => {
  const s = { x: 100, y: 100, w: 400, h: 300 };
  assert.deepEqual(resize(W, H, 0, s, "e", 700, 999), { ...s, w: 600 });
  assert.deepEqual(resize(W, H, 0, s, "w", 50, 999), { ...s, x: 50, w: 450 });
  assert.deepEqual(resize(W, H, 0, s, "s", 999, 700), { ...s, h: 600 });
  assert.deepEqual(resize(W, H, 0, s, "n", 999, 0), { ...s, y: 0, h: 400 });
  assert.deepEqual(resize(W, H, 0, s, "se", 800, 700), { x: 100, y: 100, w: 700, h: 600 });
  assert.deepEqual(resize(W, H, 0, s, "nw", 0, 0), { x: 0, y: 0, w: 500, h: 400 });
  const e = resize(W, H, 1, s, "e", 900, 0);
  assert.ok(near(e.w, e.h) && near(e.y + e.h / 2, 250), `1:1 edge resize keeps the centre line: ${JSON.stringify(e)}`);
  const n = resize(W, H, 1, s, "n", 0, 0);
  assert.ok(near(n.w, n.h) && n.y >= 0 && near(n.x + n.w / 2, 300), JSON.stringify(n));
});

test("zoom never exceeds 1; the canvas fits the desktop", () => {
  assert.equal(fitZoom(1920, 1080, 1276, 620), 620 / 1080);
  assert.equal(fitZoom(400, 600, 1276, 665), 1);
  assert.deepEqual(cropCanvas(1920, 1080, 1366, 900), { cw: 1276, ch: 620 });
  assert.deepEqual(cropCanvas(400, 300, 1366, 900), { cw: 400, ch: 300 });
  assert.deepEqual(cropCanvas(100, 100, 300, 300), { cw: 320, ch: 240 });
  assert.deepEqual(roundBox({ x: 1.4, y: 2.6, w: 3.5, h: 4.49 }), { x: 1, y: 3, w: 4, h: 4 });
  assert.equal(roundBox(null), null);
});
