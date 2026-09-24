import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { existsSync, readFileSync } from "node:fs";
import { Blimp, FLYER_TEXT, airshipHTML, bannerSVG, ropePath, SHIP_SRC, SHIP_SRC_PX, SHIP_W, SHIP_H, PX, SPRITE_W, SPRITE_H, PX_LINE_ROW, PX_ROPE_Y, STERN_Y, ROPE_Y, ROPE_W, ROPE, OVERLAP, FLYER_TOP, ART_W, ART_H, ART_LINE_W, BANNER_W, CLOTH_TOP, CLOTH_H, LETTER_PX, CAP } from "../html/hxh/os/blimp.js";

const d = setupDom();

test("the airship is Abi's drawing: a transparent PNG shipped with the site, shown at half its old size in its own proportions, nose west — or its pixel sprite on the wallpaper's 5-px grain", () => {
  const html = airshipHTML();
  assert.match(html, new RegExp(`^<img class="airship" src="${SHIP_SRC}" width="${SHIP_W}" height="${SHIP_H}" alt="" draggable="false"`));
  assert.ok(existsSync(new URL("../html/hxh" + SHIP_SRC.replace(/^\/hxh/, ""), import.meta.url)), "the art is in the repo at " + SHIP_SRC);
  assert.equal(SHIP_W, 240, "half of 480 (Andrew, 2026-09-24: way too big)");
  assert.equal(SHIP_H % PX, 0, "a whole number of grain cells tall");
  assert.ok(Math.abs(SHIP_H - SHIP_W * ART_H / ART_W) <= PX / 2, "the box keeps the art's aspect to within half a cell");
  assert.ok(STERN_Y > SHIP_H * 0.55 && STERN_Y < SHIP_H * 0.7, "the stern sits a little below the middle of the art: " + STERN_Y);
  assert.doesNotMatch(html, /class="px"/);
  const px = airshipHTML("pixelated");
  assert.match(px, new RegExp(`src="${SHIP_SRC_PX}" width="${SHIP_W}" height="${SHIP_H}"`), "the sprite fills the same box");
  const spritePath = new URL("../html/hxh" + SHIP_SRC_PX.replace(/^\/hxh/, ""), import.meta.url);
  assert.ok(existsSync(spritePath), "the sprite is in the repo at " + SHIP_SRC_PX);
  const png = readFileSync(spritePath);   // IHDR: width at 16, height at 20
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [SPRITE_W, SPRITE_H], "the sprite is one pixel per grain cell");
  assert.equal(SPRITE_W * PX, SHIP_W);
  assert.ok(PX_LINE_ROW >= 0 && PX_LINE_ROW < SPRITE_H);
});

test("the banner ripples: cloth and lettering paths animate through phases; no hem; the capitals sit centred by their cap height; the rope sits on the side that trails", () => {
  const left = bannerSVG(FLYER_TEXT, "left"), right = bannerSVG(FLYER_TEXT, "right");
  assert.equal((left.match(/<animate attributeName="d"/g) || []).length, 2);
  assert.doesNotMatch(left, /class="hem"/);   // all orange (Andrew, 2026-09-24)
  assert.match(left, new RegExp(`<textPath[^>]*text-anchor="middle"[^>]*>${FLYER_TEXT}</textPath>`));
  assert.doesNotMatch(left, /dominant-baseline/);   // Safari ignores it on a textPath: the baseline is placed instead
  const baseline = +left.match(/<defs><path id="bwave\d+" d="M ?[\d.]+ ([\d.]+)/)[1];
  assert.equal(baseline.toFixed(1), (CLOTH_TOP + CLOTH_H / 2 + LETTER_PX * CAP / 2).toFixed(1), "the baseline rides the midline plus half a cap");
  assert.match(left, /data-style="original"/);
  const px = bannerSVG(FLYER_TEXT, "left", "pixelated");
  assert.match(px, /data-style="pixelated"/);
  assert.match(px, new RegExp(`class="rope" d="M 0.00 ${PX_ROPE_Y.toFixed(2)} L [^"]*" stroke-width="${PX}" shape-rendering="crispEdges"`), "pixelated: a crisp grain-wide rope on the sprite's own row");
  assert.doesNotMatch(px, /class="rope" [^>]*filter=/);
  assert.equal(+(PX_ROPE_Y + FLYER_TOP).toFixed(2), (PX_LINE_ROW + 0.5) * PX, "…whose centre is the centre of that row in the ship's box");
  assert.match(left, /data-rope="left"/);
  assert.match(left, new RegExp(`class="rope" d="M 0.00 ${ROPE_Y.toFixed(2)} L `));   // the rope starts at the art's axis line, inside the ship's box
  assert.match(right, new RegExp(`class="rope" d="M ${BANNER_W}.00 ${ROPE_Y.toFixed(2)} L `));
  assert.match(left, new RegExp(`class="rope" d="[^"]*" stroke-width="${ROPE_W}"`));
  const values = left.match(/values="([^"]+)"/)[1].split(";");
  assert.equal(values.length, 4);
  assert.equal(values[0], values[3], "the loop returns to its first phase");
  assert.notEqual(values[0], values[1]);
  assert.notEqual(bannerSVG().match(/id="(bwave\d+)"/)[1], left.match(/id="(bwave\d+)"/)[1], "each banner's wave path has its own id");
});

