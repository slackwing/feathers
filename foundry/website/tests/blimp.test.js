import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { existsSync, readFileSync } from "node:fs";
import { Blimp, FLYER_TEXT, airshipHTML, bannerSVG, ropePath, BRIDLE, SHIP_SRC, SHIP_W, SHIP_H, STERN_Y, ROPE_Y, ROPE_W, ROPE, OVERLAP, FLYER_TOP, FLIGHT_MS, ART_W, ART_H, ART_LINE_W, BANNER_W, CLOTH_TOP, CLOTH_H, CORNER_IN, HOLD, ripple, LETTER_PX, CAP } from "../html/hxh/os/blimp.js";

const d = setupDom();

test("the airship is Abi's drawing: a transparent PNG shipped with the site, at half its first size in its own proportions, nose west", () => {
  const html = airshipHTML();
  assert.match(html, new RegExp(`^<img class="airship" src="${SHIP_SRC}" width="${SHIP_W}" height="${SHIP_H}" alt="" draggable="false"`));
  assert.ok(existsSync(new URL("../html/hxh" + SHIP_SRC.replace(/^\/hxh/, ""), import.meta.url)), "the art is in the repo at " + SHIP_SRC);
  assert.ok(!existsSync(new URL("../html/hxh/img/blimp-px.png", import.meta.url)), "the pixel sprite is gone (Andrew, 2026-09-27)");
  assert.equal(SHIP_W, 240, "half of 480 (Andrew, 2026-09-24: way too big)");
  assert.equal(SHIP_H, Math.round(SHIP_W * ART_H / ART_W), "the art's own aspect");
  assert.ok(STERN_Y > SHIP_H * 0.55 && STERN_Y < SHIP_H * 0.7, "the stern sits a little below the middle of the art: " + STERN_Y);
  assert.equal(FLIGHT_MS, 50000, "twice the first 100 s (Andrew, 2026-09-27: faster)");
});

test("the banner ripples: cloth and lettering paths animate through phases; no hem; the capitals sit centred by their cap height; a two-line bridle on the side that trails", () => {
  const left = bannerSVG(FLYER_TEXT, "left"), right = bannerSVG(FLYER_TEXT, "right");
  assert.equal((left.match(/<animate attributeName="d"/g) || []).length, 2);
  assert.doesNotMatch(left, /class="hem"|data-style/);
  assert.match(left, new RegExp(`<textPath[^>]*text-anchor="middle"[^>]*>${FLYER_TEXT}</textPath>`));
  assert.doesNotMatch(left, /dominant-baseline/);   // Safari ignores it on a textPath: the baseline is placed instead
  const baseline = +left.match(/<defs><path id="bwave\d+" d="M ?[\d.]+ ([\d.]+)/)[1];
  assert.equal(baseline.toFixed(1), (CLOTH_TOP + CLOTH_H / 2 + LETTER_PX * CAP / 2).toFixed(1), "the baseline rides the midline plus half a cap");
  assert.match(left, /data-rope="left"/);
  for (const [svg, x0] of [[left, "0.00"], [right, BANNER_W + ".00"]]) {
    const ropes = [...svg.matchAll(/<path class="rope" d="([^"]+)" stroke-width="([\d.]+)" filter="url\(#bwave\d+-soft\)"/g)];
    assert.equal(ropes.length, 2, "two lines: a bridle (Andrew, 2026-09-27)");
    for (const [, d, w] of ropes) { assert.ok(d.startsWith(`M ${x0} ${ROPE_Y.toFixed(2)} L `), "both from the same point on the art's axis line"); assert.equal(+w, ROPE_W); }
  }
  const values = left.match(/values="([^"]+)"/)[1].split(";");
  assert.equal(values.length, 4);
  assert.equal(values[0], values[3], "the loop returns to its first phase");
  assert.notEqual(values[0], values[1]);
  assert.notEqual(bannerSVG().match(/id="(bwave\d+)"/)[1], left.match(/id="(bwave\d+)"/)[1], "each banner's wave path has its own id");
});

test("the bridle's corners hold still: in every ripple phase the cloth's leading corners sit exactly on the two line ends, both flight directions (Andrew, 2026-09-27: the ends didn't quite touch)", () => {
  assert.equal(CORNER_IN, 0, "each line ends on its corner");
  for (const [rope, lead] of [["left", ROPE], ["right", BANNER_W - ROPE]]) {
    const svg = bannerSVG(FLYER_TEXT, rope);
    const frames = svg.match(/class="cloth"[^>]*><animate attributeName="d" values="([^"]+)"/)[1].split(";");
    const ends = [...svg.matchAll(/<path class="rope" d="([^"]+)"/g)].map(m => m[1].match(/-?[\d.]+/g).map(Number).slice(-2));
    assert.deepEqual(ends.map(e => e[0]), [lead, lead], rope + ": both lines end on the leading edge");
    for (const d of frames) {
      const pts = d.match(/-?[\d.]+ -?[\d.]+/g).map(q => q.split(" ").map(Number));
      const corners = rope === "left" ? [pts[0], pts.at(-1)] : [pts.find(q => q[0] === lead && q[1] < CLOTH_TOP + 1), pts.find(q => q[0] === lead && q[1] > CLOTH_TOP + CLOTH_H - 1)];
      assert.deepEqual(corners, ends, `${rope}: the corners meet the line ends in this frame`);
    }
  }
  const pts = ripple(0, 200, 10, 3, 1.3);
  assert.equal(pts[0][1], 10, "no motion at the held end");
  assert.ok(pts.some(([x, y]) => x > HOLD && Math.abs(y - 10) > 1), "full flapping past HOLD");
  assert.deepEqual(ripple(0, 200, 10, 3, 1.3, 200).at(-1), [200, 10], "the held end can be either side");
});

