import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Blimp, FLYER_TEXT, airshipSVG, bannerSVG, SHIP_W, BANNER_W } from "../html/hxh/os/blimp.js";

const d = setupDom();

test("the airship is the show's: a shark-nosed blue hull, the ✕✕ plate, masts along the spine, a cabin with lit windows, an engine pod, fins and turning propellers", () => {
  const svg = airshipSVG();
  assert.match(svg, new RegExp(`viewBox="0 0 ${SHIP_W} `));
  for (const cls of ["hull", "nose", "teeth", "eye", "pupil", "brow", "plate", "masts", "cabin", "windows", "pod", "fins", "outline"]) assert.match(svg, new RegExp(`class="${cls}`), cls);
  assert.equal((svg.match(/<rect x="\d+" y="158"/g) || []).length, 11);   // the cabin's windows
  assert.equal((svg.match(/class="mast"/g) || []).length, 4);
  assert.equal((svg.match(/animateTransform[^>]*rotate/g) || []).length, 2);   // stern and pod propellers turn
  assert.match(svg, /linearGradient/);                 // a lit hull
  assert.doesNotMatch(svg, /class="px"/);             // not pixel art, on purpose
  assert.notEqual(airshipSVG().match(/id="(ship\d+)-hull"/)[1], svg.match(/id="(ship\d+)-hull"/)[1], "each ship's gradient and clip have their own ids");
});

test("the banner ripples: cloth, hem and lettering paths animate through phases; the rope sits on the side that trails", () => {
  const left = bannerSVG(FLYER_TEXT, "left"), right = bannerSVG(FLYER_TEXT, "right");
  assert.equal((left.match(/<animate attributeName="d"/g) || []).length, 3);
  assert.match(left, new RegExp(`<textPath[^>]*dominant-baseline="central"[^>]*>${FLYER_TEXT}</textPath>`));   // centred in the cloth
  assert.match(left, /data-rope="left"/);
  assert.match(left, /class="rope" d="M 0 /);
  assert.match(right, new RegExp(`class="rope" d="M ${BANNER_W} `));
  const values = left.match(/values="([^"]+)"/)[1].split(";");
  assert.equal(values.length, 4);
  assert.equal(values[0], values[3], "the loop returns to its first phase");
  assert.notEqual(values[0], values[1]);
  assert.notEqual(bannerSVG().match(/id="(bwave\d+)"/)[1], left.match(/id="(bwave\d+)"/)[1], "each banner's wave path has its own id");
});

test("a flight is a ship and a banner, west or east, gone when its animation ends", () => {
  const b = new Blimp({ reduced: true, random: () => 0.9 }).mount(document.body);
  const el = b.launch({ dir: -1, top: 10 });
  assert.ok(el.classList.contains("blimp") && el.classList.contains("west"));
  assert.equal(el.style.top, "10%");
  assert.ok(el.querySelector(".ship svg.airship"));
  assert.equal(el.querySelector(".flyer svg.banner").dataset.rope, "left");
  assert.equal(el.querySelector(".flyer textPath").textContent, FLYER_TEXT);
  const east = b.launch({ dir: 1 });
  assert.ok(east.classList.contains("east"));
  assert.equal(east.querySelector(".flyer svg.banner").dataset.rope, "right");
  assert.equal(b.flights, 2);
  el.dispatchEvent(new d.win.Event("animationend"));
  assert.equal(el.isConnected, false);
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
