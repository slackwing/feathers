/* Splash — the OS's title screen, between the black boot screen and the
   desktop (Andrew, 2026-09-27: "sort of like the OS splash screen… the
   Windows 98 splash… instead of the OS, i want it to say Hunter x
   Halloween, it's like the intro to this site, supposed to wow everyone…
   try 3 different styles, and randomize which loads"). It never moves on
   by itself: every style says "Click to start", and a click, tap, Enter,
   Space or Escape dismisses it — with a short original startup chime when
   Sounds are on (the click is the gesture a browser wants before audio).
   Settings › Other › Splash screen shows any of them again, over the
   desktop, until clicked. It comes after the logon, never before it.

   The three:
     summons  the site's first landing page (tag hxh-pre-retro), revived:
              ink and paper grain, a red glow from above, the slab-serif
              HUNTER over a pumpkin HALLOWEEN, the pulsing blood-red ✕,
              the kana, embers rising.
     select   a retro fighting game's PLAYER SELECT (Andrew, 2026-09-27:
              "like a retro street fighter game character selection
              screen using randomly selected character avatars"): the
              title in chrome-gradient italic over Andrew's key-art
              backdrop (img/select-bg.jpg, dimmed), a grid of the
              Binder's characters' avatars, the 1P and 2P
              cursors hopping about as in attract mode, the big portraits
              and name plates they point at, and CREDIT 01. The roster is
              read at show time (/hxh/api/db/binder — the splash runs
              after sign-in); without it the tiles are ??? silhouettes.
     night    an arcade attract screen at the wallpaper's own 5-px grain:
              stars, a harvest moon on the sea, Netero's blimp (Abi's
              drawing) drifting across it, the title in pixel type and a
              blinking CLICK TO START.

   Everything is sized in container units of the full-screen root (which
   is `container-type: size`), so the desktop's CSS zoom cannot distort it.
   Under reduced motion each is a still picture. No copyrighted art. */
import { Component } from "./component.js";
import { h, esc } from "./dom.js";
import { SHIP_SRC } from "./blimp.js";
import { geometry, islandLayer, drawPier, ISLAND_W, ISLAND_H, TOWN_X, house } from "./wallpaper.js";
import "./splash.css";

export const SPLASHES = [
  ["summons", "Summons"],
  ["select", "Heavens Arena", { prompt: "COMING SOON", chime: false }],   // the arena's placeholder, whoever opens it (Andrew, 2026-09-27)
  ["night", "Night"],
];
/** What each splash IS, beyond its picture — its prompt and whether it chimes — so the app, Settings › Other › Splash
    screen and anything else that shows it show the same thing. */
export const SPLASH_DEFAULTS = Object.fromEntries(SPLASHES.map(([id, , d]) => [id, d || {}]));
export const SPLASH_IDS = SPLASHES.map(([id]) => id);
/** Under every splash on a phone (Env.small). */
export const BEST_VIEWED = "For the best experience, visit on a tablet or computer.";   // Andrew, 2026-09-28: "best experienced… for best experience"
/** The one the site opens with: the Summons is the site's anchor (Andrew, 2026-09-27). Player Select is the Heavens Arena
    placeholder (apps/arena.js); Night lives only in Settings › Other › Splash screen. */
export const STARTUP_SPLASH = "summons";

/** A style at random (the page's first load picks one). */
export function randomSplash(random = Math.random) {
  return SPLASH_IDS[Math.min(SPLASH_IDS.length - 1, Math.floor(random() * SPLASH_IDS.length))];
}

const X = `<span class="x">×</span>`;

/* ---------- summons: the first landing page, revived ---------- */
function summons(el, { reduced, random, prompt = "Click to start" }) {
  el.innerHTML = `
    <div class="sp-grain"></div>
    <div class="sp-embers"></div>
    <div class="sp-center">
      <div class="sp-assoc">Hunter Association · Official Summons</div>
      <h1 class="sp-logo">HUNTER${X}<br><span class="hallow">HALLOWEEN</span></h1>
      <div class="sp-kana">ハンター×ハロウィン</div>
      <div class="sp-start">${esc(prompt)}</div>
    </div>`;
  if (!reduced) embers(el.querySelector(".sp-embers"), random);
  return () => {};
}

