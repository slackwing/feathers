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
import { h, esc, cqFix } from "../os/dom.js";
import { icon } from "../os/icons.js";
import { type } from "../os/typewriter.js";
import { GICard, LIMIT, cardNo as cardNoOf, rankLimit } from "./card.js";
import { ClaimDialog, ClaimInfoDialog } from "./roster/dialogs.js";
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
export const CLAIMED_HINT = "No cards claimed yet.";

/* The lower-right corner of the description box is kept for the name
   plate of whoever becomes the character (Andrew, 2026-09-21) — the
   plate itself will sit somewhere in that corner with a little random
   lean and offset, so the whole corner is the reserved zone. A heart
   stays out when its CENTRE is in the zone; its edge may overlap a
   little ("don't be so scared to be exclusive between stamps"). */
export const STAMP_W = 17;               // a heart's width, % of the description box
export const PLATE = { x: 50, y: 58 };   // the zone: from here to the corner, in % of the box

/** True when a heart at (x, y) has its centre in the name plate's zone. */
export function onPlate(x, y) { return x + STAMP_W / 2 > PLATE.x && y + STAMP_W / 2 > PLATE.y; }

/** A saved spot moved out of the zone by the shorter move: left of it, or above it. */
export function clearOfPlate(s) {
  if (!onPlate(s.x, s.y)) return s;
  const left = s.x + STAMP_W / 2 - PLATE.x, up = s.y + STAMP_W / 2 - PLATE.y;
  return left <= up ? { ...s, x: Math.round((PLATE.x - STAMP_W / 2) * 10) / 10 } : { ...s, y: Math.round((PLATE.y - STAMP_W / 2) * 10) / 10 };
}

/* Where a claim's name plate lands (% of the description band; the plate hangs from its BOTTOM-RIGHT
   corner, a long name growing leftward). All of it on the white description box, which spans 4.3–95.7 %
   across and 7.2–92.8 % down (Andrew, 2026-09-27: "shouldn't go too much into the edge where it can't be
   seen"; it used to reach 100 × 102 and lose its bottom): at the range's limits a six-letter plate leaning
   the full 6° still clears the box's bottom and right edges. hxh changeset 020 moved the plates already
   stamped into this range by the same linear map. */
export const PLATE_X = [84, 91], PLATE_Y = [78, 85], PLATE_ROT = 6;
export function randomPlate(rand = Math.random) {
  const at = ([a, b]) => Math.round((a + rand() * (b - a)) * 10) / 10;
  return { x: at(PLATE_X), y: at(PLATE_Y), rotation: Math.round((rand() * 2 - 1) * PLATE_ROT * 10) / 10 };
}

