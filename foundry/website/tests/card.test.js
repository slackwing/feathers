import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./dom.js";
import { GICard, KINDS, LIMIT, cardNo, rankLimit, panelPath, foilURI, fitText, NAME_MAX, NAME_MIN } from "../html/hxh/apps/card.js";

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