/** The Summons' rising embers, into `box`. */
function embers(box, random) {
  for (let i = 0; i < 26; i++) {
    const s = h("i");
    s.style.left = (random() * 100).toFixed(1) + "%";
    s.style.animationDelay = (-random() * 9).toFixed(2) + "s";
    s.style.animationDuration = (6 + random() * 6).toFixed(2) + "s";
    s.style.setProperty("--drift", ((random() - 0.5) * 12).toFixed(1) + "cqw");
    s.style.setProperty("--size", (0.25 + random() * 0.45).toFixed(2) + "cqmin");
    box.append(s);
  }
}

/** The Summons without its title — its ink, glow, grain and embers — as a page's background under the windows: the
    account pages' dialog sits on it (Andrew, 2026-09-28: "lay it over the splash's floating ember/orange bits
    background… remove the hero stuff and put the dialog there instead"). */
export class EmberBackdrop extends Component {
  /** props: reduced, random */
  render() {
    const { reduced = false, random = Math.random } = this.props;
    const el = h("div", { className: `splash-bg sp-summons${reduced ? " still" : ""}`, "aria-hidden": "true" });
    el.innerHTML = `<div class="sp-grain"></div><div class="sp-embers"></div>`;
    if (!reduced) embers(el.querySelector(".sp-embers"), random);
    return el;
  }
}

/* ---------- select: a retro fighting game's PLAYER SELECT ---------- */
export const SELECT_TILES = 12;

/** The Binder's characters that have an avatar, shuffled; [] when the roster cannot be read. */
export async function selectRoster(fetch, random = Math.random) {
  if (!fetch) return [];
  try {
    const r = await fetch("/hxh/api/db/binder", { credentials: "same-origin" });
    if (!r.ok) return [];
    const list = (await r.json()).filter(c => c && c.avatar_image_id);
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    return list.slice(0, SELECT_TILES).map(c => ({ name: String(c.first || c.name || "???").toUpperCase(), src: `/hxh/api/db/images/${c.avatar_image_id}/thumb` }));
  } catch { return []; }
}

/** A fighter's portrait: the avatar itself, smooth (Andrew, 2026-09-27: "don't pixelate the avatars"), cropped to the square by CSS. */
function portrait(doc, src) {
  const i = doc.createElement("img");
  i.alt = ""; i.draggable = false; i.src = src;
  return i;
}

function select(el, { reduced, random, fetch, prompt = "CLICK TO START" }) {
  el.innerHTML = `
    <div class="sp-backdrop"></div>
    <div class="sp-head">HEAVENS ARENA</div>
    <div class="sp-stage">
      <div class="sp-fighter p1"><div class="sp-big"></div><div class="sp-plate"></div></div>
      <div class="sp-grid"></div>
      <div class="sp-fighter p2"><div class="sp-big"></div><div class="sp-plate"></div></div>
    </div>
    <div class="sp-start">${esc(prompt)}</div>
    <div class="sp-credit"><span>1P</span><span>CREDIT 01</span></div>`;
  const doc = el.ownerDocument, win = doc.defaultView;
  const grid = el.querySelector(".sp-grid");
  let fighters = Array.from({ length: SELECT_TILES }, () => ({ name: "???", img: null }));
  const tiles = fighters.map((_, i) => { const t = h("div", { className: "sp-tile", dataset: { i: String(i) } }, h("div", { className: "sp-sil" })); grid.append(t); return t; });
  const cur = { p1: 0, p2: SELECT_TILES - 1 };
  const show = () => {
    for (const t of tiles) t.classList.remove("p1", "p2");
    tiles[cur.p1].classList.add("p1"); tiles[cur.p2].classList.add("p2");
    for (const who of ["p1", "p2"]) {
      const f = fighters[cur[who]], box = el.querySelector(`.sp-fighter.${who}`);
      box.querySelector(".sp-plate").textContent = f.name;
      const big = box.querySelector(".sp-big");
      big.replaceChildren(f.img ? portrait(doc, f.img.src) : h("div", { className: "sp-sil" }));
    }
  };
  show();
  let stopped = false;
  selectRoster(fetch, random).then(list => {
    if (stopped || !list.length) return;
    list.forEach((f, i) => {
      const img = new win.Image();
      img.onload = () => {
        if (stopped) return;
        fighters[i] = { name: f.name, img };
        tiles[i].replaceChildren(portrait(doc, img.src));
        if (cur.p1 === i || cur.p2 === i) show();
      };
      img.src = f.src;
      fighters[i] = { name: f.name, img: null };
    });
    show();
  });
  if (reduced) return () => { stopped = true; };
  // attract mode: each cursor hops to a neighbouring tile now and then, the big portrait follows
  const cols = () => (win.getComputedStyle?.(grid).gridTemplateColumns || "").split(" ").filter(Boolean).length || 6;
  const hop = k => {
    const n = cols(), r = Math.floor(k / n), c = k % n, moves = [];
    if (c > 0) moves.push(k - 1); if (c < n - 1 && k + 1 < SELECT_TILES) moves.push(k + 1);
    if (r > 0) moves.push(k - n); if (k + n < SELECT_TILES) moves.push(k + n);
    return moves[Math.floor(random() * moves.length)] ?? k;
  };
  const timer = win.setInterval(() => { if (random() < 0.7) cur.p1 = hop(cur.p1); if (random() < 0.7) cur.p2 = hop(cur.p2); show(); }, 650);
  return () => { stopped = true; win.clearInterval(timer); };
}

