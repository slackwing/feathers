import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, tick } from "./dom.js";
import { paginate, randomStamp, randomPlate, onPlate, clearOfPlate, STAMP_W, PLATE, STAMP_ROT, BOOKMARK_HINT, STAMPS, binderLayout, TYPES, PER_PAGE, LIMIT, typeOf, rankBox, cardNo, firstSentence, cardText, SOURCE, BinderApp, CARD_W, CARD_RATIO, FILL, GAP, PAD, PAGENO, SPINE, TASKBAR, TABS, DRAG_SLOP, TYPE_MS } from "../html/hxh/apps/binder.js";
import { OS } from "../html/hxh/os/os.js";

let nextId = 1;
// where the reader is: "claimed", "bookmark", or the page number; and the index of page 1 (the claimed and bookmark pages come first)
const at = b => { const p = b.pages[b.page]; return p.kind === "cards" ? p.n : p.kind; };
const page1 = b => b.pages.findIndex(p => p.kind === "cards");
const mk = (name, nen = [], arcs = ["hunter-exam"], extra = {}) => ({ id: nextId++, name, first: name, rank: "C", nen_types: nen, arcs, arms: [], description: "First. Second.", card_description: "", ...extra });

test("paginate: the claimed cards get their own pages at the FRONT — card-number order, nine to a page, a second past nine claimants (Andrew, 2026-09-27; first since 2026-09-28)", () => {
  const chars = Array.from({ length: 25 }, (_, i) => mk("c" + i, [], ["hunter-exam"], { no: i + 1 }));
  const claimed = chars.slice(0, 11).map(c => c.id).reverse();   // eleven claimants, in any order
  const pages = paginate(chars, [], claimed);
  const cl = pages.filter(p => p.kind === "claimed");
  assert.deepEqual(cl.map(p => [p.cards.length, p.n, p.of]), [[PER_PAGE, 1, 2], [2, 2, 2]]);
  assert.deepEqual(cl[0].cards.map(c => c.no).slice(0, 3), [1, 2, 3], "card-number order");
  assert.deepEqual(pages.slice(0, 3).map(p => p.kind), ["claimed", "claimed", "bookmark"], "the first tabs, then the bookmarks");
  assert.deepEqual(paginate(chars, [], []).filter(p => p.kind === "claimed").map(p => p.cards.length), [0], "nobody has claimed yet: one empty claimed page");
});

test("the tabs: 31 book pixels each (was 40), so fourteen fit one row of the page's 474 — the claimed tab leads the row, a yellow star (Andrew, 2026-09-28: no tab floating off to the right)", async () => {
  const fs = await import("node:fs");
  const css = fs.readFileSync(new URL("../html/hxh/apps/binder.css", import.meta.url), "utf8");
  const w = +css.match(/\.tab \{[^}]*?width: (\d+)px/)[1];
  const gap = +css.match(/\.tabs \{[^}]*?gap: (\d+)px/)[1];
  const row = 3 * 150 + 2 * 12 + 2 * 20 - 2 * 20;   // the page's width less the strip's insets
  assert.equal(w, 31);
  assert.ok(14 * w + 13 * gap <= row, `fourteen tabs fit one row: ${14 * w + 13 * gap} of ${row}`);
  assert.doesNotMatch(css, /margin-left: auto/, "no tab pushed off to the right");
  const { hasIconPair, ICONS } = await import("../html/hxh/os/icons.js");
  assert.ok(hasIconPair("star") && ICONS.star.join("").includes("Y") && !ICONS.star.join("").includes("r"), "a 16×16 yellow star, no red");
});

