/* Blimp — Chairman Netero's airship, now and then, across the sky, towing
   a banner that says HUNTER × HALLOWEEN (Andrew, 2026-09-19/20). The ship
   is ABI'S DRAWING (`img/blimp.png`, 2026-09-24, in place of the vector
   one): the Hunter Association's airship as a side view flying WEST —
   shark-nosed blue hull, the ✕✕ plate, propeller masts along the spine, a
   cabin with lit windows, an engine pod and a stern propeller — on a
   transparent ground, smooth (the one thing on the desktop that is not
   pixel art). CSS flips it to fly east. The banner is a cloth whose edges
   and lettering ripple (SMIL, no script) on a rope from the tail. CSS
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
export const ART_W = 1289, ART_H = 955, ART_STERN_Y = 581;   // Abi's drawing: its pixels, and the hull's tail centreline (where the rope ties on)
export const SHIP_W = 480, SHIP_H = Math.round(SHIP_W * ART_H / ART_W), STERN_Y = Math.round(SHIP_W * ART_STERN_Y / ART_W);
export const BANNER_W = 320, BANNER_H = 70, ROPE = 44, ROPE_Y = 10;   // the rope starts at (0, ROPE_Y) of the banner box

let seq = 0;

/** The ship: Abi's drawing, nose to the LEFT (flying west), at SHIP_W × SHIP_H. CSS flips it to fly east. */
export function airshipHTML() {
  return `<img class="airship" src="${SHIP_SRC}" width="${SHIP_W}" height="${SHIP_H}" alt="" draggable="false" aria-hidden="true">`;
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
  const line = phases.map(p => poly(ripple(x0, x1, top + hgt / 2, amp, p))).join(";");   // the lettering rides the cloth's midline
  const hem = phases.map(p => poly(ripple(x0, x1, top + 3, amp, p))).join(";");
  const ropeD = rope === "left" ? `M 0 ${ROPE_Y} L ${ROPE} ${top + 2}` : `M ${BANNER_W} ${ROPE_Y} L ${BANNER_W - ROPE} ${top + 2}`;
  const dur = "1.5s";
  return `<svg class="banner" viewBox="0 0 ${BANNER_W} ${BANNER_H}" width="${BANNER_W}" height="${BANNER_H}" data-rope="${rope}" aria-hidden="true">
  <path class="rope" d="${ropeD}"/>
  <path class="cloth" d="${cloth.split(";")[0]}"><animate attributeName="d" values="${cloth}" dur="${dur}" repeatCount="indefinite"/></path>
  <path class="hem" d="${hem.split(";")[0]}"><animate attributeName="d" values="${hem}" dur="${dur}" repeatCount="indefinite"/></path>
  <defs><path id="${id}" d="${line.split(";")[0]}"><animate attributeName="d" values="${line}" dur="${dur}" repeatCount="indefinite"/></path></defs>
  <text class="lettering" dominant-baseline="central"><textPath href="#${id}" startOffset="50%" text-anchor="middle" dominant-baseline="central">${text}</textPath></text>
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
      h("span", { className: "flyer", style: { marginTop: (STERN_Y - ROPE_Y) + "px" }, html: bannerSVG(FLYER_TEXT, dir < 0 ? "left" : "right") }),   // the rope's start meets the stern
    );
    el.addEventListener("animationend", () => el.remove());
    this.el.append(el);
    this.flights = (this.flights || 0) + 1;
    return el;
  }
}
