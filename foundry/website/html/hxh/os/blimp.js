/* Blimp — Chairman Netero's airship, now and then, across the sky, towing
   a banner that says HUNTER × HALLOWEEN (Andrew, 2026-09-19/20). The ship
   is ABI'S DRAWING (`img/blimp.png`, 2026-09-24, in place of the vector
   one): the Hunter Association's airship as a side view flying WEST —
   shark-nosed blue hull, the ✕✕ plate, propeller masts along the spine, a
   cabin with lit windows, an engine pod and a stern propeller — on a
   transparent ground, smooth (the one thing on the desktop that is not
   pixel art). CSS flips it to fly east. The banner is an
   orange cloth whose edges and lettering ripple (SMIL, no script) on a
   bridle: two lines from the stern's axis line, one to each leading corner
   of the cloth. CSS animates the flight
   from one edge to the other, behind every window and icon, above the
   wallpaper. Spawns at a random interval (4–9 min by default), never
   under reduced motion; `launch()` flies one now (Settings › Other ›
   Fly the blimp).

   As many at once as anyone launches (Andrew, 2026-10-08, after taylor's
   "blimp only flys once per selection 😔": "don't disable Fly the blimp…
   every time it starts a new instance"), each at its own height, heading
   and DEPTH — a nearer ship is bigger, drawn in front, and crosses faster
   (parallax: apparent speed ∝ apparent size). None while the page is
   hidden (Andrew came home to fifty of them, 2026-09-20: a background tab
   keeps its timers but not its animations, so nothing ever ended and
   every booked flight piled up at the edges): a flight that should long
   have ended is purged when the page is looked at again. */
import { Component } from "./component.js";
import { h } from "./dom.js";

export const FLYER_TEXT = "HUNTER × HALLOWEEN";
export const SHIP_SRC = "/hxh/img/blimp.png";
export const ART_W = 1289, ART_H = 955;                     // Abi's drawing, in its own pixels
export const ART_LINE_Y = 582.85, ART_LINE_W = 4.25;        // the stern's propeller axis line: alpha-weighted centre (pixel centres) and equivalent thickness, from the PNG — the rope continues it
export const SHIP_W = 240, SHIP_H = Math.round(SHIP_W * ART_H / ART_W);   // 240 × 178 — half the size Andrew found "way too big" (2026-09-24), the art's own aspect
const SCALE_Y = SHIP_H / ART_H;                             // the browser stretches the art to the whole-px box: heights scale by this
export const STERN_Y = +(ART_LINE_Y * SCALE_Y).toFixed(2);  // ≈ 108.6 px down the ship's box
export const ROPE_W = +(ART_LINE_W * SCALE_Y).toFixed(2);   // exactly the art's line, as drawn (≈ 0.8 px)
export const ROPE_SOFT = 0.12;                              // Gaussian blur (px): the rope's edges as soft as the downsampled art's — no crisp-meets-soft seam
export const OVERLAP = 2;                                   // px of rope drawn over the art's own line (solid for ~3.4 px past the propeller at this scale)
export const BANNER_W = 252, BANNER_H = 46, ROPE = 56;      // the bridle takes the first ROPE px of the banner box
export const CLOTH_TOP = 9, CLOTH_H = 28, AMP = 2.5, WAVE = 34;   // the cloth's place in the box and its ripple (amplitude, wavelength/2π)
export const CORNER_IN = 0;                                 // each line ends ON the cloth's corner (Andrew, 2026-09-27: the ends didn't quite touch)
export const HOLD = 48;                                     // px over which the ripple grows from nothing: the edge tied to the bridle is held still, so its corners never leave the rope ends
export const LETTER_PX = 11, CAP = 0.72;                    // the lettering's size (= os.css .banner .lettering) and its cap height (a fraction of the em): capitals are centred by their caps
export const FLYER_TOP = Math.round(STERN_Y - (CLOTH_TOP + CLOTH_H / 2));   // the flyer's margin-top, whole px: the stern line meets the cloth's midline, so the bridle is a symmetric triangle
export const ROPE_Y = +(STERN_Y - FLYER_TOP).toFixed(2);    // where the bridle starts (and the art's line runs), in banner coordinates
export const FLIGHT_MS = 50000;                             // one crossing at depth 1: twice as fast as the first 100 s (Andrew, 2026-09-27: "increase the blimp speed")
export const DEPTH_MIN = 0.45, DEPTH_MAX = 1.3;             // a ship's scale: far and small … near and big (depth 1 = SHIP_W); its crossing takes FLIGHT_MS / depth
export const TOP_MIN = 2, TOP_MAX = 30;                     // % down the sky: far ships stay clear of the island (horizon 62 %); only near ones may pass in front of it

let seq = 0;