test("paginate: after the claimed page, a bookmark page always (empty or not, one per PER_PAGE bookmarks), then PER_PAGE cards a page in card-number order (a duplicate number keeps id order)", () => {
  const chars = Array.from({ length: PER_PAGE + 2 }, (_, i) => mk("c" + i, i % 2 ? ["enhancement"] : [], ["hunter-exam"], { no: PER_PAGE + 2 - i }));   // numbers run against ids
  const pages = paginate(chars);
  assert.equal(pages.length, 4);
  assert.deepEqual(pages.map(p => p.kind), ["claimed", "bookmark", "cards", "cards"], "the claimed page comes first, always at least one");
  assert.deepEqual([pages[1].cards.length, pages[1].n, pages[1].of], [0, 1, 1], "no bookmarks: one empty bookmark page");
  assert.deepEqual([pages[2].n, pages[2].of, pages[3].n, pages[3].of], [1, 2, 2, 2], "card pages number from 1 on their own");
  assert.deepEqual(pages[2].cards.map(c => c.no), Array.from({ length: PER_PAGE }, (_, i) => i + 1));
  assert.deepEqual(pages[3].cards.map(c => c.no), [PER_PAGE + 1, PER_PAGE + 2]);
  assert.deepEqual(paginate([]).map(p => p.kind), ["claimed", "bookmark"], "an empty binder still has its claimed page and its bookmark page");
  const marked = paginate(chars, chars.slice(0, PER_PAGE + 1).map(c => c.id));
  assert.deepEqual(marked.slice(1, 3).map(p => [p.kind, p.cards.length, p.n, p.of]), [["bookmark", PER_PAGE, 1, 2], ["bookmark", 1, 2, 2]], "ten bookmarks: two bookmark pages");
  assert.deepEqual(marked[1].cards.map(c => c.no).slice(0, 3), [2, 3, 4], "bookmarks keep card-number order (ids 1–10 carry numbers 11 down to 2)");
  const dup = [mk("a", [], [], { no: 2 }), mk("b", [], [], { no: 2 }), mk("c", [], [], { no: 1 })];
  assert.deepEqual(paginate(dup)[2].cards.map(c => c.name), ["c", "a", "b"]);
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
  stampsDb = { hearts: [], hearts_mine: [], bookmarks: [], claims: [] };   // the server's stamp table, as the reader "a" sees it
  const fakeFetch = async (url, init) => {
    fetched.push({ url: String(url), init });
    if (String(url).includes("/admin/api/me")) return { ok: true, status: 200, json: async () => ({ username: "a", roles: [{ website: "hxh", role: "guest" }] }) };
    if (String(url) === SOURCE) return { ok: true, status: 200, json: async () => [] };
    if (String(url) === STAMPS) return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(stampsDb)) };
    const m = String(url).match(/\/hxh\/api\/db\/chars\/(\d+)\/stamp$/);
    if (m && init?.method === "POST") {
      const id = +m[1], body = JSON.parse(init.body);
      if (body.kind === "claim") {
        const mine = stampsDb.claims.find(c => c.char_id === id && c.username === "a");
        if (mine) { stampsDb.claims = stampsDb.claims.filter(c => c !== mine); return { ok: true, status: 200, json: async () => ({ on: false }) }; }
        const other = stampsDb.claims.find(c => c.char_id === id);
        if (other) return { ok: false, status: 409, json: async () => ({ error: "claimed by " + other.label }) };
        stampsDb.claims = stampsDb.claims.filter(c => c.username !== "a");
        stampsDb.claims.push({ char_id: id, username: "a", label: "READER A", x: body.x, y: body.y, rotation: body.rotation });
        return { ok: true, status: 200, json: async () => ({ on: true }) };
      }
      const list = body.kind === "heart" ? stampsDb.hearts_mine : stampsDb.bookmarks;
      const on = !list.includes(id);
      if (on) { list.push(id); if (body.kind === "heart") stampsDb.hearts.push({ char_id: id, x: body.x, y: body.y, rotation: body.rotation, by: "a" }); }
      else { list.splice(list.indexOf(id), 1); if (body.kind === "heart") stampsDb.hearts = stampsDb.hearts.filter(h => !(h.char_id === id && h.by === "a")); }   // only the reader's own heart goes
      return { ok: true, status: 200, json: async () => ({ on, ...body, char_id: id }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  os = new OS({ win: d.win, fetch: fakeFetch, env: { reduced: true, floating: () => true, zoom: () => 1, width: 1366, height: 900, wait: () => Promise.resolve() } });
  await os.start({ apps: [[BinderApp, { fetch: fakeFetch }]], boot: false });
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
  assert.equal(b.pages.length, 4);
  const all = b.$(".tabs").querySelectorAll(".tab");
  assert.deepEqual([...all].map(t => t.classList.contains("bm") ? "bm" : t.classList.contains("claimed") ? "claimed" : t.textContent), ["claimed", "bm", "1", "2"]);
  assert.deepEqual([...all].map(t => t.title), ["Claimed", "Bookmarks", "Page 1 of 2", "Page 2 of 2"]);
  assert.ok(all[0].querySelector("svg"), "the claimed tab wears the star");
  const tabs = [...all].slice(1);   // bookmarks, 1, 2: the indexes below
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
  assert.equal(at(b), 1);
  assert.equal(b.selected.name, "Killua Zoldyck");
  const k = b.$(".cards .card.on .gicard");
  assert.equal(k.querySelector(".gi-panel.no .gi-txt").textContent, "002");
  assert.equal(k.querySelector(".gi-frame img").getAttribute("src"), "/hxh/api/db/images/30");   // no card picture yet: the avatar stands in
  assert.equal(k.querySelector(".gi-desc").textContent, "First.");                              // no card description: the profile's first sentence
  d.click(b.$('[data-dir="up"]'));
  assert.equal(b.selected.name, "Gon Freecss");
  d.click(b.$('[data-dir="right"]'));
  assert.equal(at(b), 2);
  assert.equal(b.selected, null);     // selection cleared when its page leaves
  assert.equal(b.$(".cards").querySelectorAll(".card").length, 1);
  assert.equal(b.$(".cards").querySelectorAll(".slot").length, PER_PAGE - 1);
  assert.ok(b.$(".cards .card .gicard .gi-nopic"), "no picture at all: the hatched window");
  assert.ok(tabs[2].classList.contains("on") && !tabs[1].classList.contains("on"));
  d.click(b.$('[data-dir="left"]'));
  assert.equal(at(b), 1);
  d.click(tabs[2]);
  assert.equal(at(b), 2);
  d.click(tabs[1]);
  assert.equal(at(b), 1);
});

const settle = () => new Promise(r => setTimeout(r, 30));

test("the panel keys: heart, bookmark, Claim and ? — Claim (off until registration opens) with their hints; no Claim or Close", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();   // the launch-time load (an empty roster) settles first
  const keys = [...b.$(".keys").querySelectorAll(".key")];
  assert.deepEqual(keys.map(k => k.dataset.act), ["heart", "bookmark", "claim", "claim-info"]);
  assert.deepEqual(keys.map(k => k.title), ["I like this character!", "Bookmark for myself", "This is me!", "About claiming"]);
  assert.ok(keys[0].querySelector("svg") && keys[1].querySelector("svg"), "icon keys");
  assert.equal(keys[2].textContent, "CLAIM");
  assert.equal(keys[3].textContent, "?");
  assert.deepEqual(keys.map(k => k.disabled), [true, true, true, false], "nothing selected: heart, bookmark and Claim off; ? always on");
  assert.ok(!b.$('[data-act="become"]') && !b.$('[data-act="shut"]'));
  nextId = 1;
  b.setRoster([mk("Gon", ["enhancement"], ["hunter-exam"], { card_number: 1 })]);
  b.showPage(page1(b));
  d.click(b.$(".cards .card"));
  assert.deepEqual(keys.map(k => k.disabled), [false, false, false, false]);
  d.click(keys[3]);
  await tick();
  const dlg = os.wm.all().find(x => x.props?.cls?.includes("dlg"));
  assert.ok(dlg && dlg.state.open && dlg.title === "Claim");
  assert.equal(dlg.$(".q").textContent, "Claim the character you plan to show up as!");
  assert.equal(dlg.el.querySelectorAll(".pts li").length, 3);
  assert.deepEqual([...dlg.el.querySelectorAll(".actions .btn")].map(x => x.textContent), ["OK"]);
  d.click(dlg.$('[data-act="ok"]'));
});

test("a claim: the question with Claim / Not Yet / Bookmark Instead; a claim prints the reader's name in the card's corner; one per reader (a new claim moves), one per card (another's is refused); pressing again releases", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();
  nextId = 1;
  b.me = "a";
  b.setRoster([mk("Gon", ["enhancement"], ["hunter-exam"], { card_number: 1 }), mk("Killua", [], ["hunter-exam"], { card_number: 2 }), mk("Leorio", [], ["hunter-exam"], { card_number: 3 })]);
  b.showPage(page1(b));
  const card = id => b.$(`.cards .card[data-id="${id}"]`);
  const claim = b.$('[data-act="claim"]');
  d.click(card(1));
  d.click(claim);
  await tick();
  let dlg = os.wm.all().find(x => x.props?.cls?.includes("dlg") && x.state.open);
  assert.ok(dlg && dlg.title === "Claim Gon?");
  assert.deepEqual([...dlg.el.querySelectorAll(".actions .btn")].map(x => x.textContent), ["Claim", "Not Yet", "Bookmark Instead"]);
  assert.equal(dlg.$(".q").textContent, "Claim the character you plan to show up as!", "the same words as the ? box");
  d.click(dlg.$('[data-act="cancel"]'));
  await settle();
  assert.equal(stampsDb.claims.length, 0, "Not Yet claims nothing");
  d.click(claim);
  await tick();
  dlg = os.wm.all().find(x => x.props?.cls?.includes("dlg") && x.state.open);
  d.click(dlg.$('[data-act="bookmark"]'));
  await settle();
  assert.deepEqual(stampsDb.bookmarks, [1], "Bookmark Instead bookmarks");
  assert.equal(stampsDb.claims.length, 0);
  d.click(card(1));
  d.click(claim);
  await tick();
  dlg = os.wm.all().find(x => x.props?.cls?.includes("dlg") && x.state.open);
  d.click(dlg.$('[data-act="ok"]'));
  await settle();
  assert.deepEqual(stampsDb.claims.map(c => c.char_id), [1]);
  const plate = card(1).querySelector(".gi-stamps .gi-claim");
  assert.ok(plate, "the name plate is on the card");
  assert.equal(plate.textContent, "READER A");
  const x = parseFloat(plate.style.left), y = parseFloat(plate.style.top);
  assert.ok(x >= 84 && x <= 91 && y >= 78 && y <= 85, "its bottom-right corner sits well inside the box's corner (2026-09-27): " + plate.style.left + " " + plate.style.top);
  assert.ok(/translate\(-100%, -100%\)/.test(plate.style.transform), "hung from its bottom-right corner, so a long name grows into the box");
  assert.ok(claim.classList.contains("lit") && !claim.disabled);
  assert.equal(claim.title, "This is you! Press again to release");
  // a new claim moves the old one
  d.click(card(2));
  assert.ok(!claim.classList.contains("lit"));
  d.click(claim);
  await tick();
  dlg = os.wm.all().find(x => x.props?.cls?.includes("dlg") && x.state.open);
  d.click(dlg.$('[data-act="ok"]'));
  await settle();
  assert.deepEqual(stampsDb.claims.map(c => c.char_id), [2], "the claim moved");
  assert.ok(!card(1).querySelector(".gi-claim") && card(2).querySelector(".gi-claim"));
  // another reader's claim: the key is off and says whose
  stampsDb.claims.push({ char_id: 3, username: "b", label: "READER B", x: 55, y: 70, rotation: 3 });
  b.stamps = JSON.parse(JSON.stringify(stampsDb));
  b.setRoster(b.roster.map(c => ({ ...c })));
  d.click(card(3));
  assert.ok(claim.disabled, "someone else holds it");
  assert.equal(claim.title, "Claimed by READER B");
  assert.equal(card(3).querySelector(".gi-claim").textContent, "READER B");
  // pressing again on my own releases it
  d.click(card(2));
  d.click(claim);
  await settle();
  assert.deepEqual(stampsDb.claims.map(c => c.char_id), [3], "released");
  assert.ok(!card(2).querySelector(".gi-claim") && !claim.classList.contains("lit"));
});

