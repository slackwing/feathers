/* Wallpaper — the pixel-art Whale Island, drawn procedurally and scaled
   up with image-rendering: pixelated. Original art inspired by the
   island's silhouette: a forested hump, a low tail with the harbour
   town and the pale rock spire. Sea glitter twinkles, clouds drift very
   slowly, a flock of birds crosses now and then. 8 fps; one static frame
   under prefers-reduced-motion.

   Geometry (Andrew, 2026-09-19): the art (island in columns 88–240 of
   a 320-wide space) is drawn at a fixed 5 screen px per art px — a big
   monitor gets more ocean and sky, not a bigger whale — except that the
   island may never exceed 85 % of the width; then the scale is capped
   and the whole desktop zooms down with it (Env.whale, OS.applyZoom).
   The canvas is exactly the columns and rows the view needs at that
   scale, island centred, horizon at 62 %.
   The pure pieces (geometry, cloudBounds, the height profile, glints)
   are exported for tests; drawing needs a 2-D canvas. */
import { Component } from "./component.js";
import { h } from "./dom.js";
import { whale, WHALE } from "./env.js";

export const ISLAND_W = WHALE.artW;          // the space the island art is drawn in
export const ISLAND_CENTER = WHALE.center;   // its midpoint (columns 88..240)
export const HORIZON = WHALE.horizon;        // horizon row as a fraction of the height

/** Canvas geometry for a view: the columns and rows that cover it at the whale scale. */
export function geometry(vw = 1366, vh = 900) {
  const { W, H, scale, zoom } = whale(vw, vh);
  const HZ = Math.round(H * HORIZON);
  return { W, H, HZ, OX: Math.round(W / 2 - ISLAND_CENTER), GX: W / 2, scale, zoom };
}

/* deterministic hash so the island is the same every visit */
export const hash = (x, y = 0) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

/* ---------- pixel clouds ----------
   A cloud is a cluster of lobes [cx, cy, r] (squashed spheres). The union
   is treated as a bumpy dome: for each pixel the metaball-style smooth
   union gives a height, the height field gives a surface normal, and the
   normal is dotted with ONE light from the upper right and quantised to
   four tones. So every bump is white on the side that faces the light and
   lilac-grey on its underside, and the cluster's whole underside falls
   into shadow — connected regions that follow the silhouette, as in the
   reference pixel sky (Andrew: per-lobe highlights "look like polka
   dots"). Test page: scratchpad test-clouds.html. */
export const CLOUD = { hi: "#ffffff", base: "#f3eefa", shade: "#dacfec", shade2: "#c6b8de" };
export const LIGHT = (() => { const v = [0.45, -0.55, 0.7], n = Math.hypot(...v); return v.map(c => c / n); })();

/** Scale the lobes and size a canvas around them (1px margin) so no lobe
    is ever clipped — a clipped top reads as a cloud with a piece missing. */
export function cloudBounds(lobesIn, scale = 1) {
  const L = lobesIn.map(([cx, cy, r]) => [cx * scale, cy * scale, r * scale]);
  const minX = Math.min(...L.map(l => l[0] - l[2])), minY = Math.min(...L.map(l => l[1] - l[2] * 0.85));
  const lobes = L.map(([cx, cy, r]) => [cx - minX + 1, cy - minY + 1, r]);
  const w = Math.ceil(Math.max(...lobes.map(l => l[0] + l[2]))) + 2, h = Math.ceil(Math.max(...lobes.map(l => l[1] + l[2] * 0.85))) + 2;
  return { lobes, w, h };
}

/** opts: flat = dome flattening (lower → flatter → more of the interior
    reads as one tone), cut = dot-product thresholds for hi/base/shade. */