/* ---------- night: an arcade attract screen at the wallpaper's grain ---------- */
/** A stable pseudo-random number in [0, 1) for a pixel and a frame (the glints' shimmer). */
const glint = (x, y, f) => { const v = Math.sin(x * 12.9898 + y * 78.233 + f * 37.719) * 43758.5453; return v - Math.floor(v); };

/* The desktop's Whale Island, pixel for pixel (wallpaper.js islandLayer), at night (Andrew, 2026-09-27): every colour
   of the day art mapped to a dark, moonlit purple — almost a shadow — with the harbour town's windows lit. */
export const NIGHT_ISLAND = {
  "#24552b": "#150d2a", "#2f6f35": "#1c1236", "#3f8c42": "#261a48", "#7cc26a": "#3d2d6e",   // forest; its ridge catches the moon
  "#c9b88a": "#34284f",                                                                        // beach
  "#c8102e": "#3b1633", "#ff7518": "#4a2436", "#e8dcc3": "#3c3352", "#7c4dff": "#2c2160",      // roofs
  "#efe3c8": "#2a2140", "#0b0a08": "#0b0612",                                                  // walls, doors
  "#fff6e0": "#8a7fb4", "#f1e6cc": "#6f6598", "#dccb9f": "#554b7c", "#b8a071": "#3d3460",      // the rock spire, surf
  "#8b6d4b": "#241a33",                                                                        // the pier
};
/** The night sea: the sky's purples mirrored and much darker, horizon first to the foreground, which is almost black
    (Andrew, 2026-09-27: "much darker shades, it's fine if it even almost seems black by the darkest"). */
