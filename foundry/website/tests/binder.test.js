import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, tick } from "./dom.js";
import { paginate, binderLayout, TYPES, ARCS, PER_PAGE, LIMIT, typeOf, rankBox, cardNo, firstSentence, BinderApp } from "../html/hxh/apps/binder.js";
import { OS } from "../html/hxh/os/os.js";
import { RegisterApp } from "../html/hxh/apps/register.js";

const mk = (slug, nen = [], arcs = ["hunter-exam"], extra = {}) => ({ slug, name: slug, nen_types: nen, arcs, weapons: [], description: "First. Second.", ...extra });

test("paginate: one group per tab, PER_PAGE cards, untyped filed by first arc", () => {
  const chars = [
    ...Array.from({ length: PER_PAGE + 1 }, (_, i) => mk("en" + i, ["enhancement"])),
    mk("tr", ["transmutation", "emission"]),
    mk("ex1"), mk("ex2"), mk("zo", [], ["zoldyck-family"]),
  ];
  const pages = paginate(chars);
  assert.deepEqual(pages.map(p => p.type.code), ["EN", "EN", "TR", "EX", "ZO"]);
  assert.equal(pages[0].cards.length, PER_PAGE);
  assert.deepEqual([pages[0].n, pages[0].of, pages[1].n, pages[1].of], [1, 2, 2, 2]);
  assert.equal(pages[2].cards[0].slug, "tr");   // first Nen type wins
  assert.equal(pages[3].cards.length, 2);
  assert.equal(pages[4].type.hue, ARCS[1].hex);   // arc tabs use their own hex as hue
  assert.equal(paginate([]).length, 0);
  assert.equal(TYPES.length, 7);
  assert.equal(ARCS.length, 7);
});

test("helpers: typeOf, rankBox, cardNo, firstSentence", () => {
  assert.equal(typeOf(mk("x")).code, "--");
  assert.equal(typeOf(mk("x", ["specialization"])).code, "SP");
  assert.equal(rankBox({ rank: "S" }), "S-1");
  assert.equal(rankBox({}), "C-4");
  assert.equal(LIMIT.A, 2);
  assert.equal(cardNo({ no: 7 }), "007");
  assert.equal(firstSentence("Hello there! And more."), "Hello there!");
  assert.equal(firstSentence("no punctuation"), "no punctuation");
  assert.equal(firstSentence(undefined), "");
});

test("layout maths: the midpoint between the first sizing and the full desktop", () => {
  const l = binderLayout(1366, 900);
  assert.equal(l.bw, Math.round((1366 + 1180) / 2));
  assert.equal(l.bh, Math.min(Math.round((900 - 45 + 780) / 2), 900 - 45 - 46 - 16));
  assert.equal(l.pw, Math.floor((l.bw - 50) / 2));
  assert.equal(l.x, Math.max(16, Math.round((1366 - l.bw) / 2)));
  assert.equal(l.y, Math.max(46, Math.round((900 - 45 - l.bh) / 2)));
  const small = binderLayout(1000, 600);
  assert.equal(small.bw, Math.round((1000 + 952) / 2));
  assert.ok(small.bh <= 600 - 45 - 46 - 16);
});