test("a live re-read keeps the selected card and does not retype the screen; an unchanged re-read touches nothing", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();
  nextId = 1;
  const roster = [mk("Gon", ["enhancement"], ["hunter-exam"], { card_number: 1 }), mk("Killua", [], ["hunter-exam"], { card_number: 2 })];
  b.setRoster(roster);
  b.showPage(page1(b));
  d.click(b.$('.cards .card[data-id="2"]'));
  assert.equal(b.selected.id, 2);
  const scr = b.$(".screen").innerHTML, el = b.$('.cards .card[data-id="2"]');
  b.setRoster(roster.map(c => ({ ...c })));   // the same content again, as the clock does
  assert.equal(b.$('.cards .card[data-id="2"]'), el, "nothing changed: the page was not rebuilt");
  assert.equal(b.selected.id, 2);
  b.setRoster(roster.map(c => ({ ...c, version: 9 })));   // something changed: rebuilt, but the selection stays and the screen is not retyped
  assert.notEqual(b.$('.cards .card[data-id="2"]'), el, "rebuilt");
  assert.equal(b.selected.id, 2, "the selection survived the rebuild");
  assert.ok(b.$('.cards .card[data-id="2"]').classList.contains("on"));
  assert.equal(b.$(".screen").innerHTML, scr, "the screen was left alone");
  assert.ok(!b.$('[data-act="heart"]').disabled);
});

