/* The Binder — the roster as a Greed Island card binder in a chromeless
   window (minimize + close float at the book's corner; the book's own
   margins drag the window). Cards are the accepted characters of the
   Roster DB (GET /hxh/api/db/binder — the old html/hxh/roster.json is
   DEPRECATED, kept only for reference), each printed by GICard
   (apps/card.js, spec docs/GI_CARD.md). Tabs are one per GROUP of
   cards; the grouping is one function (groupCards) and only groups
   that have cards get a tab, so tabs appear on their own as characters
   are added. The pure parts (grouping, pagination, layout maths) are
   exported for tests. */
import { App } from "../os/apps.js";
import { Window } from "../os/window.js";
import { h, esc } from "../os/dom.js";
import { textColorFor } from "../os/icons.js";
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
// Characters with no stated Nen type are filed by the arc they first
// appear in, on muted arc-coloured tabs, so a page is still one tab.
export const ARCS = [
  { slug: "hunter-exam",       code: "EX", name: "Hunter Exam",       ja: "ハンター試験編",     hex: "#b8ad97" },
  { slug: "zoldyck-family",    code: "ZO", name: "Zoldyck Family",    ja: "ゾルディック家編",   hex: "#a89bb8" },
  { slug: "heavens-arena",     code: "HA", name: "Heavens Arena",     ja: "天空闘技場編",       hex: "#9fb8b0" },
  { slug: "yorknew-city",      code: "YN", name: "Yorknew City",      ja: "ヨークシン編",       hex: "#b8a0a0" },
  { slug: "greed-island",      code: "GI", name: "Greed Island",      ja: "グリードアイランド編", hex: "#a3b89b" },
  { slug: "chimera-ant",       code: "CA", name: "Chimera Ant",       ja: "キメラアント編",     hex: "#b8b493" },
  { slug: "chairman-election", code: "EL", name: "Chairman Election", ja: "会長選挙編",         hex: "#a8aec0" },
];
export { LIMIT };
export const PER_PAGE = 9;                         // 3 × 3 sleeves per page, like the show
export const SOURCE = "/hxh/api/db/binder";        // the Roster DB's accepted characters

export const typeOf = c => TYPES.find(t => t.slug === ((c.nen_types || [])[0] || "")) || TYPES[TYPES.length - 1];
const titleCase = s => s.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
export const rankBox = c => rankLimit(c.rank || "C");
export const cardNo = c => cardNoOf(c.no ?? c.id);
export const firstSentence = s => (String(s || "").match(/^[^.!?]*[.!?]/) || [s || ""])[0].trim();
/** What a card's description box prints: the card description, else the profile's first sentence. */
export const cardText = c => c.card_description || firstSentence(c.description);

/**
 * The grouping behind the tabs: one group per Nen type, the untyped by
 * first arc. Returns only groups that have cards, in tab order. Swap
 * this function to change what the tabs mean (Andrew has "a better
 * idea for the tabs" — everything else keys off the group objects).
 */
export function groupCards(chars) {
  const out = [];
  for (const t of TYPES.slice(0, -1)) {
    const mine = chars.filter(c => typeOf(c) === t);
    if (mine.length) out.push({ ...t, cards: mine });
  }
  const untyped = chars.filter(c => !(c.nen_types || []).length);
  for (const a of ARCS) {
    const mine = untyped.filter(c => (c.arcs || [])[0] === a.slug);
    if (mine.length) out.push({ ...a, hue: a.hex, cards: mine });
  }
  return out;
}

