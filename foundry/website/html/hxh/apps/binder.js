/* The Binder — the roster as a Greed Island card binder in a chromeless
   window (minimize + close float at the book's corner; the book's own
   margins drag the window). Cards are the accepted characters of the
   Roster DB (GET /hxh/api/db/binder — the old html/hxh/roster.json is
   DEPRECATED, kept only for reference), each printed by GICard
   (apps/card.js, spec docs/GI_CARD.md), in card-number order
   (card_number — the Roster DB's binder position, renumbered by
   dragging rows there), PER_PAGE to a page. Tabs are one per PAGE, so
   a reader can see how deep into the book they are (Andrew,
   2026-09-21: no tabs by Nen type or arc). The pure parts (pagination,
   layout maths) are exported for tests. */
import { App } from "../os/apps.js";
import { Window } from "../os/window.js";
import { h, esc } from "../os/dom.js";
import { icon } from "../os/icons.js";
import { type } from "../os/typewriter.js";
import { GICard, LIMIT, cardNo as cardNoOf, rankLimit } from "./card.js";
import "./binder.css";

export const TYPES = [
  { slug: "enhancement",    code: "EN", name: "Enhancer",    ja: "強化系", hue: "var(--enhancer)",    hex: "#ff5a36" },
  { slug: "transmutation",  code: "TR", name: "Transmuter",  ja: "変化系", hue: "var(--transmuter)",  hex: "#37d0ff" },
  { slug: "conjuration",    code: "CO", name: "Conjurer",    ja: "具現化系", hue: "var(--conjurer)",  hex: "#c09bff" },
  { slug: "emission",       code: "EM", name: "Emitter",     ja: "放出系", hue: "var(--emitter)",     hex: "#ffd166" },
  { slug: "manipulation",   code: "MA", name: "Manipulator", ja: "操作系", hue: "var(--manipulator)", hex: "#ff7ad9" },
  { slug: "specialization", code: "SP", name: "Specialist",  ja: "特質系", hue: "var(--specialist)",  hex: "#58e05c" },
  { slug: "",               code: "--", name: "Non-user",    ja: "非能力者", hue: "var(--none)",      hex: "#9a9a9a" },
];
export { LIMIT };
export const PER_PAGE = 9;                         // 3 × 3 sleeves per page, like the show
export const SOURCE = "/hxh/api/db/binder";        // the Roster DB's accepted characters
export const STAMPS = "/hxh/api/db/stamps";        // everyone's hearts, my hearts, my bookmarks
export const STAMP_ROT = 25;                        // a heart leans at most this far from upright (degrees)
export const BOOKMARK_HINT = "Bookmark characters for them to show here!";

/** Where a new heart lands on the description box: % of the box, allowed to hang over its edge; upright within ±STAMP_ROT. */
export function randomStamp(rand = Math.random) {
  return { x: Math.round((-8 + rand() * 92) * 10) / 10, y: Math.round((-15 + rand() * 100) * 10) / 10, rotation: Math.round((rand() * 2 - 1) * STAMP_ROT * 10) / 10 };
}
export const LIVE_MS = 20000;                        // an open binder re-reads itself this often

export const typeOf = c => TYPES.find(t => t.slug === ((c.nen_types || [])[0] || "")) || TYPES[TYPES.length - 1];
const titleCase = s => s.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
export const rankBox = c => rankLimit(c.rank || "C");
export const cardNo = c => cardNoOf(c.no ?? c.id);
export const firstSentence = s => (String(s || "").match(/^[^.!?]*[.!?]/) || [s || ""])[0].trim();
/** What a card's description box prints: the card description, else the profile's first sentence. */
export const cardText = c => c.card_description || firstSentence(c.description);

/**
 * The pages: the reader's bookmarks first (always at least one page, empty
 * or not — Andrew, 2026-09-21), then every card PER_PAGE to a page in
 * card-number order (a duplicate number keeps id order). Each page is a
 * tab; bookmark pages wear the bookmark icon, the rest their number.
 */
export function paginate(chars, bookmarks = []) {
  const sorted = [...chars].sort((a, b) => (a.no ?? a.id) - (b.no ?? b.id) || a.id - b.id);
  const marked = new Set(bookmarks);
  const mine = sorted.filter(c => marked.has(c.id));
  const out = [];
  for (let i = 0; i < Math.max(1, mine.length); i += PER_PAGE) out.push({ kind: "bookmark", cards: mine.slice(i, i + PER_PAGE), n: out.length + 1 });
  for (const p of out) p.of = out.length;
  const first = out.length;
  for (let i = 0; i < sorted.length; i += PER_PAGE) out.push({ kind: "cards", cards: sorted.slice(i, i + PER_PAGE), n: out.length - first + 1 });
  for (const p of out.slice(first)) p.of = out.length - first;
  return out;
}