test("an iPad turning — the Binder's or the desktop's zoom changes — rebuilds the page's cards, selection kept, screen not retyped; the same scale touches nothing (Andrew, 2026-09-27: cards drawn at half size in full-size slots on Abi's iPad)", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();
  nextId = 1;
  b.setRoster([mk("Gon", ["enhancement"], ["hunter-exam"], { card_number: 1 }), mk("Killua", [], ["hunter-exam"], { card_number: 2 })]);
  b.showPage(page1(b));
  d.click(b.$('.cards .card[data-id="2"]'));
  const scr = b.$(".screen").innerHTML, el = () => b.$('.cards .card[data-id="2"]'), first = el();
  b.layout();   // a resize that changes nothing
  assert.equal(el(), first, "same scale: the cards are left alone");
  const env = os.env, keep = { width: env.width, height: env.height, zoom: env.zoom };
  try {
    env.width = 820; env.height = 1180;   // landscape → portrait: the Binder's zoom changes
    const z0 = b.win.el.style.zoom;
    b.layout();
    assert.notEqual(b.win.el.style.zoom, z0);
    const turned = el();
    assert.notEqual(turned, first, "a new zoom: fresh card elements, sized from scratch");
    assert.equal(b.selected.id, 2, "the selection survives");
    assert.ok(turned.classList.contains("on"));
    assert.equal(b.$(".screen").innerHTML, scr, "the screen is not retyped");
    assert.equal(b.$(".cards").querySelectorAll(".card").length, 2);
    env.zoom = () => 0.9;   // the desktop's own zoom (the whale rule) alone changes
    b.layout();
    assert.notEqual(el(), turned, "the desktop's zoom counts too");
  } finally { Object.assign(env, keep); b.layout(); }
});