test("the bridle: two lines from one point on the art's axis line, horizontal out of the stern, tangent-matched bends, straight runs to the cloth's top and bottom leading corners — a symmetric triangle", () => {
  const scale = SHIP_H / ART_H;
  assert.equal(ROPE_W, +(ART_LINE_W * scale).toFixed(2), "each line is exactly as thick as the art's line, as drawn");
  assert.equal(+(FLYER_TOP + ROPE_Y).toFixed(2), STERN_Y, "margin (whole px) + start height (the fraction) = the line's height in the ship's box");
  assert.equal(FLYER_TOP, Math.round(FLYER_TOP));
  assert.deepEqual(BRIDLE, [CLOTH_TOP + CORNER_IN, CLOTH_TOP + CLOTH_H - CORNER_IN]);
  assert.ok(Math.abs((ROPE_Y - BRIDLE[0]) - (BRIDLE[1] - ROPE_Y)) < 1, "the stern meets the cloth's midline: the two lines fan out evenly");
  const parse = d => d.match(/-?[\d.]+/g).map(Number);   // M ax ay L bx by C c1x c1y c2x c2y px py L qx qy
  const [top, bottom] = BRIDLE.map(yq => parse(ropePath("left", yq)));
  assert.deepEqual(top.slice(0, 4), bottom.slice(0, 4), "one shared start and horizontal stretch");
  for (const [yq, n] of [[BRIDLE[0], top], [BRIDLE[1], bottom]]) {
    const [ax, ay, bx, by, c1x, c1y, c2x, c2y, px, py, qx, qy] = n;
    assert.equal(ax, 0); assert.equal(ay, ROPE_Y); assert.equal(by, ay);
    assert.ok(bx > OVERLAP, "the straight start runs past the ship's edge");
    assert.equal(c1y, ay); assert.equal(c2y, ay, "zero curvature where the bend leaves the line (smooth derivatives out of the drawing)");
    assert.ok(bx < c1x && c1x < c2x && c2x < px && px < qx, "control points march toward the banner");
    assert.ok(Math.abs(Math.atan2(py - c2y, px - c2x) - Math.atan2(qy - py, qx - px)) < 0.01, "the bend meets the straight run at the same angle");
    assert.equal(qx, ROPE); assert.equal(qy, yq);
  }
  assert.ok(top[11] < ROPE_Y && bottom[11] > ROPE_Y, "one up to the top corner, one down to the bottom");
  const mirrored = parse(ropePath("right", BRIDLE[0]));
  assert.deepEqual(mirrored.filter((_, i) => i % 2 === 1), top.filter((_, i) => i % 2 === 1), "the right bridle is the left one mirrored");
  assert.equal(mirrored[0], BANNER_W);
});