let d, os;
beforeEach(async () => {
  d = setupDom();
  os = new OS({ win: d.win, fetch: async () => ({ ok: true, json: async () => ({ username: "a" }) }), env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  await os.start({ apps: [[BinderApp, { fetch: null }], RegisterApp], boot: false });
});

test("the Binder window is chromeless with minimize + close, popup, on the taskbar", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  const w = os.wm.get("win-binder");
  assert.ok(w.chromeless && w.props.popup && w.hasTask);
  assert.deepEqual([...w.el.querySelectorAll(".fbtns .tbtn")].map(x => x.title), ["Minimize", "Close"]);
  assert.equal(w.el.querySelector(".bookx"), null);
  assert.equal(w.el.style.getPropertyValue("--bw"), binderLayout(1366, 900).bw + "px");
  assert.equal(w.state.open, true);
  assert.ok(os.taskbar.button("win-binder"));
  d.click(w.el.querySelector(".fbtns .min"));
  assert.equal(w.state.minimized, true);
  await os.launch("binder");
  d.click(w.el.querySelector(".fbtns .close"));
  assert.equal(w.state.open, false);
  assert.ok(b.book.classList.contains("closed"));
});

test("roster → tabs, pages, cards; selection drives the screen; D-pad steps", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  b.setRoster([mk("gon", ["enhancement"], ["hunter-exam"], { name: "Gon Freecss", first: "Gon", name_ja: "ゴン＝フリークス", rank: "S", glyph: "🎣", weapons: ["fishing-rod"], affiliation: "Hunter" }), mk("kil", ["transmutation"]), mk("leo")]);
  assert.equal(b.pages.length, 3);
  const tabs = b.$(".tabs").querySelectorAll(".tab");
  assert.deepEqual([...tabs].map(t => t.textContent), ["EN", "TR", "EX"]);
  assert.ok(tabs[0].classList.contains("on"));
  const cards = b.$(".cards");
  assert.equal(cards.querySelectorAll(".card").length, 1);
  assert.equal(cards.querySelectorAll(".slot").length, PER_PAGE - 1);
  const card = cards.querySelector(".card");
  assert.equal(card.querySelector(".nm").textContent, "Gon");
  assert.equal(card.querySelector(".no").textContent, "001");
  assert.equal(card.querySelector(".rk").textContent, "S-1");
  assert.equal(card.querySelector(".art .ja").textContent, "ゴン");
  assert.equal(card.querySelector(".tx div").textContent, "First.");
  assert.match(b.$(".pageno").textContent, /^1 \/ 3/);
  assert.match(b.$(".screen").innerHTML, /カードを選択/);
  d.click(card);
  assert.equal(b.selected.slug, "gon");
  assert.ok(card.classList.contains("on"));
  const scr = b.$(".screen");
  assert.match(scr.querySelector(".top").textContent, /No\.001「ゴン＝フリークス」/);
  assert.match(scr.querySelector(".line").innerHTML, /Enhancer/);
  assert.match(scr.innerHTML, /Fishing Rod/);
  assert.match(scr.querySelector(".status").textContent, /残り 1枚/);
  assert.equal(scr.querySelector(".desc").textContent, "First. Second.");
  d.click(b.$('[data-dir="down"]'));   // past the last card → next page, first card
  assert.equal(b.page, 1);
  assert.equal(b.selected.slug, "kil");
  d.click(b.$('[data-dir="up"]'));
  assert.equal(b.page, 0);
  assert.equal(b.selected.slug, "gon");
  d.click(b.$('[data-dir="right"]')); d.click(b.$('[data-dir="right"]'));
  assert.equal(b.page, 2);
  assert.equal(b.selected, null);     // selection cleared when its page leaves
  assert.match(scr.innerHTML, /カードを選択/);
  d.click(b.$('[data-dir="left"]'));
  assert.equal(b.page, 1);
  d.click(tabs[0]);
  assert.equal(b.page, 0);
});

test("cover opens (no 3D under reduced motion), CLOSE shuts; CLAIM toasts and opens Registration", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  b.setRoster([mk("gon", ["enhancement"])]);
  d.click(b.$(".cover"));
  assert.ok(b.isOpen);
  assert.equal(b.$(".leaf .page") !== null, true);
  d.click(b.$('[data-act="claim"]'));
  assert.equal(os.toast.body.textContent, "Pick a card first.");
  assert.equal(os.wm.get("win-register"), undefined);
  d.click(b.$(".card"));
  d.click(b.$('[data-act="claim"]'));
  assert.match(os.toast.body.textContent, /gon is a fine choice/);
  assert.equal(os.wm.get("win-register").state.open, true);
  d.click(b.$('[data-act="shut"]'));
  assert.ok(b.book.classList.contains("closed"));
  assert.ok(b.$(".face.back .page"));
  b.$(".cover").dispatchEvent(new d.win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.ok(b.isOpen);
});

test("a failed roster fetch leaves the binder empty; a resize re-places an open binder", async () => {
  const b = os.registry.get("binder");
  b.options.fetch = async () => { throw new Error("net"); };
  await os.launch("binder");
  await b.load();
  assert.equal(b.$(".cards").textContent, "The binder is empty.");
  const w = os.wm.get("win-binder");
  w.el.style.left = "1px";
  os.bus.emit("resize");
  assert.equal(w.el.style.left, binderLayout(1366, 900).x + "px");
  await tick();
});