export const SEA_BANDS = ["#0b0617", "#070410", "#040209", "#010003"];   // all but black, a purple breath at the top (Andrew, 2026-09-27: "even closer to black, all shades")
export const SEA_HORIZON = "#170c2e";          // a faint lit line where sea meets sky
export const ISLAND_SHADOW = "#040209";        // the island's dithered shadow on the water
export const WINDOW_LIGHTS = ["#ffd35a", "#ffb347"];
export const WINDOW_LIT = 0.8;   // "lights in most windows"
/** Where a house has windows (island space): both upper corners and the lower one beside the door. */
export function townWindows() {
  const out = [];
  TOWN_X.forEach((x, i) => {
    const { w, top } = house(x, i);
    for (const [wx, wy] of [[x, top + 1], [x + w - 1, top + 1], [x + w - 1, ISLAND_H - 2]]) if (!out.some(([a, b]) => a === wx && b === wy)) out.push([wx, wy]);
  });
  return out;
}
/** The lit ones — stable from visit to visit. */
export const litWindows = () => townWindows().filter(([x, y]) => glint(x, y, 3.1) < WINDOW_LIT);
const hex2 = (r, g, b) => "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
/** The island layer at night, or null without a canvas. */
export function nightIsland(doc) {
  const isl = islandLayer(doc);
  if (!isl) return null;
  const g = isl.getContext("2d"), img = g.getImageData(0, 0, ISLAND_W, ISLAND_H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const n = NIGHT_ISLAND[hex2(d[i], d[i + 1], d[i + 2])];
    const [r, gg, b] = n ? [1, 3, 5].map(k => parseInt(n.slice(k, k + 2), 16)) : [d[i] * 0.2 + 17, d[i + 1] * 0.2 + 10, d[i + 2] * 0.2 + 34];   // anything unmapped: sunk into the night
    d[i] = r; d[i + 1] = gg; d[i + 2] = b;
  }
  g.putImageData(img, 0, 0);
  for (const [x, y] of litWindows()) { g.fillStyle = WINDOW_LIGHTS[glint(y, x, 5.7) < 0.7 ? 0 : 1]; g.fillRect(x, y, 1, 1); }
  return isl;
}

/** How long one glint keeps its state before it re-rolls, in seconds. The re-rolls are staggered pixel by pixel, so at
    any moment only a small share of the road changes: a shimmer, not static (Andrew, 2026-09-27: "too random and
    chaotic… only swap a certain proportion at a time"). */
export const GLINT_CYCLE = 4.5;   // 3.2 until the road grew sparse (2026-09-27): fewer glints make each re-roll a larger share of the lit ones

/**
 * The moon's road on the water, as lit pixels [x, y, colour] at time t
 * (s): nearly the moon's width at the horizon, widening a little toward
 * the viewer, densest at the top and thinning as it comes down, softer
 * at its sides (not a Christmas tree). Each pixel re-rolls once per
 * GLINT_CYCLE at its own offset.
 */