test("a heart: one per reader per card, toggled; the key lights while mine is on; every heart is stamped on the card at its saved spot and leans", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();   // the launch-time load (an empty roster) settles first
  nextId = 1;
  stampsDb.hearts = [{ char_id: 1, x: 60, y: 10, rotation: -12 }];   // someone else's heart, already there
  b.stamps = JSON.parse(JSON.stringify(stampsDb));
  b.setRoster([mk("Gon", ["enhancement"], ["hunter-exam"], { card_number: 1 }), mk("Killua", [], ["hunter-exam"], { card_number: 2 })]);
  b.showPage(page1(b));
  const gon = () => b.$('.cards .card[data-id="1"]');
  const stamps = () => [...gon().querySelectorAll(".gi-band .gi-stamps .gi-stamp")];
  assert.equal(stamps().length, 1, "the other reader's heart shows");
  assert.deepEqual([stamps()[0].style.left, stamps()[0].style.top, stamps()[0].style.transform], ["60%", "10%", "rotate(-12deg)"]);
  stampsDb.hearts.push({ char_id: 1, x: 70, y: 70, rotation: 5 });   // a heart saved on the plate: drawn clear of it
  b.stamps = JSON.parse(JSON.stringify(stampsDb));
  b.showPage(page1(b));
  assert.deepEqual(stamps().map(s => [s.style.left, s.style.top]), [["60%", "10%"], ["70%", "49.5%"]]);
  stampsDb.hearts.pop();
  b.stamps = JSON.parse(JSON.stringify(stampsDb));
  b.showPage(page1(b));
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
  b.showPage(page1(b));
  d.click(b.$('.cards .card[data-id="2"]'));
  const bm = b.$('[data-act="bookmark"]');
  d.click(bm);
  await settle();
  assert.deepEqual(JSON.parse(fetched.filter(f => f.url === "/hxh/api/db/chars/2/stamp").at(-1).init.body), { kind: "bookmark", x: 0, y: 0, rotation: 0 });
  assert.ok(bm.classList.contains("lit"));
  assert.equal(b.selected.id, 2, "still selected after the re-page");
  assert.equal(at(b), 1, "bookmarking does not turn the page");
  assert.deepEqual(b.pages.find(p => p.kind === "bookmark").cards.map(c => c.id), [2]);
  d.click(b.$(".tabs .tab.bm"));
  assert.equal(at(b), "bookmark");
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

test("the book always opens on page 1, never the bookmarks (Andrew, 2026-09-27); a reload keeps the page they turned to", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();   // the launch-time load (an empty roster) settles first
  nextId = 1;
  const roster = [mk("Gon", ["enhancement"], ["hunter-exam"], { card_number: 1 }), mk("Killua", [], ["hunter-exam"], { card_number: 2 })];
  b.setRoster(roster);
  assert.equal(at(b), 1, "no bookmarks: page 1");
  b.stamps = { hearts: [], hearts_mine: [], bookmarks: [2] };
  b.setRoster(roster);
  assert.equal(at(b), 1, "a reload keeps page 1 even once a bookmark exists");
  b.page = null; b.chose = false; b.sig = null;   // as at a fresh open
  b.setRoster(roster);
  assert.equal(at(b), 1, "a reader with bookmarks still opens on page 1");
  d.click(b.$(".tabs .tab.bm"));
  b.stamps = { hearts: [], hearts_mine: [], bookmarks: [] };
  b.setRoster(roster);
  assert.equal(at(b), "bookmark", "they turned to the bookmark tab themselves: an empty one still stays");
});