/* The card is the anchor (Andrew, 2026-09-19: "i like the card size, so
   make that the anchor to compute the binder size around"): in BOOK
   pixels a card is CARD_W wide, a page is exactly a 3 × 3 grid of cards
   plus its gaps, padding and the page number, the book is two pages and
   the spine, and the right panel mirrors the page. The book is then
   shown at ONE CSS zoom (never a transform, never per-value maths) that
   makes it fill FILL of the desktop — width or height, whichever binds
   (Andrew: "the binder is tiny! … fill like 85% of the screen"). Tabs
   hang above the page. */
export const CARD_W = 150;                 // a card's width in book pixels
export const CARD_RATIO = 2072 / 1475;      // a card's height / width (docs/GI_CARD.md)
export const FILL = 0.85;                   // of the desktop above the taskbar
export const GAP = 12, PAD = 20, PAGENO = 30, SPINE = 50, TASKBAR = 45, TABS = 46;
export const DESIGN_PW = 514;               // the page width the panel's controls were drawn for (binder.css --u)
export function binderLayout(vw, vh, { card = CARD_W, fill = FILL } = {}) {
  const cw = card, ch = cw * CARD_RATIO, pw = 3 * cw + 2 * GAP + 2 * PAD;
  const bw = 2 * pw + SPINE, bh = 3 * ch + 2 * GAP + 2 * PAD + PAGENO;
  const zoom = Math.round(Math.min(fill * vw / bw, fill * (vh - TASKBAR) / (bh + TABS)) * 1000) / 1000;
  const r = o => Math.round(o * 100) / 100;
  return { cw, ch: r(ch), pw, bw, bh: r(bh), zoom,
    x: Math.max(16, Math.round((vw - bw * zoom) / 2)), y: Math.max(Math.round(TABS * zoom), Math.round((vh - TASKBAR - bh * zoom) / 2)) };
}

const BOOK = `
  <div class="book closed">
    <div class="inside">
      <div class="leaf"></div>
      <div class="spine"><i class="clasp"></i><i class="clasp"></i></div>
      <div class="panel">
        <div class="screen"></div>
        <div class="controls">
          <div class="keys">
            <button class="key ico" type="button" data-act="heart" title="I like this character!" disabled>${icon("heart", 16)}</button>
            <button class="key ico" type="button" data-act="bookmark" title="Bookmark for myself" disabled>${icon("bookmark", 16)}</button>
            <button class="key" type="button" data-act="become" title="This is me!" disabled>BECOME</button>
          </div>
          <div class="dial"></div>
          <div class="pad"></div>
          <div class="dpad">
            <button type="button" data-dir="up" title="Previous card"></button>
            <button type="button" data-dir="left" title="Previous page"></button>
            <i class="c"></i>
            <button type="button" data-dir="right" title="Next page"></button>
            <button type="button" data-dir="down" title="Next card"></button>
          </div>
        </div>
        <div class="shade"></div>
      </div>
    </div>
    <div class="flap">
      <div class="face front">
        <div class="cover" role="button" tabindex="0" title="Open">
          <i class="rivet tl"></i><i class="rivet tr"></i><i class="rivet bl"></i><i class="rivet br"></i>
          <div class="emblem"></div>
          <div class="plate">HUNTER<span class="x">×</span>HALLOWEEN<span class="ja">ハンター×ハロウィン</span></div>
          <div class="sub">BINDER<span class="ja">バインダー</span></div>
          <div class="clasps"><i></i><i></i></div>
        </div>
      </div>
      <div class="face back">
        <div class="page">
          <div class="tabs"></div>
          <div class="cards"></div>
          <div class="pageno"></div>
        </div>
        <i class="halfspine"></i>
      </div>
    </div>
  </div>`;

/* Presses on these are the book's own controls; anything else on the book drags the window. */
const CONTROLS = ".card, .gicard, .tab, button, .cover, .screen, .dpad, .keys, .pad, .dial, .fbtns";

export class BinderApp extends App {
  static id = "binder";
  static name = "Binder";
  static icon = "book";
  static order = 20;

  constructor(os, options = {}) {
    super(os, options);
    this.pages = []; this.page = null; this.chose = false; this.sel = null; this.roster = []; this.typer = null; this.cards = new Map();
    this.stamps = { hearts: [], hearts_mine: [], bookmarks: [] };
    this.src = options.src || SOURCE;
    this.stampsSrc = options.stampsSrc || STAMPS;
  }