/** One tab per page; a group never shares a page. */
export function paginate(chars) {
  const out = [];
  for (const g of groupCards(chars)) {
    const { cards, ...type } = g;
    for (let i = 0; i < cards.length; i += PER_PAGE) {
      out.push({ type, cards: cards.slice(i, i + PER_PAGE), n: Math.floor(i / PER_PAGE) + 1, of: Math.ceil(cards.length / PER_PAGE) });
    }
  }
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
            <button class="key" type="button" data-act="claim">CLAIM</button>
            <button class="key" type="button" data-act="shut">CLOSE</button>
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
    this.pages = []; this.page = 0; this.sel = null; this.roster = []; this.typer = null; this.cards = new Map();
    this.src = options.src || SOURCE;
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
      if (act === "shut") this.shut();
      if (act === "claim") this.claimSel();
      if (dir === "left") this.showPage(this.page - 1);
      if (dir === "right") this.showPage(this.page + 1);
      if (dir === "up" || dir === "down") this.step(dir === "up" ? -1 : 1);
    });
    // drag the window by the book's margins (Andrew, 2026-09-19) — never by a card or a control
    os.wm.drag(this.win, this.book, { allow: e => !e.target.closest?.(CONTROLS) });
    os.bus.on("resize", () => { if (this.win.state.open) { const at = this.layout(); if (at) os.wm.place(this.win.id, at); os.wm.fit(); } });
    this.load();
    return this.win;
  }

  load() {
    const fetch = this.options.fetch || this.os.win.fetch?.bind(this.os.win);
    if (!fetch) return Promise.resolve();
    return fetch(this.src, { cache: "no-cache", credentials: "same-origin" }).then(r => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then(list => this.setRoster(list))
      .catch(() => { this.$(".cards").textContent = "The binder is empty."; });
  }

  /** The cards, in the order the API gives them (by number). */
  setRoster(list) {
    this.roster = (list || []).map(c => ({ ...c, no: c.no ?? c.id }));
    this.pages = paginate(this.roster);
    this.renderTabs();
    this.showPage(0);
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
    el.style.zoom = String(l.zoom);
    for (const c of this.cards.values()) c.fit();
    return { x: l.x, y: l.y };
  }

  launch() {
    const win = this.window();
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
      const b = h("button", { type: "button", className: "tab", text: p.type.code,
        title: `${p.type.name} ${p.type.ja}` + (p.of > 1 ? ` · ${p.n}/${p.of}` : ""),
        onclick: () => this.showPage(i) });
      b.style.setProperty("--hue", p.type.hue);
      b.style.setProperty("--t", textColorFor(p.type.hex));
      tabs.append(b);
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
    for (let k = p.cards.length; k < PER_PAGE; k++) box.append(h("div", { className: "slot" }));
    this.$(".pageno").innerHTML = `${this.page + 1} / ${this.pages.length}<span class="ja">${esc(p.type.ja)}</span>`;
    if (this.sel && !p.cards.includes(this.sel)) this.select(null);
  }

  /** A sleeve holding one printed card. */
  cardEl(c) {
    const b = h("button", { type: "button", className: "card" + (c === this.sel ? " on" : ""), dataset: { id: String(c.id) }, title: c.name, onclick: () => this.select(c) });
    const card = new GICard({ no: c.no, name: c.name, rank: c.rank, description: cardText(c), alt: c.name,
      image: c.card_image_id ? `/hxh/api/db/images/${c.card_image_id}` : (c.avatar_image_id ? `/hxh/api/db/images/${c.avatar_image_id}` : null) });
    card.mount(b);
    this.cards.set(c.id, card);
    return b;
  }

  idle() {
    this.$(".screen").innerHTML = `<div class="idle"><div class="emblem"></div><div class="ja">カードを選択</div></div>`;
  }

  select(c) {
    this.sel = c;
    this.$(".cards").querySelectorAll(".card").forEach(b => b.classList.toggle("on", b.dataset.id === String(c && c.id)));
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
    if (n < 0) { this.showPage(this.page - 1); return this.select(this.pages[this.page].cards[this.pages[this.page].cards.length - 1]); }
    if (n >= cards.length) { this.showPage(this.page + 1); return this.select(this.pages[this.page].cards[0]); }
    this.select(cards[n]);
  }

  claimSel() {
    const os = this.os;
    if (!this.sel) { os.toast.show("Pick a card first."); return; }
    const c = this.sel;
    os.toast.show(`${c.first || c.name} is a fine choice — registration opens soon.`);
    if (os.registry.has("register")) os.launch("register");
  }
}
