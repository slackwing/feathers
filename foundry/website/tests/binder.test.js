import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, tick } from "./dom.js";
import { paginate, binderLayout, TYPES, PER_PAGE, LIMIT, typeOf, rankBox, cardNo, firstSentence, cardText, SOURCE, BinderApp, CARD_W, CARD_RATIO, FILL, GAP, PAD, PAGENO, SPINE, TASKBAR, TABS } from "../html/hxh/apps/binder.js";
import { OS } from "../html/hxh/os/os.js";
import { RegisterApp } from "../html/hxh/apps/register.js";

let nextId = 1;
const mk = (name, nen = [], arcs = ["hunter-exam"], extra = {}) => ({ id: nextId++, name, first: name, rank: "C", nen_types: nen, arcs, arms: [], description: "First. Second.", card_description: "", ...extra });

test("paginate: PER_PAGE cards a page in card-number order (a duplicate number keeps id order), every page a tab, nothing grouped by Nen or arc", () => {
  const chars = Array.from({ length: PER_PAGE + 2 }, (_, i) => mk("c" + i, i % 2 ? ["enhancement"] : [], ["hunter-exam"], { no: PER_PAGE + 2 - i }));   // numbers run against ids
  const pages = paginate(chars);
  assert.equal(pages.length, 2);
  assert.deepEqual([pages[0].n, pages[0].of, pages[1].n, pages[1].of], [1, 2, 2, 2]);
  assert.deepEqual(pages[0].cards.map(c => c.no), Array.from({ length: PER_PAGE }, (_, i) => i + 1));
  assert.deepEqual(pages[1].cards.map(c => c.no), [PER_PAGE + 1, PER_PAGE + 2]);
  assert.equal(paginate([]).length, 0);
  const dup = [mk("a", [], [], { no: 2 }), mk("b", [], [], { no: 2 }), mk("c", [], [], { no: 1 })];
  assert.deepEqual(paginate(dup)[0].cards.map(c => c.name), ["c", "a", "b"]);
  assert.equal(TYPES.length, 7);
});

test("helpers: typeOf, rankBox, cardNo, firstSentence, cardText", () => {
  assert.equal(typeOf(mk("x")).code, "--");
  assert.equal(typeOf(mk("x", ["specialization"])).code, "SP");
  assert.equal(rankBox({ rank: "S" }), "S-1");
  assert.equal(rankBox({}), "C-4");
  assert.equal(LIMIT.A, 2);
  assert.equal(cardNo({ no: 7 }), "007");
  assert.equal(cardNo({ id: 42 }), "042");
  assert.equal(firstSentence("Hello there! And more."), "Hello there!");
  assert.equal(firstSentence("no punctuation"), "no punctuation");
  assert.equal(firstSentence(undefined), "");
  assert.equal(cardText({ card_description: "Short.", description: "Long one. More." }), "Short.");
  assert.equal(cardText({ card_description: "", description: "Long one. More." }), "Long one.");
  assert.equal(SOURCE, "/hxh/api/db/binder");
});

test("layout maths: the card is the anchor in book pixels — a page is exactly 3 × 3 cards, the book two pages and a spine — and one zoom makes the book fill 85% of the desktop", () => {
  const l = binderLayout(2560, 1440);
  assert.equal(l.cw, CARD_W);
  assert.equal(l.ch, Math.round(CARD_W * CARD_RATIO * 100) / 100);
  assert.equal(l.pw, 3 * CARD_W + 2 * GAP + 2 * PAD);
  assert.equal(l.bw, 2 * l.pw + SPINE);
  assert.ok(Math.abs(l.bh - (3 * l.ch + 2 * GAP + 2 * PAD + PAGENO)) < 0.05);
  const byH = FILL * (1440 - TASKBAR) / (l.bh + TABS), byW = FILL * 2560 / l.bw;
  assert.equal(l.zoom, Math.round(Math.min(byH, byW) * 1000) / 1000);
  assert.ok(l.zoom > 1.4, "a 1440-tall desktop shows the book at about 1.5×: " + l.zoom);
  assert.ok(Math.abs((l.bh + TABS) * l.zoom - FILL * (1440 - TASKBAR)) < 2, "height-bound: the book plus its tabs is 85% of the desktop above the taskbar");
  assert.equal(l.x, Math.round((2560 - l.bw * l.zoom) / 2));
  assert.equal(l.y, Math.max(Math.round(TABS * l.zoom), Math.round((1440 - TASKBAR - l.bh * l.zoom) / 2)));
  const small = binderLayout(1366, 900);
  assert.ok(small.zoom < 1 && small.zoom > 0.9, "a 900-tall desktop shrinks the book a little: " + small.zoom);
  assert.equal(small.cw, CARD_W);   // the book's own pixels never change, only the zoom
  const wide = binderLayout(1200, 3000);
  assert.ok(Math.abs(wide.bw * wide.zoom - FILL * 1200) < 2, "width-bound on a narrow tall screen");
});