export function cloudSprite(lobesIn, { flat = 0.5, cut = [0.78, 0.5, 0.25], scale = 1 } = {}) {
  const { lobes, w, h } = cloudBounds(lobesIn, scale);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext?.("2d");
  if (!g) return c;   // no canvas (tests)
  const hgt = (x, y) => {
    let f = 0;
    for (const [cx, cy, r] of lobes) { const dx = x - cx, dy = (y - cy) / 0.85; const q = r * r - dx * dx - dy * dy; if (q > 0) f += q; }
    return f > 0 ? flat * Math.sqrt(f) : 0;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (hgt(x, y) <= 0) continue;
    const nx = (hgt(x - 1, y) - hgt(x + 1, y)) / 2, ny = (hgt(x, y - 1) - hgt(x, y + 1)) / 2;
    const d = (nx * LIGHT[0] + ny * LIGHT[1] + LIGHT[2]) / Math.hypot(nx, ny, 1);
    g.fillStyle = d > cut[0] ? CLOUD.hi : d > cut[1] ? CLOUD.base : d > cut[2] ? CLOUD.shade : CLOUD.shade2;
    g.fillRect(x, y, 1, 1);
  }
  return c;
}

/* Cloud shapes hand-written after the reference sky (lobes [cx, cy, r] in
   unscaled units): a wide cumulus, a tall stacked one, one with a long thin
   tail, a long low bank, a wisp, a tiny puff. Keep every lobe r ≥ 4 with
   spacing ≤ r or thin parts fragment into dots. Drawn small and spaced
   well apart (Andrew: not so many clouds close together). */
export const SHAPES = {
  wide:    [[20, 16, 17], [44, 10, 21], [68, 15, 16], [86, 20, 10], [14, 25, 12], [38, 29, 14], [64, 28, 12], [84, 26, 8]],
  stacked: [[14, 18, 12], [26, 10, 14], [40, 16, 12], [22, 27, 10], [38, 28, 9], [52, 23, 7], [62, 27, 5]],
  tailed:  [[12, 10, 10], [26, 6, 12], [40, 10, 9], [10, 16, 7], [26, 18, 8], [42, 16, 6], [52, 17, 6], [61, 18, 5], [69, 18, 5], [76, 19, 4]],
  bank:    [[10, 8, 8], [22, 6, 9], [36, 7, 9], [50, 8, 8], [64, 9, 7], [78, 10, 6], [90, 11, 5], [14, 13, 7], [30, 14, 7], [46, 14, 7], [60, 14, 6], [74, 14, 6], [86, 14, 5]],
  wisp:    [[7, 5, 5], [14, 4, 6], [22, 4, 6], [30, 5, 5], [37, 5, 4]],
  puff:    [[6, 5, 5], [13, 4, 6], [7, 8, 4], [14, 9, 4]],
};
const CLOUD_SCALE = 0.6;
/* placements in the 320 × 112 sky the art was drawn for; x spreads with
   the width, y with the horizon */
export const CLOUDS = [
  { shape: "wide",    x: 6,   y: 8,  v: 0.08 },
  { shape: "puff",    x: 86,  y: 34, v: 0.05 },
  { shape: "stacked", x: 112, y: 4,  v: 0.07 },
  { shape: "wisp",    x: 172, y: 42, v: 0.10 },
  { shape: "tailed",  x: 200, y: 10, v: 0.06 },
  { shape: "puff",    x: 268, y: 46, v: 0.09, scale: 0.8 },
  { shape: "bank",    x: 252, y: 68, v: 0.05 },
];

/* ---------- the island's height profile (in its own 320-column space) ----------
   A broad rounded hump (flattened gaussian), a low back just above the
   rooftops carried right into the tail so there is no dip before it, and
   a hill-sized fluke at the tip — the rock spire stands on that lift. */
export function islandHeight(x) {
  if (x < 88 || x > 240) return 0;
  const taper = smooth((x - 88) / 14) * smooth((240 - x) / 4);
  const hump = 38 * Math.pow(Math.exp(-(((x - 134) / 34) ** 2)), 0.7);
  const back = 7 * smooth((x - 96) / 30) * smooth((236 - x) / 4);
  const fluke = 11 * smooth((x - 210) / 20) * smooth((238 - x) / 6);
  const hgt = Math.max(hump, back, fluke) + Math.floor(hash(x) * 3);
  return Math.round(hgt * taper);
}

