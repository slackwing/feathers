/* Splash — the OS's title screen, between the black boot screen and the
   desktop (Andrew, 2026-09-27: "sort of like the OS splash screen… the
   Windows 98 splash… instead of the OS, i want it to say Hunter x
   Halloween, it's like the intro to this site, supposed to wow everyone…
   try 3 different styles, and randomize which loads"). It never moves on
   by itself: every style says "Click to start", and a click, tap, Enter,
   Space or Escape dismisses it — with a short original startup chime when
   Sounds are on (the click is the gesture a browser wants before audio).
   Settings › Other › Splash screen shows any of them again, over the
   desktop, until clicked.

   The three:
     summons  the site's first landing page (tag hxh-pre-retro), revived:
              ink and paper grain, a red glow from above, the slab-serif
              HUNTER over a pumpkin HALLOWEEN, the pulsing blood-red ✕,
              the kana, embers rising.
     clouds   the Windows 98 splash, our way: a sky of soft clouds, a cloth
              flag with the ✕ waving and shedding little squares from its
              trailing edge, the wordmark with a superscript year, and the
              sliding bar along the bottom.
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
  ["clouds", "Clouds"],
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

/* ---------- clouds: the Windows 98 splash, our way ---------- */
/** The flag's cloth, flat: cream field, ink border, the bold red ✕, a pumpkin hem. */
function drawCloth(doc, W, H) {
  const c = doc.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#fff6e0"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#ff7518"; g.fillRect(0, H * 0.84, W, H * 0.16);
  const cx = W * 0.5, cy = H * 0.42, r = H * 0.3;
  g.lineCap = "round";
  for (const [w, col] of [[H * 0.2, "#0b0a08"], [H * 0.13, "#c8102e"]]) {
    g.strokeStyle = col; g.lineWidth = w;
    g.beginPath(); g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r); g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r); g.stroke();
  }
  g.strokeStyle = "#0b0a08"; g.lineWidth = Math.max(2, H * 0.03); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, H - g.lineWidth);
  return c;
}

function clouds(el, { reduced, random }) {
  el.innerHTML = `
    <div class="sp-cloud c1"></div><div class="sp-cloud c2"></div><div class="sp-cloud c3"></div><div class="sp-cloud c4"></div><div class="sp-cloud c5"></div>
    <div class="sp-lockup">
      <canvas class="sp-flag" aria-hidden="true"></canvas>
      <div class="sp-word">
        <div class="sp-maker">Hunter Association<sup>®</sup></div>
        <div class="sp-name">Hunter${X}Halloween<sup class="yr">'26</sup></div>
        <div class="sp-edition">Party Edition</div>
      </div>
    </div>
    <div class="sp-start">Click to start</div>
    <div class="sp-bar"></div>`;
  const canvas = el.querySelector(".sp-flag");
  const doc = el.ownerDocument, win = doc.defaultView;
  const g = canvas.getContext?.("2d");
  if (!g) return () => {};
  const CW = 180, CH = 124, PAD = 18;   // the cloth, and room for the wave and the shed squares
  const cloth = drawCloth(doc, CW, CH);
  if (!cloth) return () => {};
  const dpr = Math.min(3, win?.devicePixelRatio || 1);
  canvas.width = (CW + PAD * 3) * dpr; canvas.height = (CH + PAD * 2) * dpr;
  const bits = Array.from({ length: 9 }, (_, i) => ({ y: 0.1 + random() * 0.8, s: 3 + random() * 6, col: ["#c8102e", "#ff7518", "#fff6e0"][i % 3], off: random() }));
  const draw = t => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, CW + PAD * 3, CH + PAD * 2);
    const x0 = PAD * 2, y0 = PAD;
    // the cloth: one 2-px column at a time, lifted by a travelling wave that grows toward the free edge
    for (let x = 0; x < CW; x += 2) {
      const ph = x * 0.05 - t * 3.2, amp = 2 + x * 0.075;
      g.drawImage(cloth, x, 0, 2, CH, x0 + x, y0 + amp * Math.sin(ph), 2.4, CH);
    }
    // light and shade across the folds, only on the cloth
    g.globalCompositeOperation = "source-atop";
    for (let x = 0; x < CW; x += 2) {
      const ph = x * 0.05 - t * 3.2, k = Math.cos(ph);
      g.fillStyle = k > 0 ? `rgba(255,255,255,${(0.16 * k).toFixed(3)})` : `rgba(20,10,40,${(-0.22 * k).toFixed(3)})`;
      g.fillRect(x0 + x, 0, 2.4, CH + PAD * 2);
    }
    g.globalCompositeOperation = "source-over";
    // little squares shed from the leading edge, drifting back — the Win98 flag's trail
    for (const b of bits) {
      const f = (t * 0.35 + b.off) % 1;
      g.globalAlpha = 1 - f;
      g.fillStyle = b.col;
      g.fillRect(x0 - 4 - f * PAD * 2, y0 + b.y * CH + Math.sin(t * 2 + b.off * 6) * 3, b.s * (1 - f * 0.5), b.s * (1 - f * 0.5));
    }
    g.globalAlpha = 1;
  };
  if (reduced) { draw(0.6); return () => {}; }
  let raf = 0, stop = false;
  const t0 = win.performance?.now?.() ?? Date.now();
  const tick = () => { if (stop) return; draw(((win.performance?.now?.() ?? Date.now()) - t0) / 1000); raf = win.requestAnimationFrame(tick); };
  raf = win.requestAnimationFrame(tick);
  return () => { stop = true; win.cancelAnimationFrame?.(raf); };
}

/* ---------- night: an arcade attract screen at the wallpaper's grain ---------- */
const GRAIN = 5;
function night(el, { reduced, random }) {
  el.innerHTML = `
    <canvas class="sp-sky px" aria-hidden="true"></canvas>
    <img class="sp-ship" src="${SHIP_SRC}" alt="" draggable="false">
    <div class="sp-title">
      <div class="sp-top">HUNTER ASSOCIATION PRESENTS</div>
      <div class="sp-big">HUNTER${X}</div>
      <div class="sp-big hallow">HALLOWEEN</div>
      <div class="sp-start">CLICK TO START</div>
    </div>
    <div class="sp-foot">© 2026 HUNTER ASSOCIATION · A PURPLE SQUARE PRODUCTION</div>`;
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
    for (let y = HZ + 1; y < H; y++) {   // the moon's road of glints on the water
      const spread = 1 + Math.round((y - HZ) * 0.5);
      for (let k = 0; k < 3; k++) {
        const x = MX + Math.round(Math.sin(t * 1.3 + y * 0.9 + k * 2.1) * spread);
        if ((y + k + Math.floor(t * 4)) % 3 === 0) { g.fillStyle = k ? "#ffd98a" : "#fff3c9"; g.fillRect(x, y, k ? 1 : 2, 1); }
      }
    }
  };
  if (reduced) { paint(0); return () => {}; }
  paint(0);
  const timer = win.setInterval(() => paint((win.performance?.now?.() ?? Date.now()) / 1000), 180);   // a few fps, like the wallpaper
  return () => win.clearInterval(timer);
}

const BUILD = { summons, clouds, night };

/* ---------- the overlay ---------- */
export class Splash extends Component {
  /** props: reduced, random, sounds ({ play(name) }) */
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
    const stop = BUILD[id](el, { reduced, random });
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
