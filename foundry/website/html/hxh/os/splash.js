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
import { h } from "./dom.js";
import { SHIP_SRC } from "./blimp.js";
import "./splash.css";

export const SPLASHES = [
  ["summons", "Summons"],
  ["select", "Player Select"],
  ["night", "Night"],
];
export const SPLASH_IDS = SPLASHES.map(([id]) => id);

/** A style at random (the page's first load picks one). */
export function randomSplash(random = Math.random) {
  return SPLASH_IDS[Math.min(SPLASH_IDS.length - 1, Math.floor(random() * SPLASH_IDS.length))];
}

const X = `<span class="x">×</span>`;

/* ---------- summons: the first landing page, revived ---------- */
function summons(el, { reduced, random }) {
  el.innerHTML = `
    <div class="sp-grain"></div>
    <div class="sp-embers"></div>
    <div class="sp-center">
      <div class="sp-assoc">Hunter Association · Official Summons</div>
      <h1 class="sp-logo">HUNTER${X}<br><span class="hallow">HALLOWEEN</span></h1>
      <div class="sp-kana">ハンター×ハロウィン</div>
      <div class="sp-start">Click to start</div>
    </div>`;
  if (!reduced) {
    const box = el.querySelector(".sp-embers");
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
  return () => {};
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

function select(el, { reduced, random, fetch }) {
  el.innerHTML = `
    <div class="sp-backdrop"></div>
    <div class="sp-head">PLAYER SELECT</div>
    <div class="sp-logo"><span class="w1">HUNTER</span><span class="x">×</span><span class="w2">HALLOWEEN</span></div>
    <div class="sp-stage">
      <div class="sp-fighter p1"><div class="sp-big"></div><div class="sp-plate"></div></div>
      <div class="sp-grid"></div>
      <div class="sp-fighter p2"><div class="sp-big"></div><div class="sp-plate"></div></div>
    </div>
    <div class="sp-start">CLICK TO START</div>
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
const GRAIN = 5;
function night(el, { reduced, random }) {
  el.innerHTML = `
    <canvas class="sp-sky px" aria-hidden="true"></canvas>
    <img class="sp-ship" src="${SHIP_SRC}" alt="" draggable="false">
    <div class="sp-title">
      <div class="sp-top">PURPLE SQUARE PRESENTS</div>
      <div class="sp-big">HUNTER${X}</div>
      <div class="sp-big hallow">HALLOWEEN</div>
      <div class="sp-start">CLICK TO START</div>
    </div>
    <div class="sp-foot">© 2026 HUNTER ASSOCIATION</div>`;
  const canvas = el.querySelector(".sp-sky");
  const g = canvas.getContext?.("2d");
  const win = el.ownerDocument.defaultView;
  if (!g) return () => {};
  const r = el.getBoundingClientRect();
  const W = Math.max(40, Math.ceil((r.width || 1366) / GRAIN)), H = Math.max(30, Math.ceil((r.height || 900) / GRAIN));
  canvas.width = W; canvas.height = H;
  const HZ = Math.round(H * 0.72), MR = Math.max(6, Math.round(Math.min(W, H) * 0.11));
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
  b.fillStyle = "#0c1a3a"; b.fillRect(0, HZ, W, H - HZ);   // the sea
  b.fillStyle = "#081229"; b.fillRect(0, HZ + Math.round((H - HZ) * 0.45), W, H - HZ);
  b.fillStyle = "#16294f"; b.fillRect(0, HZ, W, 1);
  const paint = t => {
    if (bg !== canvas && b !== g) g.drawImage(bg, 0, 0);
    for (const s of stars) {
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + s.p);
      if (tw < 0.25) continue;
      if (Math.hypot(s.x - MX, s.y - MY) <= MR + 3) continue;   // not in front of the moon
      g.fillStyle = s.b > 0.85 && tw > 0.85 ? "#ffffff" : tw > 0.6 ? "#e8dcc3" : "#8a7fb0";
      g.fillRect(s.x, s.y, 1, 1);
    }
    // the moon's road on the water (Andrew, 2026-09-27: not a Christmas tree): nearly the moon's width at the horizon,
    // widening a little toward us, its glints densest at the top and thinning as it comes down; they shimmer frame to frame
    const frame = Math.floor(t * 5), depth = H - HZ;
    for (let y = HZ + 1; y < H; y++) {
      const d = (y - HZ) / depth, half = MR * (0.85 + 0.45 * d), dens = 0.62 * Math.pow(1 - d, 1.7) + 0.025;
      for (let x = Math.floor(MX - half); x <= Math.ceil(MX + half); x++) {
        const edge = 1 - Math.pow(Math.abs(x - MX) / half, 2);   // softer toward the road's sides
        if (edge <= 0 || glint(x, y, frame) >= dens * edge) continue;
        g.fillStyle = d < 0.25 ? (glint(y, x, frame) < 0.5 ? "#fff3c9" : "#ffd98a") : d < 0.6 ? "#ffd98a" : "#c9a45e";
        g.fillRect(x, y, 1, 1);
      }
    }
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
   * another while one is up replaces it.
   */
  show(id = null) {
    const { reduced = false, random = Math.random } = this.props;
    if (!SPLASH_IDS.includes(id)) id = randomSplash(random);
    this.finish?.(false);
    const el = this.el;
    el.className = `splashscreen sp-${id}${reduced ? " still" : ""}`;
    el.dataset.style = id;
    el.hidden = false;
    const stop = BUILD[id](el, { reduced, random, fetch: this.props.fetch });
    el.focus?.({ preventScroll: true });
    return new Promise(resolve => {
      const onKey = e => { if (["Enter", " ", "Escape"].includes(e.key)) { e.preventDefault(); done(true); } };
      const onClick = e => { e.stopPropagation(); done(true); };
      const done = gesture => {
        el.removeEventListener("click", onClick);
        el.ownerDocument.removeEventListener("keydown", onKey, true);
        this.finish = null;
        stop();
        el.hidden = true;
        el.replaceChildren();
        if (gesture) this.props.sounds?.play?.("startup");
        resolve(id);
      };
      this.finish = done;
      el.addEventListener("click", onClick);
      el.ownerDocument.addEventListener("keydown", onKey, true);
    });
  }
}