/* ---------- glitter ----------
   After the sea reference: a narrow inverted bell hanging from the horizon
   (σ = 40 columns) — 44 rows deep at the centre, nothing at the sides —
   with a short strip along the horizon. Brightest and clumpy near the
   top, easing off with depth, plus stragglers past the curve so the edge
   isn't perfect; each candidate twinkles on its own 2–4 frame clock. */
export const GS = 40, GD = 44;
export const bell = (x, g, k = 1) => Math.exp(-(((x - g.GX) / (GS * k)) ** 2) / 2);
export function glintDensity(x, y, g) {
  const d = y - g.HZ, dmax = GD * bell(x, g);
  let dens;
  if (d <= dmax) {
    const t = d / dmax;
    dens = 0.55 * Math.pow(1 - t, 1.4) * (0.55 + 0.45 * bell(x, g));
  } else {
    dens = 0.05 * Math.exp(-(d - dmax) / 12) * (0.4 + 0.6 * bell(x, g, 1.6));
  }
  if (d <= 1) dens = Math.max(dens, 0.2 * bell(x, g, 1.4));
  dens *= 0.65 + 0.7 * hash((x >> 2) + 977, y >> 2);
  return { dens, d, dmax };
}
export function glints(g) {
  const out = [];
  const bottom = Math.min(g.H, g.HZ + GD + 60);   // nothing twinkles far below the bell
  for (let y = g.HZ; y < bottom; y++) for (let x = 0; x < g.W; x++) {
    const { dens, d, dmax } = glintDensity(x, y, g);
    if (dens < 0.012) continue;
    out.push({ i: y * g.W + x, x, y, d: Math.min(dens, 0.9), phase: (hash(x, y) * 7) | 0, per: 2 + ((hash(y, x) * 3) | 0), big: d > 10 && d <= dmax && hash(x * 3, y) < 0.06 });
  }
  return out;
}

/** Paint and animate the wallpaper on `canvas` for a viewport of vw × vh.
    Returns { stop } or null when the host has no 2-D canvas. */