  /** The chromeless window with the book inside. Built once. */
  window() {
    if (this.win) return this.win;
    const os = this.os;
    this.win = new Window({
      id: "win-binder", title: "Binder", icon: "book", chrome: "none", buttons: ["min", "close"], popup: true, cls: "binder",
      content: BOOK,
    });
    os.wm.add(this.win);
    const el = this.win.el;
    this.book = el.querySelector(".book");
    this.$ = sel => el.querySelector(sel);
    this.idle();
    const cover = this.$(".cover");
    cover.addEventListener("click", () => this.openBook());
    cover.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.openBook(); } });
    el.addEventListener("click", e => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      const dir = e.target.closest("[data-dir]")?.dataset.dir;
      if (act === "heart" || act === "bookmark") this.stampSel(act);
      if (dir === "left") this.go(this.page - 1);
      if (dir === "right") this.go(this.page + 1);
      if (dir === "up" || dir === "down") this.step(dir === "up" ? -1 : 1);
    });
    // drag the window by the book's margins (Andrew, 2026-09-19) — never by a card or a control
    os.wm.drag(this.win, this.book, { allow: e => !e.target.closest?.(CONTROLS) });
    os.bus.on("resize", () => { if (this.win.state.open) { const at = this.layout(); if (at) os.wm.place(this.win.id, at); os.wm.fit(); } });
    // the Roster DB changed under an open binder (a verdict, a card picture): re-read it
    os.bus.on("roster:changed", () => { if (this.win.state.open) this.load(); });
    os.live?.every(this.win, LIVE_MS, () => this.load());   // and on its own clock, for readers without the Roster app
    return this.win;
  }

  get(url) {
    const fetch = this.options.fetch || this.os.win.fetch?.bind(this.os.win);
    if (!fetch) return Promise.reject(new Error("no fetch"));
    return fetch(url, { cache: "no-cache", credentials: "same-origin" }).then(r => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))));
  }

  /** The roster and the stamps together; a stamps failure only loses the stamps. */
  load() {
    if (!(this.options.fetch || this.os.win.fetch)) return Promise.resolve();
    return Promise.all([this.get(this.src), this.get(this.stampsSrc).catch(() => null)])
      .then(([list, stamps]) => { if (stamps && Array.isArray(stamps.hearts)) this.stamps = stamps; this.setRoster(list); })
      .catch(() => { this.$(".cards").textContent = "The binder is empty."; });
  }

  /**
   * The cards, in the order the API gives them (by number). The book opens
   * on the reader's bookmarks when they have some, else on page 1; a reload
   * keeps the page the reader is on (an empty bookmark page they never
   * chose is not a page they are on).
   */
  setRoster(list) {
    this.roster = (list || []).map(c => ({ ...c, no: c.card_number ?? c.no ?? c.id }));
    this.pages = paginate(this.roster, this.stamps.bookmarks);
    this.renderTabs();
    const bm = this.pages[0], last = this.pages.length - 1;
    const auto = this.page == null || (!this.chose && this.page === 0 && !bm.cards.length);
    this.showPage(auto ? (bm.cards.length ? 0 : Math.min(1, last)) : Math.min(this.page, last));
  }

  /** The reader turns to a page (a tab, the D-pad): from now on reloads keep their place. */
  go(i) { this.chose = true; this.showPage(i); }

  /* ---------- stamps ---------- */

  heartsOn(id) { return (this.stamps.hearts || []).filter(h => h.char_id === id); }
  hearted(id) { return (this.stamps.hearts_mine || []).includes(id); }
  bookmarked(id) { return (this.stamps.bookmarks || []).includes(id); }

  /** The heart stamps on one printed card: drawn over the description box at their saved spots. */
  renderStamps(card, c) {
    const band = card.el?.querySelector(".gi-band");
    if (!band) return;
    let box = band.querySelector(".gi-stamps");
    if (!box) { box = h("div", { className: "gi-stamps" }); band.append(box); }
    box.replaceChildren(...this.heartsOn(c.id).map(s => {
      const el = h("span", { className: "gi-stamp", html: icon("heart", 16), title: "Someone likes this character" });
      el.style.left = s.x + "%"; el.style.top = s.y + "%"; el.style.transform = `rotate(${s.rotation}deg)`;
      return el;
    }));
  }

  /** The heart and bookmark keys follow the selected card: lit when the reader's own stamp is on it, off with no card. */
  syncKeys() {
    const c = this.sel;
    for (const [act, on] of [["heart", c && this.hearted(c.id)], ["bookmark", c && this.bookmarked(c.id)]]) {
      const b = this.$(`[data-act="${act}"]`);
      b.disabled = !c;
      b.classList.toggle("lit", !!on);
    }
  }

  /** Heart or bookmark the selected card, or take the stamp back; then re-read the stamps so every card shows the truth. */
  async stampSel(kind) {
    const os = this.os, c = this.sel;
    if (!c) { os.toast.show("Pick a card first."); return; }
    const fetch = this.options.fetch || os.win.fetch?.bind(os.win);
    const spot = kind === "heart" ? randomStamp() : { x: 0, y: 0, rotation: 0 };
    try {
      const r = await fetch(`/hxh/api/db/chars/${c.id}/stamp`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, ...spot }) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      this.stamps = await this.get(this.stampsSrc);
    } catch { os.toast.show("The stamp did not take. Try again."); return; }
    if (kind === "bookmark") { this.setRoster(this.roster); if (this.sel !== c) this.select(c); }
    else for (const [id, card] of this.cards) { const cc = this.roster.find(x => x.id === id); if (cc) this.renderStamps(card, cc); }
    this.syncKeys();
  }

  /** Size the book to the viewport and return where to put the window. */
  layout() {
    const os = this.os;
    if (!this.win || !os.env.floating()) return null;
    const l = binderLayout(os.env.width, os.env.height);
    const el = this.win.el;
    el.style.setProperty("--bw", l.bw + "px");
    el.style.setProperty("--bh", l.bh + "px");
    el.style.setProperty("--pw", l.pw + "px");
    el.style.setProperty("--cardw", l.cw + "px");
    el.style.setProperty("--cardh", l.ch + "px");
    el.style.setProperty("--u", String(Math.round(l.pw / DESIGN_PW * 1000) / 1000));   // the panel's controls scale with the page
    el.style.zoom = String(l.zoom);
    for (const c of this.cards.values()) c.fit();
    return { x: l.x, y: l.y };
  }

  /** Every open re-reads the roster: the binder was built once at boot and went stale when a character was accepted later (Abi, 2026-09-21). */
  launch() {
    const win = this.window();
    this.load();
    const p = this.os.wm.open(win.id, this.layout());
    for (const c of this.cards.values()) c.fit();
    return p;
  }

  /* The page turn: the cover (front face) swings -180° on the spine hinge
     and its back face, the card page, lands on the left. On finish the
     page moves into .leaf (plain flow); shut() puts it back on the leaf
     and swings it home. No 3D on phones or with reduced motion. */
  animated() { return this.os.env.floating() && !this.os.env.reduced; }

  settle(from, to, fn) {
    const flap = this.$(".flap"), book = this.book;
    const done = () => {
      if (!book.classList.contains(from)) return;
      clearTimeout(this.turnTimer); flap.removeEventListener("transitionend", onEnd);
      fn(); book.classList.replace(from, to); this.os.wm.fit();
      for (const c of this.cards.values()) c.fit();
    };
    const onEnd = e => { if (e.target === flap) done(); };
    flap.addEventListener("transitionend", onEnd);
    this.turnTimer = setTimeout(done, 1000);
  }

  get isOpen() { return this.book.classList.contains("open"); }

  openBook() {
    const book = this.book;
    if (!book.classList.contains("closed")) return;
    const page = this.$(".page"), leaf = this.$(".leaf");
    if (!this.animated()) { leaf.append(page); book.classList.replace("closed", "open"); this.os.wm.fit(); for (const c of this.cards.values()) c.fit(); return; }
    book.classList.replace("closed", "opening");
    this.settle("opening", "open", () => leaf.append(page));
  }

  shut() {
    const book = this.book;
    if (book.classList.contains("closed") || book.classList.contains("closing")) return;
    const page = this.$(".page"), back = this.$(".face.back");
    back.prepend(page);
    if (!this.animated() || !book.classList.contains("open")) {
      book.classList.remove("open", "opening", "closing", "start"); book.classList.add("closed"); this.os.wm.fit(); return;
    }
    book.classList.remove("open"); book.classList.add("closing", "start");
    void this.$(".flap").offsetWidth;   // commit the -180° start before transitioning home
    book.classList.remove("start");
    this.settle("closing", "closed", () => {});
  }

  renderTabs() {
    const tabs = this.$(".tabs");
    tabs.replaceChildren();
    this.pages.forEach((p, i) => {
      tabs.append(p.kind === "bookmark"
        ? h("button", { type: "button", className: "tab bm", html: icon("bookmark", 16), title: "Bookmarks" + (p.of > 1 ? ` ${p.n} of ${p.of}` : ""), onclick: () => this.go(i) })
        : h("button", { type: "button", className: "tab", text: String(p.n), title: `Page ${p.n} of ${p.of}`, onclick: () => this.go(i) }));
    });
  }

  showPage(i) {
    const box = this.$(".cards");
    for (const c of this.cards.values()) c.unmount();
    this.cards.clear();
    box.replaceChildren();
    if (!this.pages.length) { this.$(".pageno").textContent = ""; return; }
    this.page = (i + this.pages.length) % this.pages.length;
    const p = this.pages[this.page];
    this.$(".tabs").querySelectorAll(".tab").forEach((t, k) => t.classList.toggle("on", k === this.page));
    p.cards.forEach(c => box.append(this.cardEl(c)));
    for (const card of this.cards.values()) card.fit();   // a card mounts before its sleeve is in the page (no width yet): fit once the page holds it
    for (let k = p.cards.length; k < PER_PAGE; k++) box.append(h("div", { className: "slot" }));
    if (p.kind === "bookmark" && !p.cards.length) box.append(h("div", { className: "hint", text: BOOKMARK_HINT }));
    this.$(".pageno").textContent = p.kind === "bookmark" ? "Bookmarks" + (p.of > 1 ? ` ${p.n} / ${p.of}` : "") : `${p.n} / ${p.of}`;
    if (this.sel && !p.cards.includes(this.sel)) this.select(null);
    this.syncKeys();
  }

  /** A sleeve holding one printed card. */
  cardEl(c) {
    const b = h("button", { type: "button", className: "card" + (c === this.sel ? " on" : ""), dataset: { id: String(c.id) }, title: c.name, onclick: () => this.select(c) });
    const card = new GICard({ no: c.no, name: c.first || c.name, rank: c.rank, description: cardText(c), alt: c.name,   // the plaque prints the SHORT name (Gon, not Gon Freecss)
      image: c.card_image_id ? `/hxh/api/db/images/${c.card_image_id}` : (c.avatar_image_id ? `/hxh/api/db/images/${c.avatar_image_id}` : null) });
    card.mount(b);
    this.renderStamps(card, c);
    this.cards.set(c.id, card);
    return b;
  }

  idle() {
    this.$(".screen").innerHTML = `<div class="idle"><div class="emblem"></div><div class="ja">カードを選択</div></div>`;
  }

  select(c) {
    this.sel = c;
    this.$(".cards").querySelectorAll(".card").forEach(b => b.classList.toggle("on", b.dataset.id === String(c && c.id)));
    this.syncKeys();
    const scr = this.$(".screen");
    this.typer?.skip?.();
    clearInterval(this.follow);
    if (!c) { this.idle(); return; }
    const t = typeOf(c);
    const types = (c.nen_types || []).length ? c.nen_types.map(n => (TYPES.find(x => x.slug === n) || {}).name || n).join(" / ") : "—";
    const arms = (c.arms || []).length ? c.arms.map(titleCase).join(", ") : "—";
    scr.innerHTML = `
      <div class="top">No.${esc(cardNo(c))}「${esc(c.first || c.name)}」</div>
      <div class="name">${esc(c.name)}</div>
      <div class="line">Nen: <b style="color:${t.hex}">${esc(types)}</b>${c.affiliation ? ` · <b>${esc(c.affiliation)}</b>` : ""}</div>
      <div class="line">Arms: <b>${esc(arms)}</b></div>
      <div class="desc"></div>
      <div class="status">所持者 0名 ／ 残り ${LIMIT[c.rank] || 4}枚</div>`;
    // keep the typing cursor in view on the small screen
    this.follow = setInterval(() => { scr.scrollTop = scr.scrollHeight; }, 80);
    this.typer = type(scr.querySelector(".desc"), [c.description || ""], { speed: 6, reduced: this.os.env.reduced, onDone: () => clearInterval(this.follow) });
    scr.scrollTop = 0;
  }

  get selected() { return this.sel; }

  step(d) {
    const cards = this.pages[this.page]?.cards || [];
    if (!cards.length) return;
    const i = this.sel ? cards.indexOf(this.sel) : -1;
    const n = i + d;
    if (n < 0) { this.go(this.page - 1); return this.select(this.pages[this.page].cards[this.pages[this.page].cards.length - 1]); }
    if (n >= cards.length) { this.go(this.page + 1); return this.select(this.pages[this.page].cards[0]); }
    this.select(cards[n]);
  }

}
