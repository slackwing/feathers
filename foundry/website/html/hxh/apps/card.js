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

/* ---------- the foil's colour from the picture ----------
   Andrew (2026-09-19): marble the band in the picture's own interesting
   colours — reds, blues, greens and what lies between — not its skin,
   white or black. Pixels are kept when saturated and mid-light and not
   skin-toned; the strongest hue wins, a second hue darkens the veins. */
export const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
export const hslToHex = (h, s, l) => {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
};
export const isSkin = (h, s, l) => h >= 8 && h <= 45 && s <= 0.62 && l >= 0.35 && l <= 0.9;
export const isInteresting = (h, s, l) => s >= 0.32 && l >= 0.16 && l <= 0.82 && !isSkin(h, s, l);

/** The dominant interesting hues of an RGBA byte array (24 bins of 15°): { dominant: [h,s,l], second, count }. */
export function interestingPalette(data, { step = 1 } = {}) {
  const bins = Array.from({ length: 24 }, () => ({ w: 0, sx: 0, sy: 0, s: 0, l: 0, n: 0 }));
  let count = 0;
  for (let i = 0; i < data.length; i += 4 * step) {
    if (data[i + 3] < 128) continue;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (!isInteresting(h, s, l)) continue;
    const b = bins[Math.floor(h / 15) % 24], w = s * (1 - Math.abs(l - 0.5));
    b.w += w; b.sx += Math.cos(h * Math.PI / 180) * w; b.sy += Math.sin(h * Math.PI / 180) * w; b.s += s * w; b.l += l * w; b.n++;
    count++;
  }
  if (!count) return { dominant: null, second: null, count: 0 };
  const merged = bins.map((b, i) => {   // a bin with its neighbours, so a hue straddling a boundary still wins
    const p = bins[(i + 23) % 24], n = bins[(i + 1) % 24];
    return { i, w: b.w + p.w * 0.5 + n.w * 0.5, sx: b.sx + p.sx * 0.5 + n.sx * 0.5, sy: b.sy + p.sy * 0.5 + n.sy * 0.5, s: b.s + p.s * 0.5 + n.s * 0.5, l: b.l + p.l * 0.5 + n.l * 0.5 };
  });
  const hsl = m => [((Math.atan2(m.sy, m.sx) * 180 / Math.PI) + 360) % 360, m.s / m.w, m.l / m.w];
  const order = [...merged].sort((a, b) => b.w - a.w);
  const top = order[0];
  const far = order.find(m => m.w > 0 && Math.min(Math.abs(m.i - top.i), 24 - Math.abs(m.i - top.i)) >= 4);
  return { dominant: hsl(top), second: far && far.w >= top.w * 0.18 ? hsl(far) : null, count };
}

/** Foil colours (base, highlight, vein) from a palette; falls back to the kind's own when the picture has nothing interesting. */
export function foilFromPalette(pal, kind = "restricted") {
  if (!pal?.dominant) return KINDS[kind] || KINDS.restricted;
  const [h, s] = pal.dominant, sat = Math.min(0.85, Math.max(0.45, s * 1.15));
  const veinH = pal.second ? pal.second[0] : h;
  return { foil: hslToHex(h, sat, 0.5), foilHi: hslToHex(h, sat * 0.9, 0.72), foilLo: hslToHex(veinH, sat, 0.28) };
}

const paletteCache = new Map();
/** Read a same-origin picture into a small canvas and pick its palette (null when it cannot be read). */
export function paletteOfImage(img, doc = document) {
  const key = img.currentSrc || img.src;
  if (paletteCache.has(key)) return paletteCache.get(key);
  let pal = null;
  try {
    const c = doc.createElement("canvas");
    c.width = 64; c.height = 36;
    const ctx = c.getContext("2d");
    if (ctx) { ctx.drawImage(img, 0, 0, 64, 36); pal = interestingPalette(ctx.getImageData(0, 0, 64, 36).data); }
  } catch { pal = null; }
  paletteCache.set(key, pal);
  return pal;
}

/** The foil mottle: fine turbulence tinted with the given colours (or a kind's), as a data-URI SVG that scales with the card. */
export function foilURI(kind) {
  const k = typeof kind === "object" && kind ? kind : (KINDS[kind] || KINDS.restricted);
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
    this.setFoil(KINDS[kind]);
    const panel = (cls, text) => h("div", { className: `gi-panel ${cls}` }, h("span", { className: "gi-txt", text }));
    this.plaque = h("div", { className: "gi-plaque" }, panel("no", cardNo(p.no)), panel("name", p.name || ""), panel("rank", rankLimit(p.rank)));
    // the outlines with riveted corners, one SVG per panel, drawn in the panel's own box
    for (const pn of this.plaque.children) pn.prepend(this.outline());
    this.img = p.image ? h("img", { alt: p.alt || p.name || "", src: p.image, draggable: "false" }) : null;
    this.frame = h("div", { className: "gi-frame" }, h("div", { className: "gi-pic" }, this.img || h("div", { className: "gi-nopic" })));
    // the band takes the picture's colours once it is in (Andrew's marbling)
    if (this.img && p.foilFrom !== "kind") {
      const paint = () => { const pal = paletteOfImage(this.img, this.img.ownerDocument); if (pal?.dominant) this.setFoil(foilFromPalette(pal, kind)); };
      if (this.img.complete && this.img.naturalWidth) paint(); else this.img.addEventListener("load", paint, { once: true });
    }
    this.band = h("div", { className: "gi-band" }, h("div", { className: "gi-inset" }, h("p", { className: "gi-desc", text: p.description || "" })));
    this.body.append(this.plaque, this.frame, this.band);
    this.nameEl = this.plaque.querySelector(".gi-panel.name .gi-txt");
    return el;
  }

  /** Colour the band: { foil, foilHi, foilLo }. */
  setFoil(colors) {
    this.foil = colors;
    this.body.style.setProperty("--foil", `url("${foilURI(colors)}")`);
    this.body.style.setProperty("--foil-base", colors.foil);
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
