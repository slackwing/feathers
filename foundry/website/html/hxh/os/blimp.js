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
export const SHIP_W = 440, SHIP_H = 190;
export const BANNER_W = 320, BANNER_H = 70, ROPE = 44;

let seq = 0;

/* The hull outline, nose to the LEFT (the reference is a side view flying
   left); reused as a clip for the nose paint and the panel lines. */
const HULL = "M 18 92 C 18 46, 78 22, 176 22 C 280 22, 368 44, 416 88 C 372 132, 280 156, 176 156 C 78 156, 18 136, 18 92 Z";

/**
 * The Hunter Association's airship from the show (Andrew's reference is
 * a night shot; colours are its daylight ones): a long blue hull, its
 * nose painted black as a grinning shark — white sawtooth teeth, an angry
 * white eye — the Association's ✕✕ plate on the flank, a row of
 * propeller masts along the spine, a long cabin slung under the belly
 * with a run of lit windows, an engine pod astern, cross fins and a stern
 * propeller. Smooth vector; fixed colours (this is the show's ship, not
 * the theme's). Nose left = flying west; CSS flips it to fly east.
 */
export function airshipSVG() {
  const id = "ship" + (++seq);
  const teeth = (x0, y, n, w, h, up) => { let d = `M ${x0} ${y}`; for (let i = 0; i < n; i++) d += ` L ${x0 + w * (i + 0.5)} ${up ? y - h : y + h} L ${x0 + w * (i + 1)} ${y}`; return d + " Z"; };
  const masts = [150, 205, 260, 315].map(x => `<g class="mast"><line x1="${x}" y1="24" x2="${x}" y2="6"/><line x1="${x - 12}" y1="6" x2="${x + 12}" y2="6"/><circle cx="${x}" cy="6" r="2.4"/></g>`).join("");
  const windows = Array.from({ length: 11 }, (_, i) => `<rect x="${118 + i * 12}" y="158" width="7" height="6" rx="1"/>`).join("");
  return `<svg class="airship" viewBox="0 0 ${SHIP_W} ${SHIP_H}" width="${SHIP_W}" height="${SHIP_H}" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc0f2"/><stop offset=".35" stop-color="#3e8ed6"/><stop offset=".75" stop-color="#2a68ad"/><stop offset="1" stop-color="#173f6f"/></linearGradient>
    <clipPath id="${id}-clip"><path d="${HULL}"/></clipPath>
  </defs>
  <g class="fins"><path d="M 352 40 L 404 4 L 412 74 Z"/><path d="M 352 138 L 404 174 L 412 104 Z"/><path d="M 372 84 L 436 78 L 436 96 L 372 100 Z"/></g>
  <g class="masts">${masts}</g>
  <path class="hull" d="${HULL}" fill="url(#${id}-hull)"/>
  <g clip-path="url(#${id}-clip)">
    <path class="nose" d="M -10 -10 H 128 C 110 40, 110 140, 128 200 H -10 Z"/>
    <path class="teeth" d="${teeth(24, 98, 8, 12.5, 15, false)}"/>
    <path class="teeth lower" d="${teeth(38, 128, 6, 12.5, 12, true)}"/>
    <path class="gum" d="M 22 98 C 60 96, 100 92, 124 88"/>
    <ellipse class="eye" cx="88" cy="58" rx="16" ry="9"/>
    <circle class="pupil" cx="92" cy="60" r="5"/>
    <path class="brow" d="M 66 50 L 104 46"/>
    <path class="panel" d="M 140 40 C 220 30, 320 36, 400 70"/>
    <path class="panel" d="M 136 132 C 220 146, 320 140, 400 106"/>
    <path class="sheen" d="M 150 34 C 230 26, 320 30, 380 52"/>
  </g>
  <path class="outline" d="${HULL}"/>
  <g class="plate"><rect x="150" y="50" width="58" height="40" rx="3"/><path d="M 158 58 L 174 82 M 174 58 L 158 82 M 184 58 L 200 82 M 200 58 L 184 82"/></g>
  <g class="struts"><line x1="130" y1="150" x2="126" y2="166"/><line x1="185" y1="154" x2="185" y2="166"/><line x1="240" y1="150" x2="244" y2="166"/><line x1="322" y1="146" x2="326" y2="160"/></g>
  <rect class="cabin" x="108" y="150" width="150" height="22" rx="6"/>
  <g class="windows">${windows}</g>
  <rect class="pod" x="308" y="152" width="40" height="18" rx="6"/>
  <g class="prop pod-prop"><ellipse cx="352" cy="161" rx="2" ry="10"><animateTransform attributeName="transform" type="rotate" from="0 352 161" to="360 352 161" dur="0.45s" repeatCount="indefinite"/></ellipse><circle cx="352" cy="161" r="2.5"/></g>
  <g class="prop stern"><ellipse cx="424" cy="88" rx="2.5" ry="16"><animateTransform attributeName="transform" type="rotate" from="0 424 88" to="360 424 88" dur="0.5s" repeatCount="indefinite"/></ellipse><circle cx="424" cy="88" r="3.5"/></g>
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
  const top = 16, hgt = 40, amp = 3.5;
  const phases = [0, 2.1, 4.2, 0];
  const cloth = phases.map(p => poly(ripple(x0, x1, top, amp, p)) + " " + poly(ripple(x0, x1, top + hgt, amp, p).reverse(), "L") + " Z").join(";");
  const line = phases.map(p => poly(ripple(x0, x1, top + hgt / 2, amp, p))).join(";");   // the lettering rides the cloth's midline
  const hem = phases.map(p => poly(ripple(x0, x1, top + 3, amp, p))).join(";");
  const ropeD = rope === "left" ? `M 0 ${top - 6} L ${ROPE} ${top + 2}` : `M ${BANNER_W} ${top - 6} L ${BANNER_W - ROPE} ${top + 2}`;
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

  /** Fly one across now — the previous one, if still up, lands. Returns the element. */
  launch({ dir = (this.props.random || Math.random)() < 0.5 ? -1 : 1, top = null } = {}) {
    const { random = Math.random, duration = 100000 } = this.props;
    for (const old of this.el.querySelectorAll(".blimp")) old.remove();
    const el = h("div", { className: "blimp " + (dir < 0 ? "west" : "east"), dataset: { until: String(this.now + duration) } });
    el.style.top = (top ?? 4 + random() * 14) + "%";
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