export function moonRoad({ H, HZ, MX, MR }, t) {
  const out = [], depth = H - HZ;
  for (let y = HZ + 1; y < H; y++) {
    // a wide trapezoid — the road spreads toward us as over a long stretch of water — and far sparser, thinning fast
    // (Andrew, 2026-09-27: "widen the trapezoid… too straight for the distance… reduce the density more dramatically")
    const d = (y - HZ) / depth, half = MR * (0.8 + 2.2 * d), dens = 0.34 * Math.pow(1 - d, 2.6) + 0.006;
    for (let x = Math.floor(MX - half); x <= Math.ceil(MX + half); x++) {
      const edge = 1 - Math.pow(Math.abs(x - MX) / half, 2);
      if (edge <= 0) continue;
      const f = Math.floor(t / GLINT_CYCLE + glint(x, y, 7.3));   // this pixel's own epoch: it changes when its offset comes round
      if (glint(x, y, f) >= dens * edge) continue;
      out.push([x, y, d < 0.25 ? (glint(y, x, f) < 0.5 ? "#fff3c9" : "#ffd98a") : d < 0.6 ? "#ffd98a" : "#c9a45e"]);
    }
  }
  return out;
}
function night(el, { reduced, random, prompt = "CLICK TO START" }) {
  el.innerHTML = `
    <canvas class="sp-sky px" aria-hidden="true"></canvas>
    <img class="sp-ship" src="${SHIP_SRC}" alt="" draggable="false">
    <div class="sp-title">
      <div class="sp-top">PURPLE SQUARE PRESENTS</div>
      <div class="sp-big">HUNTER${X}</div>
      <div class="sp-big hallow">HALLOWEEN</div>
    </div>
    <div class="sp-start">${esc(prompt)}</div>
    <div class="sp-foot">© 2026 HUNTER ASSOCIATION</div>`;
  const canvas = el.querySelector(".sp-sky");
  const g = canvas.getContext?.("2d");
  const win = el.ownerDocument.defaultView;
  if (!g) return () => {};
  const r = el.getBoundingClientRect();
  // the wallpaper's own geometry — its scale, horizon and centring — so the island sits exactly where the desktop's does
  const { W, H, HZ, OX } = geometry(win.innerWidth || r.width || 1366, win.innerHeight || r.height || 900);
  canvas.width = W; canvas.height = H;
  const MR = Math.max(6, Math.round(Math.min(W, H) * 0.11));
  const MX = Math.round(W * 0.84), MY = Math.max(MR + 4, Math.round(H * 0.17));   // high and to the right, clear of the title
  const stars = Array.from({ length: Math.round(W * H / 170) }, () => ({ x: Math.floor(random() * W), y: Math.floor(random() * HZ * 0.95), p: random() * 6.28, b: random() }));
  const bands = ["#0a0620", "#120a33", "#1b0f44", "#261554", "#321a60"];
  // the still part — sky bands, moon, sea — painted once; each frame lays it down and adds stars and glints
  const bg = el.ownerDocument.createElement("canvas");
  bg.width = W; bg.height = H;
  const b = bg.getContext("2d") || g;
  for (let y = 0; y < HZ; y++) {   // five night bands, checker-dithered at their edges like the original sky
    const f = (y / HZ) * bands.length, i = Math.min(bands.length - 1, Math.floor(f)), frac = f - i;
    for (let x = 0; x < W; x++) { b.fillStyle = frac > 0.8 && (x + y) % 2 && i < bands.length - 1 ? bands[i + 1] : bands[i]; b.fillRect(x, y, 1, 1); }
  }
  for (let y = -MR - 4; y <= MR + 4; y++) for (let x = -MR - 4; x <= MR + 4; x++) {   // the harvest moon and a dithered halo
    const d = Math.hypot(x, y);
    if (d <= MR) b.fillStyle = "#ffd98a";
    else if (d <= MR + 2 && (x + y) % 2 === 0) b.fillStyle = "#5a3d6e";
    else continue;
    b.fillRect(MX + x, MY + y, 1, 1);
  }
  b.fillStyle = "#f2c56a";
  for (const [cx, cy, cr] of [[-0.35, -0.2, 0.22], [0.3, 0.25, 0.16], [0.05, -0.45, 0.1]]) {
    for (let y = -MR; y <= MR; y++) for (let x = -MR; x <= MR; x++) if (Math.hypot(x - cx * MR, y - cy * MR) <= cr * MR && Math.hypot(x, y) <= MR) b.fillRect(MX + x, MY + y, 1, 1);
  }
  // the sea reflects the sky (Andrew, 2026-09-27: purple like the sky, not blue; darker): the sky's own purples
  // mirrored and deepened — lightest just under the horizon, darkening toward us — its band edges dithered like the sky's
  const sea = SEA_BANDS, depth = H - HZ;
  for (let y = HZ; y < H; y++) {
    const f = ((y - HZ) / depth) * sea.length, i = Math.min(sea.length - 1, Math.floor(f)), frac = f - i;
    for (let x = 0; x < W; x++) { b.fillStyle = frac > 0.8 && (x + y) % 2 && i < sea.length - 1 ? sea[i + 1] : sea[i]; b.fillRect(x, y, 1, 1); }
  }
  b.fillStyle = SEA_HORIZON; b.fillRect(0, HZ, W, 1);
  // the island's shadow on the water, as on the desktop's sea, and the town's windows glimmering in it
  for (let y = HZ; y < HZ + 7; y++) for (let x = OX + 97; x < OX + 240; x++) if ((x + y) % 2 === 0) { b.fillStyle = ISLAND_SHADOW; b.fillRect(x, y, 1, 1); }
  const isle = nightIsland(el.ownerDocument);
  const IY = HZ - ISLAND_H;
  let onIsle = () => false;
  if (isle) {
    b.drawImage(isle, OX, IY);
    const m = isle.getContext("2d").getImageData(0, 0, ISLAND_W, ISLAND_H).data;
    onIsle = (x, y) => { const ix = x - OX, iy = y - IY; return ix >= 0 && ix < ISLAND_W && iy >= 0 && iy < ISLAND_H && m[(iy * ISLAND_W + ix) * 4 + 3] > 0; };
    for (const [x, y] of litWindows()) for (const k of [2, 4]) { b.fillStyle = "#6b5424"; b.fillRect(OX + x, HZ + (ISLAND_H - 1 - y) + k, 1, 1); }   // their reflections, dim, under each window
  }
  drawPier(b, OX, HZ, NIGHT_ISLAND["#8b6d4b"]);
  const paint = t => {
    if (bg !== canvas && b !== g) g.drawImage(bg, 0, 0);
    for (const s of stars) {
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + s.p);
      if (tw < 0.25) continue;
      if (Math.hypot(s.x - MX, s.y - MY) <= MR + 3) continue;   // not in front of the moon
      if (onIsle(s.x, s.y)) continue;   // nor in front of the island
      g.fillStyle = s.b > 0.85 && tw > 0.85 ? "#ffffff" : tw > 0.6 ? "#e8dcc3" : "#8a7fb0";
      g.fillRect(s.x, s.y, 1, 1);
    }
    for (const [x, y, col] of moonRoad({ H, HZ, MX, MR }, t)) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  };
  if (reduced) { paint(0); return () => {}; }
  paint(0);
  const timer = win.setInterval(() => paint((win.performance?.now?.() ?? Date.now()) / 1000), 180);   // a few fps, like the wallpaper
  return () => win.clearInterval(timer);
}

