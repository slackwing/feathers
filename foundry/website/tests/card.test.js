import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { GICard, KINDS, LIMIT, cardNo, rankLimit, panelPath, foilURI, fitText, NAME_MAX, NAME_MIN, rgbToHsl, hslToHex, isSkin, isInteresting, interestingPalette, foilFromPalette, CENTER_SIGMA, FOCUS } from "../html/hxh/apps/card.js";

test("numbers and rank-limits print as the cards do", () => {
  assert.equal(cardNo(7), "007");
  assert.equal(cardNo(1039), "1039");
  assert.equal(cardNo(undefined), "000");
  assert.equal(rankLimit("SS"), "SS-1");
  assert.equal(rankLimit("S"), "S-1");
  assert.equal(rankLimit("A"), "A-2");
  assert.equal(rankLimit(""), "C-4");
  assert.deepEqual(LIMIT, { SS: 1, S: 1, A: 2, B: 3, C: 4 });
});

test("the gi-panel gi-outline: four edges bending around four full rings centred on the corners", () => {
  const dPath = panelPath(200, 60, 5);
  assert.match(dPath, /^M 5 0 L 195 0 A 5 5 0 0 0 200 5 L 200 55 A 5 5 0 0 0 195 60 L 5 60 A 5 5 0 0 0 0 55 L 0 5 A 5 5 0 0 0 5 0 Z/);
  assert.equal((dPath.match(/a 5 5 0 1 0/g) || []).length, 8, "four rings, two arcs each");
  assert.match(dPath, /M -5 0 a 5 5 0 1 0 10 0/);   // the ring at the top-left corner
});

test("the foil is a tinted noise SVG per kind", () => {
  for (const k of Object.keys(KINDS)) {
    const u = foilURI(k);
    assert.match(u, /^data:image\/svg\+xml;charset=utf-8,/);
    assert.ok(decodeURIComponent(u).includes(KINDS[k].foil));
    assert.ok(decodeURIComponent(u).includes("feTurbulence"));
  }
  assert.equal(foilURI("nope"), foilURI("restricted"));
});

test("fitText shrinks a long name until it fits, never below the minimum", () => {
  const box = { clientWidth: 100 };
  const el = { style: {}, parentElement: box, get scrollWidth() { return parseFloat(this.style.fontSize) * 9; } };   // 9 px of text per px of font
  const used = fitText(el, 20, 8);
  assert.ok(used < 20 && used >= 8, "shrunk: " + used);
  assert.ok(el.scrollWidth <= 100 - 8, "fits with the side allowance");
  const short = { style: {}, parentElement: box, get scrollWidth() { return 30; } };
  assert.equal(fitText(short, 20, 8), 20);
  const huge = { style: {}, parentElement: box, get scrollWidth() { return 5000; } };
  assert.equal(fitText(huge, 20, 8), 8);
  assert.equal(fitText(null, 20, 8), 0);
  assert.ok(NAME_MAX > NAME_MIN);
});

test("GICard renders the gi-plaque, gi-frame and gi-band from its props alone; kinds pick the foil; no picture → the hatched window", () => {
  const d = setupDom();
  const c = new GICard({ no: 3, name: "Gon Freecss", rank: "S", image: "/hxh/api/db/images/9", description: "A boy.", kind: "restricted" });
  c.mount(d.doc.body);
  const el = c.el;
  assert.ok(el.classList.contains("gicard") && el.classList.contains("kind-restricted"));
  assert.equal(el.dataset.no, "003");
  assert.deepEqual([...el.querySelectorAll(".gi-plaque .gi-panel")].map(p => p.className.replace("gi-panel ", "")), ["no", "name", "rank"]);
  assert.deepEqual([...el.querySelectorAll(".gi-plaque .gi-txt")].map(p => p.textContent), ["003", "Gon Freecss", "S-1"]);
  assert.equal(el.querySelectorAll(".gi-plaque svg.gi-outline").length, 3);
  assert.equal(el.querySelector(".gi-frame .gi-pic img").getAttribute("src"), "/hxh/api/db/images/9");
  assert.equal(el.querySelector(".gi-band .gi-inset .gi-desc").textContent, "A boy.");
  assert.ok(el.querySelector(".gi-body").style.getPropertyValue("--foil").startsWith('url("data:image/svg+xml'));
  const s = new GICard({ no: 1039, name: "Accompany", rank: "C", image: null, kind: "spell", description: "" });
  s.mount(d.doc.body);
  assert.ok(s.el.classList.contains("kind-spell"));
  assert.ok(s.el.querySelector(".gi-frame .gi-pic .gi-nopic"));
  const u = new GICard({ no: 1, name: "X", kind: "bogus" });
  u.mount(d.doc.body);
  assert.ok(u.el.classList.contains("kind-restricted"), "unknown kinds fall back to the red specified-slot card");
});

