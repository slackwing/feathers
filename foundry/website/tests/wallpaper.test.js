import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { cloudBounds, cloudSprite, SHAPES, CLOUDS, islandHeight, glints, glintDensity, bell, wallpaper, Wallpaper, W, H, HZ, hash } from "../html/hxh/os/wallpaper.js";

setupDom();

test("cloudBounds sizes the canvas around every lobe with a margin, scaled", () => {
  const { lobes, w, h } = cloudBounds([[10, 10, 5], [20, 8, 6]], 1);
  assert.equal(lobes[0][0] - lobes[0][2], 1);            // leftmost lobe starts 1px in
  assert.equal(w, Math.ceil(Math.max(...lobes.map(l => l[0] + l[2]))) + 2);
  assert.equal(h, Math.ceil(Math.max(...lobes.map(l => l[1] + l[2] * 0.85))) + 2);
  const half = cloudBounds([[10, 10, 5], [20, 8, 6]], 0.5);
  assert.ok(half.w < w && half.h < h);
});

test("every hand-written shape keeps its lobes r ≥ 4 and neighbours within reach", () => {
  for (const [name, lobes] of Object.entries(SHAPES)) {
    for (const [, , r] of lobes) assert.ok(r >= 4, `${name}: lobe smaller than 4`);
    for (const [cx, cy, r] of lobes) {
      const near = lobes.some(([x, y, rr]) => (x !== cx || y !== cy) && Math.hypot(x - cx, y - cy) <= r + rr);
      assert.ok(near, `${name}: lobe at ${cx},${cy} is detached`);
    }
  }
  for (const c of CLOUDS) assert.ok(SHAPES[c.shape], c.shape);
});

test("cloudSprite degrades to an empty canvas without 2-D context", () => {
  const c = cloudSprite(SHAPES.puff, { scale: 0.6 });
  assert.equal(c.tagName, "CANVAS");
  assert.deepEqual([c.width, c.height], [cloudBounds(SHAPES.puff, 0.6).w, cloudBounds(SHAPES.puff, 0.6).h]);
});

test("the island: nothing outside 88–240, a hump left of centre, a lower back, a lifted fluke", () => {
  assert.equal(islandHeight(50), 0);
  assert.equal(islandHeight(250), 0);
  const peak = Math.max(...Array.from({ length: W }, (_, x) => islandHeight(x)));
  assert.ok(peak >= 36 && peak <= 42, "peak " + peak);
  assert.ok(islandHeight(134) > islandHeight(200));
  assert.ok(islandHeight(200) >= 6 && islandHeight(200) <= 10, "back " + islandHeight(200));
  assert.ok(islandHeight(229) > islandHeight(205), "fluke lifts");
  assert.equal(islandHeight(134), islandHeight(134));   // deterministic
  assert.equal(hash(3, 4), hash(3, 4));
});

test("glitter is a narrow bell under the horizon, densest at the top centre", () => {
  assert.equal(bell(W / 2), 1);
  assert.ok(bell(W / 2 + 40) < 0.7 && bell(0) < 1e-3);
  const centreTop = glintDensity(W / 2, HZ + 1).dens, centreDeep = glintDensity(W / 2, HZ + 30).dens, side = glintDensity(20, HZ + 5).dens;
  assert.ok(centreTop > centreDeep && centreDeep > side);
  const g = glints();
  assert.ok(g.length > 2000 && g.length < 12000, "count " + g.length);   // ~8k candidates, most dark on any frame
  assert.ok(g.every(p => p.y >= HZ && p.y < H && p.d <= 0.9 && p.per >= 2 && p.per <= 4));
  const near = g.filter(p => Math.abs(p.x - W / 2) < 40).length, far = g.filter(p => Math.abs(p.x - W / 2) > 120).length;
  assert.ok(near > far * 3, `near ${near} far ${far}`);
});

test("wallpaper returns null without a canvas; the Wallpaper component still mounts", () => {
  const c = document.createElement("canvas");
  assert.equal(wallpaper(c), null);
  assert.equal(wallpaper(null), null);
  const wp = new Wallpaper({ env: { reduced: true } }).mount(document.body);
  assert.ok(wp.el.classList.contains("wall"));
  assert.deepEqual([wp.el.width, wp.el.height], [W, H]);
  wp.unmount();
});
