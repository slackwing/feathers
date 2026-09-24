/* Blimp — Chairman Netero's airship, now and then, across the sky, towing
   a banner that says HUNTER × HALLOWEEN (Andrew, 2026-09-19/20). The ship
   is ABI'S DRAWING (`img/blimp.png`, 2026-09-24, in place of the vector
   one): the Hunter Association's airship as a side view flying WEST —
   shark-nosed blue hull, the ✕✕ plate, propeller masts along the spine, a
   cabin with lit windows, an engine pod and a stern propeller — on a
   transparent ground, smooth (the one thing on the desktop that is not
   pixel art), OR, with Settings › Display › Blimp › Pixelated, as a
   sprite on the wallpaper's own 5-px grain (`img/blimp-px.png`, made by
   scripts/pixelate-blimp.py). CSS flips it to fly east. The banner is an
   orange cloth whose edges and lettering ripple (SMIL, no script) on a
   rope that continues the stern's axis line. CSS animates the flight
   from one edge to the other, behind every window and icon, above the
   wallpaper. Spawns at a random interval (4–9 min by default), never
   under reduced motion; `launch()` flies one now (Settings › Display ›
   Blimp › Fly the blimp).

   ONE flight at a time, and none while the page is hidden (Andrew came
   home to fifty of them, 2026-09-20: a background tab keeps its timers
   but not its animations, so nothing ever ended and every booked flight
   piled up at the edges). A new launch removes the previous ship; a
   flight that should long have ended is purged when the page is looked
   at again. */
import { Component } from "./component.js";
import { h } from "./dom.js";

export const FLYER_TEXT = "HUNTER × HALLOWEEN";
export const STYLES = ["original", "pixelated"];
export const SHIP_SRC = "/hxh/img/blimp.png", SHIP_SRC_PX = "/hxh/img/blimp-px.png";
export const ART_W = 1289, ART_H = 955;                     // Abi's drawing, in its own pixels
export const ART_LINE_Y = 582.85, ART_LINE_W = 4.25;        // the stern's propeller axis line: alpha-weighted centre (pixel centres) and equivalent thickness, from the PNG — the rope continues it
export const PX = 5;                                        // the wallpaper's grain, screen px per art px (env.js WHALE.scale): the pixelated ship is drawn on the same grid
export const SHIP_W = 240, SHIP_H = Math.round(SHIP_W * ART_H / ART_W / PX) * PX;   // 240 × 180 — half the size Andrew found "way too big" (2026-09-24), a whole number of grain cells tall
export const SPRITE_W = SHIP_W / PX, SPRITE_H = SHIP_H / PX;   // 48 × 36: the pixel sprite (scripts/pixelate-blimp.py draws it at this size)
export const PX_LINE_ROW = 21;                              // the sprite row that carries the stern's axis line (the script prints it): the pixelated rope sits on that row
const SCALE_Y = SHIP_H / ART_H;                             // the browser stretches the art to the whole-px box: heights scale by this
export const STERN_Y = +(ART_LINE_Y * SCALE_Y).toFixed(2);  // ≈ 109.9 px down the ship's box
export const ROPE_W = +(ART_LINE_W * SCALE_Y).toFixed(2);   // exactly the art's line, as drawn (≈ 0.8 px)
export const ROPE_SOFT = 0.12;                              // Gaussian blur (px): the rope's edges as soft as the downsampled art's — no crisp-meets-soft seam
export const OVERLAP = 2;                                   // px of rope drawn over the art's own line (solid for ~3.4 px past the propeller at this scale)
export const BANNER_W = 236, BANNER_H = 46, ROPE = 40;      // the rope takes the first ROPE px of the banner box
export const CLOTH_TOP = 9, CLOTH_H = 28, AMP = 2.5, WAVE = 34;   // the cloth's place in the box and its ripple (amplitude, wavelength/2π)
export const LETTER_PX = 11, CAP = 0.72;                    // the lettering's size (= os.css .banner .lettering) and its cap height (a fraction of the em): capitals are centred by their caps
export const FLYER_TOP = Math.round(STERN_Y - 6);           // the flyer's margin-top, whole px: the rope's height inside the banner carries the fraction, so nothing snaps
export const ROPE_Y = +(STERN_Y - FLYER_TOP).toFixed(2);    // where the rope starts (and the art's line runs), in banner coordinates
export const PX_ROPE_Y = +((PX_LINE_ROW + 0.5) * PX - FLYER_TOP).toFixed(2);   // pixelated: the centre of the sprite's line row, in banner coordinates

let seq = 0;

/** The ship: Abi's drawing (or its pixel sprite), nose to the LEFT (flying west), at SHIP_W × SHIP_H. CSS flips it to fly east. */
export function airshipHTML(style = "original") {
  return `<img class="airship" src="${style === "pixelated" ? SHIP_SRC_PX : SHIP_SRC}" width="${SHIP_W}" height="${SHIP_H}" alt="" draggable="false" aria-hidden="true">`;
}

/**
 * The rope, in "left" coordinates (a ship flying west, the banner
 * trailing to its right): starts OVERLAP px inside the ship's box, ON
 * the art's axis line, runs on horizontally, bends, and ends as a
 * straight edge at the cloth's leading top corner. The bend is a cubic
 * whose first two control points lie on the horizontal — so its
 * curvature is zero where it leaves the line (smooth derivatives out of
 * the drawing, Andrew 2026-09-24) — and whose last control point sits on
 * the straight run's line, so it meets that run at its own angle: the
 * run is straight into the banner ("fine"). `y0` is the line's height
 * in the banner box (the sprite's own row when pixelated). Mirrored
 * for "right".
 */
