import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { Blimp, FLYER_TEXT, airshipSVG, bannerSVG, SHIP_W, BANNER_W } from "../html/hxh/os/blimp.js";

const d = setupDom();

test("the airship is smooth vector art dressed in theme tokens: hull, stripe, fins, propeller, cabin with six windows", () => {
  const svg = airshipSVG();
  assert.match(svg, new RegExp(`viewBox="0 0 ${SHIP_W} `));
  for (const cls of ["hull", "stripe", "fins", "prop", "cabin", "windows"]) assert.match(svg, new RegExp(`class="${cls}"`), cls);
  assert.equal((svg.match(/<rect x="\d+" y="87"/g) || []).length, 6);
  assert.match(svg, /animateTransform[^>]*rotate/);   // the propeller turns
  assert.doesNotMatch(svg, /class="px"/);             // not pixel art, on purpose
});

test("the banner ripples: cloth, hem and lettering paths animate through phases; the rope sits on the side that trails", () => {
  const left = bannerSVG(FLYER_TEXT, "left"), right = bannerSVG(FLYER_TEXT, "right");
  assert.equal((left.match(/<animate attributeName="d"/g) || []).length, 3);
  assert.match(left, new RegExp(`<textPath[^>]*>${FLYER_TEXT}</textPath>`));
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
