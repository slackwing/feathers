import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, tick } from "./dom.js";
import { paginate, randomStamp, onPlate, clearOfPlate, STAMP_W, PLATE, STAMP_ROT, BOOKMARK_HINT, STAMPS, binderLayout, TYPES, PER_PAGE, LIMIT, typeOf, rankBox, cardNo, firstSentence, cardText, SOURCE, BinderApp, CARD_W, CARD_RATIO, FILL, GAP, PAD, PAGENO, SPINE, TASKBAR, TABS } from "../html/hxh/apps/binder.js";
import { OS } from "../html/hxh/os/os.js";
import { RegisterApp } from "../html/hxh/apps/register.js";

let nextId = 1;
const mk = (name, nen = [], arcs = ["hunter-exam"], extra = {}) => ({ id: nextId++, name, first: name, rank: "C", nen_types: nen, arcs, arms: [], description: "First. Second.", card_description: "", ...extra });

test("paginate: a bookmark page always comes first (empty or not, one per PER_PAGE bookmarks), then PER_PAGE cards a page in card-number order (a duplicate number keeps id order)", () => {
  const chars = Array.from({ length: PER_PAGE + 2 }, (_, i) => mk("c" + i, i % 2 ? ["enhancement"] : [], ["hunter-exam"], { no: PER_PAGE + 2 - i }));   // numbers run against ids
  const pages = paginate(chars);
  assert.equal(pages.length, 3);
  assert.deepEqual(pages.map(p => p.kind), ["bookmark", "cards", "cards"]);
  assert.deepEqual([pages[0].cards.length, pages[0].n, pages[0].of], [0, 1, 1], "no bookmarks: one empty bookmark page");
  assert.deepEqual([pages[1].n, pages[1].of, pages[2].n, pages[2].of], [1, 2, 2, 2], "card pages number from 1 on their own");
  assert.deepEqual(pages[1].cards.map(c => c.no), Array.from({ length: PER_PAGE }, (_, i) => i + 1));
  assert.deepEqual(pages[2].cards.map(c => c.no), [PER_PAGE + 1, PER_PAGE + 2]);
  assert.deepEqual(paginate([]).map(p => p.kind), ["bookmark"], "an empty binder still has its bookmark page");
  const marked = paginate(chars, chars.slice(0, PER_PAGE + 1).map(c => c.id));
  assert.deepEqual(marked.slice(0, 2).map(p => [p.kind, p.cards.length, p.n, p.of]), [["bookmark", PER_PAGE, 1, 2], ["bookmark", 1, 2, 2]], "ten bookmarks: two bookmark pages");
  assert.deepEqual(marked[0].cards.map(c => c.no).slice(0, 3), [2, 3, 4], "bookmarks keep card-number order (ids 1–10 carry numbers 11 down to 2)");
  const dup = [mk("a", [], [], { no: 2 }), mk("b", [], [], { no: 2 }), mk("c", [], [], { no: 1 })];
  assert.deepEqual(paginate(dup)[1].cards.map(c => c.name), ["c", "a", "b"]);
  assert.equal(TYPES.length, 7);
});