export function ropePath(rope, y0 = ROPE_Y, yq = CLOTH_TOP + 2) {
  const t = 8;                                              // the bend's reach: control points t apart
  const b = [OVERLAP + 6, y0], m = [b[0] + 2 * t, y0], q = [ROPE, yq];
  const len = Math.hypot(q[0] - m[0], q[1] - m[1]), u = [(q[0] - m[0]) / len, (q[1] - m[1]) / len];
  const c1 = [b[0] + t, y0], p = [m[0] + t * u[0], m[1] + t * u[1]];   // m is the bend's last control point AND a point of the straight run's line
  const X = rope === "left" ? x => x : x => BANNER_W - x;
  const pt = ([x, y]) => `${X(x).toFixed(2)} ${y.toFixed(2)}`;
  return `M ${pt([0, y0])} L ${pt(b)} C ${pt(c1)} ${pt(m)} ${pt(p)} L ${pt(q)}`;
}

/** Points of a rippling edge: y = base + A·sin(x/WAVE + phase), every `step` px from x0 to x1. */
function ripple(x0, x1, base, amp, phase, step = 8) {
  const pts = [];
  for (let x = x0; x <= x1; x += step) pts.push([x, base + amp * Math.sin(phase + (x - x0) / WAVE)]);
  return pts;
}
const poly = (pts, start = "M") => start + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ");

/**
 * The banner: the rope from the stern and an orange cloth whose edges
 * and lettering ripple through three phases (values loop). `rope` is the
 * side the rope is on — "left" trails behind a ship flying west, "right"
 * behind one flying east — so the letters never mirror. `style`
 * "pixelated" draws the rope as a crisp PX-wide line on the sprite's own
 * row (the cloth and lettering stay smooth).
 */
export function bannerSVG(text = FLYER_TEXT, rope = "left", style = "original") {
  const id = "bwave" + (++seq), px = style === "pixelated";
  const x0 = rope === "left" ? ROPE : 0, x1 = rope === "left" ? BANNER_W : BANNER_W - ROPE;
  const phases = [0, 2.1, 4.2, 0];
  const cloth = phases.map(p => poly(ripple(x0, x1, CLOTH_TOP, AMP, p)) + " " + poly(ripple(x0, x1, CLOTH_TOP + CLOTH_H, AMP, p).reverse(), "L") + " Z").join(";");
  const line = phases.map(p => poly(ripple(x0, x1, CLOTH_TOP + CLOTH_H / 2 + LETTER_PX * CAP / 2, AMP, p))).join(";");   // the baseline rides the cloth's midline plus half a cap: the capitals sit centred (no dominant-baseline — Safari ignores it on a textPath)
  const dur = "1.5s";
  const ropeAttrs = px ? `stroke-width="${PX}" shape-rendering="crispEdges"` : `stroke-width="${ROPE_W}" filter="url(#${id}-soft)"`;
  return `<svg class="banner" viewBox="0 0 ${BANNER_W} ${BANNER_H}" width="${BANNER_W}" height="${BANNER_H}" data-rope="${rope}" data-style="${px ? "pixelated" : "original"}" aria-hidden="true">
  <defs><filter id="${id}-soft" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="${ROPE_SOFT}"/></filter></defs>
  <path class="rope" d="${ropePath(rope, px ? PX_ROPE_Y : ROPE_Y)}" ${ropeAttrs}/>
  <path class="cloth" d="${cloth.split(";")[0]}"><animate attributeName="d" values="${cloth}" dur="${dur}" repeatCount="indefinite"/></path>
  <defs><path id="${id}" d="${line.split(";")[0]}"><animate attributeName="d" values="${line}" dur="${dur}" repeatCount="indefinite"/></path></defs>
  <text class="lettering"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${text}</textPath></text>
</svg>`;
}

export class Blimp extends Component {
  /** props: style ("original" | "pixelated"), reduced, random, minWait / maxWait (ms), duration (ms), setTimeout/clearTimeout (tests) */
  render() { this.style = STYLES.includes(this.props.style) ? this.props.style : "original"; return h("div", { className: "blimps", id: "blimps" }); }
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

  /** Settings › Display › Blimp: Original or Pixelated — re-dresses any ship already up, too. */
  setStyle(style) {
    if (!STYLES.includes(style)) style = "original";
    this.style = style;
    for (const el of this.el.querySelectorAll(".blimp")) {
      el.classList.toggle("pixelated", style === "pixelated");
      el.querySelector(".ship").innerHTML = airshipHTML(style);
      el.querySelector(".flyer").innerHTML = bannerSVG(FLYER_TEXT, el.classList.contains("west") ? "left" : "right", style);
    }
    return style;
  }

  /** Fly one across now — the previous one, if still up, lands. Returns the element. */
  launch({ dir = (this.props.random || Math.random)() < 0.5 ? -1 : 1, top = null } = {}) {
    const { random = Math.random, duration = 100000 } = this.props;
    for (const old of this.el.querySelectorAll(".blimp")) old.remove();
    const el = h("div", { className: "blimp " + (dir < 0 ? "west" : "east") + (this.style === "pixelated" ? " pixelated" : ""), dataset: { until: String(this.now + duration) } });
    el.style.top = (top ?? 2 + random() * 10) + "%";
    el.style.animationDuration = duration + "ms";
    el.append(
      h("span", { className: "ship", html: airshipHTML(this.style) }),
      h("span", { className: "flyer", style: { marginTop: FLYER_TOP + "px", [dir < 0 ? "marginLeft" : "marginRight"]: -OVERLAP + "px" }, html: bannerSVG(FLYER_TEXT, dir < 0 ? "left" : "right", this.style) }),   // the rope starts on the art's own axis line, a few px inside the ship's box
    );
    el.addEventListener("animationend", () => el.remove());
    this.el.append(el);
    this.flights = (this.flights || 0) + 1;
    return el;
  }
}