export function wallpaper(canvas, { vw = 1366, vh = 900, reduced = false, doc = document, interval = 125, random = Math.random } = {}) {
  if (!canvas) return null;
  const g = geometry(vw, vh);
  const { W, H, HZ, OX } = g;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext?.("2d");
  if (!ctx) return null;
  const layer = (w = W, hh = H) => { const c = doc.createElement("canvas"); c.width = w; c.height = hh; return c; };
  const px = (gg, x, y, col) => { gg.fillStyle = col; gg.fillRect(x, y, 1, 1); };

  // sky: five bands dithered at their boundaries, stretched over the horizon rows
  const sky = layer(), sg = sky.getContext("2d");
  const SKY = ["#2456a4", "#2f6cc0", "#3f86d6", "#5aa2e6", "#86c0f0"];
  for (let y = 0; y < HZ; y++) {
    const f = y / HZ * SKY.length, i = Math.min(SKY.length - 1, Math.floor(f)), frac = f - i;
    for (let x = 0; x < W; x++) {
      const dither = frac > 0.8 && i < SKY.length - 1 && (x + y) % 2 === 0;
      px(sg, x, y, SKY[dither ? i + 1 : i]);
    }
  }

  // sea: bands hang from the horizon, the deepest colour fills the rest;
  // the island's dark reflection sits under its footprint
  const sea = layer(), eg = sea.getContext("2d");
  const SEA = ["#2c73b5", "#245f9c", "#1c4b80", "#163b66"];
  const seaBand = y => y < HZ + 8 ? 0 : y < HZ + 22 ? 1 : y < HZ + 44 ? 2 : 3;
  for (let y = HZ; y < H; y++) for (let x = 0; x < W; x++) {
    let b = seaBand(y);
    const edge = [HZ + 8, HZ + 22, HZ + 44].some(e => y === e - 1) && (x + y) % 2 === 0;
    if (edge) b = Math.min(3, b + 1);
    let col = SEA[b];
    if (hash(Math.floor(x / 6), y) < 0.045) col = SEA[Math.min(3, b + 1)];   // short horizontal wave streaks
    if (y < HZ + 7 && x - OX > 96 && x - OX < 240 && (x + y) % 2 === 0) col = SEA[Math.min(3, b + 1)]; // reflection
    px(eg, x, y, col);
  }

  // island, drawn in its own 320-column space then placed centred
  const IH = 60;   // rows the island art needs above the horizon
  const isl = layer(ISLAND_W, IH), ig = isl.getContext("2d");
  const GREEN = ["#24552b", "#2f6f35", "#3f8c42", "#7cc26a"];
  const hs = Array.from({ length: ISLAND_W }, (_, x) => islandHeight(x));
  for (let x = 0; x < ISLAND_W; x++) {
    const hgt = hs[x];
    if (!hgt) continue;
    const slope = (hs[x + 1] || 0) - (hs[x - 1] || 0);   // >0: rising to the right (faces left/sun)
    for (let y = IH - hgt; y < IH; y++) {
      const d = y - (IH - hgt);                          // depth below the ridge
      let col;
      if (d === 0) col = GREEN[3];
      else if (d < 3 && slope > 0) col = GREEN[2];
      else if (slope < -1 && d < hgt * 0.6) col = (x + y) % 2 ? GREEN[0] : GREEN[1];
      else col = hash(x, y) < 0.35 ? GREEN[0] : GREEN[1];
      px(ig, x, y, col);
    }
    px(ig, x, IH - 1, x > 98 && x < 236 ? "#c9b88a" : GREEN[0]);   // beach strip
  }
  // harbour town on the low tail
  const ROOF = ["#c8102e", "#ff7518", "#c8102e", "#e8dcc3", "#ff7518", "#c8102e", "#7c4dff", "#c8102e"];
  [154, 159, 165, 170, 176, 182, 188, 194].forEach((x, i) => {
    const w = i % 3 === 1 ? 4 : 3, top = IH - 5 - (i % 2);
    ig.fillStyle = ROOF[i]; ig.fillRect(x, top, w, 1);
    ig.fillStyle = "#efe3c8"; ig.fillRect(x, top + 1, w, IH - 1 - (top + 1));
    px(ig, x + 1, IH - 2, "#0b0a08");
  });
  // the tail: a pale rock spire rising from the knoll at the island's tip
  // — wide at the base, tapering, leaning outward like a raised fluke —
  // with a little surf at the point; the top 3 rows are left off
  const SP = 18, sx0 = 229, base = IH - hs[sx0] + 2;   // foot sunk 2px into the green
  for (let k = 3; k < SP; k++) {
    const t = k / (SP - 1);
    const w = 1 + Math.round(5 * Math.pow(t, 1.4));     // 1px tip → 6px foot
    const cx = sx0 + Math.round(3 * (1 - t));           // top leans 3px outward
    const y = base - SP + 1 + k;
    for (let dx = -Math.floor(w / 2); dx < w - Math.floor(w / 2); dx++) {
      const f = (dx + Math.floor(w / 2)) / Math.max(1, w - 1);   // 0 = lit left edge, 1 = shaded right edge
      px(ig, cx + dx, y, k === 0 ? "#fff6e0" : f < 0.35 ? "#f1e6cc" : f < 0.8 ? "#dccb9f" : "#b8a071");
    }
  }
  for (const dx of [-3, -2, 3]) { px(ig, sx0 + dx, base - 1, GREEN[2]); px(ig, sx0 + dx, base - 2, GREEN[1]); }   // scrub over the foot
  for (const x of [238, 239, 241, 242]) px(ig, x, IH - 1, "#fff6e0");         // surf at the tip
  // pier into the sea (drawn on the sea layer, in canvas space)
  eg.fillStyle = "#8b6d4b"; eg.fillRect(172 + OX, HZ, 14, 1); px(eg, 185 + OX, HZ + 1, "#8b6d4b"); px(eg, 174 + OX, HZ + 1, "#8b6d4b");

  const clouds = CLOUDS.map(c => ({ ...c, x: c.x * W / ISLAND_W, y: Math.round(c.y * HZ / 112), img: cloudSprite(SHAPES[c.shape], { scale: CLOUD_SCALE * (c.scale || 1) }) }));
  const gl = glints(g);
  let flock = null, nextFlock = 60, tick = 0;
  const drawGlints = () => {
    for (const p of gl) {
      const r = hash(p.i, ((tick + p.phase) / p.per) | 0);
      if (r >= p.d) continue;
      const c = r < p.d * 0.5 ? "#ffffff" : "#d2ecff";
      px(ctx, p.x, p.y, c);
      if (p.big) { px(ctx, p.x - 1, p.y, c); px(ctx, p.x + 1, p.y, c); px(ctx, p.x, p.y - 1, c); px(ctx, p.x, p.y + 1, c); }
    }
  };
  const BIRD = [[[0, 0], [2, 0], [1, 1]], [[1, 0], [0, 1], [2, 1]]];
  const spawnFlock = () => {
    const dir = random() < 0.5 ? -1 : 1;
    flock = { x: dir < 0 ? W + 6 : -12, y: Math.round(HZ * 0.12) + random() * HZ * 0.45, dir,
      birds: Array.from({ length: 3 + Math.floor(random() * 3) }, (_, i) => [i * 5, (i % 2) * 2 + Math.floor(i / 2) * 2]) };
  };

  const frame = () => {
    tick++;
    ctx.drawImage(sky, 0, 0);
    for (const c of clouds) {
      if (!reduced) { c.x += c.v; if (c.x > W + 4) c.x = -c.img.width - 4; }
      ctx.drawImage(c.img, Math.round(c.x), c.y);
    }
    ctx.drawImage(sea, 0, 0);
    ctx.drawImage(isl, OX, HZ - IH);
    drawGlints();
    if (!reduced) {
      if (!flock && --nextFlock <= 0) spawnFlock();
      if (flock) {
        flock.x += 1.6 * flock.dir;
        const f = BIRD[Math.floor(tick / 3) % 2];
        for (const [bx, by] of flock.birds) for (const [dx, dy] of f) px(ctx, Math.round(flock.x + bx + dx), Math.round(flock.y + by + dy), "#0b0a08");
        if (flock.x < -30 || flock.x > W + 30) { flock = null; nextFlock = 8 * (12 + random() * 28); }
      }
    }
  };
  frame();
  const timer = reduced ? null : setInterval(() => { if (!doc.hidden) frame(); }, interval);
  timer?.unref?.();
  return { stop() { clearInterval(timer); }, frame, geometry: g, get tick() { return tick; } };
}

/** The fixed full-screen canvas behind the desktop; repainted for the
    viewport's aspect whenever the OS announces a resize. */
export class Wallpaper extends Component {
  /** props: env, bus */
  render() { return h("canvas", { className: "wall", width: 320, height: 180 }); }
  onMount() {
    this.paint();
    if (this.props.bus) this.listen(this.props.bus, "resize", () => this.paint());
  }
  paint() {
    this.anim?.stop();
    const w = this.props.env?.win || globalThis.window;
    this.anim = wallpaper(this.el, { vw: w?.innerWidth || 1366, vh: w?.innerHeight || 900, reduced: !!this.props.env?.reduced });
  }
  onUnmount() { this.anim?.stop(); }
}
