import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { cloudBounds, cloudSprite, SHAPES, CLOUDS, islandHeight, glints, glintDensity, bell, wallpaper, Wallpaper, geometry, CANVAS_W, ISLAND_W, hash } from "../html/hxh/os/wallpaper.js";
import { EventBus } from "../html/hxh/os/bus.js";

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

test("geometry: 304 columns so the island is the middle half; height follows the aspect; horizon at 62%", () => {
  const g = geometry(1366, 900);
  assert.equal(g.W, CANVAS_W);
  assert.equal(g.H, Math.round(304 * 900 / 1366));
  assert.equal(g.HZ, Math.round(g.H * 0.62));
  assert.equal(g.OX, 152 - 164);                   // the island's midpoint (164 of 320) lands on the canvas centre
  assert.equal((88 + g.OX) / g.W, (88 - 12) / 304);   // island from 25% …
  assert.ok(Math.abs((240 + g.OX) / g.W - 0.75) < 0.01);   // … to 75% of the view
  const phone = geometry(390, 844);
  assert.equal(phone.W, 304);
  assert.equal(phone.H, Math.round(304 * 844 / 390));   // a tall canvas: extra sky and sea
  assert.ok(phone.H > 600);
  assert.equal(geometry(1, 1e9).H, 1400);   // clamped
});

test("the island: nothing outside 88–240, a hump left of centre, a lower back, a lifted fluke", () => {
  assert.equal(islandHeight(50), 0);
  assert.equal(islandHeight(250), 0);
  const peak = Math.max(...Array.from({ length: ISLAND_W }, (_, x) => islandHeight(x)));
  assert.ok(peak >= 36 && peak <= 42, "peak " + peak);
  assert.ok(islandHeight(134) > islandHeight(200));
  assert.ok(islandHeight(200) >= 6 && islandHeight(200) <= 10, "back " + islandHeight(200));
  assert.ok(islandHeight(229) > islandHeight(205), "fluke lifts");
  assert.equal(islandHeight(134), islandHeight(134));   // deterministic
  assert.equal(hash(3, 4), hash(3, 4));
});

test("glitter is a narrow bell under the horizon, densest at the top centre", () => {
  const g = geometry(1366, 900), { W, H, HZ } = g;
  assert.equal(bell(W / 2, g), 1);
  assert.ok(bell(W / 2 + 40, g) < 0.7 && bell(0, g) < 1e-3);
  const centreTop = glintDensity(W / 2, HZ + 1, g).dens, centreDeep = glintDensity(W / 2, HZ + 30, g).dens, side = glintDensity(20, HZ + 5, g).dens;
  assert.ok(centreTop > centreDeep && centreDeep > side);
  const pts = glints(g);
  assert.ok(pts.length > 2000 && pts.length < 12000, "count " + pts.length);   // ~8k candidates, most dark on any frame
  assert.ok(pts.every(p => p.y >= HZ && p.y < H && p.d <= 0.9 && p.per >= 2 && p.per <= 4));
  const near = pts.filter(p => Math.abs(p.x - W / 2) < 40).length, far = pts.filter(p => Math.abs(p.x - W / 2) > 120).length;
  assert.ok(near > far * 3, `near ${near} far ${far}`);
  const tall = glints(geometry(390, 844));
  assert.ok(tall.every(p => p.y < geometry(390, 844).HZ + 44 + 60), "nothing twinkles far below the bell on a tall canvas");
});

test("wallpaper returns null without a canvas; the component paints for the view and repaints on resize", () => {
  const c = document.createElement("canvas");
  assert.equal(wallpaper(c), null);
  assert.deepEqual([c.width, c.height], [304, geometry(1366, 900).H]);   // sized for the view even without a 2-D context
  assert.equal(wallpaper(null), null);
  const bus = new EventBus();
  let paints = 0;
  const wp = new Wallpaper({ env: { reduced: true, win: { innerWidth: 390, innerHeight: 844 } }, bus });
  const orig = wp.paint.bind(wp);
  wp.paint = () => { paints++; orig(); };
  wp.mount(document.body);
  assert.ok(wp.el.classList.contains("wall"));
  assert.deepEqual([wp.el.width, wp.el.height], [304, geometry(390, 844).H]);
  bus.emit("resize");
  assert.equal(paints, 2);
  wp.unmount();
});