test("the picture's palette: saturated mid-light hues count, skin / white / black do not; the strongest hue colours the foil, a second hue its veins", () => {
  assert.deepEqual(rgbToHsl(255, 0, 0).map(v => Math.round(v * 100) / 100), [0, 1, 0.5]);
  assert.equal(hslToHex(120, 1, 0.5), "#00ff00");
  assert.equal(hslToHex(0, 0, 1), "#ffffff");
  assert.ok(isSkin(...rgbToHsl(222, 184, 150)), "peach is skin");
  assert.ok(!isInteresting(...rgbToHsl(222, 184, 150)));
  assert.ok(!isInteresting(...rgbToHsl(250, 250, 250)) && !isInteresting(...rgbToHsl(10, 10, 12)) && !isInteresting(...rgbToHsl(120, 120, 120)));
  assert.ok(isInteresting(...rgbToHsl(40, 170, 60)) && isInteresting(...rgbToHsl(200, 30, 40)) && isInteresting(...rgbToHsl(30, 80, 200)));
  const px = [];
  const put = (rgb, n) => { for (let i = 0; i < n; i++) px.push(...rgb, 255); };
  put([40, 170, 60], 120); put([60, 190, 80], 60); put([222, 184, 150], 200); put([250, 250, 250], 300); put([12, 12, 12], 200); put([30, 80, 200], 50);
  const pal = interestingPalette(new Uint8ClampedArray(px));
  assert.equal(pal.count, 230);
  assert.ok(pal.dominant[0] > 110 && pal.dominant[0] < 135, "green wins: " + pal.dominant[0]);
  assert.ok(pal.second && pal.second[0] > 210 && pal.second[0] < 235, "blue is the second hue: " + JSON.stringify(pal.second));
  const f = foilFromPalette(pal);
  assert.match(f.foil, /^#[0-9a-f]{6}$/);
  const [fh] = rgbToHsl(...[1, 3, 5].map(i => parseInt(f.foil.slice(i, i + 2), 16)));
  assert.ok(fh > 110 && fh < 135, "the foil is green: " + f.foil);
  const [lh] = rgbToHsl(...[1, 3, 5].map(i => parseInt(f.foilLo.slice(i, i + 2), 16)));
  assert.ok(lh > 210 && lh < 235, "the veins are blue: " + f.foilLo);
  assert.deepEqual(foilFromPalette({ dominant: null, count: 0 }, "spell"), KINDS.spell);
  assert.deepEqual(interestingPalette(new Uint8ClampedArray([250, 250, 250, 255])), { dominant: null, second: null, count: 0 });
  assert.equal(foilURI({ foil: "#123456", foilHi: "#abcdef", foilLo: "#000000" }).includes(encodeURIComponent("#123456")), true);
});

test("the spotlight: with the picture's layout the hue under the lower third of the frame outvotes a sky that fills the rest (True Bisky's pink dress, not the blue around her)", () => {
  const W = 64, H = 36, px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {   // a blue sky everywhere; a pink dress in the lower middle, a third of the area
    const dress = x >= 20 && x < 44 && y >= 16 && y < 34, i = (y * W + x) * 4;
    px.set(dress ? [214, 60, 120, 255] : [45, 110, 210, 255], i);
  }
  const flat = interestingPalette(px, { width: W, height: H, sigma: 0 });
  assert.ok(flat.dominant[0] > 200 && flat.dominant[0] < 230, "every pixel alike: the sky wins " + flat.dominant[0]);
  const lit = interestingPalette(px, { width: W, height: H });
  assert.ok(lit.dominant[0] > 320 && lit.dominant[0] < 350, "under the spotlight: the dress wins " + lit.dominant[0]);
  assert.ok(lit.second && lit.second[0] > 200 && lit.second[0] < 230, "the sky still veins the foil: " + JSON.stringify(lit.second));
  assert.ok(CENTER_SIGMA > 0 && CENTER_SIGMA < 0.5 && FOCUS > 0.5 && FOCUS < 0.75, "a tight spotlight below the middle");
  const none = new Uint8ClampedArray(W * H * 4).fill(255);
  assert.deepEqual(interestingPalette(none, { width: W, height: H }), { dominant: null, second: null, count: 0 });
});
