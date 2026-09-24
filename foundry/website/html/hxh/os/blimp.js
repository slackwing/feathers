/* Blimp — Chairman Netero's airship, now and then, across the sky, towing
   a banner that says HUNTER × HALLOWEEN (Andrew, 2026-09-19/20). The ship
   is ABI'S DRAWING (`img/blimp.png`, 2026-09-24, in place of the vector
   one): the Hunter Association's airship as a side view flying WEST —
   shark-nosed blue hull, the ✕✕ plate, propeller masts along the spine, a
   cabin with lit windows, an engine pod and a stern propeller — on a
   transparent ground, smooth (the one thing on the desktop that is not
   pixel art). CSS flips it to fly east. The banner is an orange cloth whose
   edges and lettering ripple (SMIL, no script) on a rope that continues the
   stern's axis line. CSS
   animates the flight from one edge to the other, behind every window and
   icon, above the wallpaper. Spawns at a random interval (4–9 min by
   default), never under reduced motion; `launch()` flies one now.

   ONE flight at a time, and none while the page is hidden (Andrew came
   home to fifty of them, 2026-09-20: a background tab keeps its timers
   but not its animations, so nothing ever ended and every booked flight
   piled up at the edges). A new launch removes the previous ship; a
   flight that should long have ended is purged when the page is looked
   at again. */
import { Component } from "./component.js";
import { h } from "./dom.js";

export const FLYER_TEXT = "HUNTER × HALLOWEEN";
export const SHIP_SRC = "/hxh/img/blimp.png";
export const ART_W = 1289, ART_H = 955;                     // Abi's drawing, in its own pixels
export const ART_LINE_Y = 582.85, ART_LINE_W = 4.25;        // the stern's propeller axis line: alpha-weighted centre (pixel centres) and equivalent thickness, from the PNG — the rope continues it
export const SHIP_W = 480, SHIP_H = Math.round(SHIP_W * ART_H / ART_W);
const SCALE_Y = SHIP_H / ART_H;                             // the browser stretches the art to the whole-px box: heights scale by this, not by the width's ratio
export const STERN_Y = +(ART_LINE_Y * SCALE_Y).toFixed(2);  // ≈ 217.3 px down the ship's box
export const ROPE_W = +(ART_LINE_W * SCALE_Y).toFixed(2);   // exactly the art's line, as drawn (≈ 1.58 px)
export const ROPE_SOFT = 0.12;                              // Gaussian blur (px): the rope's edges as soft as the downsampled art's (measured: the art is nearly crisp at this scale) — no crisp-meets-soft seam
export const OVERLAP = 5;                                   // px of rope drawn over the art's own line (solid there; the propeller sits further in)
export const BANNER_W = 332, BANNER_H = 70, ROPE = 56;      // the rope takes the first ROPE px of the banner box
export const FLYER_TOP = Math.round(STERN_Y - 10);          // the flyer's margin-top, whole px: the rope's height inside the banner carries the fraction, so nothing snaps
export const ROPE_Y = +(STERN_Y - FLYER_TOP).toFixed(2);    // where the rope starts (and the art's line runs), in banner coordinates
export const LETTER_PX = 16, CAP = 0.72;                    // the lettering's size and its cap height (a fraction of the em): capitals are centred by their caps, not their baseline

let seq = 0;

/** The ship: Abi's drawing, nose to the LEFT (flying west), at SHIP_W × SHIP_H. CSS flips it to fly east. */
export function airshipHTML() {
  return `<img class="airship" src="${SHIP_SRC}" width="${SHIP_W}" height="${SHIP_H}" alt="" draggable="false" aria-hidden="true">`;
}

/**
 * The rope, in "left" coordinates (a ship flying west, the banner trailing
 * to its right): starts OVERLAP px inside the ship's box, on the art's own
 * axis line, runs on horizontally, then bends (a cubic whose start tangent
 * is horizontal and whose end tangent is the straight run) into a straight
 * edge that meets the cloth's leading top corner. Mirrored for "right".
 * Andrew (2026-09-24): "smoothly horizontal where it connects to the
 * blimp's tail black line, but becomes a straightedge connecting to the
 * banner" — no seam: same line, same colour, a hair wider, overlapping.
 */