test("a live re-read keeps the page by what it is, not its index: a tenth claim adds a claimed page in front and the reader stays on their page (2026-09-28)", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();
  nextId = 1;
  const roster = Array.from({ length: 4 * PER_PAGE }, (_, i) => mk("c" + i, [], ["hunter-exam"], { card_number: i + 1 }));
  const claims = n => roster.slice(0, n).map((c, i) => ({ char_id: c.id, username: "u" + i, x: 88, y: 82, rotation: 0 }));
  b.stamps = { hearts: [], hearts_mine: [], bookmarks: [], claims: claims(PER_PAGE) };
  b.setRoster(roster);
  b.go(b.pages.findIndex(p => p.kind === "cards" && p.n === 3));
  assert.equal(at(b), 3);
  b.stamps = { ...b.stamps, claims: claims(PER_PAGE + 1) };
  b.setRoster(roster);
  assert.equal(b.pages.filter(p => p.kind === "claimed").length, 2, "a second claimed page, in front");
  assert.equal(at(b), 3, "still page 3");
  b.go(1);   // claimed 2 of 2
  assert.equal(at(b), "claimed");
  b.stamps = { ...b.stamps, claims: claims(PER_PAGE) };
  b.setRoster(roster);
  assert.equal(at(b), "claimed", "claimed 2 went away: the last claimed page");
  assert.equal(b.pages.filter(p => p.kind === "claimed").length, 1);
});

test("the book's margins drag the window; cards and controls do not", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  b.setRoster([mk("Gon", ["enhancement"])]);
  const w = os.wm.get("win-binder"), el = w.el;
  el.style.left = "100px"; el.style.top = "80px"; el.style.zoom = "1";   // unscaled: wm.test covers a zoomed drag
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

test("the closed cover drags the binder on a travelling press and opens on a still click; the click that ends a drag never opens it (Andrew, 2026-09-27)", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  b.setRoster([mk("Gon", ["enhancement"])]);
  const w = os.wm.get("win-binder"), el = w.el, cover = b.$(".cover");
  el.style.left = "100px"; el.style.top = "80px"; el.style.zoom = "1";   // unscaled: wm.test covers a zoomed drag
  Object.defineProperty(el, "offsetLeft", { value: 100, configurable: true });
  Object.defineProperty(el, "offsetTop", { value: 80, configurable: true });
  Object.defineProperty(el, "offsetWidth", { value: 1000, configurable: true });
  Object.defineProperty(os.desktop.el, "clientWidth", { value: 1366, configurable: true });
  const pd = (target, x, y) => target.dispatchEvent(new d.win.PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y, button: 0 }));
  const pm = (x, y) => b.book.dispatchEvent(new d.win.PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y }));
  const pu = () => b.book.dispatchEvent(new d.win.PointerEvent("pointerup", { bubbles: true }));
  assert.ok(b.book.classList.contains("closed"));
  pd(b.$(".cover .plate"), 10, 10); pm(70, 50); pu(); cover.click();   // the browser's click after the release
  assert.equal(el.style.left, "160px", "a press anywhere on the cover, the name plate included, drags");
  assert.equal(el.style.top, "120px");
  assert.ok(b.book.classList.contains("closed"), "the drag's own click does not open the book");
  pd(cover, 10, 10); pm(12, 13); pu(); cover.click();   // 3.6 px of wobble
  assert.equal(el.style.left, "160px", "a wobble under DRAG_SLOP does not move it");
  assert.ok(!b.book.classList.contains("closed"), "a still click opens the book");
  assert.equal(DRAG_SLOP, 5);
});