test("the rope continues the art's axis line: same height, a hair wider, horizontal out of the stern, a tangent-matched bend, then a straight edge to the cloth's corner", () => {
  const scale = SHIP_H / ART_H;   // heights scale by the box the browser stretches the art into
  assert.equal(ROPE_W, +(ART_LINE_W * scale).toFixed(2), "the rope is exactly as thick as the art's line, as drawn");
  assert.equal(+(FLYER_TOP + ROPE_Y).toFixed(2), STERN_Y, "margin (whole px) + start height (the fraction) = the line's height in the ship's box");
  assert.match(bannerSVG(), /<path class="rope" [^>]*filter="url\(#bwave\d+-soft\)"/, "the rope is softened to match the downsampled art");
  assert.equal(FLYER_TOP, Math.round(FLYER_TOP));
  const d = ropePath("left");
  const nums = d.match(/-?[\d.]+/g).map(Number);   // M ax ay L bx by C c1x c1y c2x c2y px py L qx qy
  const [ax, ay, bx, by, c1x, c1y, c2x, c2y, px, py, qx, qy] = nums;
  assert.equal(ax, 0); assert.equal(ay, ROPE_Y); assert.equal(by, ay);
  assert.ok(bx > OVERLAP, "the straight start runs past the ship's edge");
  assert.equal(c1y, ay); assert.equal(c2y, ay, "both first control points lie on the line: zero curvature where the bend leaves it (smooth derivatives out of the drawing)");
  assert.ok(bx < c1x && c1x < c2x && c2x < px && px < qx, "control points march toward the banner");
  const tangent = Math.atan2(py - c2y, px - c2x), run = Math.atan2(qy - py, qx - px);
  assert.ok(Math.abs(tangent - run) < 0.01, "the bend meets the straight run at the same angle");
  assert.equal(qx, ROPE); assert.equal(qy, CLOTH_TOP + 2, "the rope ends at the cloth's leading top corner");
  assert.equal(ropePath("left", PX_ROPE_Y).match(/-?[\d.]+/g).map(Number)[1], PX_ROPE_Y, "the pixelated rope starts on the sprite's row instead");
  const mirrored = ropePath("right").match(/-?[\d.]+/g).map(Number);
  assert.deepEqual(mirrored.filter((_, i) => i % 2 === 1), nums.filter((_, i) => i % 2 === 1), "the right rope is the left one mirrored");
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
  // Settings › Display › Blimp: Pixelated re-dresses the ship that is up, and every one after
  assert.equal(b.setStyle("pixelated"), "pixelated");
  assert.ok(east.classList.contains("pixelated"));
  assert.equal(east.querySelector("img.airship").getAttribute("src"), SHIP_SRC_PX);
  assert.equal(east.querySelector("svg.banner").dataset.style, "pixelated");
  assert.equal(east.querySelector("svg.banner").dataset.rope, "right", "the rope stays on the trailing side");
  const next = b.launch({ dir: -1 });
  assert.ok(next.classList.contains("pixelated") && next.querySelector("img.airship").getAttribute("src") === SHIP_SRC_PX);
  assert.equal(b.setStyle("nope"), "original", "unknown styles fall back");
  assert.equal(next.querySelector("img.airship").getAttribute("src"), SHIP_SRC);
  assert.ok(!next.classList.contains("pixelated"));
  const pxFirst = new Blimp({ reduced: true, style: "pixelated" }).mount(document.body);
  assert.ok(pxFirst.launch({ dir: 1 }).classList.contains("pixelated"), "a remembered setting dresses the first flight");
  pxFirst.unmount();
  assert.equal(b.flights, 3);
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