/** Where a new heart lands on the description box: % of the box, allowed to hang over its edge, never on the plate; upright within ±STAMP_ROT. */
export function randomStamp(rand = Math.random) {
  let spot;
  for (let tries = 0; tries < 40; tries++) {
    spot = { x: Math.round((-8 + rand() * 92) * 10) / 10, y: Math.round((-15 + rand() * 100) * 10) / 10 };
    if (!onPlate(spot.x, spot.y)) break;
  }
  return { ...clearOfPlate(spot), rotation: Math.round((rand() * 2 - 1) * STAMP_ROT * 10) / 10 };
}
export const LIVE_MS = 20000;                        // an open binder re-reads itself this often
export const TYPE_MS = 4;                            // ms per character on the screen: "a little faster" than 6 (Andrew, 2026-09-27); 4 is the browsers' timer floor
export const BIG_W = 0.92;                           // the enlarged card on the screen: at most this share of the screen's width, and never taller than it
export const REVEAL_MS = 1400;                       // the enlarged card paints in top to bottom over this long
export const GLIDE_PAUSE = 350;                      // then a beat before the screen glides down to the profile under it
export const PIN_SLACK = 16;                         // px: a reader this close to the bottom is at the bottom, and the typing keeps them there

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
 * card-number order (a duplicate number keeps id order), then the CLAIMED
 * cards, PER_PAGE to a page, last (always at least one page — Andrew,
 * 2026-09-27: "all the way on the right… a thick red checkmark, to show
 * claimed cards", a second page past nine claimants). Each page is a tab;
 * bookmark pages wear the bookmark icon, claimed pages the checkmark, the
 * rest their number.
 */
export function paginate(chars, bookmarks = [], claimed = []) {
  const sorted = [...chars].sort((a, b) => (a.no ?? a.id) - (b.no ?? b.id) || a.id - b.id);
  const out = [];
  const group = (kind, cards) => {
    const from = out.length;
    for (let i = 0; i < Math.max(1, cards.length); i += PER_PAGE) out.push({ kind, cards: cards.slice(i, i + PER_PAGE), n: out.length - from + 1 });
    for (const p of out.slice(from)) p.of = out.length - from;
  };
  const marked = new Set(bookmarks), taken = new Set(claimed);
  group("bookmark", sorted.filter(c => marked.has(c.id)));
  const first = out.length;
  for (let i = 0; i < sorted.length; i += PER_PAGE) out.push({ kind: "cards", cards: sorted.slice(i, i + PER_PAGE), n: out.length - first + 1 });
  for (const p of out.slice(first)) p.of = out.length - first;
  group("claimed", sorted.filter(c => taken.has(c.id)));
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
            <button class="key" type="button" data-act="claim" title="This is me!" disabled>CLAIM</button>
            <button class="key ico info" type="button" data-act="claim-info" title="About claiming">?</button>
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
          <i class="edge" title="Close"></i>
          <div class="tabs"></div>
          <div class="cards"></div>
          <div class="pageno"></div>
        </div>
        <i class="halfspine"></i>
      </div>
    </div>
  </div>`;

/* Presses on these are the book's own controls; anything else on the book drags the window —
   the closed cover included: it moves on a travelling press and opens on a still click (DRAG_SLOP). */
const CONTROLS = ".card, .gicard, .tab, button, .screen, .dpad, .keys, .pad, .dial, .fbtns";
export const DRAG_SLOP = 5;   // screen px a press may wander and still be a click (Andrew, 2026-09-27)

export class BinderApp extends App {
  static id = "binder";
  static name = "Binder";
  static icon = "book";
  static order = 20;

  constructor(os, options = {}) {
    super(os, options);
    this.pages = []; this.page = null; this.chose = false; this.sel = null; this.roster = []; this.typer = null; this.cards = new Map();
    this.stamps = { hearts: [], hearts_mine: [], bookmarks: [], claims: [] };
    this.me = null;   // the reader's username, from the OS session
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
    // the typing follows the reader only while they sit at the bottom: scroll up to the card and the text goes on typing below
    const scr = this.$(".screen");
    scr.addEventListener("scroll", () => {
      const r = this.run;
      if (!r || r.gliding) return;                                                                     // our own glide
      if (r.expect != null && Math.abs(scr.scrollTop - r.expect) <= 1) { r.expect = null; return; }  // the one event our own follow causes
      r.expect = null;
      if (!r.typing && scr.scrollTop <= 1) return;                                                     // the pick's reset to the top
      r.moved = true;
      r.pinned = scr.scrollHeight - scr.scrollTop - scr.clientHeight <= PIN_SLACK;
    });
    const cover = this.$(".cover");
    cover.addEventListener("click", () => this.openBook());
    cover.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.openBook(); } });
    el.addEventListener("click", e => {
      if (e.target.closest(".edge")) { this.shut(); return; }   // the left page's left edge closes the book (Andrew, 2026-09-27); a drag from it moves the window instead
      const act = e.target.closest("[data-act]")?.dataset.act;
      const dir = e.target.closest("[data-dir]")?.dataset.dir;
      if (act === "heart" || act === "bookmark") this.stampSel(act);
      if (act === "claim") this.claimSel();
      if (act === "claim-info") new ClaimInfoDialog().ask(os);
      if (dir === "left") this.go(this.page - 1);
      if (dir === "right") this.go(this.page + 1);
      if (dir === "up" || dir === "down") this.step(dir === "up" ? -1 : 1);
    });
    // drag the window by the book's margins (Andrew, 2026-09-19) and anywhere on the closed cover (2026-09-27) — never by a card or a control
    os.wm.drag(this.win, this.book, { allow: e => !e.target.closest?.(CONTROLS), threshold: DRAG_SLOP });
    this.me = os.user?.username || null;
    os.bus.on("session:user", ({ user }) => { this.me = user?.username || null; if (this.win.el) this.syncKeys(); });
    os.bus.on("resize", () => { if (this.win.state.open) { const at = this.layout(); if (at) os.wm.place(this.win.id, at); os.wm.fit(); } });
    os.bus.on("window:open", ({ id }) => { if (id === this.win.id) { cqFix(this.win.el); for (const c of this.cards.values()) c.fit(); } });   // shown (launched or restored): measure with it laid out
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
   * The cards, in the order the API gives them (by number). The book always
   * opens on page 1, never the bookmarks (Andrew, 2026-09-27); a reload
   * keeps the page the reader is on (a bookmark page they never chose is
   * not a page they are on) AND the card they had selected — the
   * live re-read every LIVE_MS used to rebuild the page and drop the
   * selection (Andrew, 2026-09-22). A re-read that changes nothing
   * touches nothing.
   */
  setRoster(list) {
    const roster = (list || []).map(c => ({ ...c, no: c.card_number ?? c.no ?? c.id }));
    const sig = JSON.stringify([roster.map(c => [c.id, c.no, c.version, c.card_image_id, c.avatar_image_id, c.card_description, c.first || c.name, c.rank]), this.stamps]);
    if (sig === this.sig && this.page != null) return;
    this.sig = sig;
    this.roster = roster;
    this.pages = paginate(this.roster, this.stamps.bookmarks, (this.stamps.claims || []).map(c => c.char_id));
    this.renderTabs();
    const last = this.pages.length - 1, first = Math.max(0, this.pages.findIndex(p => p.kind !== "bookmark"));
    const auto = this.page == null || (!this.chose && this.page < first);
    const keep = this.sel && this.roster.find(c => c.id === this.sel.id);
    this.showPage(auto ? first : Math.min(this.page, last), keep);
  }

  /** The reader turns to a page (a tab, the D-pad): from now on reloads keep their place. */
  go(i) { this.chose = true; this.showPage(i); }

  /* ---------- stamps ---------- */

  heartsOn(id) { return (this.stamps.hearts || []).filter(h => h.char_id === id); }
  hearted(id) { return (this.stamps.hearts_mine || []).includes(id); }
  bookmarked(id) { return (this.stamps.bookmarks || []).includes(id); }
  claimOn(id) { return (this.stamps.claims || []).find(c => c.char_id === id) || null; }
  myClaim() { return this.me ? (this.stamps.claims || []).find(c => c.username === this.me) || null : null; }

  /** The heart stamps on one printed card: drawn over the description box at their saved spots. */
  renderStamps(card, c) {
    const band = card.el?.querySelector(".gi-band");
    if (!band) return;
    let box = band.querySelector(".gi-stamps");
    if (!box) { box = h("div", { className: "gi-stamps" }); band.append(box); }
    box.replaceChildren(...this.heartsOn(c.id).map(clearOfPlate).map(s => {
      const el = h("span", { className: "gi-stamp", html: icon("heart-stamp", 16), title: "Someone likes this character" });
      el.style.left = s.x + "%"; el.style.top = s.y + "%"; el.style.transform = `rotate(${s.rotation}deg)`;
      return el;
    }));
    // the claim: the member's name in the reserved corner, a passport stamp
    const cl = this.claimOn(c.id);
    if (cl) {
      const el = h("span", { className: "gi-claim", text: cl.label || cl.username.toUpperCase(), title: `${cl.label || cl.username} is coming as ${c.first || c.name}` });
      el.style.left = cl.x + "%"; el.style.top = cl.y + "%"; el.style.transform = `translate(-100%, -100%) rotate(${cl.rotation}deg)`;   // (x, y) is the plate's bottom-right corner
      box.append(el);
    }
  }

  /** The heart, bookmark and claim keys follow the selected card: off with no card, lit when the reader's own stamp is on it; Claim also off on a card someone else holds. */
  syncKeys() {
    const c = this.sel, cl = c && this.claimOn(c.id), mine = !!(cl && this.me && cl.username === this.me);
    for (const [act, on] of [["heart", c && this.hearted(c.id)], ["bookmark", c && this.bookmarked(c.id)], ["claim", mine]]) {
      const b = this.$(`[data-act="${act}"]`);
      b.disabled = !c || (act === "claim" && !!cl && !mine);
      b.classList.toggle("lit", !!on);
    }
    const claim = this.$('[data-act="claim"]');
    claim.title = cl && !mine ? `Claimed by ${cl.label || cl.username}` : mine ? "This is you! Press again to release" : "This is me!";
  }

  /** Claim: the question first (or a release when the reader already holds this card); Bookmark Instead bookmarks. */
  async claimSel() {
    const os = this.os, c = this.sel;
    if (!c) { os.toast.show("Pick a card first."); return; }
    const cl = this.claimOn(c.id);
    if (cl && this.me && cl.username === this.me) { await this.stampSel("claim"); os.toast.show(`Your claim on ${c.first || c.name} is released.`); return; }
    if (cl) { os.toast.show(`${cl.label || cl.username} already claimed ${c.first || c.name}.`); return; }
    const answer = await new ClaimDialog({ name: c.first || c.name }).ask(os);
    if (!answer) return;
    if (answer === "bookmark") { if (!this.bookmarked(c.id)) await this.stampSel("bookmark"); return; }
    const before = this.myClaim();
    await this.stampSel("claim");
    if (this.claimOn(c.id)?.username === this.me) os.toast.show(before ? `You are now ${c.first || c.name} (your claim moved).` : `You are ${c.first || c.name}!`);
  }

  /** Heart or bookmark the selected card, or take the stamp back; then re-read the stamps so every card shows the truth. */
  async stampSel(kind) {
    const os = this.os, c = this.sel;
    if (!c) { os.toast.show("Pick a card first."); return; }
    const fetch = this.options.fetch || os.win.fetch?.bind(os.win);
    const spot = kind === "heart" ? randomStamp() : kind === "claim" ? randomPlate() : { x: 0, y: 0, rotation: 0 };
    try {
      const r = await fetch(`/hxh/api/db/chars/${c.id}/stamp`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, ...spot }) });
      if (!r.ok) { let why = ""; try { why = (await r.json()).error || ""; } catch { /* no body */ } throw new Error(why || "HTTP " + r.status); }
      this.stamps = await this.get(this.stampsSrc);
    } catch (err) { os.toast.show(/claimed by/.test(err.message) ? `Sorry, ${err.message}.` : "The stamp did not take. Try again."); return; }
    if (kind === "claim") os.people?.load();   // a claim changes how you look everywhere (os/people.js): the Start menu, the chat
    if (kind === "bookmark" || kind === "claim") { this.setRoster(this.roster); if (this.sel !== c) this.select(c); }   // both change which pages exist
    else {
      for (const [id, card] of this.cards) { const cc = this.roster.find(x => x.id === id); if (cc) this.renderStamps(card, cc); }
      if (this.bigCard && this.sel) this.renderStamps(this.bigCard, this.sel);   // the enlarged copy on the screen too
    }
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
    if (!el.hidden) cqFix(el);   // the binder's zoom on top of the page's: Safari's container-unit error is their product (os/dom.js)
    // A change of scale (the Binder's own zoom or the desktop's — an iPad turning) rebuilds the page's cards.
    // Abi's iPad drew every card's artwork at about 2/3 of its sleeve (Andrew, 2026-09-27). CONFIRMED in WebKit
    // since (Playwright's WebKit 26.6): the cause is WebKit applying `zoom` a second time to container-query units,
    // on every load, not only after a rotation — cqFix above cancels it. The rebuild is kept: harmless, and fresh
    // elements measure their text from scratch.
    const scale = l.zoom + "|" + (os.env.zoom?.() ?? 1);
    const rescaled = this.scale != null && this.scale !== scale;
    this.scale = scale;
    if (rescaled && this.page != null && this.cards.size) this.showPage(this.page, this.sel);
    else for (const c of this.cards.values()) c.fit();
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
    // the minimize / close buttons float above the book: hidden while a leaf turns, back when it lands (Andrew, 2026-09-27)
    this.win.el.classList.add("turning");
    const done = () => {
      if (!book.classList.contains(from)) return;
      clearTimeout(this.turnTimer); flap.removeEventListener("transitionend", onEnd);
      this.win.el.classList.remove("turning");
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
      clearTimeout(this.turnTimer); this.win.el.classList.remove("turning");   // a turn cut short must not leave the buttons hidden
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
        : p.kind === "claimed"
          ? h("button", { type: "button", className: "tab claimed" + (p.n === 1 ? " first" : ""), html: icon("check", 16), title: "Claimed" + (p.of > 1 ? ` ${p.n} of ${p.of}` : ""), onclick: () => this.go(i) })
          : h("button", { type: "button", className: "tab", text: String(p.n), title: `Page ${p.n} of ${p.of}`, onclick: () => this.go(i) }));
    });
  }

  showPage(i, keep = null) {
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
    if (p.kind === "claimed" && !p.cards.length) box.append(h("div", { className: "hint", text: CLAIMED_HINT }));
    this.$(".pageno").textContent = p.kind === "bookmark" ? "Bookmarks" + (p.of > 1 ? ` ${p.n} / ${p.of}` : "") : p.kind === "claimed" ? "Claimed" + (p.of > 1 ? ` ${p.n} / ${p.of}` : "") : `${p.n} / ${p.of}`;
    if (keep && p.cards.includes(keep)) this.select(keep, { quiet: true });   // the same card, re-read: keep it, do not retype the screen
    else if (this.sel && !p.cards.includes(this.sel)) this.select(null);
    this.syncKeys();
  }

  /** A character's printed card: the plaque prints the SHORT name (Gon, not Gon Freecss); no card picture yet, the avatar stands in. */
  printed(c) {
    return new GICard({ no: c.no, name: c.first || c.name, rank: c.rank, description: cardText(c), alt: c.name,
      image: c.card_image_id ? `/hxh/api/db/images/${c.card_image_id}` : (c.avatar_image_id ? `/hxh/api/db/images/${c.avatar_image_id}` : null) });
  }

  /** A sleeve holding one printed card. */
  cardEl(c) {
    const b = h("button", { type: "button", className: "card" + (c === this.sel ? " on" : ""), dataset: { id: String(c.id) }, title: c.name, onclick: () => this.select(c) });
    const card = this.printed(c);
    card.mount(b);
    this.renderStamps(card, c);
    this.cards.set(c.id, card);
    return b;
  }

  idle() {
    this.$(".screen").innerHTML = `<div class="idle"><div class="emblem"></div><div class="ja">カードを選択</div></div>`;
  }

  select(c, { quiet = false } = {}) {
    this.sel = c;
    this.$(".cards").querySelectorAll(".card").forEach(b => b.classList.toggle("on", b.dataset.id === String(c && c.id)));
    this.syncKeys();
    if (quiet) return;
    const scr = this.$(".screen");
    this.typer?.skip?.();
    this.stopRun();
    this.bigCard?.unmount(); this.bigCard = null;
    if (!c) { this.idle(); return; }
    const t = typeOf(c);
    const types = (c.nen_types || []).length ? c.nen_types.map(n => (TYPES.find(x => x.slug === n) || {}).name || n).join(" / ") : "—";
    const arms = (c.arms || []).length ? c.arms.map(titleCase).join(", ") : "—";
    scr.innerHTML = `<div class="prof">
      <div class="top">No.${esc(cardNo(c))}「${esc(c.first || c.name)}」</div>
      <div class="name">${esc(c.name)}</div>
      <div class="line">Nen: <b style="color:${t.hex}">${esc(types)}</b>${c.affiliation ? ` · <b>${esc(c.affiliation)}</b>` : ""}</div>
      <div class="line">Arms: <b>${esc(arms)}</b></div>
      <div class="desc"></div>
      <div class="status">所持者 0名 ／ 残り ${LIMIT[c.rank] || 4}枚</div></div>`;
    scr.scrollTop = 0;
    this.play(c);
  }

  /** Stop a pick's screen sequence (its timers and its follow). */
  stopRun() {
    const r = this.run;
    if (!r) return;
    r.timers.forEach(clearTimeout); clearInterval(r.follow);
    this.run = null;
  }

  /**
   * A pick on the screen (Andrew, 2026-09-27: "start with the enlarged
   * card first showing on the screen, then scroll down to do the typing.
   * The user may scroll up while the typing continues"). The whole card
   * comes first, above the profile, as big as the screen shows whole
   * (BIG_W of its width, never taller than it), painting in top to bottom
   * like a picture over a slow modem; after GLIDE_PAUSE the screen glides
   * down to the profile — a screenful of its own — and types it. The
   * typing keeps the reader at the bottom only while they stay there: a
   * reader who scrolls up to the card is left there, and one who scrolls
   * before the glide is not glided at all. Reduced motion: no paint-in,
   * no glide, the text typed at once below the card.
   */
  play(c) {
    const scr = this.$(".screen"), prof = scr.querySelector(".prof");
    const cs = getComputedStyle(scr), px = v => parseFloat(v) || 0;
    const room = { w: scr.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight), h: scr.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) };
    const o = this.options, reduced = !!this.os.env.reduced;
    const reveal = o.revealMs ?? REVEAL_MS, pause = o.glidePause ?? GLIDE_PAUSE, speed = o.typeMs ?? TYPE_MS;
    const r = this.run = { c, timers: [], follow: null, gliding: false, typing: false, pinned: false, moved: false, expect: null };
    const later = (ms, fn) => r.timers.push(setTimeout(() => { if (this.run === r) fn(); }, ms));
    const w = Math.max(80, Math.floor(Math.min(room.w * BIG_W, room.h / CARD_RATIO)));
    const box = h("div", { className: "big" + (reduced ? "" : " load") });
    box.style.width = w + "px";
    scr.insertBefore(box, prof);
    const card = this.bigCard = this.printed(c);
    card.mount(box);
    card.el.style.animationDuration = reveal + "ms";
    this.renderStamps(card, c);
    prof.style.minHeight = Math.max(0, room.h) + "px";   // a screenful of its own, so the glide can bring its top to the top
    const typeIt = () => {
      r.typing = true;
      r.follow = setInterval(() => {
        if (!r.pinned) return;
        const bottom = scr.scrollHeight - scr.clientHeight;
        if (scr.scrollTop >= bottom - 1) return;
        scr.scrollTop = bottom; r.expect = scr.scrollTop;   // an own scroll: the listener lets exactly its event pass
      }, 80);
      this.typer = type(prof.querySelector(".desc"), [c.description || ""], { speed, reduced, onDone: () => clearInterval(r.follow) });
    };
    if (reduced) { typeIt(); return; }
    later(reveal + pause, () => {
      if (r.moved) { typeIt(); return; }   // the reader already took the screen: leave it where they put it
      // the profile is exactly a screenful at this point, so its top is the screen's last scroll position; not offsetTop,
      // which Safari scales by the page zoom (it aimed ~30 px short on Abi's iPad and the follow then jumped)
      const top = scr.scrollHeight - scr.clientHeight;
      const land = () => { if (this.run !== r || !r.gliding) return; r.gliding = false; r.pinned = true; typeIt(); };
      r.gliding = true;
      if (!scr.scrollTo || Math.abs(scr.scrollTop - top) < 2) { scr.scrollTop = top; land(); return; }
      scr.addEventListener("scrollend", land, { once: true });
      later(900, land);   // a browser without scrollend
      scr.scrollTo({ top, behavior: "smooth" });
    });
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