test("the left page's left edge closes the book; a card beside it does not (Andrew, 2026-09-27)", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  b.setRoster([mk("Gon", ["enhancement"])]);
  d.click(b.$(".cover"));
  assert.ok(b.book.classList.contains("open"));
  const edge = b.$(".leaf .page .edge");
  assert.ok(edge, "the edge travels with the page into the open leaf");
  assert.equal(edge.title, "Close");
  d.click(b.$(".cards .card"));
  assert.ok(b.book.classList.contains("open"), "a card is not the edge");
  d.click(edge);
  assert.ok(b.book.classList.contains("closed"), "the edge shuts the book");
  assert.ok(b.$(".face.back .page .edge"), "the page, edge and all, is back on the leaf");
  assert.equal(os.wm.get("win-binder").state.open, true, "the book shuts; the window stays");
});

test("a pick puts the whole card, enlarged, above the profile: the same printed card, hearts included; the next pick replaces it (Andrew, 2026-09-27)", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();
  nextId = 1;
  b.setRoster([mk("Gon Freecss", ["enhancement"], ["hunter-exam"], { first: "Gon", rank: "S", card_image_id: 18, card_number: 1 }), mk("Killua Zoldyck", [], ["hunter-exam"], { first: "Killua", card_number: 2 })]);
  d.click(b.$(".cover"));
  d.click(b.$('.cards .card[data-id="1"]'));
  const scr = b.$(".screen");
  const big = () => scr.querySelector(":scope > .big .gicard");
  assert.deepEqual([...scr.children].map(e => e.className), ["big", "prof"], "the card first, the profile under it; reduced motion: no paint-in");
  assert.equal(big().querySelector(".gi-panel.name .gi-txt").textContent, "Gon", "the plaque's short name");
  assert.equal(big().querySelector(".gi-frame img").getAttribute("src"), "/hxh/api/db/images/18");
  assert.equal(scr.querySelector(".prof .desc").textContent, "First. Second.", "reduced motion types it at once");
  assert.equal(scr.querySelector(".prof > .name").textContent, "Gon Freecss", "the profile's full name, not the card's panel");
  d.click(b.$('[data-act="heart"]'));
  await settle();
  assert.equal(big().querySelectorAll(".gi-stamps .gi-stamp").length, 1, "a heart lands on the enlarged card too");
  d.click(b.$('.cards .card[data-id="2"]'));
  assert.equal(scr.querySelectorAll(".big").length, 1, "one card at a time");
  assert.equal(big().querySelector(".gi-panel.name .gi-txt").textContent, "Killua");
  assert.equal(TYPE_MS, 4, "a little faster than the old 6 ms a character");
});