test("a flight is a ship and a banner, west or east, gone when its animation ends", () => {
  const b = new Blimp({ reduced: true, random: () => 0.9 }).mount(document.body);
  const el = b.launch({ dir: -1, top: 10 });
  assert.ok(el.classList.contains("blimp") && el.classList.contains("west"));
  assert.equal(el.style.top, "10%");
  assert.ok(el.querySelector(".ship img.airship"));
  assert.equal(el.querySelector(".flyer").style.marginTop, FLYER_TOP + "px", "the rope ties on at the stern");
  assert.equal(el.querySelector(".flyer").style.marginLeft, -OVERLAP + "px", "the banner tucks under the ship's box so the rope starts on the art's line");
  assert.equal(el.querySelector(".flyer svg.banner").dataset.rope, "left");
  assert.equal(el.querySelector(".flyer textPath").textContent, FLYER_TEXT);
  const east = b.launch({ dir: 1 });
  assert.ok(east.classList.contains("east"));
  assert.equal(east.querySelector(".flyer svg.banner").dataset.rope, "right");
  assert.equal(east.querySelector(".flyer").style.marginRight, -OVERLAP + "px");
  assert.equal(b.flights, 2);
  el.dispatchEvent(new d.win.Event("animationend"));
  assert.equal(el.isConnected, false);
  b.unmount();
});

test("flying: a ship is up from launch until its animation ends — or, for a hidden tab's stale flight, until it is purged", () => {
  let now = 5_000_000;
  const b = new Blimp({ reduced: true, random: () => 0.5, duration: 100000, now: () => now }).mount(document.body);
  assert.equal(b.flying, false);
  const el = b.launch({ dir: -1 });
  assert.equal(b.flying, true, "launched and still at the edge counts as up");
  el.dispatchEvent(new d.win.Event("animationend"));
  assert.equal(b.flying, false);
  b.launch({ dir: 1 });
  now += 100001;   // the tab was hidden through the whole flight: the element never got its animationend
  assert.equal(b.flying, false, "an overdue flight is purged, not counted");
  assert.equal(b.el.querySelectorAll(".blimp").length, 0);
  b.unmount();
});

test("one flight at a time, none while the page is hidden, overdue flights purged on return (fifty blimps after a night, 2026-09-20)", () => {
  const timers = [];
  const st = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  let now = 1_000_000, hidden = false;
  const doc = { get hidden() { return hidden; }, listeners: {}, addEventListener(t, f) { this.listeners[t] = f; }, removeEventListener() {} };
  const b = new Blimp({ minWait: 1000, maxWait: 1000, random: () => 0.5, duration: 100000, setTimeout: st, clearTimeout: () => {}, doc, now: () => now }).mount(document.body);
  const flights = () => b.el.querySelectorAll(".blimp").length;
  timers[0].fn();
  assert.equal(flights(), 1);
  timers[1].fn();
  assert.equal(flights(), 1, "a second launch lands the first");
  assert.equal(b.flights, 2);
  // the tab goes to the background for a night: bookings keep coming, ships do not
  hidden = true;
  for (let i = 2; i < 40; i++) { now += 1000; timers[i].fn(); }
  assert.equal(b.flights, 2);
  assert.equal(flights(), 1);
  assert.equal(timers.length, 41, "the next flight stays booked");
  // the one left up is long overdue; looking at the page again clears it
  now += 200000;
  doc.listeners.visibilitychange();
  assert.equal(flights(), 1, "still hidden: nothing purged yet");
  hidden = false;
  doc.listeners.visibilitychange();
  assert.equal(flights(), 0);
  timers.at(-1).fn();
  assert.equal(flights(), 1);
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