test("randomStamp: on the description box, allowed past its edge, never far from upright, its centre never on the name plate's zone in the lower right", () => {
  for (const r of [0, 0.3, 0.5, 0.999]) {
    const s = randomStamp(() => r);
    assert.ok(s.x >= -8 && s.x <= 84.1 && s.y >= -15 && s.y <= 85.1, JSON.stringify(s));
    assert.ok(Math.abs(s.rotation) <= STAMP_ROT);
    assert.ok(!onPlate(s.x, s.y), JSON.stringify(s));
  }
  assert.deepEqual(randomStamp(() => 0.3), { x: 19.6, y: 15, rotation: -10 });
  // a draw whose centre lands in the zone is thrown away and drawn again
  const rolls = [0.9, 0.9, 0.1, 0.1, 0.5];   // (74.8, 75) is in the zone → (1.2, -5); rotation 0
  assert.deepEqual(randomStamp(() => rolls.shift()), { x: 1.2, y: -5, rotation: 0 });
  assert.equal(rolls.length, 0, "every roll was used");
  // a generator that only ever lands in the zone still ends, nudged clear
  const stuck = randomStamp(() => 0.999);
  assert.ok(!onPlate(stuck.x, stuck.y) && stuck.y === PLATE.y - STAMP_W / 2, JSON.stringify(stuck));
  // the zone is judged by the heart's centre: an edge may overlap it a little
  assert.ok(onPlate(PLATE.x - STAMP_W / 2 + 1, PLATE.y - STAMP_W / 2 + 1));
  assert.ok(!onPlate(PLATE.x - STAMP_W / 2, 80), "centre left of the zone, however low");
  assert.ok(!onPlate(80, PLATE.y - STAMP_W / 2), "centre above the zone, however far right");
  // saved hearts from before the zone existed are moved out by the shorter move
  assert.deepEqual(clearOfPlate({ x: 40, y: 40, rotation: 3 }), { x: 40, y: 40, rotation: 3 }, "outside: untouched");
  assert.deepEqual(clearOfPlate({ x: 70, y: 52, rotation: 3 }), { x: 70, y: 49.5, rotation: 3 }, "barely over the top edge: moves up");
  assert.deepEqual(clearOfPlate({ x: 44, y: 80, rotation: 3 }), { x: 41.5, y: 80, rotation: 3 }, "barely over the left edge: moves left");
});
test("a card's plaque prints the short name; the full name stays on the screen", async () => {
  const { setupDom } = await import("./dom.js"); const { OS } = await import("../html/hxh/os/os.js");
  const d = setupDom();
  const os = new OS({ win: d.win, fetch: async () => ({ ok: true, json: async () => ({ username: "andrew", roles: [{ website: "hxh", role: "admin" }] }) }), env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  const gon = mk("Gon Freecss", ["enhancement"], ["hunter-exam"], { first: "Gon" });
  await os.start({ apps: [[BinderApp, { fetch: async () => ({ ok: true, json: async () => [gon] }) }]], boot: false });
  await os.launch("binder");
  await new Promise(r => setTimeout(r, 20));
  const w = os.wm.get("win-binder");
  assert.equal(w.el.querySelector(".card").title, "Gon Freecss");
  assert.equal(w.el.querySelector(".gi-panel.name .gi-txt").textContent, "Gon");
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

let d, os, fetched, stampsDb;
beforeEach(async () => {
  d = setupDom();
  fetched = [];
  stampsDb = { hearts: [], hearts_mine: [], bookmarks: [] };   // the server's stamp table, as the reader "a" sees it
  const fakeFetch = async (url, init) => {
    fetched.push({ url: String(url), init });
    if (String(url).includes("/admin/api/me")) return { ok: true, status: 200, json: async () => ({ username: "a", roles: [{ website: "hxh", role: "guest" }] }) };
    if (String(url) === SOURCE) return { ok: true, status: 200, json: async () => [] };
    if (String(url) === STAMPS) return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(stampsDb)) };
    const m = String(url).match(/\/hxh\/api\/db\/chars\/(\d+)\/stamp$/);
    if (m && init?.method === "POST") {
      const id = +m[1], body = JSON.parse(init.body);
      const list = body.kind === "heart" ? stampsDb.hearts_mine : stampsDb.bookmarks;
      const on = !list.includes(id);
      if (on) { list.push(id); if (body.kind === "heart") stampsDb.hearts.push({ char_id: id, x: body.x, y: body.y, rotation: body.rotation, by: "a" }); }
      else { list.splice(list.indexOf(id), 1); if (body.kind === "heart") stampsDb.hearts = stampsDb.hearts.filter(h => !(h.char_id === id && h.by === "a")); }   // only the reader's own heart goes
      return { ok: true, status: 200, json: async () => ({ on, ...body, char_id: id }) };
    }
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
  os.live.wake();
  await tick();
  assert.equal(reads(), afterLaunch + 3, "and it re-reads on its own clock while open");
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
  assert.equal(b.pages.length, 3);
  const tabs = b.$(".tabs").querySelectorAll(".tab");
  assert.deepEqual([...tabs].map(t => t.classList.contains("bm") ? "bm" : t.textContent), ["bm", "1", "2"]);
  assert.deepEqual([...tabs].map(t => t.title), ["Bookmarks", "Page 1 of 2", "Page 2 of 2"]);
  assert.ok(tabs[0].querySelector("svg"), "the bookmark tab wears the icon");
  assert.ok(tabs[1].classList.contains("on"), "no bookmarks: the binder opens on page 1");
  d.click(tabs[0]);
  assert.equal(b.$(".cards .hint").textContent, BOOKMARK_HINT);
  assert.equal(b.$(".pageno").textContent, "Bookmarks");
  assert.equal(b.$(".cards").querySelectorAll(".slot").length, PER_PAGE, "nine empty sleeves under the hint");
  d.click(tabs[1]);
  const cards = b.$(".cards");
  assert.equal(cards.querySelectorAll(".card").length, PER_PAGE);
  assert.equal(cards.querySelectorAll(".slot").length, 0);
  const card = cards.querySelector(".card .gicard");
  assert.ok(card, "the sleeve holds a printed GICard");
  assert.equal(card.querySelector(".gi-panel.no .gi-txt").textContent, "001");
  assert.equal(card.querySelector(".gi-panel.name .gi-txt").textContent, "Gon");   // the plaque prints the short name
  assert.equal(card.querySelector(".gi-panel.rank .gi-txt").textContent, "S-1");
  assert.equal(card.querySelector(".gi-frame img").getAttribute("src"), "/hxh/api/db/images/18");
  assert.equal(card.querySelector(".gi-desc").textContent, "A cheerful boy.");
  assert.ok(card.classList.contains("kind-restricted"));
  assert.equal(b.$(".pageno").textContent, "1 / 2");
  assert.ok(tabs[1].classList.contains("on"));
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
  assert.equal(b.page, 1);
  assert.equal(b.selected.name, "Killua Zoldyck");
  const k = b.$(".cards .card.on .gicard");
  assert.equal(k.querySelector(".gi-panel.no .gi-txt").textContent, "002");
  assert.equal(k.querySelector(".gi-frame img").getAttribute("src"), "/hxh/api/db/images/30");   // no card picture yet: the avatar stands in
  assert.equal(k.querySelector(".gi-desc").textContent, "First.");                              // no card description: the profile's first sentence
  d.click(b.$('[data-dir="up"]'));
  assert.equal(b.selected.name, "Gon Freecss");
  d.click(b.$('[data-dir="right"]'));
  assert.equal(b.page, 2);
  assert.equal(b.selected, null);     // selection cleared when its page leaves
  assert.equal(b.$(".cards").querySelectorAll(".card").length, 1);
  assert.equal(b.$(".cards").querySelectorAll(".slot").length, PER_PAGE - 1);
  assert.ok(b.$(".cards .card .gicard .gi-nopic"), "no picture at all: the hatched window");
  assert.ok(tabs[2].classList.contains("on") && !tabs[1].classList.contains("on"));
  d.click(b.$('[data-dir="left"]'));
  assert.equal(b.page, 1);
  d.click(tabs[2]);
  assert.equal(b.page, 2);
  d.click(tabs[1]);
  assert.equal(b.page, 1);
});

test("the panel keys: heart, bookmark, Become (off until registration opens) with their hints; no Claim or Close", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();   // the launch-time load (an empty roster) settles first
  const keys = [...b.$(".keys").querySelectorAll(".key")];
  assert.deepEqual(keys.map(k => k.dataset.act), ["heart", "bookmark", "become"]);
  assert.deepEqual(keys.map(k => k.title), ["I like this character!", "Bookmark for myself", "This is me!"]);
  assert.ok(keys[0].querySelector("svg") && keys[1].querySelector("svg"), "icon keys");
  assert.equal(keys[2].textContent, "BECOME");
  assert.deepEqual(keys.map(k => k.disabled), [true, true, true], "nothing selected: heart and bookmark off; Become off until registration");
  assert.ok(!b.$('[data-act="claim"]') && !b.$('[data-act="shut"]'));
  nextId = 1;
  b.setRoster([mk("Gon", ["enhancement"], ["hunter-exam"], { card_number: 1 })]);
  b.showPage(1);
  d.click(b.$(".cards .card"));
  assert.deepEqual(keys.map(k => k.disabled), [false, false, true]);
});

const settle = () => new Promise(r => setTimeout(r, 30));

test("a heart: one per reader per card, toggled; the key lights while mine is on; every heart is stamped on the card at its saved spot and leans", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();   // the launch-time load (an empty roster) settles first
  nextId = 1;
  stampsDb.hearts = [{ char_id: 1, x: 60, y: 10, rotation: -12 }];   // someone else's heart, already there
  b.stamps = JSON.parse(JSON.stringify(stampsDb));
  b.setRoster([mk("Gon", ["enhancement"], ["hunter-exam"], { card_number: 1 }), mk("Killua", [], ["hunter-exam"], { card_number: 2 })]);
  b.showPage(1);
  const gon = () => b.$('.cards .card[data-id="1"]');
  const stamps = () => [...gon().querySelectorAll(".gi-band .gi-stamps .gi-stamp")];
  assert.equal(stamps().length, 1, "the other reader's heart shows");
  assert.deepEqual([stamps()[0].style.left, stamps()[0].style.top, stamps()[0].style.transform], ["60%", "10%", "rotate(-12deg)"]);
  stampsDb.hearts.push({ char_id: 1, x: 70, y: 70, rotation: 5 });   // a heart saved on the plate: drawn clear of it
  b.stamps = JSON.parse(JSON.stringify(stampsDb));
  b.showPage(1);
  assert.deepEqual(stamps().map(s => [s.style.left, s.style.top]), [["60%", "10%"], ["70%", "49.5%"]]);
  stampsDb.hearts.pop();
  b.stamps = JSON.parse(JSON.stringify(stampsDb));
  b.showPage(1);
  d.click(gon());
  const heart = b.$('[data-act="heart"]');
  assert.ok(!heart.classList.contains("lit"));
  d.click(heart);
  await settle();
  const post = fetched.filter(f => f.url === "/hxh/api/db/chars/1/stamp").at(-1);
  const body = JSON.parse(post.init.body);
  assert.equal(body.kind, "heart");
  assert.ok(Math.abs(body.rotation) <= STAMP_ROT && body.x >= -8 && body.y >= -15, "a random spot within the rules");
  assert.ok(heart.classList.contains("lit"), "lit: my heart is on");
  assert.equal(stamps().length, 2, "mine joined the other one");
  assert.equal(b.selected.id, 1, "the selection stays");
  d.click(heart);
  await settle();
  assert.ok(!heart.classList.contains("lit"), "pressed again: taken back");
  assert.equal(stamps().length, 1);
  assert.deepEqual(stampsDb.hearts_mine, []);
  d.click(b.$('.cards .card[data-id="2"]'));
  assert.ok(!heart.classList.contains("lit"), "another card: not hearted");
});

test("a bookmark: private, toggled; the card appears on the bookmark tab, and leaves it when taken back", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();   // the launch-time load (an empty roster) settles first
  nextId = 1;
  b.setRoster([mk("Gon", ["enhancement"], ["hunter-exam"], { card_number: 1 }), mk("Killua", [], ["hunter-exam"], { card_number: 2 })]);
  b.showPage(1);
  d.click(b.$('.cards .card[data-id="2"]'));
  const bm = b.$('[data-act="bookmark"]');
  d.click(bm);
  await settle();
  assert.deepEqual(JSON.parse(fetched.filter(f => f.url === "/hxh/api/db/chars/2/stamp").at(-1).init.body), { kind: "bookmark", x: 0, y: 0, rotation: 0 });
  assert.ok(bm.classList.contains("lit"));
  assert.equal(b.selected.id, 2, "still selected after the re-page");
  assert.equal(b.page, 1, "bookmarking does not turn the page");
  assert.deepEqual(b.pages[0].cards.map(c => c.id), [2]);
  d.click(b.$(".tabs .tab.bm"));
  assert.equal(b.page, 0);
  assert.deepEqual([...b.$(".cards").querySelectorAll(".card")].map(c => c.dataset.id), ["2"]);
  assert.ok(!b.$(".cards .hint"));
  d.click(b.$('.cards .card[data-id="2"]'));
  assert.ok(bm.classList.contains("lit"), "on the bookmark page the key knows it is bookmarked");
  d.click(bm);
  await settle();
  assert.ok(!bm.classList.contains("lit"));
  assert.equal(b.$(".cards .hint")?.textContent, BOOKMARK_HINT, "the bookmark page is empty again");
  assert.ok(!stampsDb.hearts.length, "a bookmark never draws a heart");
});

test("the book opens on the reader's bookmarks when they have some, else on page 1; a reload keeps the page they turned to", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();   // the launch-time load (an empty roster) settles first
  nextId = 1;
  const roster = [mk("Gon", ["enhancement"], ["hunter-exam"], { card_number: 1 }), mk("Killua", [], ["hunter-exam"], { card_number: 2 })];
  b.setRoster(roster);
  assert.equal(b.page, 1, "no bookmarks: page 1");
  b.stamps = { hearts: [], hearts_mine: [], bookmarks: [2] };
  b.setRoster(roster);
  assert.equal(b.page, 1, "a reload keeps page 1 even once a bookmark exists");
  b.page = null; b.chose = false;   // as at a fresh open
  b.setRoster(roster);
  assert.equal(b.page, 0, "a reader with bookmarks opens on them");
  d.click(b.$(".tabs .tab.bm"));
  b.stamps = { hearts: [], hearts_mine: [], bookmarks: [] };
  b.setRoster(roster);
  assert.equal(b.page, 0, "they turned to the bookmark tab themselves: an empty one still stays");
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