test("with motion: the card paints in, then the screen glides to the profile and types; a reader who scrolls up stays up while it types on, and back at the bottom is followed again", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  await tick();
  nextId = 1;
  b.setRoster([mk("Gon Freecss", ["enhancement"], ["hunter-exam"], { first: "Gon", description: "x".repeat(400) })]);
  d.click(b.$(".cover"));
  os.env.reduced = false;
  Object.assign(b.options, { revealMs: 20, glidePause: 10, typeMs: 2 });
  const scr = b.$(".screen");
  let top = 0;   // jsdom has no layout: a screen 300 tall over 1000 of content
  Object.defineProperty(scr, "scrollTop", { get: () => top, set: v => { top = v; }, configurable: true });
  Object.defineProperty(scr, "scrollHeight", { value: 1000, configurable: true });
  Object.defineProperty(scr, "clientHeight", { value: 300, configurable: true });
  const scroll = to => { top = to; scr.dispatchEvent(new d.win.Event("scroll")); };
  const desc = () => scr.querySelector(".prof .desc").textContent.length;
  d.click(b.$(".cards .card"));
  assert.ok(scr.querySelector(".big").classList.contains("load"), "the card paints in");
  assert.equal(scr.querySelector(".big .gicard").style.animationDuration, "20ms");
  assert.equal(desc(), 0, "no typing while it paints in");
  await tick(60);
  assert.ok(desc() > 0, "then the profile types");
  scroll(0);   // the reader scrolls up to the card mid-typing
  const at = desc();
  await tick(200);
  assert.equal(top, 0, "and is left there");
  assert.ok(desc() > at, "while the typing goes on below");
  scroll(700);   // back at the bottom (1000 − 700 − 300 = 0)
  top = 690;     // the text grows: 10 px short of the bottom again
  await tick(120);
  assert.equal(top, 700, "followed again: the typing keeps the reader at the bottom");
  scroll(700);   // the event of that own scroll is not taken for the reader's
  assert.equal(b.run.pinned, true);
  b.select(null);
  assert.equal(b.run, null, "a new pick (or none) stops the old sequence");
});

test("the corner buttons are gone while a leaf turns, opening or closing, and back once it lands; no turn, no hiding (Andrew, 2026-09-27)", async () => {
  const b = os.registry.get("binder");
  await os.launch("binder");
  b.setRoster([mk("Gon", ["enhancement"])]);
  const el = os.wm.get("win-binder").el, flap = b.$(".flap");
  const land = () => flap.dispatchEvent(new d.win.Event("transitionend"));
  d.click(b.$(".cover"));
  assert.ok(!el.classList.contains("turning"), "reduced motion: the book opens at once, nothing to hide");
  d.click(b.$(".leaf .page .edge"));
  os.env.reduced = false;
  d.click(b.$(".cover"));
  assert.ok(b.book.classList.contains("opening") && el.classList.contains("turning"), "opening: hidden from the first frame");
  land();
  assert.ok(b.book.classList.contains("open") && !el.classList.contains("turning"), "landed: back");
  d.click(b.$(".leaf .page .edge"));
  assert.ok(b.book.classList.contains("closing") && el.classList.contains("turning"), "closing: hidden");
  land();
  assert.ok(b.book.classList.contains("closed") && !el.classList.contains("turning"), "shut: back");
});

test("a claim plate lands on the white description box, not over its edge: corner at x 84–91, y 78–85, lean ±6° (Andrew, 2026-09-27)", async () => {
  const { PLATE_X, PLATE_Y, PLATE_ROT } = await import("../html/hxh/apps/binder.js");
  for (const r of [0, 0.5, 0.999]) {
    const p = randomPlate(() => r);
    assert.ok(p.x >= PLATE_X[0] && p.x <= PLATE_X[1] && p.y >= PLATE_Y[0] && p.y <= PLATE_Y[1] && Math.abs(p.rotation) <= PLATE_ROT, JSON.stringify(p));
  }
  // the worst case stays on the box (4.3–95.7 × 7.2–92.8 % of the band, a 94.6 × 56.65 cqw band): a six-letter plate
  // (~37 cqw × 11.7 cqw) at the range's corner, leaning the full 6° either way
  const W = 94.6, H = 56.65, w = 37, h = 11.7, s = Math.sin(PLATE_ROT * Math.PI / 180);
  assert.ok(PLATE_Y[1] + (w * s) / H * 100 <= 92.8, "a leftward lean drops its left end no lower than the box's bottom");
  assert.ok(PLATE_X[1] + (h * s) / W * 100 <= 95.7, "a rightward lean pushes its top no further than the box's right edge");
  assert.ok(PLATE_X[0] - (w / W) * 100 >= 4.3, "a long name still starts inside the box");
});

test("the book is a touch drag handle: touch-action none, so a finger drag moves the window instead of scrolling the page (Andrew, 2026-09-28)", async () => {
  const fs = await import("node:fs");
  const css = fs.readFileSync(new URL("../html/hxh/apps/binder.css", import.meta.url), "utf8");
  assert.match(css, /\.book \{[^}]*touch-action: none/);
});
