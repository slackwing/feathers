/* GICard — a Greed Island card, drawn the way the show's cards are
   printed (measured from the Fandom scans, spec in docs/GI_CARD.md):
   a dark 63:88 card with rounded corners; a cream gi-plaque split into
   three outlined panels — number, name, rank-limit — whose gi-outline
   corners are replaced by riveted rings; a cream-framed 16:9
   illustration with a thin dark inner line; a foil-textured
   description gi-band (red for the 100 specified slot cards, blue for
   spells, yellow for free slots, black for game-master cards) with a
   white rounded gi-inset for the text. Every length is a percentage of
   the card's width (cqw), so one number — the width — sizes the whole
   card; nothing here is per-card code. Long names shrink to fit their
   gi-panel. */
import { Component } from "../os/component.js";
import { h, esc } from "../os/dom.js";
import "./card.css";

export const KINDS = {
  restricted: { foil: "#d4577c", foilHi: "#f7a4c0", foilLo: "#902a54" },   // the 100 specified slot cards: pink-red glitter
  spell:      { foil: "#4a72cf", foilHi: "#8fb2f2", foilLo: "#213d92" },   // the 40 spell cards
  free:       { foil: "#dcb43a", foilHi: "#f6dd7c", foilLo: "#a27f12" },   // free slots
  master:     { foil: "#2c2c31", foilHi: "#5d5d66", foilLo: "#0b0b0e" },   // game-master cards
};
export const LIMIT = { SS: 1, S: 1, A: 2, B: 3, C: 4 };   // conversion limit printed after the rank
export const NAME_MAX = 7.4, NAME_MIN = 3.2;              // name font size, in cqw, before and after shrinking

/** The foil mottle: turbulence tinted to the kind's colour, as a data-URI SVG that scales with the card. */
export function foilURI(kind) {
  const k = KINDS[kind] || KINDS.restricted;
  // fine fractal grain (the print's glitter is a few percent of the width), lit from hi to lo
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240">
    <filter id="f" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.07 0.09" numOctaves="4" seed="11"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.2 -0.55"/></filter>
    <filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.05 0.07" numOctaves="3" seed="3"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.8 -0.5"/></filter>
    <rect width="100%" height="100%" fill="${k.foil}"/>
    <rect width="100%" height="100%" fill="${k.foilHi}" filter="url(#f)"/>
    <rect width="100%" height="100%" fill="${k.foilLo}" filter="url(#g)" opacity=".85"/>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace(/\s+/g, " "));
}

/** The three-digit card number the plaque prints. */
export const cardNo = n => String(n ?? 0).padStart(3, "0");
export const rankLimit = rank => `${rank || "C"}-${LIMIT[rank] ?? 4}`;

/**
 * The plaque panel outline as an SVG path: a rectangle whose corners are
 * rings of radius r centred on the corner points — the outline runs
 * along each edge and bends around the inside of each ring; the rings
 * are drawn in full. Coordinates in a 1000-wide box; h is the height
 * in the same units. Stroked, never filled.
 */
export function panelPath(w, hh, r) {
  const A = (x, y, sweep) => `A ${r} ${r} 0 0 ${sweep} ${x} ${y}`;
  // the edge lines, each ending where they meet the corner rings
  const edges = `M ${r} 0 L ${w - r} 0 ${A(w, r, 0)} L ${w} ${hh - r} ${A(w - r, hh, 0)} L ${r} ${hh} ${A(0, hh - r, 0)} L 0 ${r} ${A(r, 0, 0)} Z`;
  // the rings themselves
  const ring = (cx, cy) => `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
  return `${edges} ${ring(0, 0)} ${ring(w, 0)} ${ring(w, hh)} ${ring(0, hh)}`;
}

export class GICard extends Component {
  /** props: no, name, rank, image (url|null), description, kind = "restricted", alt */
  render() {
    const p = this.props;
    const kind = KINDS[p.kind] ? p.kind : "restricted";
    // the outer box is the size container; its own lengths (radius) cannot use cqw, so the body inside does
    const el = h("div", { className: `gicard kind-${kind}`, dataset: { no: cardNo(p.no) } });
    this.body = h("div", { className: "gi-body" });
    el.append(this.body);
    this.body.style.setProperty("--foil", `url("${foilURI(kind)}")`);
    const panel = (cls, text) => h("div", { className: `gi-panel ${cls}` }, h("span", { className: "gi-txt", text }));
    this.plaque = h("div", { className: "gi-plaque" }, panel("no", cardNo(p.no)), panel("name", p.name || ""), panel("rank", rankLimit(p.rank)));
    // the outlines with riveted corners, one SVG per panel, drawn in the panel's own box
    for (const pn of this.plaque.children) pn.prepend(this.outline());
    this.frame = h("div", { className: "gi-frame" }, h("div", { className: "gi-pic" }, p.image ? h("img", { alt: p.alt || p.name || "", src: p.image, draggable: "false" }) : h("div", { className: "gi-nopic" })));
    this.band = h("div", { className: "gi-band" }, h("div", { className: "gi-inset" }, h("p", { className: "gi-desc", text: p.description || "" })));
    this.body.append(this.plaque, this.frame, this.band);
    this.nameEl = this.plaque.querySelector(".gi-panel.name .gi-txt");
    return el;
  }

  outline() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "gi-outline");
    svg.setAttribute("viewBox", "0 0 1000 1000");
    svg.setAttribute("preserveAspectRatio", "none");
    return svg;
  }

  onMount() { this.fit(); }

  /** Size each panel's outline to its box (rings must stay round, so the path is built in the box's own pixels) and shrink a long name. */
  fit() {
    if (!this.el) return;
    const cw = this.el.clientWidth;
    if (!cw) return;
    for (const pn of this.plaque.children) {
      const svg = pn.querySelector("svg.gi-outline");
      const w = pn.clientWidth, hh = pn.clientHeight;
      if (!w || !hh) continue;
      const stroke = cw * 0.0047, r = cw * 0.0075, inset = stroke / 2 + r;
      svg.setAttribute("viewBox", `0 0 ${w} ${hh}`);
      svg.innerHTML = `<path d="${panelPath(w - 2 * inset, hh - 2 * inset, r)}" transform="translate(${inset} ${inset})" fill="none" stroke="currentColor" stroke-width="${stroke}"/>`;
    }
    fitText(this.nameEl, cw * NAME_MAX / 100, cw * NAME_MIN / 100);
  }
}

/** Shrink el's font until its text fits its box (or the minimum). Returns the size used, in px. */
export function fitText(el, maxPx, minPx) {
  if (!el) return 0;
  let size = maxPx;
  el.style.fontSize = size + "px";
  const box = el.parentElement;
  let guard = 24;
  while (guard-- > 0 && size > minPx && el.scrollWidth > box.clientWidth - box.clientWidth * 0.08) {
    size = Math.max(minPx, size * 0.92);
    el.style.fontSize = size + "px";
  }
  return size;
}