let d, os, fetched;
beforeEach(async () => {
  d = setupDom();
  fetched = [];
  const fakeFetch = async (url, init) => {
    fetched.push({ url: String(url), init });
    if (String(url).includes("/admin/api/me")) return { ok: true, status: 200, json: async () => ({ username: "a", roles: [{ website: "hxh", role: "guest" }] }) };
    if (String(url) === SOURCE) return { ok: true, status: 200, json: async () => [] };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  os = new OS({ win: d.win, fetch: fakeFetch, env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  await os.start({ apps: [[BinderApp, { fetch: fakeFetch }], RegisterApp], boot: false });
});

test("the Binder window is chromeless with minimize + close, popup, on the taskbar; it reads the Roster DB, not roster.json", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();
  const w = os.wm.get("win-binder");
  assert.ok(w.chromeless && w.props.popup && w.hasTask);
  assert.deepEqual([...w.el.querySelectorAll(".fbtns .tbtn")].map(x => x.title), ["Minimize", "Close"]);
  assert.equal(w.el.style.getPropertyValue("--bw"), binderLayout(1366, 900).bw + "px");
  assert.equal(w.el.style.getPropertyValue("--cardw"), binderLayout(1366, 900).cw + "px");
  assert.equal(w.el.style.zoom, String(binderLayout(1366, 900).zoom));
  assert.ok(fetched.some(f => f.url === SOURCE && f.init?.credentials === "same-origin"), "loads /hxh/api/db/binder with the session cookie");
  assert.ok(!fetched.some(f => f.url.includes("roster.json")));
  d.click(w.el.querySelector(".fbtns .min"));
  assert.equal(w.state.minimized, true);
  await os.launch("binder");
  d.click(w.el.querySelector(".fbtns .close"));
  assert.equal(w.state.open, false);
  assert.ok(b.book.classList.contains("closed"));
});

test("every open re-reads the Roster DB; a roster change while the binder is open reloads it, a closed binder ignores it", async () => {
  const reads = () => fetched.filter(f => f.url === SOURCE).length;
  const before = reads();
  await os.launch("binder");
  await tick();
  assert.ok(reads() > before, "launch reads the roster");
  const afterLaunch = reads();
  os.bus.emit("roster:changed", { id: 1 });
  await tick();
  assert.equal(reads(), afterLaunch + 1, "a change under an open binder reloads it");
  d.click(os.wm.get("win-binder").el.querySelector(".fbtns .close"));
  os.bus.emit("roster:changed", { id: 1 });
  await tick();
  assert.equal(reads(), afterLaunch + 1, "a closed binder stays quiet");
  await os.launch("binder");
  await tick();
  assert.equal(reads(), afterLaunch + 2, "opening again reads again");
});

test("roster → tabs, pages, printed cards; selection drives the screen; D-pad steps", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  nextId = 1;
  b.setRoster([
    mk("Killua Zoldyck", ["transmutation"], ["hunter-exam"], { first: "Killua", avatar_image_id: 30, card_number: 2 }),   // id 1 but No. 2: card_number orders the book, not the id
    mk("Gon Freecss", ["enhancement"], ["hunter-exam"], { first: "Gon", rank: "S", arms: ["fishing-rod"], affiliation: "Hunter", card_description: "A cheerful boy.", card_image_id: 18, avatar_image_id: 12, card_number: 1 }),
    mk("Leorio", [], ["hunter-exam"], { first: "Leorio", card_number: 3 }),
    ...Array.from({ length: PER_PAGE - 2 }, (_, i) => mk("filler" + i, [], ["hunter-exam"], { card_number: 4 + i })),
  ]);
  assert.equal(b.pages.length, 2);
  const tabs = b.$(".tabs").querySelectorAll(".tab");
  assert.deepEqual([...tabs].map(t => t.textContent), ["1", "2"]);
  assert.deepEqual([...tabs].map(t => t.title), ["Page 1 of 2", "Page 2 of 2"]);
  assert.ok(tabs[0].classList.contains("on"));
  const cards = b.$(".cards");
  assert.equal(cards.querySelectorAll(".card").length, PER_PAGE);
  assert.equal(cards.querySelectorAll(".slot").length, 0);
  const card = cards.querySelector(".card .gicard");
  assert.ok(card, "the sleeve holds a printed GICard");
  assert.equal(card.querySelector(".gi-panel.no .gi-txt").textContent, "001");
  assert.equal(card.querySelector(".gi-panel.name .gi-txt").textContent, "Gon Freecss");
  assert.equal(card.querySelector(".gi-panel.rank .gi-txt").textContent, "S-1");
  assert.equal(card.querySelector(".gi-frame img").getAttribute("src"), "/hxh/api/db/images/18");
  assert.equal(card.querySelector(".gi-desc").textContent, "A cheerful boy.");
  assert.ok(card.classList.contains("kind-restricted"));
  assert.equal(b.$(".pageno").textContent, "1 / 2");
  assert.match(b.$(".screen").innerHTML, /カードを選択/);
  d.click(cards.querySelector(".card"));
  assert.equal(b.selected.name, "Gon Freecss");
  assert.ok(cards.querySelector(".card").classList.contains("on"));
  const scr = b.$(".screen");
  assert.match(scr.querySelector(".top").textContent, /No\.001「Gon」/);
  assert.match(scr.querySelector(".line").innerHTML, /Enhancer/);
  assert.match(scr.innerHTML, /Fishing Rod/);
  assert.match(scr.querySelector(".status").textContent, /残り 1枚/);
  assert.equal(scr.querySelector(".desc").textContent, "First. Second.");
  d.click(b.$('[data-dir="down"]'));   // the next card on the page
  assert.equal(b.page, 0);
  assert.equal(b.selected.name, "Killua Zoldyck");
  const k = b.$(".cards .card.on .gicard");
  assert.equal(k.querySelector(".gi-panel.no .gi-txt").textContent, "002");
  assert.equal(k.querySelector(".gi-frame img").getAttribute("src"), "/hxh/api/db/images/30");   // no card picture yet: the avatar stands in
  assert.equal(k.querySelector(".gi-desc").textContent, "First.");                              // no card description: the profile's first sentence
  d.click(b.$('[data-dir="up"]'));
  assert.equal(b.selected.name, "Gon Freecss");
  d.click(b.$('[data-dir="right"]'));
  assert.equal(b.page, 1);
  assert.equal(b.selected, null);     // selection cleared when its page leaves
  assert.equal(b.$(".cards").querySelectorAll(".card").length, 1);
  assert.equal(b.$(".cards").querySelectorAll(".slot").length, PER_PAGE - 1);
  assert.ok(b.$(".cards .card .gicard .gi-nopic"), "no picture at all: the hatched window");
  assert.ok(tabs[1].classList.contains("on") && !tabs[0].classList.contains("on"));
  d.click(b.$('[data-dir="left"]'));
  assert.equal(b.page, 0);
  d.click(tabs[1]);
  assert.equal(b.page, 1);
  d.click(tabs[0]);
  assert.equal(b.page, 0);
});

test("the book's margins drag the window; cards and controls do not", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  b.setRoster([mk("Gon", ["enhancement"])]);
  const w = os.wm.get("win-binder"), el = w.el;
  el.style.left = "100px"; el.style.top = "80px";
  Object.defineProperty(el, "offsetLeft", { value: 100, configurable: true });
  Object.defineProperty(el, "offsetTop", { value: 80, configurable: true });
  Object.defineProperty(el, "offsetWidth", { value: 1000, configurable: true });
  Object.defineProperty(os.desktop.el, "clientWidth", { value: 1366, configurable: true });
  const pd = (target, x, y) => target.dispatchEvent(new d.win.PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y, button: 0 }));
  const pm = (x, y) => b.book.dispatchEvent(new d.win.PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y }));
  const pu = () => b.book.dispatchEvent(new d.win.PointerEvent("pointerup", { bubbles: true }));
  pd(b.$(".cards .card"), 10, 10); pm(50, 50); pu();
  assert.equal(el.style.left, "100px");   // a card press never moves the window
  pd(b.book, 10, 10); pm(50, 42); pu();
  assert.equal(el.style.left, "140px");   // a margin press does, snapped to 4 px
  assert.equal(el.style.top, "112px");
});