/** The ship: Abi's drawing, nose to the LEFT (flying west), at SHIP_W × SHIP_H (or a depth's size). CSS flips it to fly east. */
export function airshipHTML(w = SHIP_W, hgt = SHIP_H) {
  return `<img class="airship" src="${SHIP_SRC}" width="${w}" height="${hgt}" alt="" draggable="false" aria-hidden="true">`;
}

/**
 * A ship and its banner at `depth` (1 = the size above): the ship's
 * whole-px box in the art's aspect, and — re-derived from the art's
 * measurements for that box, exactly as FLYER_TOP / ROPE_Y / ROPE_W are
 * for depth 1 — the flyer's whole-px margin-top, where the bridle starts
 * and how thick it is, in the banner's own units (the banner is drawn at
 * BANNER_W × BANNER_H and scaled by `depth`), so the rope still continues
 * the stern's line and meets the cloth's midline at every size.
 */
export function depthGeometry(depth = 1) {
  const shipW = Math.round(SHIP_W * depth), shipH = Math.round(shipW * ART_H / ART_W);
  const k = shipH / ART_H, stern = ART_LINE_Y * k;
  const flyerTop = Math.round(stern - (CLOTH_TOP + CLOTH_H / 2) * depth);
  return { depth, shipW, shipH, flyerTop, ropeY: +((stern - flyerTop) / depth).toFixed(2), ropeW: +(ART_LINE_W * k / depth).toFixed(2), overlap: +(OVERLAP * depth).toFixed(2) };
}

/**
 * One line of the bridle, in "left" coordinates (a ship flying west, the
 * banner trailing to its right): starts OVERLAP px inside the ship's box,
 * ON the art's axis line, runs on horizontally, bends, and ends as a
 * straight edge at `yq` on the cloth's leading edge. The bend is a cubic
 * whose first two control points lie on the horizontal — so its
 * curvature is zero where it leaves the line (smooth derivatives out of
 * the drawing, Andrew 2026-09-24) — and whose last control point sits on
 * the straight run's line, so it meets that run at its own angle.
 * Both lines share the start and the horizontal stretch, then fan out
 * to the top and bottom corners (Andrew, 2026-09-27: "2 coming out from
 * the same point… kind of like a triangle"). Mirrored for "right".
 */
export function ropePath(rope, yq, y0 = ROPE_Y) {
  const t = 8;                                              // the bend's reach: control points t apart
  const b = [OVERLAP + 6, y0], m = [b[0] + 2 * t, y0], q = [ROPE, yq];
  const len = Math.hypot(q[0] - m[0], q[1] - m[1]), u = [(q[0] - m[0]) / len, (q[1] - m[1]) / len];
  const c1 = [b[0] + t, y0], p = [m[0] + t * u[0], m[1] + t * u[1]];   // m is the bend's last control point AND a point of the straight run's line
  const X = rope === "left" ? x => x : x => BANNER_W - x;
  const pt = ([x, y]) => `${X(x).toFixed(2)} ${y.toFixed(2)}`;
  return `M ${pt([0, y0])} L ${pt(b)} C ${pt(c1)} ${pt(m)} ${pt(p)} L ${pt(q)}`;
}

/** The bridle's two corners on the cloth's leading edge: top, bottom. */
export const BRIDLE = [CLOTH_TOP + CORNER_IN, CLOTH_TOP + CLOTH_H - CORNER_IN];

/**
 * Points of a rippling edge from x0 to x1 (every `step` px, both ends
 * included): y = base + A·ramp·sin(x/WAVE + phase), where `ramp` climbs
 * smoothly from 0 at the HELD end (`held` = x0 or x1, the edge tied to
 * the bridle) to 1 over HOLD px — a towed banner is still where it is
 * tied and flaps more toward its free end, and the bridle's corners stay
 * put in every frame.
 */
export function ripple(x0, x1, base, amp, phase, held = x0, step = 8) {
  const pts = [];
  const xs = []; for (let x = x0; x < x1; x += step) xs.push(x); xs.push(x1);
  for (const x of xs) {
    const k = Math.min(1, Math.abs(x - held) / HOLD), ramp = k * k * (3 - 2 * k);   // smoothstep: no kink where the flapping begins
    pts.push([x, base + amp * ramp * Math.sin(phase + (x - x0) / WAVE)]);
  }
  return pts;
}
const poly = (pts, start = "M") => start + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ");

/**
 * The banner: the bridle from the stern and an orange cloth whose edges
 * and lettering ripple through three phases (values loop). `rope` is the
 * side the bridle is on — "left" trails behind a ship flying west,
 * "right" behind one flying east — so the letters never mirror.
 */