const BUILD = { summons, select, night };

/* ---------- the overlay ---------- */
export class Splash extends Component {
  /** props: reduced, random, sounds ({ play(name) }), fetch (Player Select reads the roster) */
  render() { return h("div", { className: "splashscreen", role: "button", tabindex: "0", "aria-label": "Click to start", hidden: true }); }

  get showing() { return !this.el.hidden; }

  /**
   * Show a style (default: one at random) until the viewer clicks, taps or
   * presses Enter / Space / Escape. Resolves with the style's id. Showing
   * another while one is up replaces it. The prompt and chime are the
   * style's own (SPLASH_DEFAULTS: Heavens Arena says COMING SOON and dismisses
   * silently); `prompt` / `chime` override them.
   */
  show(id = null, opts = {}) {
    const { reduced = false, random = Math.random } = this.props;
    if (!SPLASH_IDS.includes(id)) id = randomSplash(random);
    const { prompt, chime = true } = { ...SPLASH_DEFAULTS[id], ...opts };
    this.finish?.(false);
    const el = this.el;
    el.className = `splashscreen sp-${id}${reduced ? " still" : ""}`;
    el.dataset.style = id;
    el.hidden = false;
    el.ownerDocument.body.classList.add("splashing");   // the windows step aside while it is up, and come back as they were (Andrew, 2026-10-09)
    const stop = BUILD[id](el, { reduced, random, fetch: this.props.fetch, ...(prompt ? { prompt } : {}) });
    // on a phone, the old web's courtesy line (Andrew, 2026-09-28: "please view in a tablet or browser for the best experience")
    // placed right under the prompt, wherever each style puts it (Andrew, 2026-09-28: "much bigger and closer to the CLICK TO START")
    if (this.props.small?.()) { const note = h("div", { className: "sp-best", text: BEST_VIEWED }), start = el.querySelector(".sp-start"); start ? start.after(note) : el.append(note); }
    el.setAttribute("aria-label", prompt || "Click to start");
    el.focus?.({ preventScroll: true });
    return new Promise(resolve => {
      const onKey = e => { if (["Enter", " ", "Escape"].includes(e.key)) { e.preventDefault(); done(true); } };
      // the second click of a double-click is not a dismissal: a desktop icon opens on one click, and a Windows
      // habit double-click (Heavens Arena) would otherwise open the splash and close it again at once
      const onClick = e => { e.stopPropagation(); if (e.detail > 1) return; done(true); };
      const done = gesture => {
        el.removeEventListener("click", onClick);
        el.ownerDocument.removeEventListener("keydown", onKey, true);
        this.finish = null;
        stop();
        el.hidden = true;
        el.ownerDocument.body.classList.remove("splashing");
        el.replaceChildren();
        if (gesture && chime) this.props.sounds?.play?.("startup");
        resolve(id);
      };
      this.finish = done;
      el.addEventListener("click", onClick);
      el.ownerDocument.addEventListener("keydown", onKey, true);
    });
  }
}