export function ropePath(rope, top) {
  const y0 = ROPE_Y, yq = top + 2;
  const a = [0, y0], b = [OVERLAP + 9, y0], q = [ROPE, yq], p = [ROPE - 22, y0 + (yq - y0) * 0.45];
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]), u = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
  const c1 = [b[0] + 8, y0], c2 = [p[0] - 7 * u[0], p[1] - 7 * u[1]];
  const X = rope === "left" ? x => x : x => BANNER_W - x;
  const pt = ([x, y]) => `${X(x).toFixed(2)} ${y.toFixed(2)}`;
  return `M ${pt(a)} L ${pt(b)} C ${pt(c1)} ${pt(c2)} ${pt(p)} L ${pt(q)}`;
}

/** Points of a rippling edge: y = base + A·sin(k·x + phase), every `step` px from x0 to x1. */
function ripple(x0, x1, base, amp, phase, step = 10) {
  const pts = [];
  for (let x = x0; x <= x1; x += step) pts.push([x, base + amp * Math.sin(phase + (x - x0) / 46)]);
  return pts;
}
const poly = (pts, start = "M") => start + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ");

/**
 * The banner: a rope from the tail and a cloth whose top and bottom edges
 * and lettering ripple through three phases (values loop). `rope` is the
 * side the rope is on — "left" trails behind a ship flying west, "right"
 * behind one flying east — so the letters never mirror.
 */
export function bannerSVG(text = FLYER_TEXT, rope = "left") {
  const id = "bwave" + (++seq);
  const x0 = rope === "left" ? ROPE : 0, x1 = rope === "left" ? BANNER_W : BANNER_W - ROPE;
  const top = 16, hgt = 40, amp = 3.5;
  const phases = [0, 2.1, 4.2, 0];
  const cloth = phases.map(p => poly(ripple(x0, x1, top, amp, p)) + " " + poly(ripple(x0, x1, top + hgt, amp, p).reverse(), "L") + " Z").join(";");
  const line = phases.map(p => poly(ripple(x0, x1, top + hgt / 2 + LETTER_PX * CAP / 2, amp, p))).join(";");   // the baseline rides the cloth's midline plus half a cap: the capitals sit centred (no dominant-baseline — Safari ignores it on a textPath)
  const dur = "1.5s";
  return `<svg class="banner" viewBox="0 0 ${BANNER_W} ${BANNER_H}" width="${BANNER_W}" height="${BANNER_H}" data-rope="${rope}" aria-hidden="true">
  <defs><filter id="${id}-soft" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="${ROPE_SOFT}"/></filter></defs>
  <path class="rope" d="${ropePath(rope, top)}" stroke-width="${ROPE_W}" filter="url(#${id}-soft)"/>
  <path class="cloth" d="${cloth.split(";")[0]}"><animate attributeName="d" values="${cloth}" dur="${dur}" repeatCount="indefinite"/></path>
  <defs><path id="${id}" d="${line.split(";")[0]}"><animate attributeName="d" values="${line}" dur="${dur}" repeatCount="indefinite"/></path></defs>
  <text class="lettering"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${text}</textPath></text>
</svg>`;
}

export class Blimp extends Component {
  /** props: reduced, random, minWait / maxWait (ms), duration (ms), setTimeout/clearTimeout (tests) */
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

  /** Is a ship up — on screen or launched and still at the edge? Overdue flights (a hidden tab's) are purged first. */
  get flying() {
    this.purge();
    return !!this.el.querySelector(".blimp");
  }

  /** Fly one across now — the previous one, if still up, lands. Returns the element. */
  launch({ dir = (this.props.random || Math.random)() < 0.5 ? -1 : 1, top = null } = {}) {
    const { random = Math.random, duration = 100000 } = this.props;
    for (const old of this.el.querySelectorAll(".blimp")) old.remove();
    const el = h("div", { className: "blimp " + (dir < 0 ? "west" : "east"), dataset: { until: String(this.now + duration) } });
    el.style.top = (top ?? 2 + random() * 10) + "%";
    el.style.animationDuration = duration + "ms";
    el.append(
      h("span", { className: "ship", html: airshipHTML() }),
      h("span", { className: "flyer", style: { marginTop: FLYER_TOP + "px", [dir < 0 ? "marginLeft" : "marginRight"]: -OVERLAP + "px" }, html: bannerSVG(FLYER_TEXT, dir < 0 ? "left" : "right") }),   // the rope starts on the art's own axis line, a few px inside the ship's box
    );
    el.addEventListener("animationend", () => el.remove());
    this.el.append(el);
    this.flights = (this.flights || 0) + 1;
    return el;
  }
}
