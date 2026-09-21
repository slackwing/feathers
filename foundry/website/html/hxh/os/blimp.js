/* Blimp — Chairman Netero's airship, now and then, across the sky, towing
   a banner that says HUNTER × HALLOWEEN (Andrew, 2026-09-19/20). After the
   Hunter Association's ship in the show: a long pale hull with a rounded
   nose and tapered tail, cross fins, a stern propeller, and a cabin slung
   under the belly with a row of lit windows. Drawn as smooth vector SVG —
   full resolution on purpose, the one thing on the desktop that is not
   pixel art — in the THEME's colours (hull = window surface, stripe =
   active title bar, cabin = inactive title bar, windows = field), so it
   changes dress with Settings › Display › Theme. The banner is a cloth
   whose edges and lettering ripple (SMIL, no script) on a rope from the
   tail. CSS animates the flight from one edge to the other, behind every
   window and icon, above the wallpaper. Spawns at a random interval (4–9
   min by default), never under reduced motion; `launch()` flies one now.

   ONE flight at a time, and none while the page is hidden (Andrew came
   home to fifty of them, 2026-09-20: a background tab keeps its timers
   but not its animations, so nothing ever ended and every booked flight
   piled up at the edges). A new launch removes the previous ship; a
   flight that should long have ended is purged when the page is looked
   at again. */
import { Component } from "./component.js";
import { h } from "./dom.js";

export const FLYER_TEXT = "HUNTER × HALLOWEEN";
export const SHIP_W = 260, SHIP_H = 104;
export const BANNER_W = 300, BANNER_H = 64, ROPE = 40;

let seq = 0;

/** The airship, nose pointing east (flipped by CSS to fly west). */
export function airshipSVG() {
  return `<svg class="airship" viewBox="0 0 ${SHIP_W} ${SHIP_H}" width="${SHIP_W}" height="${SHIP_H}" aria-hidden="true">
  <g class="fins"><path d="M 34 30 L 10 6 L 52 18 Z"/><path d="M 34 54 L 10 78 L 52 66 Z"/><path d="M 30 39 L 8 39 L 8 45 L 30 45 Z"/></g>
  <g class="prop"><line x1="10" y1="42" x2="10" y2="42"/><ellipse class="blade" cx="10" cy="42" rx="2.5" ry="13"><animateTransform attributeName="transform" type="rotate" from="0 10 42" to="360 10 42" dur="0.5s" repeatCount="indefinite"/></ellipse><circle cx="10" cy="42" r="3"/></g>
  <path class="hull" d="M 22 42 C 22 16, 96 8, 158 8 C 214 8, 250 24, 252 42 C 250 60, 214 76, 158 76 C 96 76, 22 68, 22 42 Z"/>
  <path class="stripe" d="M 44 50 C 110 66, 200 66, 244 50 L 243 56 C 200 72, 110 72, 46 56 Z"/>
  <path class="sheen" d="M 60 22 C 110 14, 180 14, 226 26"/>
  <g class="struts"><line x1="100" y1="74" x2="104" y2="84"/><line x1="172" y1="74" x2="168" y2="84"/><line x1="136" y1="76" x2="136" y2="84"/></g>
  <rect class="cabin" x="82" y="82" width="112" height="18" rx="5"/>
  <g class="windows">${[92, 108, 124, 140, 156, 172].map(x => `<rect x="${x}" y="87" width="9" height="8" rx="1.5"/>`).join("")}</g>
</svg>`;
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
  const top = 18, hgt = 30, amp = 3.5;
  const phases = [0, 2.1, 4.2, 0];
  const cloth = phases.map(p => poly(ripple(x0, x1, top, amp, p)) + " " + poly(ripple(x0, x1, top + hgt, amp, p).reverse(), "L") + " Z").join(";");
  const line = phases.map(p => poly(ripple(x0, x1, top + hgt * 0.62, amp, p))).join(";");
  const hem = phases.map(p => poly(ripple(x0, x1, top + 3, amp, p))).join(";");
  const ropeD = rope === "left" ? `M 0 ${top - 6} L ${ROPE} ${top + 2}` : `M ${BANNER_W} ${top - 6} L ${BANNER_W - ROPE} ${top + 2}`;
  const dur = "1.5s";
  return `<svg class="banner" viewBox="0 0 ${BANNER_W} ${BANNER_H}" width="${BANNER_W}" height="${BANNER_H}" data-rope="${rope}" aria-hidden="true">
  <path class="rope" d="${ropeD}"/>
  <path class="cloth" d="${cloth.split(";")[0]}"><animate attributeName="d" values="${cloth}" dur="${dur}" repeatCount="indefinite"/></path>
  <path class="hem" d="${hem.split(";")[0]}"><animate attributeName="d" values="${hem}" dur="${dur}" repeatCount="indefinite"/></path>
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

  /** Fly one across now — the previous one, if still up, lands. Returns the element. */
  launch({ dir = (this.props.random || Math.random)() < 0.5 ? -1 : 1, top = null } = {}) {
    const { random = Math.random, duration = 100000 } = this.props;
    for (const old of this.el.querySelectorAll(".blimp")) old.remove();
    const el = h("div", { className: "blimp " + (dir < 0 ? "west" : "east"), dataset: { until: String(this.now + duration) } });
    el.style.top = (top ?? 5 + random() * 16) + "%";
    el.style.animationDuration = duration + "ms";
    el.append(
      h("span", { className: "ship", html: airshipSVG() }),
      h("span", { className: "flyer", html: bannerSVG(FLYER_TEXT, dir < 0 ? "left" : "right") }),
    );
    el.addEventListener("animationend", () => el.remove());
    this.el.append(el);
    this.flights = (this.flights || 0) + 1;
    return el;
  }
}