export function bannerSVG(text = FLYER_TEXT, rope = "left", { depth = 1, ropeY = ROPE_Y, ropeW = ROPE_W } = {}) {
  const id = "bwave" + (++seq);
  const x0 = rope === "left" ? ROPE : 0, x1 = rope === "left" ? BANNER_W : BANNER_W - ROPE;
  const held = rope === "left" ? x0 : x1;   // the edge on the bridle's side
  const phases = [0, 2.1, 4.2, 0];
  const cloth = phases.map(p => poly(ripple(x0, x1, CLOTH_TOP, AMP, p, held)) + " " + poly(ripple(x0, x1, CLOTH_TOP + CLOTH_H, AMP, p, held).reverse(), "L") + " Z").join(";");
  const line = phases.map(p => poly(ripple(x0, x1, CLOTH_TOP + CLOTH_H / 2 + LETTER_PX * CAP / 2, AMP, p, held))).join(";");   // the baseline rides the cloth's midline plus half a cap: the capitals sit centred (no dominant-baseline — Safari ignores it on a textPath)
  const dur = "1.5s";
  const ropes = BRIDLE.map(yq => `<path class="rope" d="${ropePath(rope, yq, ropeY)}" stroke-width="${ropeW}" filter="url(#${id}-soft)"/>`).join("\n  ");
  const px = n => +(n * depth).toFixed(2);   // drawn in the banner's own units, shown at the ship's depth
  return `<svg class="banner" viewBox="0 0 ${BANNER_W} ${BANNER_H}" width="${px(BANNER_W)}" height="${px(BANNER_H)}" data-rope="${rope}" aria-hidden="true">
  <defs><filter id="${id}-soft" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="${ROPE_SOFT}"/></filter></defs>
  ${ropes}
  <path class="cloth" d="${cloth.split(";")[0]}"><animate attributeName="d" values="${cloth}" dur="${dur}" repeatCount="indefinite"/></path>
  <defs><path id="${id}" d="${line.split(";")[0]}"><animate attributeName="d" values="${line}" dur="${dur}" repeatCount="indefinite"/></path></defs>
  <text class="lettering"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${text}</textPath></text>
</svg>`;
}

export class Blimp extends Component {
  /** props: reduced, random, minWait / maxWait (ms), duration (ms, default FLIGHT_MS), setTimeout/clearTimeout (tests) */
  render() { return h("div", { className: "blimps", id: "blimps" }); }
  onMount() {
    this.schedule();
    const doc = this.doc;
    this._onVis = () => { if (!doc.hidden) this.purge(); };
    doc?.addEventListener?.("visibilitychange", this._onVis);
  }
  onUnmount() {
    this.props.clearTimeout?.(this.timer) ?? clearTimeout(this.timer);
    this.doc?.removeEventListener?.("visibilitychange", this._onVis);
  }

  get doc() { return this.props.doc || globalThis.document; }
  get now() { return (this.props.now || Date.now)(); }
  get hidden() { return !!this.doc?.hidden; }

  schedule() {
    if (this.props.reduced) return;
    const { minWait = 4 * 60000, maxWait = 9 * 60000, random = Math.random } = this.props;
    const st = this.props.setTimeout || ((f, ms) => setTimeout(f, ms));
    const wait = minWait + random() * (maxWait - minWait);
    this.timer = st(() => { if (!this.hidden) this.launch(); this.schedule(); }, wait);   // a hidden page gets no ship, just the next booking
    this.timer?.unref?.();
    return wait;
  }

  /** Remove flights that should have ended by now (a hidden tab's animations stand still). */
  purge() {
    let n = 0;
    for (const old of this.el.querySelectorAll(".blimp")) if (+old.dataset.until <= this.now) { old.remove(); n++; }
    return n;
  }

  /** Fly one more across now, at a random height, heading and depth unless given; ships already up fly on. Returns the element. */
  launch({ dir = (this.props.random || Math.random)() < 0.5 ? -1 : 1, top = null, depth = null } = {}) {
    const { random = Math.random, duration = FLIGHT_MS } = this.props;
    top ??= TOP_MIN + random() * (TOP_MAX - TOP_MIN);
    depth ??= DEPTH_MIN + random() * (DEPTH_MAX - DEPTH_MIN);
    const g = depthGeometry(depth), ms = Math.round(duration / depth);   // parallax: the nearer, the faster across
    const el = h("div", { className: "blimp " + (dir < 0 ? "west" : "east"), dataset: { until: String(this.now + ms), depth: String(depth) } });
    el.style.top = +top.toFixed(2) + "%";
    el.style.zIndex = String(Math.round(depth * 100));   // nearer in front
    el.style.animationDuration = ms + "ms";
    el.append(
      h("span", { className: "ship", html: airshipHTML(g.shipW, g.shipH) }),
      h("span", { className: "flyer", style: { marginTop: g.flyerTop + "px", [dir < 0 ? "marginLeft" : "marginRight"]: -g.overlap + "px" }, html: bannerSVG(FLYER_TEXT, dir < 0 ? "left" : "right", g) }),   // the bridle starts on the art's own axis line, a few px inside the ship's box
    );
    el.addEventListener("animationend", () => el.remove());
    this.el.append(el);
    this.flights = (this.flights || 0) + 1;
    return el;
  }
}
